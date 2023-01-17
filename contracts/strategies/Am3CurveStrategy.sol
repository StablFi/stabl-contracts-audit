// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Am3Curve Strategy
 * @notice Investment strategy for investing stablecoins via Am3Curve
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IAsset } from "../interfaces/balancer/interfaces/IAsset.sol";
import { IVault } from "../interfaces/balancer/interfaces/IVault.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { ICRVMinter } from "./ICRVMinter.sol";
import { ICurveGauge } from "./ICurveGauge.sol";
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { UniswapV2Exchange } from "../exchanges/UniswapV2Exchange.sol";
import { Helpers } from "../utils/Helpers.sol";
import { ILendingPoolAddressesProvider } from "../connectors/aave/interfaces/ILendingPoolAddressesProvider.sol";
import { ILendingPool } from "../connectors/aave/interfaces/ILendingPool.sol";
import { IProtocolDataProvider } from "../connectors/aave/interfaces/IProtocolDataProvider.sol";

import "hardhat/console.sol";

contract Am3CurveStrategy is BaseCurveStrategy, UniswapV2Exchange {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;


    IERC20 public primaryStable;
    IERC20 public crvToken;


    mapping(address => address) public stableToAmStable;
    mapping(address => address) public amStableToAmDebt;

    ICurveGauge crvGauge;
    ICRVMinter crvMinter;

    IERC20 public _unused_;
    


    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the am3Crv
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of CRV
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                USDC
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address _platformAddress, // a3crv Token address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC
        address[] calldata _pTokens, // am3CRV Token address
        address _primaryStable,
        address _crvToken,
        address _crvGauge,
        address _crvMinter
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        pTokenAddress = _pTokens[0];
        primaryStable = IERC20(_primaryStable);
        crvToken = IERC20(_crvToken);
        crvGauge = ICurveGauge(_crvGauge);
        crvMinter = ICRVMinter(_crvMinter);
        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }
    function _setAmAssets(address[] calldata _amAssets) external onlyGovernor {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            stableToAmStable[assetsMapped[i]] = _amAssets[i];
        }
    }
    function _setRouter(address _router) external onlyGovernor {
        require(_router != address(0), "Zero address not allowed");
        _setUniswapRouter(_router);
    }



    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        // console.log("Depositing to Am3Curve");
        require(_asset == address(primaryStable), "Token not supported.");
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, address(platformAddress), _amount);

        // 3Pool requires passing deposit amounts for all 3 assets, set to 0 for        // all
        uint256[3] memory _amounts;
        uint256 poolCoinIndex = _getCoinIndex(_asset); // DAI:0, USDC:1, USDT:2
        // Set the amount on the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;
        ICurvePool curvePool = ICurvePool(platformAddress);
        uint256 assetDecimals = Helpers.getDecimals(stableToAmStable[_asset]);
        uint256 depositValue = _amount.scaleBy(18, assetDecimals).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - maxSlippage
        );
        // Do the deposit to 3pool
        curvePool.add_liquidity(_amounts, minMintAmount, true);
        // console.log("Am3Curve: ", IERC20(pTokenAddress).balanceOf(address(this)));
        _lpDepositAll();
        emit TransferLog("Depositing to Am3Curve: ",_asset , _amount);
    }
    function depositAll() external override onlyVault nonReentrant {
        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        uint256 depositValue = 0;
        ICurvePool curvePool = ICurvePool(platformAddress);
        uint256 curveVirtualPrice = curvePool.get_virtual_price();

        for (uint256 i = 0; i < assetsMapped.length; i++) {
            address assetAddress = assetsMapped[i];
            uint256 balance = IERC20(assetAddress).balanceOf(address(this));
            emit TransferLog("Depositing All to Am3Curve: ",assetAddress , balance);
            if (balance > 0) {
                uint256 poolCoinIndex = _getCoinIndex(assetAddress);
                // Set the amount on the asset we want to deposit
                _amounts[poolCoinIndex] = balance;
                uint256 assetDecimals = Helpers.getDecimals(assetAddress);
                // Get value of deposit in Curve LP token to later determine
                // the minMintAmount argument for add_liquidity
                depositValue =
                    depositValue +
                    balance.scaleBy(18, assetDecimals).divPrecisely(
                        curveVirtualPrice
                    );
                emit Deposit(assetAddress, address(platformAddress), balance);
            }
        }

        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - maxSlippage
        );
        // Do the deposit to 3pool
        curvePool.add_liquidity(_amounts, minMintAmount, true);
        // console.log("Am3Curve: ", IERC20(pTokenAddress).balanceOf(address(this)));
        // Deposit into Gauge, the PToken is the same (3Crv) for all mapped
        // assets, so just get the address from the first one
        _lpDepositAll();
    }
    function withdraw(address _recipient, address _asset, uint256 _amount) external override onlyVault nonReentrant  {
        require(_asset == address(primaryStable), "Token not supported.");
        // Withdraw all from Gauge
        (, uint256 gaugePTokens, ) = _getTotalPTokens();
        // Withdraw all from Gauge
        _lpWithdraw(gaugePTokens);
        // Remove liquidity
        ICurvePool aaveCurvePool = ICurvePool(platformAddress);
        // uint256 totalAm3Crv = IERC20(pTokenAddress).balanceOf(address(this));
        // console.log("am3CRV: ", totalAm3Crv);

        uint256[3] memory _amounts;
        uint256 poolCoinIndex = _getCoinIndex(_asset); // DAI:0, USDC:1, USDT:2
        _amounts[poolCoinIndex] = _amount;

        uint256 am3CrvTokenToWithdrawFrom = aaveCurvePool.calc_token_amount(_amounts, false);
        // console.log("am3CrvTokenToWithdrawFrom", am3CrvTokenToWithdrawFrom);
        uint256 recievableOnWithdrawl = aaveCurvePool.calc_withdraw_one_coin(am3CrvTokenToWithdrawFrom,int128(uint128(_getCoinIndex(address(primaryStable)))));
        uint256 minAmount = recievableOnWithdrawl.mulTruncate(
            uint256(1e18) - maxSlippage
        );
        aaveCurvePool.remove_liquidity_one_coin(am3CrvTokenToWithdrawFrom, int128(uint128(_getCoinIndex(_asset))), minAmount, true);

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("Withdrawing from the Synapse: ", primaryStableBalance);
        if (primaryStableBalance > 0) {
            primaryStable.safeTransfer(_recipient, primaryStableBalance);
        }
        _lpDepositAll();
    }
    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // Withdraw all from Gauge
        (, uint256 gaugePTokens, uint256 totalPTokens) = _getTotalPTokens();
        // Withdraw all from Gauge
        _lpWithdraw(gaugePTokens);
        // Remove liquidity
        ICurvePool aaveCurvePool = ICurvePool(platformAddress);

        uint256 allAm3CrvTokens = IERC20(pTokenAddress).balanceOf(address(this));
        uint256 recievableOnWithdrawl = aaveCurvePool.calc_withdraw_one_coin(allAm3CrvTokens,int128(uint128(_getCoinIndex(address(primaryStable)))));
        uint256 minAmount = recievableOnWithdrawl.mulTruncate(
            uint256(1e18) - maxSlippage
        );
        aaveCurvePool.remove_liquidity_one_coin(totalPTokens, int128(uint128(_getCoinIndex(address(primaryStable)))), minAmount, true);
        // Transfer assets out of Vault
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("Withdrawing from the Synapse: ", primaryStableBalance);
        if (primaryStableBalance > 0) {
            primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
        }
    }
    function checkBalance()
        public
        view
        override
        returns (uint256)
    {
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        uint256 balance;
        (, , uint256 totalPTokens) = _getTotalPTokens();
        // console.log("Am3Curve - checkBalance - totalPTokens: ", totalPTokens);
        ICurvePool curvePool = ICurvePool(platformAddress);
        if (totalPTokens > 0) {
            balance = curvePool.calc_withdraw_one_coin(totalPTokens,int128(uint128(_getCoinIndex(address(primaryStable)))));
            // console.log("Am3Curve - checkBalance - primaryToken: ", balance);
        }
        return primaryStableBalance + balance;
    }

    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        _collectRewards();
    }
    function _collectRewards() internal {
        crvMinter.mint(address(crvGauge));
        uint256 crvBalance = crvToken.balanceOf(address(this));
        console.log("RewardCollection - CRV Balance: ", crvBalance);
        if (crvBalance != 0) {
            _swapExactTokensForTokens(
                address(crvToken),
                address(primaryStable),
                crvBalance,
                address(this)
            );
        }
        uint256 balance = primaryStable.balanceOf(address(this));
        console.log("RewardCollection - CRV -> USDC Balance: ", balance);
        emit RewardTokenCollected(
            harvesterAddress,
            address(primaryStable),
            balance
        );
        primaryStable.transfer(harvesterAddress, balance);
    }
    function _lpDepositAll() internal override {
        uint256 am3crvBalance = IERC20(pTokenAddress).balanceOf(address(this));
        if (am3crvBalance > 0) {
            IERC20(pTokenAddress).safeApprove(address(crvGauge),am3crvBalance);
            crvGauge.deposit(am3crvBalance, address(this), false);
        }
    }

    function _lpWithdraw(uint256 numPTokens) internal override {
        crvGauge.withdraw(numPTokens,address(this),true);
    }
    function _getTotalPTokens()
        internal
        view
        override
        returns (
            uint256 contractPTokens,
            uint256 gaugePTokens, // gauge is a misnomer here, need a better name
            uint256 totalPTokens
        )
    {
        contractPTokens = IERC20(pTokenAddress).balanceOf(address(this));
        gaugePTokens = crvGauge.balanceOf(address(this));
        totalPTokens = contractPTokens + gaugePTokens;
    }
    /* NOT NEEDED */
    function _approveBase() internal override {
    }
}
