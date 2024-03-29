// SPDX-License-Identifier: GNU-3

pragma solidity >=0.8.0;

interface IStargateRouter {
    function addLiquidity(
        uint256 _poolId,
        uint256 _amountLD,
        address _to
    ) external;

    function instantRedeemLocal(
        uint16 _poolId,
        uint256 _amountLP,
        address _to
    ) external returns (uint256 amountSD);
}
