// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSatinGauge {
    function notifyRewardAmount(
        address token,
        uint amount,
        bool is4pool
    ) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
}