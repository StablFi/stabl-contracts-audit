// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH VaultStorage Contract
 * @notice The VaultStorage contract defines the storage for the Vault contracts
 * @author Stabl Protocol Inc
 */

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { Governable } from "../governance/Governable.sol";
import { CASH } from "../token/CASH.sol";
import { Initializable } from "../utils/Initializable.sol";
import "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract VaultStorage is Initializable, Governable {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event AssetDefaultStrategyUpdated(address _asset, address _strategy);
    event AssetAllocated(address _asset, address _strategy, uint256 _amount);
    event StrategyApproved(address _addr);
    event StrategyRemoved(address _addr);
    event Mint(address _addr, uint256 _value);
    event Redeem(address _addr, uint256 _value);
    event CapitalPaused();
    event CapitalUnpaused();
    event RebasePaused();
    event RebaseUnpaused();
    event VaultBufferUpdated(uint256 _vaultBuffer);
    event RedeemFeeUpdated(uint256 _redeemFeeBps);
    event PriceProviderUpdated(address _priceProvider);
    event PriceProviderStrategyUpdated(address _priceProvider, address _strategy);
    event PriceProviderStrategyUpdationFailed(address _priceProvider, address _strategy);
    event AllocateThresholdUpdated(uint256 _threshold);
    event RebaseThresholdUpdated(uint256 _threshold);
    event StrategistUpdated(address _address);
    event MaxSupplyDiffChanged(uint256 maxSupplyDiff);
    event YieldDistribution(address _to, uint256 _yield, uint256 _fee);
    event TrusteeFeeBpsChanged(uint256 _basis);
    event TrusteeAddressChanged(address _address);
    event MintFeeCharged(address _address, uint256 _fee);
    event MintFeeChanged(address _sender, uint256 _previousFeeBps, uint256 _newFeeBps);
    event FeeAddressesChanged(address _labsAddress, address _teamAddress, address _treasuryAddress);
    event HarvesterFeeParamsChanged(address _labsAddress, uint256 _labsFeeBps, address _teamAddress, uint256 _teamFeeBps);
    event Payout(uint256 _dripperTransferred);
    event TreasuryRemitted(address _token, uint256 _amount);

    // Assets supported by the Vault, i.e. Stablecoins
    struct Asset {
        bool isSupported;
    }
    mapping(address => Asset) internal assets;
    address[] internal allAssets;

    // Strategies approved for use by the Vault
    struct Strategy {
        bool isSupported;
        uint256 _deprecated; // Deprecated storage slot
    }
    mapping(address => Strategy) internal strategies;
    address[] internal allStrategies;

    // Address of the Oracle price provider contract
    address public priceProvider;
    // Pausing bools
    bool public dontRebaseDuringDepeg; // Reusing rebasePaused
    bool public capitalPaused = true;

    // Redemption fee in basis points
    uint256 public redeemFeeBps;
    address public labsAddress;
    uint256 public labsFeeBps; // Not used
    address public teamAddress;
    uint256 public teamFeeBps; // Not Used

    // Buffer of assets to keep in Vault to handle (most) withdrawals
    uint256 public vaultBuffer;
    // Mints over this amount automatically allocate funds. 18 decimals.
    uint256 public autoAllocateThreshold;
    // Mints over this amount automatically rebase. 18 decimals.
    uint256 public rebaseThreshold;

    CASH internal cash;

    //keccak256("CASH.vault.governor.admin.impl");
    bytes32 constant adminImplPosition = 0x10e4e34101c81b29558fe5b91534ae1af03c346313e21b0f6446695a8e18e243;

    // Address of the contract responsible for post rebase syncs with AMMs
    address private _deprecated_rebaseHooksAddr = address(0);

    // Deprecated: Address of Uniswap
    // slither-disable-next-line constable-states
    address private _deprecated_uniswapAddr = address(0);

    // Address of the Strategist
    address public strategistAddr = address(0);

    // Mapping of asset address to the Strategy that they should automatically
    // be allocated to
    mapping(address => address) public assetDefaultStrategies;

    uint256 public maxSupplyDiff;

    // Trustee contract that can collect a percentage of yield [REMOVE_ON_PRODUCTION] 🚨
    address public trusteeAddress;

    uint256 public amountDueForRebase;

    // Deprecated: Tokens that should be swapped for stablecoins [REMOVE_ON_PRODUCTION] 🚨
    address[] private _deprecated_swapTokens;

    uint256 constant MINT_MINIMUM_ORACLE = 99800000;

    address public primaryStableAddress;

    // List of strategies for quickly depositing the primaryStable to.
    address[] public quickDepositStrategies;

    // Balancer pool to swap the asset to primaryStable
    address public swappingPool;
    bytes32 public swappingPoolId;

    // Harvester & Dripper
    address public harvesterAddress;
    address public dripperAddress;

    struct StrategyWithWeight {
        address strategy;
        uint256 minWeight;
        uint256 targetWeight;
        uint256 maxWeight;
        bool enabled;
        bool enabledReward;
    }

    mapping(address => uint256) public strategyWithWeightPositions;
    StrategyWithWeight[] public strategyWithWeights;

    uint256 public constant TOTAL_WEIGHT = 100000; // 100000 ~ 100%
    // next payout time in epoch seconds
    uint256 public nextPayoutTime;

    // period between payouts in seconds, need to calc nextPayoutTime
    uint256 public payoutPeriod;

    // range of time for starting near next payout time at seconds
    // if time in [nextPayoutTime-payoutTimeRange;nextPayoutTime+payoutTimeRange]
    //    then payouts can be started by payout() method anyone
    // else if time more than nextPayoutTime+payoutTimeRange
    //    then payouts started by any next buy/redeem
    uint256 public payoutTimeRange;

    mapping(address => bool) public rebaseManagers;

    struct Order {
        bool stake;
        address strategy;
        uint256 amount;
    }
    mapping(address => uint256) internal lastMints;

    uint256 public mintFeeBps; // All Mint/Deposit Fees will be sent to Treasury
    address public treasuryAddress;

    address public rebaseHandler;
    uint256 public poolBalanceCheckExponent;
    uint256 public dailyExpectedYieldBps; // 1%  = 10000
    uint256 public depegMargin; // 1% = 100

    /**
     * @dev set the implementation for the admin, this needs to be in a base class else we cannot set it
     * @param newImpl address of the implementation
     */
    function setAdminImpl(address newImpl) external onlyGovernor {
        require(Address.isContract(newImpl), "new implementation is not a contract");
        bytes32 position = adminImplPosition;
        assembly {
            sstore(position, newImpl)
        }
    }
}
