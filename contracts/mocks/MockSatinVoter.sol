// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;


contract MockSatinVoter {
    // Pool to gauge
    mapping(address => address) public gauges;
    // Gauge to bribe   
    mapping(address => address) public bribes;

    address public bribe;
    constructor()  {}
    function setGauge(address _pool, address _gauge) external {
        gauges[_pool] = _gauge;
    }
    function setBribe(address _gauge, address _bribe) external {
        bribes[_gauge] = _bribe;
    }

}
