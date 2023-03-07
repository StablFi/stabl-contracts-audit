// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IKyberPool {
    function getPoolState() external view returns ( uint160 sqrtP, int24 currentTick, int24 nearestCurrentTick , bool locked);
    function tickDistance() external view returns (int24);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function swapFeeUnits() external view returns (uint24);
    function factory() external view returns (address);
    function initializedTicks(int24 tick) external view returns (int24 previous, int24 next);
}