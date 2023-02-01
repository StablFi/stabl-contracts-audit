// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.5.16;

interface ICurveCalculator {
    function get_dx_stable(
        uint256[3] memory balances,
        uint256 amp,
        uint256 fee,
        uint256[3] memory rates,
        int128 i,
        int128 j,
        uint256 dy
    ) external view returns (uint256);
}
