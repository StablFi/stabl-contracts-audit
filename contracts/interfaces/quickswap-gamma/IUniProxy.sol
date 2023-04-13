// SPDX-License-Identifier: GNU-3
pragma solidity >=0.6.2;

interface IUniProxy {
    function deposit(uint256, uint256, address, address, uint256[4] memory) external returns (uint256);

    function getDepositAmount(address, address, uint256) external view returns (uint256, uint256);
}
