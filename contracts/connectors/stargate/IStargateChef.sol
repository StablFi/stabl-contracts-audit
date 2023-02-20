// SPDX-License-Identifier: GNU-3

pragma solidity >=0.8.0;

interface IStargateChef {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);
}
