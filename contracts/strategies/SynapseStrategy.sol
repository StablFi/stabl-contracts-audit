// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Synapse Strategy
 * @notice Investment strategy for investing stablecoins via Synapse
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IPool } from "./../connectors/synapse/IPool.sol";
import { IStakerPool } from "./../connectors/synapse/IStakerPool.sol";
import { StableMath } from "../utils/StableMath.sol";
import { DystopiaExchange } from "./DystopiaExchange.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { OvnMath } from "../utils/OvnMath.sol";

import "hardhat/console.sol";



contract SynapseStrategy is InitializableAbstractStrategy, DystopiaExchange {
    using SafeMath for uint256;
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
        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }
    function _setRouterAndPrimaryStable(address _dystRouter, address _intermediateToken, address _primaryStable) external onlyGovernor {
        require(_dystRouter != address(0), "Zero address not allowed");
        require(_intermediateToken != address(0), "Zero address not allowed");
        intermediateToken = IERC20(_intermediateToken);
        _setDystopiaRouter(_dystRouter);
        primaryStable = IERC20(_primaryStable);
    }
    function stakeLP() internal  {
        IERC20(pTokenAddress).approve(address(synapseStakerPool), IERC20(pTokenAddress).balanceOf(address(this)));
        synapseStakerPool.deposit(synapseStakerPoolId, IERC20(pTokenAddress).balanceOf(address(this)), address(this));
    }

    function unstakeLP(uint256 _amount) internal  {
        synapseStakerPool.withdraw(synapseStakerPoolId, _amount, address(this));

    }
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == address(primaryStable), "Token not supported.");
        require(_amount >= IERC20(_asset).balanceOf(address(this)), "Not enough assets");
        require(_amount > 0, "Must deposit something");
        // console.log("Depositing ", _amount, " primaryStable tokens to Synapse");
        emit TransferLog("Depositing to Synapse: ", _asset, _amount);


        emit Deposit(_asset, address(platformAddress), _amount);
        uint256 tokenIndex = synapsePool.getTokenIndex(_asset);
        uint256[] memory _amounts = new uint256[](4);
        _amounts[tokenIndex] = _amount.subBasisPoints(4);
        uint256 minToMint = synapsePool.calculateTokenAmount(_amounts, true);
        _amounts[tokenIndex] = _amount;
        IERC20(_asset).approve(address(synapsePool), _amount);
        synapsePool.addLiquidity(_amounts, minToMint, block.timestamp);
        stakeLP();
    }
    function depositAll() external override onlyVault nonReentrant {
        uint256[] memory _amounts = new uint256[](4);
        uint256[] memory _amounts_to_deposit = new uint256[](4);
        uint256 tokenIndex;
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            tokenIndex = synapsePool.getTokenIndex(assetsMapped[i]);
            address assetAddress = assetsMapped[i];
            uint256 balance = IERC20(assetAddress).balanceOf(address(this));
            emit TransferLog("Depositing all to Synapse: ", assetAddress, balance);
            if (balance > 0) {
                _amounts[tokenIndex] = balance.subBasisPoints(4);
                _amounts_to_deposit[tokenIndex] = balance;
                IERC20(assetsMapped[i]).approve(address(synapsePool), balance);

            }
        }
        uint256 minToMint = synapsePool.calculateTokenAmount(_amounts, true);
        synapsePool.addLiquidity(_amounts_to_deposit, minToMint, block.timestamp);
        stakeLP();
    }

    
    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant  {
        require(_asset == address(primaryStable), "Token not supported.");

        uint256[] memory _amounts = new uint256[](4);
        uint256 tokenIndex = synapsePool.getTokenIndex(_asset);
        _amounts[tokenIndex] = _amount.addBasisPoints(4) + 1;

        uint256 balanceLP = synapsePool.calculateTokenAmount(_amounts, false);
        (uint256 amount,) = synapseStakerPool.userInfo(synapseStakerPoolId, address(this));
        if (balanceLP > amount) {
            balanceLP = amount;
        }

        unstakeLP(balanceLP);
        IERC20(pTokenAddress).approve(address(synapsePool), balanceLP);
        synapsePool.removeLiquidityOneToken(balanceLP, uint8(tokenIndex), _amount, block.timestamp);

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("Withdrawing from the Synapse: ", primaryStableBalance);
        if (primaryStableBalance > 0) {
            primaryStable.safeTransfer(_beneficiary, primaryStableBalance);
        }

    }
    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {

        (uint256 amount,) = synapseStakerPool.userInfo(synapseStakerPoolId, address(this));
        if (amount == 0) {
            return;
        }
        uint256 tokenIndex = synapsePool.getTokenIndex(address(primaryStable));
        synapseStakerPool.withdraw(synapseStakerPoolId, amount, address(this));
        uint256 assetBalance = synapsePool.calculateRemoveLiquidityOneToken(amount, uint8(tokenIndex));
        IERC20(platformAddress).approve(address(synapsePool), amount);
        synapsePool.removeLiquidityOneToken(amount, uint8(tokenIndex), assetBalance, block.timestamp);

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("Withdrawing everthing from the Synapse: ", primaryStableBalance);
        if (primaryStableBalance > 0) {
            primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
        }

    }
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        (uint256 amount,) = synapseStakerPool.userInfo(synapseStakerPoolId, address(this));
        // console.log("synapseStakerPool.userInfo - Collecting reward tokens: ", amount);
        if (amount == 0) {
            return;
        }
        synapseStakerPool.harvest(synapseStakerPoolId, address(this));

        // sell rewards
        uint256 totalPrimaryStable;
        uint256 synBalance = synToken.balanceOf(address(this));
        // console.log("Synapse balance: ", synBalance);
        if (synBalance > 0) {
            uint256 synToPrimaryStable = _swapExactTokensForTokens(
                address(synToken),
                address(intermediateToken),
                address(primaryStable),
                false,
                true,
                synBalance,
                address(this)
            );
            // console.log( "USDP: " , intermediateToken.balanceOf(address(this)) );
            // console.log( "USDC: " , primaryStable.balanceOf(address(this)) );
            // console.log("Synapse usdc: ", synToPrimaryStable);
            totalPrimaryStable += synToPrimaryStable;
        }

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (primaryStableBalance > 0) {
            emit RewardTokenCollected(
                harvesterAddress,
                address(primaryStable),
                primaryStableBalance
            );
            primaryStable.transfer(harvesterAddress, primaryStableBalance);
        }
    }
    function checkBalance()
        external
        view
        override
        returns (uint256)
    {
        uint256 tokenIndex = synapsePool.getTokenIndex(address(primaryStable));
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));

        (uint256 amount,) = synapseStakerPool.userInfo(synapseStakerPoolId, address(this));
        if (amount > 0) {
            primaryStableBalance += synapsePool.calculateRemoveLiquidityOneToken(amount, uint8(tokenIndex));
        }
        return primaryStableBalance;
    }
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(primaryStable);
    }
    /* NOT NEEDED */
    function safeApproveAllTokens() external override  {}
    function _abstractSetPToken(address _asset, address _cToken)internal override {}
}
