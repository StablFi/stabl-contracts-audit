// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "../ISwapPlace.sol";
import "../connector/BalancerStuff.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import { Governable } from "../../governance/Governable.sol";

contract BalancerSwapPlace is ISwapPlace, Governable {
    using SafeERC20 for IERC20;

    IVault public balancerVault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    function setBalancerVault(address _balancerVault) external  onlyGovernor {
        balancerVault = IVault(_balancerVault);
    }
    function swapPlaceType() external override pure returns (string memory) {
        return "BalancerSwapPlace";
    }

    function swap(SwapRoute calldata route) external override returns (uint256) {

        bytes32 poolId = IBalancerPool(route.pool).getPoolId();

        IERC20(route.tokenIn).safeIncreaseAllowance(address(balancerVault), IERC20(route.tokenIn).balanceOf(address(this)));

        IVault.SingleSwap memory singleSwap = IVault.SingleSwap(
            poolId,
            IVault.SwapKind.GIVEN_IN,
            route.tokenIn,
            route.tokenOut,
            route.amountIn,
            new bytes(0)
        );

        IVault.FundManagement memory fundManagement = IVault.FundManagement(
            address(this),
            false,
            payable(msg.sender),
            false
        );

        return balancerVault.swap(singleSwap, fundManagement, route.amountOut, block.timestamp + 600);
    }


    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address pool
    ) external override view returns (uint256) {
        // console.log("BalancerSwapPlace's pool", pool);
        bytes32 poolId = IBalancerPool(pool).getPoolId();
        // console.log("BalancerSwapPlace's poolId");
        // console.logBytes32 (poolId);
        // console.log("balancerVault", address(balancerVault) );
        (, uint8 a) = balancerVault.getPool(poolId);
        // console.log("Pool special", a);
        (address[] memory tokens, uint256[] memory balances,) = balancerVault.getPoolTokens(poolId);
        // console.log("Pool tokens");
        (uint256 indexIn, uint256 indexOut) = getIndexes(tokenIn, tokenOut, tokens);
        // console.log("Pool indexes");
        IVault.PoolSpecialization poolSpecialization = IVault.PoolSpecialization(a);


        IBalancerPool.SwapRequest memory swapRequest;
        swapRequest.kind = IVault.SwapKind.GIVEN_IN;
        swapRequest.tokenIn = tokenIn;
        swapRequest.tokenOut = tokenOut;
        swapRequest.amount = amountIn;

        if (poolSpecialization == IVault.PoolSpecialization.GENERAL) {
            return IBalancerPool(pool).onSwap(
                swapRequest,
                balances,
                indexIn,
                indexOut
            );
        }

        if (
            poolSpecialization == IVault.PoolSpecialization.MINIMAL_SWAP_INFO ||
            poolSpecialization == IVault.PoolSpecialization.TWO_TOKEN
        ) {
            return IBalancerPool(pool).onSwap(
                swapRequest,
                balances[indexIn],
                balances[indexOut]
            );
        }

        revert("Unknown balancer poolSpecialization");
    }


    function getIndexes(
        address tokenIn,
        address tokenOut,
        address[] memory tokens
    ) internal pure returns (uint256, uint256){
        uint256 indexIn = type(uint256).max;
        uint256 indexOut = type(uint256).max;
        for (uint256 i; i < tokens.length; i++) {
            if (tokens[i] == tokenIn) {
                indexIn = i;
            } else if (tokens[i] == tokenOut) {
                indexOut = i;
            }
        }
        require(
            indexIn != type(uint256).max && indexOut != type(uint256).max,
            "Can't find index for tokens in pool"
        );
        return (indexIn, indexOut);
    }


}
