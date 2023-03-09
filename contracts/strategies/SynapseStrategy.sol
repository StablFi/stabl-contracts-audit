// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Synapse Strategy
 * @notice Investment strategy for investing stablecoins via Synapse
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IPool } from "./../connectors/synapse/IPool.sol";
import { IStakerPool } from "./../connectors/synapse/IStakerPool.sol";
import { StableMath } from "../utils/StableMath.sol";
import { DystopiaExchange } from "./DystopiaExchange.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import "../exchanges/CurveExchange.sol";
import "../interfaces/IMiniVault.sol";
import "../interfaces/IOracle.sol";
import "hardhat/console.sol";

contract SynapseStrategy is InitializableAbstractStrategy, DystopiaExchange, CurveExchange {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using OvnMath for uint256;

    uint256 internal constant maxSlippage = 1e16; // 1%
    address internal pTokenAddress;

    IERC20 public primaryStable;
    IERC20 public synToken;
    IERC20 public intermediateToken; // USDPlus

    IPool public synapsePool;
    IStakerPool public synapseStakerPool;
    uint256 public synapseStakerPoolId;
    uint256 public unused;

    address public oracleRouter;

    IERC20 public token0;
    address public curvePool;
    mapping(address => int128) internal curvePoolIndices;
    bool public isDirectDepositAllowed;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Synapse strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the nUSD
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of USDC
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                USDC
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address _platformAddress, // nUSD Token address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC
        address[] calldata _pTokens, // nUSD Token address
        address _synToken,
        address _synapsePool,
        address _synapseStakerPool,
        uint256 _synapseStakerPoolId
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        pTokenAddress = _pTokens[0];

        synToken = IERC20(_synToken);
        synapsePool = IPool(_synapsePool);
        synapseStakerPool = IStakerPool(_synapseStakerPool);
        synapseStakerPoolId = _synapseStakerPoolId;
        isDirectDepositAllowed = true;
        token0 = IERC20(_assets[0]);
        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
    }

    function _setRouterAndPrimaryStable(
        address _dystRouter,
        address _intermediateToken,
        address _primaryStable
    ) external onlyGovernor {
        require(_dystRouter != address(0), "!0");
        require(_intermediateToken != address(0), "!0");
        intermediateToken = IERC20(_intermediateToken);
        _setDystopiaRouter(_dystRouter);
        primaryStable = IERC20(_primaryStable);
    }

    function setDirectDepositAllowed(bool _isDirectDepositAllowed) external onlyGovernor {
        isDirectDepositAllowed = _isDirectDepositAllowed;
    }

    function setCurvePool(address _curvePool, address[] calldata tokens) external onlyGovernor {
        curvePool = _curvePool;
        curvePoolIndices[tokens[0]] = 0;
        curvePoolIndices[tokens[1]] = 1;
        curvePoolIndices[tokens[2]] = 2;
    }

    function poolBalanceCheckExponent() external view returns (uint256) {
        return IMiniVault(vaultAddress).poolBalanceCheckExponent();
    }

    function setOracleRouter() external onlyVaultOrGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function directDeposit() external onlyVault {
        uint256 tokenIndex = synapsePool.getTokenIndex(address(token0));
        uint256 _amount = token0.balanceOf(address(this));
        uint256[] memory _amounts = new uint256[](4);
        _amounts[tokenIndex] = _amount;
        uint256 _minToMint = _amount.subBasisPoints(4);
        token0.approve(address(synapsePool), _amount);
        synapsePool.addLiquidity(_amounts, _minToMint, block.timestamp);
        _stakeLP();
        emit Deposit(address(token0), address(platformAddress), token0.balanceOf(address(this)));
    }

    function directDepositRequirement(uint256 _psAmount) external view onlyVault returns (uint256) {
        if (address(token0) == address(primaryStable)) {
            return _psAmount;
        }
        return howMuchToSwap(curvePool, address(token0), address(primaryStable), _psAmount);
    }

    function _arrangeLP(uint256 _amount) internal {
        if (IERC20(pTokenAddress).balanceOf(address(this)) < _amount) {
            _unstakeLP(_amount - IERC20(pTokenAddress).balanceOf(address(this)));
        }
    }

    function _stakeLP() internal {
        IERC20(pTokenAddress).approve(address(synapseStakerPool), IERC20(pTokenAddress).balanceOf(address(this)));
        synapseStakerPool.deposit(synapseStakerPoolId, IERC20(pTokenAddress).balanceOf(address(this)), address(this));
    }

    function _unstakeLP(uint256 _amount) internal {
        synapseStakerPool.withdraw(synapseStakerPoolId, _amount, address(this));
    }

    function deposit(address _asset, uint256 _amount) external override onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, address(platformAddress), _amount);
        _swapPrimaryStableToToken0();
        uint256 _tokenIndex = synapsePool.getTokenIndex(address(primaryStable));
        uint256[] memory _amounts = new uint256[](4);
        _amounts[_tokenIndex] = _amount.subBasisPoints(4);
        uint256 _minToMint = synapsePool.calculateTokenAmount(_amounts, true);
        _amounts[_tokenIndex] = _amount;
        token0.approve(address(synapsePool), _amount);
        synapsePool.addLiquidity(_amounts, _minToMint, block.timestamp);
        _stakeLP();
    }

    function depositAll() external view override onlyVault {
        revert("Not implemented");
    }

    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");

        uint256[] memory _amounts = new uint256[](4);
        uint256 _tokenIndex = synapsePool.getTokenIndex(_asset);
        _amounts[_tokenIndex] = _amount.addBasisPoints(4);
        uint256 _lpToWithdraw = synapsePool.calculateTokenAmount(_amounts, false);
        if (_lpToWithdraw > lpBalance()) {
            _withdrawAll();
        } else {
            _arrangeLP(_lpToWithdraw);
            synapsePool.removeLiquidityOneToken(_lpToWithdraw, uint8(_tokenIndex), _amount, block.timestamp);
        }
        // We will always be getting primary stable from Synapse, no swapping needed
        uint256 _psBalance = primaryStable.balanceOf(address(this));
        require(_psBalance >= _amount, "Synapse - Not enough balance");
        primaryStable.safeTransfer(_beneficiary, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _withdrawAll();
        primaryStable.safeTransfer(vaultAddress, primaryStable.balanceOf(address(this)));
    }

    function _withdrawAll() internal {
        if (lpBalance() == 0) {
            return;
        }
        _arrangeLP(lpBalance());
        uint256 _tokenIndex = synapsePool.getTokenIndex(address(primaryStable));
        uint256 _assetBalance = synapsePool.calculateRemoveLiquidityOneToken(lpBalance(), uint8(_tokenIndex));

        IERC20(platformAddress).approve(address(synapsePool), lpBalance());
        synapsePool.removeLiquidityOneToken(lpBalance(), uint8(_tokenIndex), _assetBalance, block.timestamp);
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        (uint256 amount, ) = synapseStakerPool.userInfo(synapseStakerPoolId, address(this));
        if (amount == 0) {
            return;
        }
        synapseStakerPool.harvest(synapseStakerPoolId, address(this));
        uint256 synBalance = synToken.balanceOf(address(this));
        console.log("RewardCollection - SYN Balance: ", synBalance);

        uint256 _initPSBalance = primaryStable.balanceOf(address(this));
        if (synBalance > 0) {
            _swapExactTokensForTokens(address(synToken), address(intermediateToken), address(primaryStable), false, true, synBalance, address(this));
        }
        _initPSBalance = primaryStable.balanceOf(address(this)) - _initPSBalance; // Reusing variable
        console.log("RewardCollection - SYN -> USDP -> USDC Balance: ", _initPSBalance);

        if (_initPSBalance > 0) {
            emit RewardTokenCollected(harvesterAddress, address(primaryStable), _initPSBalance);
            primaryStable.transfer(harvesterAddress, _initPSBalance);
        }
    }

    function lpBalance() public view returns (uint256) {
        (uint256 _amount, ) = synapseStakerPool.userInfo(synapseStakerPoolId, address(this));
        return _amount + IERC20(pTokenAddress).balanceOf(address(this));
    }

    function checkBalance() public view override returns (uint256) {
        uint256 _tokenIndex = synapsePool.getTokenIndex(address(primaryStable));
        uint256 _psBalance = primaryStable.balanceOf(address(this));
        if (lpBalance() > 0) {
            _psBalance += synapsePool.calculateRemoveLiquidityOneToken(lpBalance(), uint8(_tokenIndex));
        }
        return _psBalance;
    }

    function netAssetValue() external view returns (uint256) {
        return checkBalance(); // We are always be getting PS from Synapse. No swapping needed
    }

    function supportsAsset(address _asset) external view override returns (bool) {
        return _asset == address(primaryStable);
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(curvePool, address(primaryStable), address(token0), primaryStableBalance, oracleRouter);
        }
    }

    /* NOT NEEDED */
    function safeApproveAllTokens() external override {}

    function _abstractSetPToken(address _asset, address _cToken) internal override {}
}
