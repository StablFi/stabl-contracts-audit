// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Tetu Strategy
 * @notice Investment strategy for investing stablecoins via Tetu
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ISmartVault } from "./../connectors/tetu/interfaces/ISmartVault.sol";
import "./../connectors/curve/CurveStuff.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import "../exchanges/UniswapV2Exchange.sol";
import "../exchanges/CurveExchange.sol";
import "../interfaces/IMiniVault.sol";
import "../interfaces/IOracle.sol";
import "../swapper/ISwapper.sol";
import "hardhat/console.sol";

contract TetuStrategy is InitializableAbstractStrategy, UniswapV2Exchange, CurveExchange {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using OvnMath for uint256;

    address internal pTokenAddress;

    IERC20 public token0;
    IERC20 public primaryStable;
    IERC20 public tetuToken;
    IERC20 public tetuLPToken;

    ISmartVault public smartVault;
    ISmartVault public xTetuSmartVault;

    bytes32 poolId; // UNUSED
    address public oracleRouter;

    address public curvePool;
    mapping(address => int128) internal curvePoolIndices;

    bool public isDirectDepositAllowed;

    address public swapper;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Tetu strategy don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Tetu Token
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of USDC
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                USDC
     * @param _pTokens Platform Token corresponding addresses
     * @param _primaryStable Primary Stable address (USDC)
     * @param _smartvault Smart Vault addresses
     * @param _xTetuSmartVault Tetu Smart Vault addresses
     */
    function initialize(
        address _platformAddress, // Tetu Token address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC / DAI / USDT
        address[] calldata _pTokens, // Tetu Token address
        address _primaryStable,
        address _smartvault,
        address _xTetuSmartVault
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        pTokenAddress = _pTokens[0];

        token0 = IERC20(_assets[0]);
        tetuToken = IERC20(_pTokens[0]); // tetu token
        tetuLPToken = IERC20(_platformAddress); // tetu token
        primaryStable = IERC20(_primaryStable); // primary Stable

        smartVault = ISmartVault(_smartvault);
        xTetuSmartVault = ISmartVault(_xTetuSmartVault);
        isDirectDepositAllowed = true;
        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
    }

    function setDirectDepositAllowed(bool _isDirectDepositAllowed) external onlyGovernor {
        isDirectDepositAllowed = _isDirectDepositAllowed;
    }

    function _setRouter(address _tetuSwapRouter) external onlyGovernor {
        require(_tetuSwapRouter != address(0), "Zero address not allowed");
        _setUniswapRouter(_tetuSwapRouter);
    }

    function setCurvePool(address _curvePool, address[] calldata tokens) external onlyGovernor {
        curvePool = _curvePool;
        curvePoolIndices[tokens[0]] = 0;
        curvePoolIndices[tokens[1]] = 1;
        curvePoolIndices[tokens[2]] = 2;
    }

    function setSwapper(address _swapper) external onlyGovernor {
        swapper = _swapper;
    }

    function setOracleRouter() external onlyVaultOrGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function poolBalanceCheckExponent() external view returns (uint256) {
        return IMiniVault(vaultAddress).poolBalanceCheckExponent();
    }

    function directDeposit() external onlyVault {
        console.log("D_TETU_DEPOSIT %s", token0.balanceOf(address(this)));

        _stake(token0.balanceOf(address(this)));
        console.log("D_TETU_DEPOSIT LP: %s", lpBalance());

        emit Deposit(address(token0), address(platformAddress), token0.balanceOf(address(this)));
    }

    function directDepositRequirement(uint256 _psAmount) external view onlyVault returns (uint256) {
        if (address(token0) == address(primaryStable)) {
            return _psAmount;
        }
        console.log("TETU_DEPOSIT_REQUIREMENT %s", _psAmount);
        return howMuchToSwap(curvePool, address(token0), address(primaryStable), _psAmount);
    }


    function _stake(uint256 _amount) internal {
        token0.approve(address(smartVault), _amount);
        smartVault.depositAndInvest(_amount);
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
    function _withdrawAll() internal {
        if (lpBalance() > 0) {
            smartVault.exit();
        }
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        if (IERC20(address(smartVault)).balanceOf(address(this)) == 0) {
            console.log("TetuStrategy - Smartvault is empty");
        } else {
            smartVault.getAllRewards();
        }

        if (IERC20(address(xTetuSmartVault)).balanceOf(address(this)) == 0) {
            console.log("TetuStrategy - xTetuSmartVault is empty");
        } else {
            xTetuSmartVault.exit();
        }

        uint256 _initialPS = primaryStable.balanceOf(address(this));

        uint256 tetuBalance = tetuToken.balanceOf(address(this));
        console.log("TetuStrategy - Tetu ", tetuBalance);

        if (tetuBalance > 10**13) {
            tetuToken.approve(address(swapper), tetuBalance);
            ISwapper(swapper).swapCommon(address(tetuToken), address(primaryStable), tetuBalance);
        }

        uint256 balance = primaryStable.balanceOf(address(this)).sub(_initialPS);
        console.log("TetuStrategy - Tetu -> USDC: ", balance);
        if (balance > 0) {
            primaryStable.transfer(harvesterAddress, balance);
            emit RewardTokenCollected(harvesterAddress, address(primaryStable), balance);
        }
    }

    function checkBalance() external view returns (uint256) {
        uint256 balanceWithInvestments = smartVault.underlyingBalanceWithInvestmentForHolder(address(this));

        // swap to PrimaryStable
        if (address(token0) != address(primaryStable) && (balanceWithInvestments + token0.balanceOf(address(this))) > 0) {
            balanceWithInvestments = onSwap(
                curvePool,
                address(token0),
                address(primaryStable),
                balanceWithInvestments + token0.balanceOf(address(this))
            );
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function netAssetValue() external view returns (uint256) {
        (uint256 _dai, uint256 _usdt, uint256 _usdc) = assetsInUsd();
        return _dai + _usdt + _usdc;
    }

    function lpBalance() public view returns (uint256) {
        return smartVault.underlyingBalanceWithInvestmentForHolder(address(this));
    }

    function _inUsd(address _asset, uint256 _amount) internal view returns (uint256) {
        return IOracle(oracleRouter).price(_asset) * _amount / (10**Helpers.getDecimals(_asset));
    }

    function _getAssetAmount(address _asset) internal view returns (uint256, uint256) {
        if (address(token0) == _asset) {
            return (token0.balanceOf(address(this)), lpBalance()); // Tetu's lpBalance is in terms of token0
        }
        return (IERC20(_asset).balanceOf(address(this)), 0);
    }
    function assetsInUsd() public view returns (uint256, uint256, uint256) {
        address[] memory _assets = IMiniVault(vaultAddress).getSupportedAssets();
        uint256[] memory _assetsInUsd = new uint256[](_assets.length);
        for (uint256 i = 0; i < _assets.length; i++) {
            (uint256 _stray, uint256 _staked) = _getAssetAmount(_assets[i]);
            _assetsInUsd[i] = _inUsd(_assets[i], _stray + _staked);
        }
        return (_assetsInUsd[0], _assetsInUsd[1], _assetsInUsd[2]);
    }
    function liquidateAll() external onlyVault nonReentrant{
        _withdrawAll();
        _withdrawStrayAssets();
    }
    function withdrawUsd(uint256 _amountInUsd) external onlyVault nonReentrant returns (uint256, uint256, uint256) {
        (uint256 _daiInUsd, uint256 _usdtInUsd, uint256 _usdcInUsd) = _calculateUsd(_amountInUsd);
        address[] memory _assets = IMiniVault(vaultAddress).getSupportedAssets();

        // @dev _withdrawAsset will return the amount of asset withdrawn (not their worth in USD), 
        // we are using the previous variable for potential gas savings
        _daiInUsd = _withdrawAsset(_assets[0], _daiInUsd);
        _usdtInUsd = _withdrawAsset(_assets[1], _usdtInUsd);
        _usdcInUsd = _withdrawAsset(_assets[2], _usdcInUsd);
        return (_daiInUsd, _usdtInUsd, _usdcInUsd);
    }
    function _calculateUsd(uint256 _amountInUsd) internal view returns (uint256, uint256, uint256) {
        (uint256 _daiInUsd, uint256 _usdtInUsd, uint256 _usdcInUsd) = assetsInUsd();
        uint256 _totalInUsd = _daiInUsd + _usdtInUsd + _usdcInUsd;
        require(_amountInUsd <= _daiInUsd + _usdtInUsd + _usdcInUsd, "TetuStrategy - LOW_BAL");

        // Vars reused: daiInUsd = _daiInUsdWithdraw and so on | Preventing Stack deep errors.
        _daiInUsd = _daiInUsd.mul(_amountInUsd).div(_totalInUsd);
        _usdtInUsd = _usdtInUsd.mul(_amountInUsd).div(_totalInUsd);
        _usdcInUsd = _usdcInUsd.mul(_amountInUsd).div(_totalInUsd);

        return (_daiInUsd, _usdtInUsd, _usdcInUsd);
    }
    function calculateUsd(uint256 _amountInUsd) external view  returns (uint256, uint256, uint256) {
        return _calculateUsd(_amountInUsd);
    }

    function withdrawStrayAssets() external onlyVault nonReentrant {
        _withdrawStrayAssets();
    }
    function _withdrawStrayAssets() internal {
        address[] memory _assets = IMiniVault(vaultAddress).getSupportedAssets();
        for (uint256 i = 0; i < _assets.length; i++) {
            IERC20(_assets[i]).safeTransfer(vaultAddress, IERC20(_assets[i]).balanceOf(address(this)));
        }
    }
    function _withdrawAsset(address _asset, uint256 _amountInUsd) internal returns (uint256) {
        if (_amountInUsd == 0) {
            return 0;
        }
        uint256 _inTokenAmount = _amountInUsd * (10**Helpers.getDecimals(_asset)) / IOracle(oracleRouter).price(_asset); // USD -> Token
        uint256 _toUnstakeAmount = _inTokenAmount.subOrZero(IERC20(_asset).balanceOf(address(this)));
        if (_toUnstakeAmount > 0 && address(token0) == _asset) {
            _directWithdraw(_toUnstakeAmount);
        }
        require(IERC20(_asset).balanceOf(address(this)) >= _inTokenAmount, "TetuStrategy - LOW_BAL_IN_TOKEN");
        IERC20(_asset).safeTransfer(vaultAddress, _inTokenAmount);
        return _inTokenAmount;
    }

    // @dev STRATEGY DEPENDENT FUNCTION
    // @dev This function will withdraw the token0 amount from the startegie's pool
    function _directWithdraw(uint256 _amountOfToken0) internal {
        uint256 numberOfShares = (_amountOfToken0.addBasisPoints(40) * smartVault.totalSupply()) / smartVault.underlyingBalanceWithInvestment();
        if (numberOfShares > lpBalance()) {
            smartVault.exit();
        } else {
            smartVault.withdraw(numberOfShares);
        }
    }
}
