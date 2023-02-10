// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Balancer Strategy
 * @notice Investment strategy for investing stablecoins via Balancer Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { StableMath } from "../utils/StableMath.sol";
import "../interfaces/IMiniVault.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../exchanges/CurveExchange.sol";
import "../exchanges/BalancerExchange.sol";

import "../interfaces/balancer/interfaces/IBalancerPool.sol";
import "../interfaces/balancer/interfaces/IVault.sol";
import "../interfaces/balancer/interfaces/IGauge.sol";

import "hardhat/console.sol";

interface IRewardHelper {
    function claimRewardsFromGauge(address gauge, address user) external;
}

contract BalancerStrategy is InitializableAbstractStrategy, CurveExchange, BalancerExchange {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using OvnMath for uint256;

    IVault public balancerVault;

    IERC20 public token0;
    IERC20 public vaultPrimary;
    IERC20 public amToken;
    IERC20 public balToken;
    IBalancerPool public lp;
    IGauge public gauge;
    IRewardHelper public rewardHelper;

    bytes32 public swapToAmPool;
    bytes32 public amUsdcPoolId;

    bytes32 public lpPoolId;
    bytes32 public swapRewardsPool;
    address public swappingPool;
    address public oracleRouter;
    address public amUsdcToken;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Balancer strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // bal vault address
        address _vaultAddress, // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // USDC
        address[] calldata _pTokens, // bal token
        address _primaryStable,
        address _lpToken,
        address _gauge,
        address _rewardHelper
    ) external onlyGovernor initializer {
        require(_rewardTokenAddresses[0] != address(0), "Zero address not allowed");
        require(_pTokens[0] != address(0), "Zero address not allowed");
        require(_platformAddress != address(0), "Zero address not allowed");
        require(_primaryStable != address(0), "Zero address not allowed");
        require(_gauge != address(0), "Zero address not allowed");

        token0 = IERC20(_assets[0]); // DAI
        vaultPrimary = IERC20(_primaryStable); // USDC

        balToken = IERC20(_pTokens[0]); // bal token

        lp = IBalancerPool(_lpToken); // am-usd token
        gauge = IGauge(_gauge);
        rewardHelper = IRewardHelper(_rewardHelper);
        _abstractSetPToken(_assets[0], _pTokens[0]);

        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
    }

    function setBalancerEssentials(
        address _balancerVault,
        address _amUsdcToken,
        bytes32 _lpPoolId,
        bytes32 _swapRewardsPool,
        bytes32 _usdcPoolId,
        bytes32 _swapToAmPool,
        address _amToken
    ) external onlyGovernor {
        require(_balancerVault != address(0), "Zero address not allowed");
        require(_lpPoolId != "", "Empty pool id not allowed");

        balancerVault = IVault(_balancerVault);
        lpPoolId = _lpPoolId;
        swapRewardsPool = _swapRewardsPool;
        swapToAmPool = _swapToAmPool;
        amToken = IERC20(_amToken); // middle token for safe swap.
        amUsdcPoolId = _usdcPoolId;
        amUsdcToken = _amUsdcToken;
    }

    function setOracleRouterSwappingPool() external onlyGovernor nonReentrant {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
        swappingPool = IMiniVault(vaultAddress).swappingPool();
    }

    /**
    @dev Function to stake the LP amount to the Gauge
    @param _amount amount of LP balance to stake
     */
    function _stake(uint256 _amount) internal {
        if (lp.balanceOf(address(this)) >= _amount) {
            lp.approve(address(gauge), _amount);
            gauge.deposit(_amount, address(this), true); // amount, addr, claim_rewards;
        }
    }

    /**
    @dev Function to unstake the LP amount from Gauge
    */
    function _arrangeLP(uint256 _lp) internal {
        if (lp.balanceOf(address(this)) > _lp) {
            return;
        }
        gauge.withdraw(_lp - lp.balanceOf(address(this)), true); // _amount, claim_rewards
    }

    function _deposit(address _asset, uint256 _amount) internal {
        require(_asset == address(vaultPrimary), "Token not compatible.");
        _swapPrimaryStableToToken0();
        _swapToLp(token0.balanceOf(address(this)));
        _stake(lp.balanceOf(address(this)));
    }

    function _swapToLp(uint256 _amount) internal returns (uint256) {
        return
            batchSwap(
                address(balancerVault),
                swapToAmPool,
                lpPoolId,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(token0)),
                IAsset(address(amToken)),
                IAsset(address(lp)),
                address(this),
                payable(address(this)),
                _amount
            );
    }

    function deposit(address _asset, uint256 _amount) external override onlyVault nonReentrant {
        require(_asset == address(vaultPrimary), "Token not compatible.");
        _deposit(_asset, _amount);
    }

    function depositAll() external override onlyVault nonReentrant {
        _deposit(address(vaultPrimary), vaultPrimary.balanceOf(address(this)));
    }

    function withdraw(address _beneficiary, address _asset, uint256 _amount) external override onlyVaultOrGovernor nonReentrant {
        require(_asset == address(vaultPrimary), "Token not compatible.");

        uint256 _tokenToAmRate = IBalancerPool(address(amUsdcToken)).getRate();
        uint256 _amToLp = _amount.scaleBy(18, 6).mul(1e18).div(_tokenToAmRate); // primary token decimals
        uint256 _minBpt = lp.getMinimumBpt();

        if (_amToLp <= _minBpt) {
            console.log("withdraw amount is low");
            return;
        }

        uint256 closeAmount = ((_lpBalance() * 98) / 100);

        if (_amToLp >= closeAmount || _amToLp <= _minBpt.mul(3)) {
            // withdrawAll
            console.log("! Balancer Strategy - withdrawing ALL");
            _withdrawAll();
            uint256 _bal = vaultPrimary.balanceOf(address(this));
            if (_bal > 0) {
                _deposit(address(vaultPrimary), _bal);
            }
            return;
        }
        // console.log("\t- @withdraw: available LP: %s; to withdraw Lp:", lp.balanceOf(address(this)), _amToLp);
        _arrangeLP(_amToLp);
        batchSwap(
            address(balancerVault),
            lpPoolId,
            amUsdcPoolId,
            IVault.SwapKind.GIVEN_IN,
            IAsset(address(lp)),
            IAsset(address(amUsdcToken)),
            IAsset(address(vaultPrimary)),
            address(this),
            payable(address(this)),
            _amToLp
        );
        _swapAssetToPrimaryStable();
        _sendBack(_beneficiary, _amount);
    }

    function _lpBalance() internal view returns (uint256) {
        return IERC20(address(gauge)).balanceOf(address(this)) + lp.balanceOf(address(this));
    }

    function _withdrawAll() internal {
        uint256 gaugeBalance = gauge.balanceOf(address(this));
        if (gaugeBalance > 0) {
            gauge.withdraw(gaugeBalance, true);
        }

        if (lp.balanceOf(address(this)) < lp.getMinimumBpt()) {
            console.log("balance low to swap");
            return;
        }

        batchSwap(
            address(balancerVault),
            lpPoolId,
            amUsdcPoolId,
            IVault.SwapKind.GIVEN_IN,
            IAsset(address(lp)),
            IAsset(address(amUsdcToken)),
            IAsset(address(vaultPrimary)),
            address(this),
            payable(address(this)),
            lp.balanceOf(address(this))
        );
    }

    function _sendBack(address _ben, uint256 _amount) internal {
        vaultPrimary.safeTransfer(_ben, _amount);
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _withdrawAll();
        _sendBack(vaultAddress, vaultPrimary.balanceOf(address(this)));
    }

    function checkBalance() external view override returns (uint256) {
        uint256 balance = vaultPrimary.balanceOf(address(this));
        uint256 lpBalance = lp.balanceOf(address(this)) + IERC20(address(gauge)).balanceOf(address(this));

        return balance + _lpToToken(lpBalance, address(amUsdcToken)); // bal in usdc
    }

    function _lpToToken(uint256 _amount, address _toToken) internal view returns (uint256) {
        uint256 rate = lp.getTokenRate(_toToken);
        return rate.scaleBy(6, 18).mul(_amount).div(1e18); // usdc decimals
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        _collectRewards();
    }

    function _collectRewards() internal {
        rewardHelper.claimRewardsFromGauge(address(gauge), address(this));

        uint256 totalUsdc = 0;
        uint256 balBalance = balToken.balanceOf(address(this));
        console.log("RewardCollection - BAL Balance: ", balBalance);

        if (balBalance > 10e5) {
            totalUsdc += swap(
                address(balancerVault),
                swapRewardsPool,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(balToken)),
                IAsset(address(vaultPrimary)),
                address(this),
                payable(address(this)),
                balBalance,
                0
            );
        } else {
            console.log("rewards balance too low");
        }

        uint256 balance = vaultPrimary.balanceOf(address(this));
        console.log("RewardCollection - BAL -> USDC Balance: ", balance);
        if (balance > 0) {
            emit RewardTokenCollected(harvesterAddress, address(vaultPrimary), balance);
            vaultPrimary.transfer(harvesterAddress, balance);
        }
    }

    function _swapAssetToPrimaryStable() internal {
        if ((address(token0) != address(vaultPrimary)) && (token0.balanceOf(address(this)) > 0)) {
            swap(swappingPool, address(token0), address(vaultPrimary), token0.balanceOf(address(this)), oracleRouter);
            if (token0.balanceOf(address(this)) > 0) {
                revert("ClearPool Strategy - Token0 to PrimarySwap failed");
            }
        }
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = vaultPrimary.balanceOf(address(this));
        if (address(vaultPrimary) != address(token0)) {
            swap(swappingPool, address(vaultPrimary), address(token0), primaryStableBalance, oracleRouter);
        }
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) external view override returns (bool) {
        return _asset == address(vaultPrimary);
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
    function _abstractSetPToken(address _asset, address _cToken) internal override {
        // Not needed
    }
}
