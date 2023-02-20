// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGauge {
    function notifyRewardAmount(
        address token,
        uint amount,
        bool is4pool
    ) external;
}
