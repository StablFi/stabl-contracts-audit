// SPDX-License-Identifier: GPL-3.0-or-later
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity >=0.8.0 <0.9.0;

interface IBalancerPool is IERC20 {
    // solhint-disable-previous-line no-empty-blocks
    function getActualSupply() external view returns (uint256);

    function getTokenRate(address _token) external view returns (uint256);

    function getScalingFactors() external view returns (uint256, uint256, uint256);

    function getRate() external view returns (uint256);

    function getMinimumBpt() external view returns (uint256);
}
