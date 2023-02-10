pragma solidity >=0.8.0 <0.9.0;

// for Balancer Strategy
interface IGauge {
    function balanceOf(address _address) external returns (uint256);

    function reward_balances(address _addr) external returns (uint256);

    function claimable_reward(
        address _addr,
        address _token
    ) external returns (uint256);

    function claim_rewards(address _addr) external;

    function deposit(
        uint256 _value,
        address _addr,
        bool _claim_rewards
    ) external;

    function withdraw(uint256 _value, bool _claim_rewards) external;

    function totalSupply() external view returns (uint256 _supply);
}
