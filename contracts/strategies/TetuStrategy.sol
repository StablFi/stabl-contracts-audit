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

    function deposit(address _asset, uint256 _amount) external override onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        require(_amount > 0, "Must deposit something");
        _swapPrimaryStableToToken0();
        console.log("TETU_DEPOSIT %s", token0.balanceOf(address(this)));
        _stake(token0.balanceOf(address(this)));
        console.log("TETU_DEPOSIT LP: %s", lpBalance());

        emit Deposit(_asset, address(platformAddress), token0.balanceOf(address(this)));
    }

    function _stake(uint256 _amount) internal {
        token0.approve(address(smartVault), _amount);
        smartVault.depositAndInvest(_amount);
    }

    function depositAll() public override onlyVault nonReentrant {
        uint256 totalBalance = token0.balanceOf(address(this));
        _stake(totalBalance);
    }

    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        uint256 _eq = _equivalentInToken0(_amount);
        console.log("EQ: ", _eq);
        if (lpBalance() > 0) {
            uint256 numberOfShares = (_eq.addBasisPoints(40) * smartVault.totalSupply()) / smartVault.underlyingBalanceWithInvestment();
            if (numberOfShares > lpBalance()) {
                console.log("WITHDRAW_ALL");
                _withdrawAll();
            } else {
                smartVault.withdraw(numberOfShares);
            }
        }
        console.log("T0: ", token0.balanceOf(address(this)));
        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        console.log("PS: ", primaryStableBalance);
        require(primaryStableBalance >= _amount, "Not enough balance");
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
    function withdrawAll() external override onlyVault nonReentrant {
        _withdrawAll();
        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (primaryStableBalance > 0) {
            // transfer to vault.
            primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
        }
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
            _swapExactTokensForTokens(address(tetuToken), address(primaryStable), tetuBalance, address(this));
        }

        uint256 balance = primaryStable.balanceOf(address(this)).sub(_initialPS);
        console.log("TetuStrategy - Tetu -> USDC: ", balance);
        if (balance > 0) {
            primaryStable.transfer(harvesterAddress, balance);
            emit RewardTokenCollected(harvesterAddress, address(primaryStable), balance);
        }
    }

    function checkBalance() external view override returns (uint256) {
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
        uint256 balanceWithInvestments = smartVault.underlyingBalanceWithInvestmentForHolder(address(this));
        if (address(token0) != address(primaryStable) && (balanceWithInvestments + token0.balanceOf(address(this))) > 0) {
            balanceWithInvestments = _convert(address(token0), address(primaryStable), balanceWithInvestments + token0.balanceOf(address(this)))
                .scaleBy(Helpers.getDecimals(address(primaryStable)), Helpers.getDecimals(address(token0)));
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function lpBalance() public view returns (uint256) {
        return smartVault.underlyingBalanceWithInvestmentForHolder(address(this));
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
        return _amount.mul(fromPrice).div(toPrice);
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
            if (token0.balanceOf(address(this)) > 0) {
                revert("Tetu Strategy - Token0 to PrimarySwap failed");
            }
        }
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(curvePool, address(primaryStable), address(token0), primaryStableBalance, oracleRouter);
        }
    }

    function supportsAsset(address _asset) external view override returns (bool) {
        return _asset == address(primaryStable);
    }

    /* NOT NEEDED */
    function safeApproveAllTokens() external override {}

    function _abstractSetPToken(address _asset, address _cToken) internal override {}
}
