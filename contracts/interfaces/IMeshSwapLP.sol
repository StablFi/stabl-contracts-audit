// SPDX-License-Identifier: MIT
pragma solidity >=0.5 <0.9.0;

import "../connectors/uniswap/v2/interfaces/IUniswapV2Pair.sol";

interface IMeshSwapLP is IUniswapV2Pair {

    function depositToken(uint256 _amount) external;

    function withdrawToken(uint256 withdrawAmount) external;
    function withdrawTokenByAmount(uint256 withdrawAmount) external;

    function claimReward() external;

    function exchangeRateStored() external view returns (uint256);

}