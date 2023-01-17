// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Clearpool Strategy
 * @notice Investment strategy for investing stablecoins via Clearpool Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";


import {IPoolBase, IPoolMaster} from  "../connectors/clearpool/Clearpool.sol";
import "../interfaces/IMiniVault.sol";
import "../exchanges/CurveExchange.sol";
import "hardhat/console.sol";


contract ClearpoolStrategy is InitializableAbstractStrategy, CurveExchange   {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;


    IERC20 public token0;
    IERC20 public primaryStable;

    IERC20 public cPoolToken;

    IPoolBase public poolBase; // Depositable, Withdrawable
    IPoolMaster public poolMaster; // Reward Withdraw


    bytes32 poolId;
    address public swappingPool;
    uint256[] public minThresholds;
    address public oracleRouter;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as CPOOL strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // cPool address address
        address _vaultAddress,    // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // USDC
        address[] calldata _pTokens, // poolBase
        address _poolMaster,  // poolMaster
        address _primaryStable
    ) external onlyGovernor initializer {
        require(_rewardTokenAddresses[0] != address(0), "Zero address not allowed");
        require(_pTokens[0] != address(0), "Zero address not allowed");
        require(_platformAddress != address(0), "Zero address not allowed");
        require(_poolMaster != address(0), "Zero address not allowed");
        require(_primaryStable != address(0), "Zero address not allowed");

        token0 = IERC20(_assets[0]);
        primaryStable = IERC20(_primaryStable);
        cPoolToken = IERC20(_platformAddress);
        poolBase = IPoolBase(_pTokens[0]);
        poolMaster = IPoolMaster(_poolMaster);

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

    function setOracleRouterSwappingPool() external onlyGovernor nonReentrant {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
        swappingPool = IMiniVault(vaultAddress).swappingPool();
    }

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
        token0.approve(address(poolBase),_amount);
        poolBase.provide(_amount);
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
    ) external override onlyVaultOrGovernor nonReentrant  {
        require(_asset == address(primaryStable), "Token not compatible.");
        // add 10 to unstake more than requested _amount
        uint256 lpTokenAmount = (_amount + 10) * 1e18 / poolBase.getCurrentExchangeRate();
        if (lpTokenAmount < minThresholds[1]) {
            console.log("Unstakable LP Token amount is too low to be withdrawn: ", lpTokenAmount);
            return;
        }
        poolBase.redeem(lpTokenAmount);

        _swapAssetToPrimaryStable();

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(_beneficiary, primaryStableBalance);
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant  {
        uint256 lpTokenAmount = poolBase.balanceOf(address(this));
        console.log("Withdrawing all LP tokens", lpTokenAmount);
        if (lpTokenAmount < minThresholds[1]) {
            console.log("Unstakable LP Token amount is too low to be withdrawn: ", lpTokenAmount);
            return;
        }
        poolBase.redeem(type(uint256).max);
        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
    }

    function checkBalance()
        external
        view
        override
        returns (uint256)
    {
        return (poolBase.balanceOf(address(this)) * poolBase.getCurrentExchangeRate() / 1e18) + primaryStable.balanceOf(address(this));
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
        uint256 lpTokenAmount = poolBase.balanceOf(address(this));
        if (lpTokenAmount > minThresholds[2]) {
            address[] memory pools = new address[](1);
            pools[0] = address(poolBase);
            poolMaster.withdrawReward(pools);
            uint256 cpoolBalance = cPoolToken.balanceOf(address(this));
            console.log("RewardCollection - CPOOL Balance (NOT SWAPPED): ", cpoolBalance);
        } else {
            console.log("RewardCollection - Nothing is collected on this harvest as LP tokens are too low: ", lpTokenAmount);
        }
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
                revert("ClearPool Strategy - Token0 to PrimarySwap failed");
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
   
}
