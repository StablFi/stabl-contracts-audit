// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity ^0.8.0; 
library KyberStructs {

    //  lowerTick and upperTick are the current tick positions of our strat. They can be changed during rebalanced. 
    //  tickSway is also set and the repositioned during rebalance.
    struct Ticks {
        int24 lowerTick;
        int24 upperTick;
        int24 tickRangeMultiplier; 
    }

    struct NftInfo { 
        uint256 tokenId;
        uint256[] tokenIds;
        uint256 pid;
        bytes[] pids;
        address tickReader;
    }

    struct TokenInfo {
        IERC20 output;
        IERC20 token0;
        IERC20 token1;
        bytes outputToPrimaryStableRoute; // Swap output to Token 0
    }
}
