// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import "../utils/Helpers.sol";
import "hardhat/console.sol";

contract Harvester is Initializable, Governable {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    event UniswapUpdated(address _address);
    event SupportedStrategyUpdate(address _address, bool _isSupported);

    mapping(address => bool) public supportedStrategies;

    address public vaultAddress;
    address public primaryStableAddress;

    /**
     * Address receiving rewards proceeds. Initially the Vault contract later will possibly
     * be replaced by another contract that eases out rewards distribution.
     */
    address public rewardProceedsAddress;
    address public labsAddress;
    uint256 public labsFeeBps;

    address public teamAddress;
    uint256 public teamFeeBps;


    /**
     * @dev Initializer to set up initial internal state
     * @param _vaultAddress Address of the Vault
     * @param _primaryStableAddress Address of primaryStable
     */
    function initialize(address _vaultAddress, address _primaryStableAddress) external onlyGovernor initializer {
        require(address(_vaultAddress) != address(0), "Vault Missing");
        require(address(_primaryStableAddress) != address(0), "PS Missing");
        vaultAddress = _vaultAddress;
        primaryStableAddress = _primaryStableAddress;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Throws if called by any address other than the Vault.
     */
    modifier onlyVaultOrGovernor() {
        require(
            msg.sender == vaultAddress || isGovernor(),
            "Caller is not the Vault or Governor"
        );
        _;
    }
    modifier onlyVault() {
        require(msg.sender == vaultAddress, "Caller is not the Vault");
        _;
    }


    /**
     * Set the Address receiving rewards proceeds.
     * @param _rewardProceedsAddress Address of the reward token
     */
    function setRewardsProceedsAddress(address _rewardProceedsAddress)
        external
        onlyGovernor
    {
        require(
            _rewardProceedsAddress != address(0),
            "Rewards proceeds address should be a non zero address"
        );

        rewardProceedsAddress = _rewardProceedsAddress;
    }


    function setLabs(address _labs, uint256 _feeBps) external onlyVaultOrGovernor {
        require(
            _labs != address(0),
            "Labs address should be a non zero address"
        );
        require(
            _feeBps > 0,
            "Labs fee should be greater than zero"
        );
        labsAddress = _labs;
        labsFeeBps = _feeBps;
    }
    function setTeam(address _team, uint256 _feeBps) external onlyVaultOrGovernor {
        require(
            _team != address(0),
            "Team address should be a non zero address"
        );
        require(
            _feeBps > 0,
            "Team fee should be greater than zero"
        );
        teamAddress = _team;
        teamFeeBps = _feeBps;
    }
    function getLabs() public view returns (address, uint256) {
        return (labsAddress, labsFeeBps);
    }
    function getTeam() public view returns (address, uint256) {
        return (teamAddress, teamFeeBps);
    }
    

    /**
     * @dev Flags a strategy as supported or not supported one
     * @param _strategyAddress Address of the strategy
     * @param _isSupported Bool marking strategy as supported or not supported
     */
    function setSupportedStrategy(address _strategyAddress, bool _isSupported)
        external
        onlyVaultOrGovernor
    {
        supportedStrategies[_strategyAddress] = _isSupported;
        emit SupportedStrategyUpdate(_strategyAddress, _isSupported);
    }

    /***************************************
                    Rewards
    ****************************************/
    /*
     * @dev Collect reward tokens from all strategies and distrubte primaryStable
     *      to labs, teams and dripper accounts/contracts.
     */
    function harvestAndDistribute() external onlyVaultOrGovernor nonReentrant {
        _harvest();
        _distribute();
    }
    function harvestAndDistribute(address _strategy) external onlyVaultOrGovernor nonReentrant {
        _harvest(_strategy);
        _distribute();
    }
    function _distribute() internal {
        if ( IERC20(primaryStableAddress).balanceOf(address(this)) > 10)  {
            _distributeFees(IERC20(primaryStableAddress).balanceOf(address(this)));
            _distributeProceeds(IERC20(primaryStableAddress).balanceOf(address(this)));
        } 
    }
    function _distributeFees(uint256 _amount) internal {
        require(
            _amount > 0,
            "Amount should be greater than zero"
        );
        console.log("Distributing fees: ", _amount);
        uint256 labsfees = ((_amount * labsFeeBps) / 100.0) / 100.0;
        console.log("Labs fees: " , labsfees);
        uint256 teamfees = ((_amount * teamFeeBps) / 100.0) / 100.0;
        console.log("Team fees: " , teamfees);
        IERC20(primaryStableAddress).transfer(
            labsAddress,
            labsfees
        );
        IERC20(primaryStableAddress).transfer(
            teamAddress,
            teamfees
        );
    }
    function distributeFees() external onlyGovernor {
        _distributeFees(IERC20(primaryStableAddress).balanceOf(address(this)));
    }
    function _distributeProceeds(uint256 _amount) internal {
        require(
            _amount > 0,
            "Amount should be greater than zero"
        );
        console.log("Distributing proceeds: ", _amount);
        IERC20(primaryStableAddress).transfer(
            rewardProceedsAddress,
            _amount
        );
    }
    function distributeProceeds() external onlyGovernor {
        _distributeProceeds(IERC20(primaryStableAddress).balanceOf(address(this)));
    }
    /**
     * @dev Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /**
     * @dev Collect reward tokens from all strategies
     */
    function harvest() external onlyGovernor nonReentrant {
        _harvest();
    }
    /**
     * @dev Collect reward tokens for a specific strategy.
     * @param _strategyAddr Address of the strategy to collect rewards from
     */
    function harvest(address _strategyAddr) external onlyGovernor nonReentrant {
        _harvest(_strategyAddr);
    }
    /**
     * @dev Collect reward tokens from all strategies
     */
    function _harvest() internal {
        address[] memory allStrategies = IVault(vaultAddress)
            .getAllStrategies();
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (supportedStrategies[allStrategies[i]] == true) {
                _harvest(allStrategies[i]);
            }
        }
    }
    /**
     * @dev Collect reward tokens from a single strategy and swap them for a
     *      supported stablecoin via Uniswap
     * @param _strategyAddr Address of the strategy to collect rewards from.
     */
    function _harvest(address _strategyAddr) internal {
        require(
            supportedStrategies[_strategyAddr],
            "Not a valid strategy address"
        );

        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.collectRewardTokens();
    }
}
