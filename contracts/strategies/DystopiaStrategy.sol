// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Dystopia Strategy
 * @notice Investment strategy for investing stablecoins via Dystopia Strategy
 * @author Stabl Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"  ;

import { IRewardStaking } from "./IRewardStaking.sol";
import { DystopiaExchange } from "./DystopiaExchange.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { AaveBorrowLibrary } from "../utils/AaveBorrowLibrary.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IDystopiaLP.sol";
import "../interfaces/ISwapper.sol";
import "../connectors/IUserProxy.sol";
import "../connectors/IPenLens.sol";
import "../exchanges/BalancerExchange.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import "hardhat/console.sol";
contract DystopiaStrategy is InitializableAbstractStrategy, DystopiaExchange, BalancerExchange  {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => uint256 ) public assetToDenominator;

    IDystopiaLP  public  gauge;
    IDystopiaLP  public  dystPair;

    address public  dystRouter;

    bytes32 public poolId;


    IERC20 public primaryStable;
    IERC20 public middleToken;
    IERC20 public token0;
    IERC20 public token1;

    IERC20 public dystToken;



    IERC20 public penToken;
    IUserProxy public userProxy;
    IPenLens public penLens;


    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Dystopia strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // dystToken address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC & DAI etc
        address[] calldata _pTokens, // DystPair
        address _primaryStable, // USDC
        address _intermediatory_token // wMATIC
    ) external onlyGovernor initializer {

        token0 = IERC20(_assets[0]);
        token1 = IERC20(_assets[1]);
        primaryStable = IERC20(_primaryStable);
        middleToken = IERC20(_intermediatory_token);

        dystToken = IERC20(_platformAddress);

        uint256 assetCount = _assets.length;
        require(assetCount == _pTokens.length, "Invalid input arrays");
        for (uint256 i = 0; i < assetCount; i++) {
            assetToDenominator[_assets[i]] = 10 ** IERC20Metadata(_assets[i]).decimals();
        }
        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }
    function setParams(
        address _gauge,
        address _dystPair,
        address _dystRouter,
        address _balancerVault, 
        bytes32 _poolId,// _poolIdUsdcTusdDaiUsdt
        address _userProxy,
        address _penLens,
        address _penToken
    ) external onlyGovernor {
        setBalancerVault(_balancerVault);
        poolId = _poolId;
        gauge = IDystopiaLP(_gauge);
        dystPair = IDystopiaLP(_dystPair);
        _setDystopiaRouter(_dystRouter);
        userProxy = IUserProxy(_userProxy);
        penLens = IPenLens(_penLens);
        penToken = IERC20(_penToken);
    }

    function getReserves() internal view returns (uint256,uint256) {
        (uint256 reserve0, uint256 reserve1,) = dystPair.getReserves();
        require(reserve0 > (10 ** (IERC20Metadata(address(token0) ).decimals() - 3))  && reserve1 > (10 ** (IERC20Metadata(address(token1) ).decimals() - 3)), "Reserves too low");
        return (reserve0, reserve1) ;
    }

    function _deposit(
        address _asset,
        uint256 _amount
    )  internal {

        require(_asset == address(primaryStable), "Token not supported.");
        (uint256 reserve0, uint256 reserve1) = getReserves();
        _swapPrimaryStableToToken0();

        // count amount token1 to swap
        uint256 token1Balance = token1.balanceOf(address(this));
        uint256 amount0From1;
        if (token1Balance > 0) {
            amount0From1 = onSwap(
                poolId,
                IVault.SwapKind.GIVEN_IN,
                token1,
                token0,
                token1Balance
            );
        }

        uint256 token0Balance = token0.balanceOf(address(this));
        // console.log("token0", address(token0));
        // console.log("token1", address(token1));
        // console.log("token0Balance", token0Balance);
        // console.log("token1Balance", token1Balance);
        // console.log("reserve0", reserve0);
        // console.log("reserve1", reserve1);
        uint256 amountToken0ToSwap = _getAmountToSwap(
            token0Balance,
            reserve0,
            reserve1,
            assetToDenominator[address(token0)],
            assetToDenominator[address(token1)],
            1,
            poolId,
            token0,
            token1
        );
        // console.log("amountToken0ToSwap", amountToken0ToSwap);
        // swap some of token0 to token1
        swap(
            poolId,
            IVault.SwapKind.GIVEN_IN,
            IAsset(address(token0)),
            IAsset(address(token1)),
            address(this),
            address(this),
            amountToken0ToSwap,
            0
        );

        // add liquidity
        token0Balance = token0.balanceOf(address(this));
        token1Balance = token1.balanceOf(address(this));

        _addLiquidity(
            address(token0),
            address(token1),
            token0Balance,
            token1Balance,
            OvnMath.subBasisPoints(token0Balance, BASIS_POINTS_FOR_SLIPPAGE),
            OvnMath.subBasisPoints(token1Balance, BASIS_POINTS_FOR_SLIPPAGE),
            address(this)
        );

        uint256 lpTokenBalance = dystPair.balanceOf(address(this));
         // console.log("Dyst LP Token Balance: ", lpTokenBalance);
        _stakeToPenrose(lpTokenBalance);

    }

    function deposit(
        address _asset,
        uint256 _amount
    )   external
        override
        onlyVault
        nonReentrant {

        require(_asset == address(primaryStable), "Token not supported.");
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

        require(_asset == address(primaryStable), "Token not supported.");
        (uint256 reserve0, uint256 reserve1) = getReserves();

        // Fetch amount of penPool LP currently staked
        address userProxyThis = penLens.userProxyByAccount(address(this));
        address stakingAddress = penLens.stakingRewardsByDystPool(address(dystPair));
        uint256 lpTokenBalance = IERC20(stakingAddress).balanceOf(userProxyThis);

        if (lpTokenBalance > 0) {
            // count amount to unstake
            uint256 totalLpBalance = dystPair.totalSupply();
            uint256 lpTokensToWithdraw = _getAmountLpTokensToWithdraw(
                OvnMath.addBasisPoints(_amount, BASIS_POINTS_FOR_SLIPPAGE),
                reserve0,
                reserve1,
                totalLpBalance,
                assetToDenominator[address(token0)],
                assetToDenominator[address(token1)],
                poolId,
                token0,
                token1
            );

            if (lpTokensToWithdraw > lpTokenBalance) {
                lpTokensToWithdraw = lpTokenBalance;
            }

            userProxy.unstakeLpAndWithdraw(address(dystPair), lpTokensToWithdraw);
            uint256 unstakedLPTokenBalance = dystPair.balanceOf(address(this));
            // remove liquidity
            _removeLiquidity(
                address(token0),
                address(token1),
                address(dystPair),
                unstakedLPTokenBalance,
                OvnMath.subBasisPoints(reserve0 * unstakedLPTokenBalance / totalLpBalance, BASIS_POINTS_FOR_SLIPPAGE),
                OvnMath.subBasisPoints(reserve1 * unstakedLPTokenBalance / totalLpBalance, BASIS_POINTS_FOR_SLIPPAGE),
                address(this)
            );
        }
        _swapAssetsToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
         // console.log("Withdraw USDC: ", primaryStableBalance);
        primaryStable.safeTransfer(_beneficiary, primaryStableBalance);
       
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant  {
        (uint256 reserve0, uint256 reserve1) = getReserves();
        _withdrawFromDystopiaAndStakeToPenrose();
        // Fetch amount of penPool LP currently staked
        address userProxyThis = penLens.userProxyByAccount(address(this));
        address stakingAddress = penLens.stakingRewardsByDystPool(address(dystPair));
        uint256 lpTokenBalance = IERC20(stakingAddress).balanceOf(userProxyThis);
        if (lpTokenBalance == 0) {
            return;
        }
        userProxy.unstakeLpAndWithdraw(address(dystPair), lpTokenBalance);
        uint256 unstakedLPTokenBalance = dystPair.balanceOf(address(this));
        if (unstakedLPTokenBalance > 0) {
            uint256 totalLpBalance = dystPair.totalSupply();
            uint256 amountOutUsdcMin = reserve0 * unstakedLPTokenBalance / totalLpBalance;
            uint256 amountOutOtherMin = reserve1 * unstakedLPTokenBalance / totalLpBalance;
            // remove liquidity
            _removeLiquidity(
                address(token0),
                address(token1),
                address(dystPair),
                unstakedLPTokenBalance,
                OvnMath.subBasisPoints(amountOutUsdcMin, BASIS_POINTS_FOR_SLIPPAGE),
                OvnMath.subBasisPoints(amountOutOtherMin, BASIS_POINTS_FOR_SLIPPAGE),
                address(this)
            );
        }

        _swapAssetsToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
         // console.log("Withdraw Primary Stable: ", primaryStableBalance);
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
        _collectRewards();
    }


    function checkBalance()
        external
        view
        override
        returns (uint256 balance)
    {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        uint256 token0Balance = token0.balanceOf(address(this));
        uint256 token1Balance = token1.balanceOf(address(this));

        // Fetch amount of penPool LP currently staked
        address userProxyThis = penLens.userProxyByAccount(address(this));
         // console.log("dystPair", address(dystPair));
        address stakingAddress = penLens.stakingRewardsByDystPool(address(dystPair));
         // console.log("stakingAddress: ", stakingAddress);
        uint256 lpTokenBalance = IERC20(stakingAddress).balanceOf(userProxyThis);
        lpTokenBalance += gauge.balanceOf(address(this));
        if (lpTokenBalance > 0) {
            uint256 totalLpBalance = dystPair.totalSupply();
            (uint256 reserve0, uint256 reserve1) = getReserves();
            token0Balance += reserve0 * lpTokenBalance / totalLpBalance;
            token1Balance += reserve1 * lpTokenBalance / totalLpBalance;
        }
        // console.log("tokenBalance", token0Balance, token1Balance);

        uint256 primaryStableBalanceFromToken0;
        if ( (address(token0) != address(primaryStable))  ) {
            if (token0Balance > 0) {
                primaryStableBalanceFromToken0 = onSwap(
                    poolId,
                    IVault.SwapKind.GIVEN_IN,
                    token0,
                    primaryStable,
                    token0Balance
                );
                // console.log("Token0 swap -  primaryStableBalanceFromToken0 ", primaryStableBalanceFromToken0);
            }
        } else {
            primaryStableBalanceFromToken0 += token0Balance;
        }

        uint256 primaryStableBalanceFromToken1;
        if ( (address(token1) != address(primaryStable))  ) {
            if (token1Balance > 0) {
                primaryStableBalanceFromToken1 = onSwap(
                    poolId,
                    IVault.SwapKind.GIVEN_IN,
                    token1,
                    primaryStable,
                    token1Balance
                );
                // console.log("Token1 swap -  primaryStableBalanceFromToken1 ", primaryStableBalanceFromToken1);
            }
        } else {
            primaryStableBalanceFromToken1 += token1Balance;
        }
         // console.log("primaryStableBalanceFromToken0: ", primaryStableBalanceFromToken0);
         // console.log("primaryStableBalanceFromToken1: ", primaryStableBalanceFromToken1);
        return primaryStableBalanceFromToken0 + primaryStableBalanceFromToken1 + primaryStableBalance;
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
         console.log("Starting collection of rewards");
        _withdrawFromDystopiaAndStakeToPenrose();

         console.log("_withdrawFromDystopiaAndStakeToPenrose called");
        // claim rewards
        userProxy.claimStakingRewards();
         console.log("claimStakingRewards called");
        // sell rewards
        uint256 totalUsdc;

        uint256 dystBalance = dystToken.balanceOf(address(this));
         console.log("dystBalance: ", dystBalance);
        if (dystBalance > 0) {
            uint256 dystUsdc = _swapExactTokensForTokens(
                address(dystToken),
                address(middleToken),
                address(token0),
                false,
                false,
                dystBalance,
                address(this)
            );
            totalUsdc += dystUsdc;
        }
         console.log("totalUsdc=",totalUsdc);
        uint256 penBalance = penToken.balanceOf(address(this));
        console.log("penBalance: ", penBalance);
        if (penBalance > 0) {
            uint256 penUsdc = _swapExactTokensForTokens(
                address(penToken),
                address(middleToken),
                address(primaryStable),
                false,
                false,
                penBalance,
                address(this)
            );
            console.log("penUsdc",penUsdc);
            totalUsdc += penUsdc;
        }
        uint256 balance = primaryStable.balanceOf(address(this));
        console.log("balance: ", balance);
        emit RewardTokenCollected(
            harvesterAddress,
            address(primaryStable),
            balance
        );
        primaryStable.transfer(harvesterAddress, balance);
    }
    function _withdrawFromDystopiaAndStakeToPenrose() internal {
        uint256 lpTokenBalance = gauge.balanceOf(address(this));
        if (lpTokenBalance > 0) {
            // claim rewards
            address[] memory token = new address[](1);
            token[0] = address(dystToken);
            gauge.getReward(address(this), token);

            // withdraw LP tokens and stake
            gauge.withdrawAll();
            uint256 lpTokenBalance = dystPair.balanceOf(address(this));
            dystPair.approve(address(userProxy), lpTokenBalance);
            userProxy.depositLpAndStake(address(dystPair), lpTokenBalance);
        }
    }
    function _stakeToPenrose(uint256 _lpTokenAmount) internal {
        dystPair.approve(address(userProxy), _lpTokenAmount);
        userProxy.depositLpAndStake(address(dystPair), _lpTokenAmount);
        uint256 penBalance = penToken.balanceOf(address(this));
         // console.log("penBalance: ", penBalance);
    }

    function _swapAssetsToPrimaryStable() internal {
        if ( (address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > 0) )  {
             // console.log("Swapping token0");
            swap(
                poolId,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(token0)),
                IAsset(address(primaryStable)),
                address(this),
                address(this),
                token0.balanceOf(address(this)),
                0
            );
        }
        if ( (address(token1) != address(primaryStable)) && (token1.balanceOf(address(this)) > 0) )  {
             // console.log("Swapping token1");
            swap(
                poolId,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(token1)),
                IAsset(address(primaryStable)),
                address(this),
                address(this),
                token1.balanceOf(address(this)),
                0
            );
        }
    }
    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(
                poolId,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(primaryStable)),
                IAsset(address(token0)),
                address(this),
                address(this),
                primaryStableBalance,
                0
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
        // NOT NEEDED
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
        // NOT NEEDED
    }
   
}
