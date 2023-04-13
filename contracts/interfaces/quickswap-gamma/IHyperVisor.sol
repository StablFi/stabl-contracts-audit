// SPDX-License-Identifier: GNU-3
pragma solidity ^0.8.0;

interface IHyperVisor {
    function deposit(uint256, uint256, address, address, uint256[4] memory minIn) external returns (uint256);

    function withdraw(uint256, address, address, uint256[4] memory) external returns (uint256, uint256);

    function whitelistedAddress() external view returns (address);

    function getTotalAmounts() external view returns (uint256, uint256);
}
