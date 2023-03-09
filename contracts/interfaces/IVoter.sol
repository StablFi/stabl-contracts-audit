// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVoter {
    function gauges(address _pool) external view returns (address);

    function external_bribes(address _gauge) external view returns (address);

    function createGauge(address _pool) external returns (address);

    function calculateSatinCashLPVeShare(uint _claimable) external view returns (uint);

    function viewSatinCashLPGaugeAddress() external view returns (address);
}
