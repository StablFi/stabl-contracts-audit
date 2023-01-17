// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Dystopia Strategy
 * @notice Investment strategy for investing stablecoins via Dystopia Strategy
 * @author Stabl Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"  ;
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { StableMath } from "../utils/StableMath.sol";

import { DystopiaExchange } from "./DystopiaExchange.sol";
import "../interfaces/IDystopiaLP.sol";
import "../interfaces/IMiniVault.sol";
import "../connectors/IUserProxy.sol";
import "../connectors/IPenLens.sol";
import "../exchanges/CurveExchange.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../utils/Helpers.sol";
import "hardhat/console.sol";


contract DystopiaStrategy is InitializableAbstractStrategy, DystopiaExchange, CurveExchange  {
    using SafeMath for uint256;
    using OvnMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => uint256 ) public assetToDenominator;

    IDystopiaLP  public  gauge;
    IDystopiaLP  public  dystPair;

    address public  dystRouter;

    bytes32 public poolId; // NOT USED


    IERC20 public primaryStable;
    IERC20 public middleToken;
    IERC20 public token0;
    IERC20 public token1;

    IERC20 public dystToken;



    IERC20 public penToken;
    IUserProxy public userProxy;
    IPenLens public penLens;

    address public swappingPool;
    uint256[] public minThresholds;
    address public oracleRouter;

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

        poolId = _poolId;
        gauge = IDystopiaLP(_gauge);
        dystPair = IDystopiaLP(_dystPair);
        _setDystopiaRouter(_dystRouter);
        userProxy = IUserProxy(_userProxy);
        penLens = IPenLens(_penLens);
        penToken = IERC20(_penToken);
        // Putting Thresholds in Place
        for (uint8 i = 0; i < 4; i++) {
            minThresholds.push(0);
        }
        // minThresholds.push(10 ** (Helpers.getDecimals(address(token0)) - 1));  // 0.1 token0
        // minThresholds.push(10 ** (Helpers.getDecimals(address(token1)) - 1));  // 0.1 token1
        // minThresholds.push(10 ** (Helpers.getDecimals(address(primaryStable)) - 1));  // 0.1 PS
        // minThresholds.push(10 ** (Helpers.getDecimals(address(dystPair)) - 1)); // 0.1 LP token
    }
    function setOracleRouterPriceProvider() external onlyGovernor {
        swappingPool = IMiniVault(vaultAddress).swappingPool();
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function getReserves() internal view returns (uint256,uint256) {
        (uint256 reserve0, uint256 reserve1,) = dystPair.getReserves();
        require(reserve0 > (10 ** (Helpers.getDecimals(address(token0)) - 3))  && reserve1 > (10 ** (Helpers.getDecimals(address(token1)) - 3)), "Reserves too low");
        return (reserve0, reserve1) ;
    }
    function divideBasedOnReserves(uint256 _psAmount) internal view returns (uint256,uint256) {
        ( uint256 reserve0, uint256  reserve1) = getReserves();
        // Scale both reserves to 18 decimals
        reserve0 = reserve0.scaleBy(18,IERC20Metadata(address(token0) ).decimals());
        reserve1 = reserve1.scaleBy(18,IERC20Metadata(address(token1) ).decimals());
        // Divide _psAmount in the ratio of reserve 0 and reserve 1
        uint256 amount0ToSwap = _psAmount.mul(reserve0).div(reserve0.add(reserve1));
        uint256 amount1ToSwap = _psAmount.sub(amount0ToSwap);
        return (amount0ToSwap, amount1ToSwap);

    }
    // TODO: _amount is not being used.
    function _deposit(address _asset, uint256 _amount)  internal {
        require(_asset == address(primaryStable), "Token not supported.");
        (uint256 _amount0ToSwap,uint256 _amount1ToSwap) = divideBasedOnReserves(_amount);
        if (_amount0ToSwap > 0 && address(token0) != address(primaryStable)) {
            swap(
                swappingPool,
                address(primaryStable),
                address(token0),
                _amount0ToSwap,
                oracleRouter
            );
        }
        if (_amount1ToSwap > 0 && address(token1) != address(primaryStable)) {
             swap(
                swappingPool,
                address(primaryStable),
                address(token1),
                _amount1ToSwap,
                oracleRouter
            );
        }
    
        // add liquidity
        uint256 token0Balance = token0.balanceOf(address(this));
        uint256 token1Balance = token1.balanceOf(address(this));
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
    function _lpToWithdraw(uint256 _amount0ToSwap, uint256 _amount1ToSwap, uint256 _totalLP, uint256 _r0, uint256 _r1) internal pure returns (uint256) {
        uint256 lpForA0 = _amount0ToSwap.mul(_totalLP).div(_r0);
        uint256 lpForA1 = _amount1ToSwap.mul(_totalLP).div(_r1);
        uint256 lpToWithdraw =  lpForA0 > lpForA1 ? lpForA0 : lpForA1;
        return lpToWithdraw;
    }
    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVaultOrGovernor nonReentrant  {

        require(_asset == address(primaryStable), "Token not supported.");
        (uint256 reserve0, uint256 reserve1) = getReserves();

        // Fetch amount of penPool LP currently staked
        address userProxyThis = penLens.userProxyByAccount(address(this));
        address stakingAddress = penLens.stakingRewardsByDystPool(address(dystPair));
        uint256 lpTokenBalance = IERC20(stakingAddress).balanceOf(userProxyThis) + dystPair.balanceOf(userProxyThis);
        (uint256 _amount0ToSwap,uint256 _amount1ToSwap) = divideBasedOnReserves(_amount.sub(primaryStable.balanceOf(address(this))));


        if (lpTokenBalance > minThresholds[3]) {
            uint256 totalLpBalance = dystPair.totalSupply();
            uint256 lpTokensToWithdraw = _lpToWithdraw(_amount0ToSwap, _amount1ToSwap, totalLpBalance, reserve0, reserve1).addBasisPoints(200);
            if (lpTokensToWithdraw > lpTokenBalance) {
                lpTokensToWithdraw = lpTokenBalance;
            }
            uint256 amountOut0Min = reserve0 * lpTokensToWithdraw / totalLpBalance;
            uint256 amountOut1Min = reserve1 * lpTokensToWithdraw / totalLpBalance;

            if (dystPair.balanceOf(address(this)) < lpTokensToWithdraw) {
                userProxy.unstakeLpAndWithdraw(address(dystPair), lpTokensToWithdraw - dystPair.balanceOf(address(this)));
            }
            uint256 unstakedLPTokenBalance = dystPair.balanceOf(address(this));
            // remove liquidity
            _removeLiquidity(
                address(token0),
                address(token1),
                address(dystPair),
                unstakedLPTokenBalance,
                amountOut0Min,
                amountOut1Min,
                address(this)
            );
        }
        _swapAssetsToPrimaryStable();
        primaryStable.safeTransfer(_beneficiary, _amount);
       
    }

    function withdrawAll() external override onlyVault nonReentrant  {
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
    }


    function checkBalance()
        external
        view
        override
        returns (uint256 balance)
    {
        // uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        uint256 token0Balance = token0.balanceOf(address(this));
        uint256 token1Balance = token1.balanceOf(address(this));

        address userProxyThis = penLens.userProxyByAccount(address(this));
        address stakingAddress = penLens.stakingRewardsByDystPool(address(dystPair));
        uint256 lpTokenBalance = IERC20(stakingAddress).balanceOf(userProxyThis);
        lpTokenBalance += gauge.balanceOf(address(this));
        lpTokenBalance += dystPair.balanceOf(address(this));

        if (lpTokenBalance > 0) {
            uint256 totalLpBalance = dystPair.totalSupply();
            (uint256 reserve0, uint256 reserve1) = getReserves();
            token0Balance += reserve0 * lpTokenBalance / totalLpBalance;
            token1Balance += reserve1 * lpTokenBalance / totalLpBalance;
        }

       uint256 primaryStableBalanceFromToken0;
        if ( (address(token0) != address(primaryStable))  ) {
            if (token0Balance > minThresholds[0]) {
                primaryStableBalanceFromToken0 = onSwap(
                    swappingPool,
                    address(token0),
                    address(primaryStable),
                    token0Balance
                );
            }
        } else {
            primaryStableBalanceFromToken0 += token0Balance;
        }

        uint256 primaryStableBalanceFromToken1;
        if ( (address(token1) != address(primaryStable))  ) {
            if (token1Balance > minThresholds[1]) {
                primaryStableBalanceFromToken1 = onSwap(
                    swappingPool,
                    address(token1),
                    address(primaryStable),
                    token1Balance
                );
            }
        } else {
            primaryStableBalanceFromToken1 += token1Balance;
        }
        return primaryStableBalanceFromToken0 + primaryStableBalanceFromToken1;
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
        _withdrawFromDystopiaAndStakeToPenrose();
        // claim rewards
        userProxy.claimStakingRewards();
        // sell rewards
        uint256 totalUsdc;

        uint256 dystBalance = dystToken.balanceOf(address(this));
        console.log("RewardCollection - DYST Balance: ", dystBalance);
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
        uint256 penBalance = penToken.balanceOf(address(this));
        console.log("RewardCollection - PEN Balance: ", penBalance);
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
            totalUsdc += penUsdc;
        }
        uint256 balance = primaryStable.balanceOf(address(this));
        console.log("RewardCollection - (DODO+WMATIC) -> USDC Balance: ", balance);
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
            // Reusing lpTokenBalance for Balance of dystPair
            lpTokenBalance = dystPair.balanceOf(address(this));
            dystPair.approve(address(userProxy), lpTokenBalance);
            userProxy.depositLpAndStake(address(dystPair), lpTokenBalance);
        }
    }
    function _stakeToPenrose(uint256 _lpTokenAmount) internal {
        dystPair.approve(address(userProxy), _lpTokenAmount);
        userProxy.depositLpAndStake(address(dystPair), _lpTokenAmount);
        // uint256 penBalance = penToken.balanceOf(address(this));
        // console.log("penBalance: ", penBalance);
    }

    function _swapAssetsToPrimaryStable() internal {
        if ( (address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > minThresholds[0]) )  {
            swap(
                swappingPool,
                address(token0),
                address(primaryStable),
                token0.balanceOf(address(this)),
                oracleRouter
            );
        }
        if ( (address(token1) != address(primaryStable)) && (token1.balanceOf(address(this)) > minThresholds[1])  )  {
            swap(
                swappingPool,
                address(token1),
                address(primaryStable),
                token1.balanceOf(address(this)),
                oracleRouter
            );
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

    function setThresholds(uint256[] calldata _minThresholds) external onlyVaultOrGovernor nonReentrant {
        require(_minThresholds.length == 4, "4 thresholds needed");
        // minThresholds[0] - token0 minimum swapping threshold
        // minThresholds[1] - token1 minimum swapping threshold
        // minThresholds[2] - primaryStable to token0 minimum swapping threshold
        // minThresholds[3] - lp token minimum swapping threshold
        minThresholds = _minThresholds;
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
