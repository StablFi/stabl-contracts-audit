// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IKyberPoolFactory {
    function getPool(address, address, uint24) external view returns (address);
}