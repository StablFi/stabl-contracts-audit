// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Aave Strategy
 * @notice Investment strategy for investing stablecoins via Aave
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ILendingPool } from "../connectors/aave/interfaces/ILendingPool.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import "../exchanges/CurveExchange.sol";
import "../interfaces/IMiniVault.sol";
import "../interfaces/IOracle.sol";

contract AaveSupplyStrategy is InitializableAbstractStrategy, CurveExchange {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using OvnMath for uint256;

    address internal pTokenAddress;

    IERC20 public token0;
    IERC20 public primaryStable;

    ILendingPool public pool;
    IERC20 public aToken;
    uint256 public storedATokenBalance;

    address public oracleRouter;

    address public curvePool;
    mapping(address => int128) internal curvePoolIndices;

    bool public isDirectDepositAllowed;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Aave strategy doesn't fit
     * well within that abstraction.
     * @param _platformAddress Address of aToken
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of USDC
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                USDC
     * @param _pTokens Platform Token corresponding addresses
     * @param _primaryStable Primary Stable address (USDC)
     * @param _aaveContracts Aave pool and aToken
     */
    function initialize(
        address _platformAddress, // aToken address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC / DAI / USDT
        address[] calldata _pTokens, // aToken address
        address _primaryStable,
        address[] calldata _aaveContracts // AavePool, aToken (in order)
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        pTokenAddress = _pTokens[0];

        token0 = IERC20(_assets[0]);
        primaryStable = IERC20(_primaryStable); // Primary stable

        pool = ILendingPool(_aaveContracts[0]);
        aToken = IERC20(_aaveContracts[1]);

        isDirectDepositAllowed = true;
        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
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

    function setOracleRouter() external onlyVaultOrGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function poolBalanceCheckExponent() external view returns (uint256) {
        return IMiniVault(vaultAddress).poolBalanceCheckExponent();
    }

    function directDeposit() external onlyVault {
        _stake(token0.balanceOf(address(this)));

        emit Deposit(address(token0), address(platformAddress), token0.balanceOf(address(this)));
    }

    function directDepositRequirement(uint256 _psAmount) external view onlyVault returns (uint256) {
        if (address(token0) == address(primaryStable)) {
            return _psAmount;
        }
        return howMuchToSwap(curvePool, address(token0), address(primaryStable), _psAmount);
    }

    function deposit(address _asset, uint256 _amount) external  onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        require(_amount > 0, "Must deposit something");
        _swapPrimaryStableToToken0();
        _stake(token0.balanceOf(address(this)));

        emit Deposit(_asset, address(platformAddress), token0.balanceOf(address(this)));
    }

    function _stake(uint256 _amount) internal {
        token0.approve(address(pool), _amount);
        storedATokenBalance += _amount;
        pool.supply(address(token0), _amount, address(this), 0);
    }

    function depositAll() public  onlyVault nonReentrant {
        _stake(token0.balanceOf(address(this)));
    }

    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external  onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        uint256 _eq = _equivalentInToken0(_amount);
        uint256 numberOfShares = _eq.addBasisPoints(40);
        if (numberOfShares > storedATokenBalance) {
            numberOfShares = storedATokenBalance;
        }
        if (numberOfShares > 0) {
            storedATokenBalance -= numberOfShares;
            pool.withdraw(address(token0), numberOfShares, address(this));
        }

        _swapAssetToPrimaryStable();
        require(primaryStable.balanceOf(address(this)) >= _amount, "AAVE: Not enough balance");
        primaryStable.safeTransfer(_beneficiary, _amount);
    }

    function _equivalentInToken0(uint256 _amount) internal view returns (uint256) {
        uint256 _eq = _amount;
        if (address(primaryStable) != address(token0)) {
            _eq = onSwap(curvePool, address(primaryStable), address(token0), _amount);
        }
        return _eq;
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external  onlyVault nonReentrant {
        if (lpBalance() > 0) {
            storedATokenBalance = 0;
            pool.withdraw(address(token0), type(uint256).max, address(this));
        }

        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        if (lpBalance() == 0) {
            return;
        }

        uint256 interest = lpBalance() - storedATokenBalance;
        if (interest > 0) {
            uint256 beforeBal = primaryStable.balanceOf(address(this));

            pool.withdraw(address(token0), interest, address(this));
            _swapAssetToPrimaryStable();

            uint256 afterBal = primaryStable.balanceOf(address(this)) - beforeBal;
            if (afterBal > 0) {
                primaryStable.transfer(harvesterAddress, afterBal);
                emit RewardTokenCollected(harvesterAddress, address(primaryStable), afterBal);
            }
        }
    }

    function checkBalance() external view  returns (uint256) {
        uint256 balanceWithInvestments = storedATokenBalance;

        // swap to PrimaryStable
        if (address(token0) != address(primaryStable) && balanceWithInvestments > 0) {
            balanceWithInvestments = onSwap(curvePool, address(token0), address(primaryStable), balanceWithInvestments);
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function netAssetValue() external view returns (uint256) {
        uint256 balanceWithInvestments = storedATokenBalance;
        if (address(token0) != address(primaryStable) && balanceWithInvestments > 0) {
            balanceWithInvestments = _convert(address(token0), address(primaryStable), balanceWithInvestments).scaleBy(
                Helpers.getDecimals(address(primaryStable)),
                Helpers.getDecimals(address(token0))
            );
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function lpBalance() public view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    function _convert(
        address from,
        address to,
        uint256 _amount,
        bool limit
    ) internal view returns (uint256) {
        if (from == to) {
            return _amount;
        }
        uint256 fromPrice = IOracle(oracleRouter).price(from);
        uint256 toPrice = IOracle(oracleRouter).price(to);
        if ((toPrice > 10**8) && limit) {
            toPrice = 10**8;
        }
        return (_amount * fromPrice) / toPrice;
    }

    function _convert(
        address from,
        address to,
        uint256 _amount
    ) internal view returns (uint256) {
        return _convert(from, to, _amount, true);
    }

    function _swapAssetToPrimaryStable() internal {
        if ((address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > 0)) {
            swap(curvePool, address(token0), address(primaryStable), token0.balanceOf(address(this)), oracleRouter);
            require(token0.balanceOf(address(this)) == 0, "Leftover token0");
        }
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(curvePool, address(primaryStable), address(token0), primaryStableBalance, oracleRouter);
        }
    }



}
