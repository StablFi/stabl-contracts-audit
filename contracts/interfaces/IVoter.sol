// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVoter {
    function gauges(address _pool) external view returns (address);

    function bribes(address _gauge) external view returns (address);
}
