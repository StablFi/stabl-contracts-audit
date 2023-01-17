// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title QuickSwap Strategy
 * @notice Investment strategy for investing stablecoins via QuickSwap Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { StableMath } from "../utils/StableMath.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"  ;
import "../exchanges/UniswapV2Exchange.sol";
import "../exchanges/CurveExchange.sol";
import "../connectors/uniswap/v2/interfaces/IUniswapV2Router02.sol";
import "../connectors/quickswap/IStakingRewards.sol";
import "../connectors/uniswap/v2/interfaces/IUniswapV2Pair.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../interfaces/IMiniVault.sol";
import "hardhat/console.sol";


contract QuickSwapStrategy is InitializableAbstractStrategy, UniswapV2Exchange, CurveExchange   {
    using SafeMath for uint256;
    using OvnMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;


    IERC20 public token0;
    IERC20 public token1;
    IERC20 public primaryStable;
    IERC20 public quickTokenNew;
    IERC20 public quickDragon;

    IUniswapV2Pair public quickSwapPair;
    bytes32 public poolId; //UNUSED

    mapping(address => uint256 ) public assetToDenominator;
    IStakingRewards public quickSwapPairStaker;

    address public swappingPool;
    uint256[] public minThresholds;
    address public oracleRouter;


    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as QuickSwap strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // QuickToken address
        address _vaultAddress,    // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // USDC + DAI
        address[] calldata _pTokens, //  quickSwapUSDCDAIPair
        address _primaryStable, // USDC address
        address _router, // quickSwapRouter02
        address _staker, // quickSwapStakingReward
        address _rewardToken // quickSwapDragonQuick
    ) external onlyGovernor initializer {
        require(_rewardTokenAddresses[0] != address(0), "Zero address not allowed");
        require(_pTokens[0] != address(0), "Zero address not allowed");
        require(_platformAddress != address(0), "Zero address not allowed");
        require(_router != address(0), "Zero address not allowed");
        require(_staker != address(0), "Zero address not allowed");
        require(_rewardToken != address(0), "Zero address not allowed");
       

        token0 = IERC20(_assets[0]);
        token1 = IERC20(_assets[1]);
        primaryStable = IERC20(_primaryStable);
        quickTokenNew = IERC20(_platformAddress);
        quickDragon = IERC20(_rewardToken);

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; i++) {
            assetToDenominator[_assets[i]] = 10 ** IERC20Metadata(_assets[i]).decimals();
        }
        quickSwapPair = IUniswapV2Pair(_pTokens[0]);
        quickSwapPairStaker = IStakingRewards(_staker);
        _setUniswapRouter(_router);

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _abstractSetPToken(_assets[0],_pTokens[0]);
        _abstractSetPToken(_assets[1],_pTokens[1]);
        for (uint8 i = 0; i < 5; i++) {
            minThresholds.push(0);
        }
    }
    function setOracleRouterPriceProvider() external onlyGovernor {
        swappingPool = IMiniVault(vaultAddress).swappingPool();
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }
    function getReserves() internal view returns (uint256,uint256) {
        ( uint256 reserve0, uint256  reserve1,) = quickSwapPair.getReserves();
        require(reserve0 > (10 ** (IERC20Metadata(address(token0) ).decimals() - 3))  && reserve1 > (10 ** (IERC20Metadata(address(token1) ).decimals() - 3)), "Reserves too low");
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
    function _deposit(
        address _asset,
        uint256 _amount
    )  internal {
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
        // console.log("LP: ", quickSwapPair.balanceOf(address(this)) );
        stakeLPForDragon();
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
        (uint256 reserve0, uint256 reserve1,) = quickSwapPair.getReserves();
        (uint256 _amount0ToSwap,uint256 _amount1ToSwap) = divideBasedOnReserves(_amount.sub(primaryStable.balanceOf(address(this))));
        uint256 lpTokenBalance = quickSwapPairStaker.balanceOf(address(this)) + quickSwapPair.balanceOf(address(this));
        if (lpTokenBalance > minThresholds[3]) {
            // count amount to unstake
            uint256 totalLpBalance = quickSwapPair.totalSupply();
            uint256 lpTokensToWithdraw = _lpToWithdraw(_amount0ToSwap, _amount1ToSwap, totalLpBalance, reserve0, reserve1).addBasisPoints(200);
            if (lpTokensToWithdraw > lpTokenBalance) {
                lpTokensToWithdraw = lpTokenBalance;
            }
            uint256 amountOut0Min = reserve0 * lpTokensToWithdraw / totalLpBalance;
            uint256 amountOut1Min = reserve1 * lpTokensToWithdraw / totalLpBalance;
            unstakeDragonForLP(lpTokensToWithdraw-quickSwapPair.balanceOf(address(this)));
            _removeLiquidity(
                address(token0),
                address(token1),
                address(quickSwapPair),
                lpTokensToWithdraw,
                OvnMath.subBasisPoints(amountOut0Min, BASIS_POINTS_FOR_SLIPPAGE),
                OvnMath.subBasisPoints(amountOut1Min, BASIS_POINTS_FOR_SLIPPAGE),
                address(this)
            );
        }
        _swapAssetsToPrimaryStable();
        primaryStable.safeTransfer(_beneficiary, _amount);
    }

    function withdrawAll() external override onlyVault nonReentrant  {
        (uint256 reserve0, uint256 reserve1,) = quickSwapPair.getReserves();

        unstakeDragonForLP();
        uint256 lpTokenBalance = quickSwapPair.balanceOf(address(this));
        if (lpTokenBalance > minThresholds[3]) {
            uint256 totalLpBalance = quickSwapPair.totalSupply();
            uint256 amountOut0Min = reserve0 * lpTokenBalance / totalLpBalance;
            uint256 amountOut1Min = reserve1 * lpTokenBalance / totalLpBalance;
            // remove liquidity
            _removeLiquidity(
                address(token0),
                address(token1),
                address(quickSwapPair),
                lpTokenBalance,
                OvnMath.subBasisPoints(amountOut0Min, BASIS_POINTS_FOR_SLIPPAGE),
                OvnMath.subBasisPoints(amountOut1Min, BASIS_POINTS_FOR_SLIPPAGE),
                address(this)
            );
        }
        _swapAssetsToPrimaryStable();

        lpTokenBalance = quickSwapPair.balanceOf(address(this));
        if (lpTokenBalance > 0) {
            stakeLPForDragon();
        }
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("Withdraw Primary Stable: ", primaryStableBalance);
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
    }
    function checkBalance()
        external
        view
        override
        returns (uint256)
    {
        uint256 token0Balance = token0.balanceOf(address(this));
        uint256 token1Balance = token1.balanceOf(address(this));

        uint256 lpTokenBalance = quickSwapPairStaker.balanceOf(address(this)).add(quickSwapPair.balanceOf(address(this)));
        if (lpTokenBalance > minThresholds[3]) {
            uint256 totalLpBalance = quickSwapPair.totalSupply();
            (uint256 reserve0, uint256 reserve1,) = quickSwapPair.getReserves();
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
    function stakeLPForDragon() internal {
        uint256 lpTokenBalance = quickSwapPair.balanceOf(address(this));
        // console.log("Staking lpTokenBalance", lpTokenBalance);
        IUniswapV2Pair(quickSwapPair).approve(address(quickSwapPairStaker), lpTokenBalance);
        quickSwapPairStaker.stake(lpTokenBalance);
        // console.log("LP Balance staked: ", quickSwapPairStaker.balanceOf(address(this)));
    }
    function unstakeDragonForLP(uint256 _amount)  internal{
        quickSwapPairStaker.withdraw(_amount);
    }
    function unstakeDragonForLP()  internal {
        quickSwapPairStaker.exit();
    }
    function _collectRewards() internal {
        // claim rewards
        quickSwapPairStaker.getReward();
        // sell rewards
        uint256 totalRewards = 0;
        uint256 quickDragonBalance = quickDragon.balanceOf(address(this));
        console.log("RewardCollection - QUICKDRAGON Balance: ", quickDragonBalance);
        if (quickDragonBalance > minThresholds[4]) {
            uint256 quickReward = _swapExactTokensForTokens(
                address(quickDragon),
                address(primaryStable),
                quickDragonBalance,
                address(this)
            );
            totalRewards += quickReward;
        }
        uint256 balance = primaryStable.balanceOf(address(this));
        console.log("RewardCollection - QUICKDRAGON -> USDC Balance: ", balance);
        if (balance > 0) {
            emit RewardTokenCollected(
                harvesterAddress,
                address(primaryStable),
                balance
            );
            primaryStable.transfer(harvesterAddress, balance);
        }
    }
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        _collectRewards();
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
        require(_minThresholds.length == 5, "5 thresholds needed");
        // minThresholds[0] - token0 minimum swapping threshold
        // minThresholds[1] - token1 minimum swapping threshold
        // minThresholds[2] - primaryStable to token0 minimum swapping threshold
        // minThresholds[3] - lp token minimum swapping threshold
        // minThresholds[4] - reward token (QUICKDRAGON) minimum swapping threshold
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
    }
   
}
