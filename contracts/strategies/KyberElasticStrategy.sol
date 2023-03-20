// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Kyber Elastic Strategy
 * @notice Investment strategy for investing stablecoins via Kyber Elastic Strategy
 * @author Stabl Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"  ;
import { OvnMath } from "../utils/OvnMath.sol";
import { TickMath } from "../connectors/kyber/libraries/TickMath.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "../exchanges/KyberExchange.sol";
import "../connectors/kyber/interfaces/IBasePositionManager.sol";
import "../connectors/kyber/interfaces/IKyberLM.sol";
import "../connectors/kyber/interfaces/ITickReader.sol";
import "../connectors/kyber/libraries/KyberTickUtils.sol";
import "../interfaces/IMiniVault.sol";
import "../connectors/kyber/libraries/KyberStructs.sol";
import "../exchanges/CurveExchange.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../utils/Helpers.sol";
import "hardhat/console.sol";


contract KyberElasticStrategy is InitializableAbstractStrategy, KyberExchange, CurveExchange, IERC721Receiver {
    using OvnMath for uint256;
    using SafeERC20 for IERC20;
    using TickMath for int24;

    /// Important variables used in our contract, can find the structs in KyberStructs.sol /// 
    KyberStructs.Ticks private ticks;
    KyberStructs.NftInfo private nftInfo;
    KyberStructs.TokenInfo private tokenInfo;

    // Important addresses needed for strategy
    IKyberPool private pool;
    IKyberLM private farm;
    address public curvePool;
    address public oracleRouter;
    IERC20 public primaryStable;

    bool public isDirectDepositAllowed; 
    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Dystopia strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // KNC Token
        address _vaultAddress,
        address[][] calldata _addresses, // [_rewardTokenAddresses, _assets, _pTokens, _neededAddresses]
        uint256 _pid,
        int24 _tickRangeMultiplier, // Tick Distance x Tick multiplier is your range 
        bytes calldata _path // Elastic path to swap from KNC to Primary Stable
    ) external onlyGovernor initializer {
        // Set our addresses
        pool = IKyberPool(_addresses[2][0]);
        farm = IKyberLM(_addresses[3][0]);
        _setNftManager(_addresses[3][1]);
        _setElasticRouter(_addresses[3][2]);
        // We use the tick reader because we have to find previous tick when minting
        nftInfo.tickReader = 0x165c68077ac06c83800d19200e6E2B08D02dE75D;
        tokenInfo.token0 = IERC20(_addresses[1][0]);
        tokenInfo.token1 = IERC20(_addresses[1][1]);

        isDirectDepositAllowed = false;

        _setStructs(_pid, _tickRangeMultiplier, _path);
        super._initialize(
            _platformAddress,
            _vaultAddress,
            _addresses[0],
            _addresses[1],
            _addresses[2]
        );
    }

    function _setStructs(uint256 _pid, int24 _tickRangeMultiplier, bytes calldata _path) private {
        // The elastic farm has pid system, we both set the pid and build a reusable array. 
        nftInfo.pid = _pid;
        nftInfo.pids[0] = abi.encode(IKyberLM.HarvestData({
            pIds: _buildArray(nftInfo.pid)
        }));

        // Set the range multiplier
        ticks.tickRangeMultiplier = _tickRangeMultiplier;

         // Need to set our ticks after we set range multiplier
        (int24 lower, int24 upper) = tickPositioning();
        ticks.lowerTick = lower;
        ticks.upperTick = upper;          
        
        tokenInfo.outputToPrimaryStableRoute = _path;

        // Simply take bytes path and convert to address array route
        (address[] memory route,) = KyberTickUtils.pathToRoute(_path);
        tokenInfo.output = IERC20(route[0]);
        primaryStable = IERC20(route[route.length -1]);

        nftManager.setApprovalForAll(address(farm), false);
    }

    /// Setters ///
    function setParams( 
        address _curvePool,
        int24 _tickRangeMultiplier
    ) external onlyGovernor {
        curvePool = _curvePool;
        ticks.tickRangeMultiplier = _tickRangeMultiplier;
    }

    function setOracleRouterPriceProvider() external onlyGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    /// Deposit into the strategy ///
    function depositAll() external  onlyVault nonReentrant {
        _deposit(primary(), _primaryStableBalance());
    }

    function deposit(
        address _asset,
        uint256 _amount
    )   external
        onlyVault
        nonReentrant {

            _onlyPrimary(_asset);
        (uint256 _amount0ToSwap, uint256 _amount1ToSwap) = _getAmountsToSwap(_amount);
        if (_amount0ToSwap > 0 && lpToken0() != primary()) {
            _swap(primary(), lpToken0(), _amount0ToSwap);
        } else if (_amount1ToSwap > 0) _swap(primary(), lpToken0(), _amount1ToSwap);

        (uint256 token0Balance, uint256 token1Balance,,,,)  = balanceOfTokens();
        if (nftInfo.tokenId != 0) {
            // add liquidity
            uint256 liquidity = _addLiquidity(
                lpToken0(),
                lpToken1(),
                token0Balance,
                token1Balance,
                nftInfo.tokenId
            );

            _join(liquidity);
        } else {
            _init(token0Balance, token1Balance);
        }
    }
    
    function _deposit(address _asset, uint256 _amount) private {
    
    }

    // intializes a position, it is used if we have either no tokenId or if we are rebalancing
    function _init(uint256 _amount0, uint256 _amount1) private returns (uint256 actual0, uint256 actual1, uint256 liquidity) {
        // ticks previous needs a fetch from an external tick reader contract.
        int24[2] memory ticksPrevious;
        ticksPrevious[0] = _getNearestPreviousTick(ticks.lowerTick);
        ticksPrevious[1] = _getNearestPreviousTick(ticks.upperTick);

        // Mint our new position the position manager contract
        (nftInfo.tokenId, liquidity, actual0, actual1) = nftManager.mint(IBasePositionManager.MintParams({
                token0: lpToken0(),
                token1: lpToken1(),
                fee: _swapFeeUnits(),
                tickLower: ticks.lowerTick,
                tickUpper: ticks.upperTick,
                ticksPrevious: ticksPrevious,
                amount0Desired: _amount0,
                amount1Desired: _amount1,
                amount0Min: OvnMath.subBasisPoints(_amount0, BASIS_POINTS_FOR_SLIPPAGE),
                amount1Min: OvnMath.subBasisPoints(_amount1, BASIS_POINTS_FOR_SLIPPAGE),
                recipient: address(this),
                deadline: block.timestamp
            })
       );   

        // Deposit our NFT into the farm and join the pool
        if (nftInfo.tokenIds.length > 0) delete nftInfo.tokenIds;
        nftInfo.tokenIds.push(nftInfo.tokenId);
        farm.deposit(nftInfo.tokenIds);
        _join(liquidity);
    }

    function _join(uint256 liquidity) private {
        farm.join(nftInfo.pid, nftInfo.tokenIds, _buildArray(liquidity));
    }

    /// Withdraw from strategy ///
    function withdrawAll() external onlyVaultOrGovernor nonReentrant  {
        _withdrawFromPool(uint128(lpBalance()));
        _swapAssetsToPrimaryStable();
        primaryStable.safeTransfer(vaultAddress, _primaryStableBalance());
        nftInfo.tokenId = 0;
    }

    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external  onlyVaultOrGovernor nonReentrant {

        _onlyPrimary(_asset);
        _withdrawFromPool(
            primary() == lpToken0()
                ? LiquidityAmounts.getLiquidityForAmount0(
                    _getSqrtRatioAtTick(ticks.lowerTick),
                    _getSqrtRatioAtTick(ticks.upperTick),
                    _amount 
                )
                : LiquidityAmounts.getLiquidityForAmount1(
                    _getSqrtRatioAtTick(ticks.lowerTick),
                    _getSqrtRatioAtTick(ticks.upperTick),
                    _amount
                )
        );

        _swapAssetsToPrimaryStable();
        primaryStable.safeTransfer(_beneficiary, _amount);

        if (lpBalance() > 0) {
            farm.deposit(nftInfo.tokenIds);
            farm.join(nftInfo.pid, nftInfo.tokenIds, _buildArray(lpBalance()));
        }
    }

     // Withdrawing from the position is two steps, you have to first remove from farm then remove liquidity
    function _withdrawFromPool(uint128 _liquidity) private returns (uint256 amt0, uint256 amt1) {
        if (inRange()) farm.harvestMultiplePools(nftInfo.tokenIds, nftInfo.pids);

        farm.exit(nftInfo.pid, nftInfo.tokenIds, _buildArray(lpBalance()));
        farm.withdraw(nftInfo.tokenIds);
        (amt0, amt1,) = nftManager.removeLiquidity(IBasePositionManager.RemoveLiquidityParams({
            tokenId: nftInfo.tokenId,
            liquidity: _liquidity, 
            amount0Min: 0, 
            amount1Min: 0,
            deadline: block.timestamp
        }));

        nftManager.transferAllTokens(lpToken0(), 0, address(this));
        nftManager.transferAllTokens(lpToken1(), 0, address(this));
    }

    
    /// Balance tokens for position ///
    function _getAmountsToSwap(uint256 _amount) private view returns (uint lp0Amt, uint256 lp1Amt) {
        lp0Amt = _amount / 2;
        lp1Amt = _amount - lp0Amt;
        
        // Fetch token decimals 
        uint256 lp0Decimals = _getDecimals(lpToken0());
        uint256 lp1Decimals = _getDecimals(lpToken1());

        // Estimate amount out for swaps and quote add liquidity
        uint256 out0 = lpToken0() != primary() ? _onSwap(
                primary(),
                lpToken0(),
                lp0Amt
            )  * 1e18 / lp0Decimals : lp0Amt;
        uint256 out1 = lpToken1() != primary() ? _onSwap(
                primary(),
                lpToken1(),
                lp1Amt
            )  * 1e18 / lp1Decimals : lp1Amt;
        (uint256 amountA, uint256 amountB,) = KyberTickUtils.quoteAddLiquidity(currentTick(), ticks.lowerTick, ticks.upperTick, out0, out1);
        
        amountA = amountA * 1e18 / lp0Decimals;
        amountB = amountB * 1e18 / lp1Decimals;
        uint256 ratio = ((out0 * 1e18) * out1) / amountB / out0;
        
        lp0Amt = lp0Amt * 1e18 / (ratio + 1e18);
        lp1Amt = lp1Amt - lp0Amt;
    }

    /// Harvest the Yield ///
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        uint256 before = _primaryStableBalance();
        farm.harvestMultiplePools(nftInfo.tokenIds, nftInfo.pids);
        uint256 outputBal = _balanceOfOutput();
        if (outputBal > 0) swapExactInput(_factory(), tokenInfo.outputToPrimaryStableRoute, outputBal);
        
        uint256 balance = _primaryStableBalance() - before;
        console.log("RewardCollection - (KNC) -> USDC Balance: ", balance);
        emit RewardTokenCollected(
            harvesterAddress,
            primary(),
            balance
        );
        primaryStable.safeTransfer(harvesterAddress, balance);
    }

    function _swapAssetsToPrimaryStable() internal {
        (uint256 token0Bal, uint256 token1Bal,,,,) = balanceOfTokens();
        if (lpToken0() != primary() && token0Bal > 0 ) {
             _swap(lpToken0(), primary(), token0Bal);
        } else if (token1Bal > 0) _swap(lpToken1(), primary(), token1Bal);
    }

    function _swap(address _from, address _to, uint256 _amount) private {
            swap(
                curvePool,
                _from,
                _to,
                _amount,
                oracleRouter
            );
    }

    function _onSwap(address _from, address _to, uint256 _amount) private view returns (uint256) {
        return onSwap(
                curvePool,
                _from,
                _to,
                _amount
            );
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
        return _amount * fromPrice / toPrice;
    }

    /// View Functions ///
    function lpBalance() public view returns (uint256 liquidity) {
        (IBasePositionManager.Position memory position,) = nftManager.positions(nftInfo.tokenId);
        return position.liquidity;
    }

    // calculate total token balances in the contract, in the position and summed up. 
    function balanceOfTokens() public view returns (
            uint256 thisTokens0, 
            uint256 thisTokens1, 
            uint256 poolTokens0, 
            uint256 poolTokens1, 
            uint256 totalTokens0, 
            uint256 totalTokens1
        ) {
        (poolTokens0, poolTokens1) = LiquidityAmounts.getAmountsForLiquidity(
            _getSqrtRatioAtTick(currentTick()),
            _getSqrtRatioAtTick(ticks.lowerTick),
            _getSqrtRatioAtTick(ticks.upperTick),
            uint128(lpBalance())
            );
        
        thisTokens0 = IERC20(lpToken0()).balanceOf(address(this));
        thisTokens1 = IERC20(lpToken1()).balanceOf(address(this));
        totalTokens0 = poolTokens0 + totalTokens0;
        totalTokens1 = poolTokens1 + totalTokens1;
    }

    function checkBalance()
        external
        view
        returns (uint256 balance)
    {
        (,,,,uint256 token0Balance, uint256 token1Balance) = balanceOfTokens();

       uint256 primaryStableBalanceFromToken0;
        if ( (lpToken0() != primary())  ) {
            if (token0Balance > 0) {
                primaryStableBalanceFromToken0 = onSwap(
                    curvePool,
                    lpToken0(),
                    primary(),
                    token0Balance
                );
            }
        } else {
            primaryStableBalanceFromToken0 += token0Balance;
        }

        uint256 primaryStableBalanceFromToken1;
        if ( (lpToken1() != primary())  ) {
            if (token1Balance > 0) {
                primaryStableBalanceFromToken1 = 
                    onSwap(
                        curvePool,
                        lpToken1(),
                        primary(),
                        token1Balance
                    );
            }
        } else {
            primaryStableBalanceFromToken1 += token1Balance;
        }
        return primaryStableBalanceFromToken0 + primaryStableBalanceFromToken1;
    }

    function netAssetValue()
        public
        view
        returns (uint256 balance)
    {
       (,,,,uint256 token0Balance, uint256 token1Balance) = balanceOfTokens();

       uint256 primaryStableBalanceFromToken0;
        if ( (lpToken0() != primary())  ) {
            if (token0Balance > 0) {
                primaryStableBalanceFromToken0 = 
                    _convert(
                        lpToken0(),
                        primary(),
                        token0Balance,
                        true
                    );
            }
        } else {
            primaryStableBalanceFromToken0 += token0Balance;
        }

        uint256 primaryStableBalanceFromToken1;
        if ( (lpToken1() != primary())  ) {
            if (token1Balance > 0) {
                primaryStableBalanceFromToken1 = 
                     _convert(
                        lpToken1(),
                        primary(),
                        token1Balance,
                        true
                    );
            }
        } else {
            primaryStableBalanceFromToken1 += token1Balance;
        }
        return primaryStableBalanceFromToken0 + primaryStableBalanceFromToken1;
    }



     /// Tick Positioning ///
    function inRange() private view returns (bool) {
        return currentTick() >= ticks.lowerTick && currentTick() <= ticks.upperTick;
    }

    // What is the pools current tick? 
    function currentTick() public view returns (int24 current) {
        (,current, ,) = pool.getPoolState();
    }

    // uses the tick multiplier determine tick positions
    function tickPositioning() public view returns (int24, int24) {
        int24 base = _tickDistance() * ticks.tickRangeMultiplier;
        return
            KyberTickUtils.baseTicks(
                currentTick(),
                base,
                _tickDistance()
            );
    }

    /// view functions to save bytes ///
    function token0() external view returns (address) {
        return assetsMapped[0];
    }
    function lpToken0() private view returns (address) {
        return address(tokenInfo.token0);
    }

    function lpToken1() private view returns (address) {
        return address(tokenInfo.token1);
    }

    function primary() private view returns (address) {
        return address(primaryStable);
    }

    function _onlyPrimary(address _asset) private view {
         require(_asset == primary(), "Token not supported.");
    }

    function _getSqrtRatioAtTick(int24 tick) private pure returns (uint160) {
        return tick.getSqrtRatioAtTick();
    }

    function _tickDistance() private view returns (int24) {
        return pool.tickDistance();
    }

    function _getDecimals(address _token) private view returns (uint256) {
        return 10**IERC20Metadata(_token).decimals();
    }

    function _factory() private view returns (address) {
        return pool.factory();
    }

    function _balanceOfOutput() private view returns (uint256) {
        return tokenInfo.output.balanceOf(address(this));
    }

    function _primaryStableBalance() private view returns (uint256) {
        return primaryStable.balanceOf(address(this));
    }

    function _swapFeeUnits() private view returns (uint24) {
        return pool.swapFeeUnits();
    }

    function _getNearestPreviousTick(int24 tick) private view returns(int24 previous) {
        (previous,) = ITickReader(nftInfo.tickReader).getNearestInitializedTicks(address(pool), tick);
    }

    // bytes saving since we do this multiple times
    function _buildArray(uint256 _input) private pure returns (uint256[] memory output) {
        output = new uint256[](1);
        output[0] = _input;
    }

    // Allow the strat to recieve the Positions NFT
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4){
        return IERC721Receiver.onERC721Received.selector;
    }
}
