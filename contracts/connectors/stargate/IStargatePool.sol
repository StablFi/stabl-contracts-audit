// SPDX-License-Identifier: GNU-3

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStargatePool is IERC20 {
    function totalLiquidity() external view returns (uint256);
    function convertRate() external view returns (uint256);
}
