// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title MeshSwap Strategy
 * @notice Investment strategy for investing stablecoins via NeshSwap Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"  ;

import { StableMath } from "../utils/StableMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";

import "../exchanges/UniswapV2Exchange.sol";
import { AaveBorrowLibrary } from "../utils/AaveBorrowLibrary.sol";
import "../interfaces/IPriceFeed.sol";
import "../exchanges/BalancerExchange.sol";
import "../interfaces/IMeshSwapLP.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "hardhat/console.sol";


contract MeshSwapStrategyDual is InitializableAbstractStrategy, UniswapV2Exchange, BalancerExchange   {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using OvnMath for uint256;


    IERC20 public token0;
    IERC20 public token1;
    IERC20 public primaryStable;
    IERC20 public meshToken;

    IMeshSwapLP public meshSwapPair;
    bytes32 public poolId;

    mapping(address => address) public assetToChainlink;
    mapping(address => uint256 ) public assetToDenominator;


    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as MeshSwap strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // MeshToken address
        address _vaultAddress,    // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // token0 + token1 (Ex. USDT)
        address[] calldata _pTokens, //  MeshSwapPair (Ex: meshSwapUsdcUsdt)
        address _router, // meshSwapRouter
        address _primaryStable, // USDC
        address[] calldata _chainLinks // chainlink, 0: primaryStable, 1: token0, 2: token1
    ) external onlyGovernor initializer {
        token0 = IERC20(_assets[0]);
        token1 = IERC20(_assets[1]);

        primaryStable = IERC20(_primaryStable);
        meshToken = IERC20(_platformAddress);

        uint256 assetCount = _assets.length;
        assetToChainlink[_primaryStable] = _chainLinks[0];
        assetToDenominator[_primaryStable] = 10 ** IERC20Metadata(_primaryStable).decimals();
        for (uint256 i = 0; i < assetCount; i++) {
            assetToChainlink[_assets[i]] = _chainLinks[i+1];
            assetToDenominator[_assets[i]] = 10 ** IERC20Metadata(_assets[i]).decimals();
        }
        meshSwapPair = IMeshSwapLP(_pTokens[0]);
        _setUniswapRouter(_router);
        _abstractSetPToken(_assets[0],_pTokens[0]);
        _abstractSetPToken(_assets[1],_pTokens[1]);

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    function setBalancer(address _balancerVault, bytes32 _balancerPoolIdUsdcTusdDaiUsdt) external onlyGovernor {
        require(_balancerVault != address(0), "Zero address not allowed");
        require(_balancerPoolIdUsdcTusdDaiUsdt != "", "Empty pool id not allowed");

        setBalancerVault(_balancerVault);
        poolId = _balancerPoolIdUsdcTusdDaiUsdt;
    }

    function getReserves() internal view returns (uint256,uint256,uint256) {
        (uint256 reserve0, uint256  reserve1,) = meshSwapPair.getReserves();
        require(reserve0 > (10 ** (IERC20Metadata(address(token0) ).decimals() - 3))  && reserve1 > (10 ** (IERC20Metadata(address(token1) ).decimals() - 3)), "Reserves too low");
        return (reserve0, reserve1, meshSwapPair.totalSupply()) ;

    }

    function _deposit(
        address _asset,
        uint256 _amount
    )  internal {

        require(_asset == address(primaryStable), "Token not supported.");
        (uint256 reserve0, uint256 reserve1, uint256 totalSupply) = getReserves();
        _swapPrimaryStableToToken0();
        // count amount token1 to swap
        uint256 token1Balance = token1.balanceOf(address(this));
        uint256 amountToken0FromToken1;
        if (token1Balance > 0) {
            amountToken0FromToken1 = onSwap(
                poolId,
                IVault.SwapKind.GIVEN_IN,
                token1,
                token0,
                token1Balance
            );
        }
        uint256 token0Balance = token0.balanceOf(address(this));
        //TODO add parameter to _getAmountToSwap() second token amount
        uint256 amountUsdcToSwap = _getAmountToSwap(
            token0Balance - (amountToken0FromToken1 / 2),
            reserve0,
            reserve1,
            assetToDenominator[address(token0)],
            assetToDenominator[address(token1)],
            1,
            poolId,
            token0,
            token1
        );

        // swap token0 to other token
        swap(
            poolId,
            IVault.SwapKind.GIVEN_IN,
            IAsset(address(token0)),
            IAsset(address(token1)),
            address(this),
            address(this),
            amountUsdcToSwap,
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
        uint256 lpTokenBalance = meshSwapPair.balanceOf(address(this));
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
        (uint256 reserve0, uint256 reserve1,) = meshSwapPair.getReserves();

        uint256 lpTokenBalance = meshSwapPair.balanceOf(address(this));
        if (lpTokenBalance > 0) {
            // count amount to unstake
            uint256 totalLpBalance = meshSwapPair.totalSupply();
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
            uint256 amountOutToken0Min = reserve0 * lpTokensToWithdraw / totalLpBalance;
            uint256 amountOutToken1Min = reserve1 * lpTokensToWithdraw / totalLpBalance;
             // console.log("lpTokensToWithdraw: ", lpTokensToWithdraw);

            // remove liquidity
            _removeLiquidity(
                address(token0),
                address(token1),
                address(meshSwapPair),
                lpTokensToWithdraw,
                OvnMath.subBasisPoints(amountOutToken0Min, BASIS_POINTS_FOR_SLIPPAGE),
                OvnMath.subBasisPoints(amountOutToken1Min, BASIS_POINTS_FOR_SLIPPAGE),
                address(this)
            );
        }

        _swapAssetsToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
         // console.log("Withdraw USDC: ", primaryStableBalance);
        primaryStable.safeTransfer(_beneficiary, primaryStableBalance);
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant  {
         // console.log("withdrawAll");
        (uint256 reserve0, uint256 reserve1,) = meshSwapPair.getReserves();
        uint256 lpTokenBalance = meshSwapPair.balanceOf(address(this));
         // console.log("Token0 Balance: ", token0.balanceOf(address(this)));
         // console.log("Token1 Balance: ", token1.balanceOf(address(this)));
         // console.log("LP Token Balance: ", meshSwapPair.balanceOf(address(this)));
        if (lpTokenBalance > 0) {
            uint256 totalLpBalance = meshSwapPair.totalSupply();
            uint256 amountOutToken0Min = reserve0 * lpTokenBalance / totalLpBalance;
            uint256 amountOutToken1Min = reserve1 * lpTokenBalance / totalLpBalance;

            // remove liquidity
            _removeLiquidity(
                address(token0),
                address(token1),
                address(meshSwapPair),
                lpTokenBalance,
                OvnMath.subBasisPoints(amountOutToken0Min, BASIS_POINTS_FOR_SLIPPAGE),
                OvnMath.subBasisPoints(amountOutToken1Min, BASIS_POINTS_FOR_SLIPPAGE),
                address(this)
            );
        }
         // console.log("Token0 Balance: ", token0.balanceOf(address(this)));
         // console.log("Token1 Balance: ", token1.balanceOf(address(this)));
         // console.log("LP Token Balance: ", meshSwapPair.balanceOf(address(this)));
        _swapAssetsToPrimaryStable();

         // console.log("After removing liquidity  primaryStableBalance:",primaryStable.balanceOf(address(this)));
         // console.log("After removing liquidity token0Balance:", token0.balanceOf(address(this)));
         // console.log("After removing liquidity token1Balance:", token1.balanceOf(address(this)) );
         // console.log("After removing liquidity meshSwapPair:", meshSwapPair.balanceOf(address(this)));

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
         // console.log("Withdraw Primary Stable: ", primaryStableBalance);
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
        _collectRewards();
    }
    function _totalValue(bool nav) internal view returns (uint256) {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        uint256 token0Balance = token0.balanceOf(address(this));
        uint256 token1Balance = token1.balanceOf(address(this));
         // console.log("primaryStableBalance: ", primaryStableBalance);
        uint256 lpTokenBalance = meshSwapPair.balanceOf(address(this));
        if (lpTokenBalance > 0) {
            uint256 totalLpBalance = meshSwapPair.totalSupply();
            (uint256 reserve0, uint256 reserve1,) = meshSwapPair.getReserves();
            token0Balance += reserve0 * lpTokenBalance / totalLpBalance;
            token1Balance += reserve1 * lpTokenBalance / totalLpBalance;
        }
         // console.log("token0Balance: ", token0Balance);
         // console.log("token1Balance: ", token1Balance);
        uint256 primaryStableBalanceFromToken0;
        if ( (address(token0) != address(primaryStable))  ) {
            if (token0Balance > 0) {
                if (nav) {
                    uint256 pricePrimaryStable = uint256(IPriceFeed(assetToChainlink[address(primaryStable)]).latestAnswer());
                     // console.log("Token0 oracle -  pricePrimaryStable ", pricePrimaryStable);
                    uint256 pricetoken0 = uint256(IPriceFeed(assetToChainlink[address(token0)]).latestAnswer());
                     // console.log("Token0 oracle -  pricetoken0 ", pricetoken0);
                    primaryStableBalanceFromToken0 = (token0Balance * assetToDenominator[address(primaryStable)] * pricetoken0) / (assetToDenominator[address(token0)] * pricePrimaryStable);
                     // console.log("Token0 oracle -  primaryStableBalanceFromToken0 ", primaryStableBalanceFromToken0);
                } else {
                     // console.log("Token0 swap -  token0Balance ", token0Balance);

                    primaryStableBalanceFromToken0 = onSwap(
                        poolId,
                        IVault.SwapKind.GIVEN_IN,
                        token0,
                        primaryStable,
                        token0Balance
                    );
                     // console.log("Token0 swap -  primaryStableBalanceFromToken0 ", primaryStableBalanceFromToken0);

                }
            }
        } else {
            primaryStableBalanceFromToken0 += token0Balance;
        }

        uint256 primaryStableBalanceFromToken1;
        if ( (address(token1) != address(primaryStable))  ) {
            if (token1Balance > 0) {
                if (nav) {
                    uint256 pricePrimaryStable = uint256(IPriceFeed(assetToChainlink[address(primaryStable)]).latestAnswer());
                     // console.log("Token1 oracle -  pricePrimaryStable ", pricePrimaryStable);
                    uint256 pricetoken1 = uint256(IPriceFeed(assetToChainlink[address(token1)]).latestAnswer());
                     // console.log("Token1 oracle -  pricetoken0 ", pricetoken1);
                    primaryStableBalanceFromToken1 = (token1Balance * assetToDenominator[address(primaryStable)] * pricetoken1) / (assetToDenominator[address(token1)] * pricePrimaryStable);
                     // console.log("Token1 oracle -  primaryStableBalanceFromToken0 ", primaryStableBalanceFromToken1);
                } else {
                     // console.log("Token1 swap -  token1Balance ", token1Balance);
                    primaryStableBalanceFromToken1 = onSwap(
                        poolId,
                        IVault.SwapKind.GIVEN_IN,
                        token1,
                        primaryStable,
                        token1Balance
                    );
                     // console.log("Token1 swap -  primaryStableBalanceFromToken1 ", primaryStableBalanceFromToken1);
                }
            }
        } else {
            primaryStableBalanceFromToken1 += token1Balance;
        }
         // console.log("primaryStableBalanceFromToken0: ", primaryStableBalanceFromToken0);
         // console.log("primaryStableBalanceFromToken1: ", primaryStableBalanceFromToken1);
        return primaryStableBalanceFromToken0 + primaryStableBalanceFromToken1 + primaryStableBalance;
    }
    function netAssetValue() external view  returns (uint256) {
        return _totalValue(true);
    }
    function checkBalance()
        external
        view
        override
        returns (uint256)
    {
        return _totalValue(false);
    }

    function _collectRewards() internal {
         // console.log("Starting collection of rewards");
        // claim rewards
        meshSwapPair.claimReward();
         // console.log("claimStakingRewards called");
        // sell rewards
        uint256 totalUsdc;
        uint256 meshBalance = meshToken.balanceOf(address(this));
        if (meshBalance > 10 ** 13) {
            uint256 meshUsdc = _swapExactTokensForTokens(
                address(meshToken),
                address(primaryStable),
                meshBalance,
                address(this)
            );
            totalUsdc += meshUsdc;
        } else {
             // console.log("Not enough mesh tokens to sell");
        }
        uint256 balance = primaryStable.balanceOf(address(this));
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


    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(primaryStable);
    }
    function safeApproveAllTokens() external override {
        // NOT NEEDED
    }
    function _abstractSetPToken(address _asset, address _cToken) internal override
    {
        // NOT NEEDED
    }
}
