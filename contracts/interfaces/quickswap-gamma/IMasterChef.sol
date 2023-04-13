// SPDX-License-Identifier: GNU-3
pragma solidity >=0.6.2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRewarder {
    function rewardToken() external returns (address);

    function onSushiReward(uint256 pid, address user, address recipient, uint256 sushiAmount, uint256 newLpAmount) external;

    function pendingTokens(uint256 pid, address user, uint256 sushiAmount) external view returns (IERC20[] memory, uint256[] memory);
}

interface IMasterChef {
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    struct PoolInfo {
        uint128 accSushiPerShare;
        uint64 lastRewardTime;
        uint64 allocPoint;
        IRewarder[] rewarders;
    }

    function poolInfo(uint256 pid) external view returns (IMasterChef.PoolInfo memory);

    function totalAllocPoint() external view returns (uint256);

    function deposit(uint256 pid, uint256 amount, address to) external;

    function withdraw(uint256 pid, uint256 amount, address to) external;

    function getRewarder(uint256 _pid, uint256 _rid) external view returns (address);

    function harvest(uint256 pid, address to) external;

    function lpToken(uint256 pid) external returns (address);
}
