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
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";

import { OvnMath } from "../utils/OvnMath.sol";
import { StrategyDodoLibrary } from "../utils/StrategyDodoLibrary.sol";
import "./../connectors/dodo/IDODOV1.sol";
import "./../connectors/dodo/IDODOV2.sol";
import "./../connectors/dodo/IDODOMine.sol";

import "../exchanges/BalancerExchange.sol";
import "../exchanges/DodoExchange.sol";

import "hardhat/console.sol";



contract DodoStrategy is InitializableAbstractStrategy, BalancerExchange, DodoExchange {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using OvnMath for uint256;


    IERC20 public usdtToken; // form intializers
    IERC20 public dodoToken; // platform Address
    IERC20 public wmaticToken; // intermediary Address
    IERC20 public usdcLPToken; // pToken 

    IERC20 public primaryStable; 


    IDODOV1 public dodoV1UsdcUsdtPool;
    IDODOV2 public dodoV2DodoUsdtPool;
    IDODOMine public dodoMine;

    bytes32 public balancerPoolIdUsdcTusdDaiUsdt;
    bytes32 public balancerPoolIdWmaticUsdcWethBal;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Dodo strategies don't fit
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
        address _platformAddress, // DODO Token address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC
        address[] calldata _pTokens, // usdcLPToken Token address
        address _usdtToken, // USDT
        address _wMaticToken, // wMATIC
        address[] calldata dodoAddresses // In ORDER: _dodoV1UsdcUsdtPool,  _dodoV2DodoUsdtPool,  _dodoMine,  _dodoV1Helper,  _dodoProxy,  _dodoApprove
    ) external onlyGovernor initializer {
        usdcLPToken = IERC20(_pTokens[0]);
        usdtToken = IERC20(_usdtToken);
        wmaticToken = IERC20(_wMaticToken);
        dodoToken = IERC20(_platformAddress);
        dodoV1UsdcUsdtPool = IDODOV1(dodoAddresses[0]);
        dodoV2DodoUsdtPool = IDODOV2(dodoAddresses[1]);
        dodoMine = IDODOMine(dodoAddresses[2]);
        _setDodoParams(dodoAddresses[3], dodoAddresses[4], dodoAddresses[5]);

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }
    function setBalancerAndPrimaryStable(address _primaryStable, address _balancerVault, bytes32 _balancerPoolIdUsdcTusdDaiUsdt, bytes32 _balancerPoolIdWmaticUsdcWethBal) external onlyGovernor {
        require(_primaryStable != address(0), "Zero address not allowed");
        require(_balancerVault != address(0), "Zero address not allowed");
        require(_balancerPoolIdUsdcTusdDaiUsdt != "", "Empty pool id not allowed");
        require(_balancerPoolIdWmaticUsdcWethBal != "", "Empty pool id not allowed");
        primaryStable = IERC20(_primaryStable);
        setBalancerVault(_balancerVault);
        balancerPoolIdUsdcTusdDaiUsdt = _balancerPoolIdUsdcTusdDaiUsdt;
        balancerPoolIdWmaticUsdcWethBal = _balancerPoolIdWmaticUsdcWethBal;
    }
    // TODO: Use "_amount" while depositing
    function _deposit(address _asset, uint256 _amount)
        internal
    {
        require(( (_asset == address(primaryStable)) && (_asset == assetsMapped[0] ) ), "Token not supported.");

        // stake all usdc tokens
        uint256 primaryStableAmount = primaryStable.balanceOf(address(this));
        // console.log("Depositing ", primaryStableAmount, " usdc tokens to DODO");
        emit TransferLog("Depositing into DODO : ", _asset, primaryStableAmount);

        // add liquidity to pool
        primaryStable.approve(address(dodoV1UsdcUsdtPool), primaryStableAmount);
        dodoV1UsdcUsdtPool.depositBaseTo(address(this), primaryStableAmount);

        // stake all lp tokens
        uint256 usdcLPTokenBalance = usdcLPToken.balanceOf(address(this));
        usdcLPToken.approve(address(dodoMine), usdcLPTokenBalance);
        dodoMine.deposit(usdcLPTokenBalance);
    }
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }
    function depositAll() external override onlyVault nonReentrant {
        _deposit(address(primaryStable), primaryStable.balanceOf(address(this)));
    }
    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant  {
        require(( (_asset == address(primaryStable)) && (_asset == assetsMapped[0] ) ), "Token not supported.");
        // console.log("Starting withdrawing from DODO of",_asset, _amount);
        uint256 amountToUnstake = StrategyDodoLibrary._getAmountIn(_amount, dodoV1UsdcUsdtPool);

        // get lp tokens
        uint256 usdcLPTokenTotalSupply = usdcLPToken.totalSupply();
        (uint256 baseTarget,) = dodoV1UsdcUsdtPool.getExpectedTarget();
        uint256 unstakeLpBalance = amountToUnstake * usdcLPTokenTotalSupply / baseTarget;
        uint256 userLPBalance = dodoMine.balanceOf(address(this));
        if (unstakeLpBalance > userLPBalance) {
            unstakeLpBalance = userLPBalance;
        }

        // unstake lp tokens
        dodoMine.withdraw(unstakeLpBalance);

        // remove liquidity from pool
        dodoV1UsdcUsdtPool.withdrawAllBase();

        // return all usdc tokens
        uint256 assetBalance = primaryStable.balanceOf(address(this));
        if (assetBalance > 0) {
            emit TransferLog("Withdrawing from the DODO: ",assetsMapped[0], assetBalance);
            IERC20(assetsMapped[0]).safeTransfer(_beneficiary, assetBalance);
        }
    }
    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // get all lp tokens
        uint256 userLPBalance = dodoMine.balanceOf(address(this));
        if (userLPBalance == 0) {
            return;
        }
        // unstake lp tokens
        dodoMine.withdraw(userLPBalance);
        // remove liquidity from pool
        dodoV1UsdcUsdtPool.withdrawAllBase();
        uint256 assetBalance = primaryStable.balanceOf(address(this));

        // console.log("Withdrawing  everthing from the DODO: ", assetBalance);
        emit TransferLog("Withdrawing  everthing from the DODO: ",  assetsMapped[0], assetBalance);

        if (assetBalance > 0) {
            IERC20(assetsMapped[0]).safeTransfer(vaultAddress, assetBalance);
        }
    }
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        uint256 userLPBalance = dodoMine.balanceOf(address(this));
        if (userLPBalance == 0) {
            return;
        }

        // claim rewards
        dodoMine.claimAllRewards();

        // sell rewards
        uint256 totalPrimaryStable;

        uint256 dodoBalance = dodoToken.balanceOf(address(this));
        // console.log("dodoBalance", dodoBalance);
        if (dodoBalance > 0) {
            // swap v2 dodo -> usdt
            uint256 usdtTokenAmount = _useDodoSwapV2(
                address(dodoV2DodoUsdtPool),
                address(dodoToken),
                address(usdtToken),
                dodoBalance,
                1,
                0
            );
            // console.log(usdtTokenAmount);

            uint256 primaryStableAmount;
            if (usdtTokenAmount > 0) {
                // swap v1 usdt -> PrimaryStable
                primaryStableAmount = swap(
                    balancerPoolIdUsdcTusdDaiUsdt,
                    IVault.SwapKind.GIVEN_IN,
                    IAsset(address(usdtToken)),
                    IAsset(address(primaryStable)),
                    address(this),
                    address(this),
                    usdtTokenAmount,
                    0
                );
            }
            // console.log("primaryStableAmount", primaryStableAmount);
            totalPrimaryStable += primaryStableAmount;
        }

        uint256 wmaticBalance = wmaticToken.balanceOf(address(this));
        // console.log("wmaticBalance", wmaticBalance);
        if (wmaticBalance > 0) {
            uint256 wmaticPrimaryStable = swap(
                balancerPoolIdWmaticUsdcWethBal,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(wmaticToken)),
                IAsset(address(primaryStable)),
                address(this),
                address(this),
                wmaticBalance,
                0
            );
            // console.log("wmaticPrimaryStable", wmaticPrimaryStable);

            totalPrimaryStable += wmaticPrimaryStable;
        }
        // console.log("totalPrimaryStable", totalPrimaryStable);

        if (totalPrimaryStable > 0) {
            emit RewardTokenCollected(
                harvesterAddress,
                address(primaryStable),
                totalPrimaryStable
            );
            primaryStable.transfer(harvesterAddress, totalPrimaryStable);
        }
        return;
    }
    function checkBalance()
        external
        view
        override
        returns (uint256 balance)
    {

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("primaryStableBalance", primaryStableBalance);
        uint256 userLPBalance = dodoMine.balanceOf(address(this));
        // console.log("userLPBalance", userLPBalance);
        if (userLPBalance > 0) {
            uint256 usdcLPTokenTotalSupply = usdcLPToken.totalSupply();
            // console.log("usdcLPTokenTotalSupply", usdcLPTokenTotalSupply);
            (uint256 baseTarget,) = dodoV1UsdcUsdtPool.getExpectedTarget();
            // console.log("baseTarget", baseTarget);
            uint256 primaryStableAmount = baseTarget * userLPBalance / usdcLPTokenTotalSupply;
            // console.log("primaryStableAmount", primaryStableAmount);
            primaryStableBalance += primaryStableAmount - (primaryStableAmount * 6 / 10000); // - 0.06 %
        }
        return primaryStableBalance;
    }
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return ( (_asset == address(primaryStable)) && (_asset == assetsMapped[0] ) );
    }
    /* NOT NEEDED */
    function safeApproveAllTokens() external override  {}
    function _abstractSetPToken(address _asset, address _cToken)internal override {}
}
