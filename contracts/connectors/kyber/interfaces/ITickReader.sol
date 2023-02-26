// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; 

interface ITickReader {
    function getNearestInitializedTicks(address pool, int24 tick)
    external
    view
    returns (int24 previous, int24 next);
}
