// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Clearpool Strategy
 * @notice Investment strategy for investing stablecoins via Clearpool Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";


import { StableMath } from "../utils/StableMath.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../interfaces/IMiniVault.sol";
import "../interfaces/IPriceFeed.sol";
import { GainsVault } from  "../connectors/gains/Gains.sol";
import { ICurvePool } from  "./ICurvePool.sol";
import "../exchanges/CurveExchange.sol";
import "../utils/ChainlinkLibrary.sol";


contract GainsStrategy is InitializableAbstractStrategy, CurveExchange   {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;


    IERC20 public token0;
    IERC20 public primaryStable;

    IERC20 public cPoolToken;

    GainsVault public gainsVault; // Depositable, Withdrawable

    IPriceFeed public oracleToken0;
    IPriceFeed public oraclePrimaryStable;

    uint256 public poolUsdcDaiFee;


    uint256 token0Dm;
    uint256 primaryStableDm;


    bytes32 poolId;  // Balancer Swap [Not Currently Being Used]
    address public swappingPool; // [IMP] Balancer Vault is not being used currently, but Curve is.

    uint256[] public minThresholds;
    address public oracleRouter;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Gains strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // DAI address
        address _vaultAddress,    // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // DAI
        address[] calldata _pTokens, // DAI - Not so relavant
        address[] calldata _priceFeeds,  // priceFeeds
        address _gainsVault, // Gains Vault
        address _primaryStable // USDC
    ) external onlyGovernor initializer {
        require(_rewardTokenAddresses[0] != address(0), "Zero address not allowed");
        require(_pTokens[0] != address(0), "Zero address not allowed");
        require(_platformAddress != address(0), "Zero address not allowed");
        require(_gainsVault != address(0), "Zero address not allowed");
        require(_primaryStable != address(0), "Zero address not allowed");

        token0 = IERC20(_assets[0]);
        primaryStable = IERC20(_primaryStable);
        gainsVault = GainsVault(_gainsVault);
        
        oracleToken0 = IPriceFeed(_priceFeeds[0]);
        oraclePrimaryStable = IPriceFeed(_priceFeeds[1]);

        token0Dm = 10 ** IERC20Metadata(_assets[0]).decimals();
        primaryStableDm = 10 ** IERC20Metadata(_primaryStable).decimals();


        for (uint8 i = 0; i < 3; i++) {
            minThresholds.push(0);
        }

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    function setOracleRouterSwappingPool() external onlyGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
        swappingPool = IMiniVault(vaultAddress).swappingPool();
    }

    // Deposit shall make use of all the DAI present in the strategy
    // once the swapping is done
    function _deposit(
        address _asset,
        uint256 _amount
    )  internal {
        require(_asset == address(primaryStable), "Token not compatible.");
        if (primaryStable.balanceOf(address(this)) < minThresholds[0]) {
            console.log("Deposit amount too low to be staked");
            return;
        }
        _swapPrimaryStableToToken0();
        uint256 token0Amount = token0.balanceOf(address(this)); // DAI amount
        console.log("DAI", token0Amount);
        token0.approve(address(gainsVault),token0Amount);
        gainsVault.depositDai(token0Amount);
    }

    function deposit(
        address _asset,
        uint256 _amount
    )   external
        override
        onlyVault
        nonReentrant {
        require(_asset == address(primaryStable), "Token not compatible.");
        _deposit(_asset, _amount);
    }

    function depositAll() external override onlyVault nonReentrant {
        _deposit(address(token0), token0.balanceOf(address(this)));
    }
    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant  {
        require(_asset == address(primaryStable), "Token not compatible.");
        uint256 token0Amount = _oraclePrimaryStableToToken0(_amount);
        if (token0Amount < minThresholds[1]) {
            console.log("Unstakable token0/LP token amount is too low to be withdrawn: ", token0Amount);
            return;
        }
        gainsVault.withdrawDai(token0Amount);

        _swapAssetToPrimaryStable();

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(_beneficiary, primaryStableBalance);
    }

    function withdrawAll() external override onlyVault nonReentrant  {
        uint256 token0DepositedAmount = gainsVault.users(address(this)).daiDeposited;
        if (token0DepositedAmount < minThresholds[1]) {
            console.log("Unstakable token0/LP token amount is too low to be withdrawn: ", token0DepositedAmount);
            return;
        }

        gainsVault.withdrawDai(token0DepositedAmount);

        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
    }
    function netAssetValue() external view returns (uint256) {
       uint256 daiAmount = gainsVault.users(address(this)).daiDeposited;
        if (
            address(token0) != address(primaryStable) &&
            daiAmount > 0
        ) {
            daiAmount = _convert(
                address(token0),
                address(primaryStable),
                daiAmount
            ).scaleBy(
                    Helpers.getDecimals(address(primaryStable)),
                    Helpers.getDecimals(address(token0))
                );
        }

        return daiAmount + primaryStable.balanceOf(address(this));
    }
    function checkBalance()
        external
        view
        override
        returns (uint256)
    {
        uint256 _psBalance = primaryStable.balanceOf(address(this));
        uint256 daiAmount = gainsVault.users(address(this)).daiDeposited;
        if (daiAmount >  minThresholds[1]) {
            return _psBalance + onSwap(
                swappingPool,
                address(token0),
                address(primaryStable),
                daiAmount
            );
        }
        return _psBalance;
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
        if ((toPrice > 10 ** 8) && limit) {
            toPrice = 10 ** 8;
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

    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        _collectRewards();
    }
    function _collectRewards() internal {
        console.log("DAI deposited:", gainsVault.users(address(this)).daiDeposited);
        if (gainsVault.users(address(this)).daiDeposited == 0) {
            return;
        }
        uint256 beforeToken0Amount = token0.balanceOf(address(this));
        gainsVault.harvest();
        uint256 afterToken0Amount = token0.balanceOf(address(this));
        uint256 token0Amount = afterToken0Amount.sub(beforeToken0Amount);
        console.log("RewardCollection - DAI : ", token0Amount);
        if (token0Amount <= minThresholds[2]) {
            console.log("RewardCollection - DAI -> USDC : Insufficient token0 ", token0Amount);
            return;
        }

        uint256 beforePrimaryStableAmount = primaryStable.balanceOf(address(this));
        _swapAssetToPrimaryStable();
        uint256 afterPrimaryStableAmount = primaryStable.balanceOf(address(this));
        uint256 primaryStableAmount = afterPrimaryStableAmount.sub(beforePrimaryStableAmount);

        console.log("RewardCollection - DAI -> USDC Balance: ", primaryStableAmount);
        emit RewardTokenCollected(
            harvesterAddress,
            address(primaryStable),
            primaryStableAmount
        );
        primaryStable.transfer(harvesterAddress, primaryStableAmount);
    }

    function setThresholds(uint256[] calldata _minThresholds) external onlyVaultOrGovernor nonReentrant {
        require(_minThresholds.length == 3, "3 thresholds needed");
        // minThresholds[0] - Minimum PS to deposit
        // minThresholds[1] - Minimum LP to withdraw
        // minThresholds[2] - Minimum LP to collect reward on
        minThresholds = _minThresholds;
    }

    function _swapAssetToPrimaryStable() internal {
        if ( (address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > 0) )  {
             swap(
                swappingPool,
                address(token0),
                address(primaryStable),
                token0.balanceOf(address(this)),
                oracleRouter
            );
            if(token0.balanceOf(address(this)) > 0) {
                revert("Gains Strategy - Token0 to PrimarySwap failed");
            }

        }
    }
    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(
                swappingPool,
                address(primaryStable),
                address(token0),
                primaryStableBalance,
                oracleRouter
            );
        }
    }


    function _oracleToken0ToPrimaryStable(uint256 _token0Amount) internal view returns (uint256){

        uint256 priceToken0 = uint256(oracleToken0.latestAnswer());
        uint256 pricePrimaryStable = uint256(oraclePrimaryStable.latestAnswer());

        uint256 amount = ChainlinkLibrary.convertTokenToToken(_token0Amount, token0Dm, primaryStableDm, priceToken0, pricePrimaryStable);

        return amount;
    }

    function _oraclePrimaryStableToToken0(uint256 _primaryStableAmount) internal view returns (uint256){

        uint256 priceToken0 = uint256(oracleToken0.latestAnswer());
        uint256 pricePrimaryStable = uint256(oraclePrimaryStable.latestAnswer());

        return ChainlinkLibrary.convertTokenToToken(_primaryStableAmount, primaryStableDm, token0Dm, pricePrimaryStable, priceToken0);
    }

    // Gains vault check payable function and can send MATIC
    receive() external payable {
    }



     /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(primaryStable);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        // Not needed
    }

    /**
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _cToken The cToken for the approval
     */
    function _abstractSetPToken(address _asset, address _cToken)
        internal
        override
    {
        // Not needed
    }
    
    /**
     * @dev Get the index of the coin
     */
    function _getCoinIndex(address _asset) internal view returns (uint256) {
        for (uint256 i = 0; i < 5; i++) {
            if (ICurvePool(swappingPool).underlying_coins(i) == _asset) {
                return i;
            }
        }
        revert("Invalid Pool asset");
    }
}
