// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IMiniVault {
   

    function priceProvider() external view returns (address);
    function swappingPool() external view returns (address);
    function poolBalanceCheckExponent() external view returns (uint256);
    function getSupportedAssets() external view returns (address[] memory);
}
