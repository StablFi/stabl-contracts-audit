// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../connectors/kyber/interfaces/IKyberElastic.sol";
import "../connectors/kyber/interfaces/IBasePositionManager.sol";
import "../connectors/kyber/libraries/KyberTickUtils.sol";
import "../utils/OvnMath.sol";
abstract contract KyberExchange {

    uint256 public constant BASIS_POINTS_FOR_SLIPPAGE = 4;

    IKyberElastic private elasticRouter;
    IBasePositionManager internal nftManager;

    address private quoter;

    function _setElasticRouter(address _elasticRouter) internal {
        elasticRouter = IKyberElastic(_elasticRouter);
    }

    function _setNftManager(address _nftManager) internal {
        nftManager = IBasePositionManager(_nftManager);
    }

    function swapExactInput(address _factory, bytes memory _path, uint256 _amountInput) internal returns (uint256 amountOut) {
        (address[] memory route,) = KyberTickUtils.pathToRoute(_path);
        IERC20(route[0]).approve(address(elasticRouter), _amountInput);
        uint256 amountOutMin = KyberTickUtils.getAmountOut(_factory, _path, _amountInput);
        
        IKyberElastic.ExactInputParams memory swapParams = IKyberElastic.ExactInputParams({
            path: _path,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountOutMin,
            minAmountOut: OvnMath.subBasisPoints(amountOutMin, BASIS_POINTS_FOR_SLIPPAGE)
        });
        return elasticRouter.swapExactInput(swapParams);
    }

    function _addLiquidity (
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint256 tokenId
    ) internal returns (uint256 liquidity) {
        IERC20(tokenA).approve(address(elasticRouter), amountADesired);
        IERC20(tokenB).approve(address(elasticRouter), amountBDesired);
        
        (liquidity,,) = _addLiquidityToNft(amountADesired, amountBDesired, tokenId);
    }

    function _addLiquidityToNft(uint256 _bal0, uint256 _bal1, uint256 _tokenId) private returns(uint256 liquidity, uint256 amount0, uint256 amount1) {
        (liquidity, amount0, amount1,) = nftManager.addLiquidity(
                IBasePositionManager.IncreaseLiquidityParams({
                    tokenId: _tokenId,
                    amount0Desired: _bal0,
                    amount1Desired: _bal1,
                    amount0Min: OvnMath.subBasisPoints(_bal0, BASIS_POINTS_FOR_SLIPPAGE),
                    amount1Min: OvnMath.subBasisPoints(_bal1, BASIS_POINTS_FOR_SLIPPAGE),
                    deadline: block.timestamp
                })
            );
    } 
}
