// SPDX-License-Identifier: MIT
pragma solidity  ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/balancer/interfaces/IVault.sol";
import "../interfaces/balancer/interfaces/IGeneralPool.sol";
import "../interfaces/balancer/interfaces/IMinimalSwapInfoPool.sol";
import "../interfaces/balancer/interfaces/IPoolSwapStructs.sol";
import { StableMath } from "../utils/StableMath.sol";
// import "hardhat/console.sol";

/*
* @dev The contract aims to be imported in VaultCore. Making the Vault,
*      less bulky and less error prone, miniature version on BalancerExchanged is employed.
*/

abstract contract MiniBalancerExchange {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    int256 public constant MAX_VALUE = 10 ** 27;
    uint256 public constant MAX_SLIPPAGE = 1e16; // = 1%

    function swap(
        address _balancerVault,
        bytes32 poolId,
        IVault.SwapKind kind,
        IAsset tokenIn,
        IAsset tokenOut,
        address sender,
        address recipient,
        uint256 amount,
        uint256 limit
    ) internal returns (uint256) {
        IVault balancerVault = IVault(_balancerVault);
        IERC20(address(tokenIn)).approve(address(balancerVault), IERC20(address(tokenIn)).balanceOf(address(this)));
        if (limit == 0) {
            limit =  onSwap(_balancerVault, poolId, kind,  IERC20(address(tokenIn)),  IERC20(address(tokenOut)), amount);
            limit = limit.mulTruncate(
                uint256(1e18) - MAX_SLIPPAGE
            );
        }
        IVault.SingleSwap memory singleSwap;
        singleSwap.poolId = poolId;
        singleSwap.kind = kind;
        singleSwap.assetIn = tokenIn;
        singleSwap.assetOut = tokenOut;
        singleSwap.amount = amount;

        IVault.FundManagement memory fundManagement;
        fundManagement.sender = sender;
        fundManagement.fromInternalBalance = false;
        fundManagement.recipient = payable(recipient);
        fundManagement.toInternalBalance = false;

        return balancerVault.swap(singleSwap, fundManagement, limit, block.timestamp + 600);
    }

    function onSwap(
        address _balancerVault,
        bytes32 poolId,
        IVault.SwapKind kind,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 balance
    ) internal view returns (uint256) {
        IVault balancerVault = IVault(_balancerVault);
        IPoolSwapStructs.SwapRequest memory swapRequest;
        swapRequest.kind = kind;
        swapRequest.tokenIn = tokenIn;
        swapRequest.tokenOut = tokenOut;
        swapRequest.amount = balance;

        (IERC20[] memory tokens, uint256[] memory balances,) = balancerVault.getPoolTokens(poolId);

        (address pool, IVault.PoolSpecialization poolSpecialization) = balancerVault.getPool(poolId);

        if (poolSpecialization == IVault.PoolSpecialization.GENERAL) {

            uint256 indexIn;
            uint256 indexOut;
            for (uint8 i = 0; i < tokens.length; i++) {
                if (tokens[i] == tokenIn) {
                    indexIn = i;
                } else if (tokens[i] == tokenOut) {
                    indexOut = i;
                }
            }

            return IGeneralPool(pool).onSwap(swapRequest, balances, indexIn, indexOut);

        } else if (poolSpecialization == IVault.PoolSpecialization.MINIMAL_SWAP_INFO) {

            uint256 balanceIn;
            uint256 balanceOut;
            for (uint8 i = 0; i < tokens.length; i++) {
                if (tokens[i] == tokenIn) {
                    balanceIn = balances[i];
                } else if (tokens[i] == tokenOut) {
                    balanceOut = balances[i];
                }
            }

            return IMinimalSwapInfoPool(pool).onSwap(swapRequest, balanceIn, balanceOut);

        } else {

            uint256 balanceIn;
            uint256 balanceOut;
            for (uint8 i = 0; i < tokens.length; i++) {
                if (tokens[i] == tokenIn) {
                    balanceIn = balances[i];
                } else if (tokens[i] == tokenOut) {
                    balanceOut = balances[i];
                }
            }

            return IMinimalSwapInfoPool(pool).onSwap(swapRequest, balanceIn, balanceOut);
        }
    }
}