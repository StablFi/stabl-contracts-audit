// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IVaultCore {
    function nav() external returns (uint256);
    function vaultNav() external returns (uint256);
    function swapAsset(address tokenFrom, address tokenTo, uint256 _amount) external returns (uint256);
    function price() external returns (uint256);
    function validateAssetPeg(address _asset, uint256 _bps) external returns (uint256);
    function getAssetIndex(address _asset) external view returns (uint256);
    function doom() external;
}