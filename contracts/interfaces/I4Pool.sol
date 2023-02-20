// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface I4Pool {
    function getTokenIndex(address tokenAddress) external view returns (uint8);

    function getTokenBalance(uint8 index) external view  returns (uint256);

    function skim(address _to) external payable ;
}
