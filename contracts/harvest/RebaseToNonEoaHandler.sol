// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IUniswapV2Pair } from "../interfaces/uniswap/IUniswapV2Pair.sol";
import { IVoter } from "../interfaces/IVoter.sol";
import { IBribe } from "../interfaces/IBribe.sol";
import { IGauge } from "../interfaces/IGauge.sol";
import { I4Pool } from "../interfaces/I4Pool.sol";
import { ICash } from "../interfaces/ICash.sol";
import { IMultiRewardsPool } from "../interfaces/IMultiRewardsPool.sol";
import "hardhat/console.sol";

contract RebaseToNonEoaHandler is Initializable, Governable {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeMath for uint256;

    IVault public vault;
    IERC20 public primaryStable;
    IERC20 public cash;

    uint256 constant BASE_FEE = 1e6;

    struct Contract {
        address contractAddress;
        bytes32 poolId;
        address gauge; // for Satin
        address bribe; // for Satin
        uint256 guageShare; // for Satin
        uint256 bribeShare; // for Satin
        uint256 treasuryShare; // for Satin
        bool isSatin;
        bool isSupported;
        bool is4pool; // for Satin
    }
    mapping(address => Contract) public contracts;
    address[] public allContracts;
    uint256 public contractsCount;

    address public treasury;
    address public satinVoter;
    address public veDist;
    mapping(address => uint256) public gaugeCashAmount;
    mapping(address => uint256) public bribeCashAmount;
    uint256 internal constant DURATION = 7 days;
    address internal SATIN_CASH_LP_GAUGE;

    event ContractAdded(address _contract);
    event ContractRemoved(address _contract);
    event GuageNotifyFailed(address _pair, address _recipient, uint256 _amount);
    event BribeNotifyFailed(address _pair, address _recipient, uint256 _amount);
    event GuageRemitted(address _pair, address _recipient, uint256 _amount);
    event BribeRemitted(address _pair, address _recipient, uint256 _amount);
    event TreasuryRemitted(address _pair, address _recipient, uint256 _amount);
    event GovernorRemitted(address _pair, address _token, address _recipient, uint256 _amount);

    /**
     * @dev Verifies that the caller is the Vault or Governor.
     */
    modifier onlyVaultOrGovernor() {
        require(msg.sender == address(vault) || msg.sender == governor(), "Caller is not the Vault or Governor");
        _;
    }

    function initialize(
        address _vaultAddress,
        address _primaryStableAddress,
        address _cash
    ) external onlyGovernor initializer {
        require(address(_vaultAddress) != address(0), "Vault Missing");
        require(address(_primaryStableAddress) != address(0), "PS Missing");
        vault = IVault(_vaultAddress);
        primaryStable = IERC20(_primaryStableAddress);
        cash = IERC20(_cash);
    }

    function setTreasury(address _treasury) external onlyGovernor {
        require(address(_treasury) != address(0), "!Treasury");
        treasury = _treasury;
    }

    function setSatinVoter(address _satinVoter) external onlyGovernor {
        require(address(_satinVoter) != address(0), "!SatinVoter");
        satinVoter = _satinVoter;
    }

    function setVeDist(address _veDist) external onlyGovernor {
        require(address(_veDist) != address(0), "!veDist");
        veDist = _veDist;
    }

    function addContract(
        address _contractAddress,
        bytes32 _poolId,
        address _gauge,
        address _bribe,
        uint256 _guageShare,
        uint256 _bribeShare,
        uint256 _treasuryShare,
        bool _isSatin,
        bool _is4pool
    ) public onlyGovernor {
        require(address(_contractAddress) != address(0), "!CONTRACT");
        require(_guageShare.add(_bribeShare).add(_treasuryShare) == BASE_FEE, "FEES != BASE_FEE");
        require((contracts[_contractAddress].contractAddress == address(0)) || (contracts[_contractAddress].isSupported == false), "ALREADY_ADDED");
        require(ICash(address(cash)).rebaseState(_contractAddress) == ICash.RebaseOptions.OptIn, "!OPTIN");
        contracts[_contractAddress] = Contract(
            _contractAddress,
            _poolId,
            _gauge,
            _bribe,
            _guageShare,
            _bribeShare,
            _treasuryShare,
            _isSatin,
            true,
            _is4pool
        );
        allContracts.push(_contractAddress);
        contractsCount++;
        emit ContractAdded(_contractAddress);
    }

    function addSatinContract(
        address _satinPoolAddress,
        uint256 _guageShare,
        uint256 _bribeShare,
        uint256 _treasuryShare
    ) external onlyGovernor {
        require(address(_satinPoolAddress) != address(0), "!POOL");
        require(address(satinVoter) != address(0), "!VOTER");
        address _bribeAddress;
        address _gaugeAddress = IVoter(satinVoter).gauges(_satinPoolAddress);
        if (_gaugeAddress == address(0)) {
            _gaugeAddress = IVoter(satinVoter).createGauge(_satinPoolAddress);
        }
        if (_gaugeAddress == IVoter(satinVoter).viewSatinCashLPGaugeAddress()) {
            SATIN_CASH_LP_GAUGE = _gaugeAddress;
        }
        _bribeAddress = IVoter(satinVoter).external_bribes(_gaugeAddress);

        addContract(_satinPoolAddress, bytes32(0), _gaugeAddress, _bribeAddress, _guageShare, _bribeShare, _treasuryShare, true, false);
    }

    function add4poolContract(
        address _4poolAddress,
        address _4poolLPToken,
        uint256 _guageShare,
        uint256 _bribeShare,
        uint256 _treasuryShare
    ) external onlyGovernor {
        require(address(_4poolAddress) != address(0), "!4POOL");
        require(address(_4poolLPToken) != address(0), "!4POOL_LP");
        require(address(satinVoter) != address(0), "!VOTER");
        address _bribeAddress;
        address _gaugeAddress = IVoter(satinVoter).gauges(_4poolLPToken);
        if (_gaugeAddress != address(0)) {
            _bribeAddress = IVoter(satinVoter).external_bribes(_gaugeAddress);
        }
        addContract(_4poolAddress, bytes32(0), _gaugeAddress, _bribeAddress, _guageShare, _bribeShare, _treasuryShare, true, true);
    }

    function removeContract(address _contractAddress) external onlyGovernor {
        require(address(_contractAddress) != address(0), "Contract Missing");
        uint256 index = allContracts.length;
        for (uint256 i = 0; i < allContracts.length; i++) {
            if (allContracts[i] == _contractAddress) {
                index = i;
                break;
            }
        }
        if (index < allContracts.length) {
            allContracts[index] = allContracts[allContracts.length - 1];
            allContracts.pop();
            emit ContractRemoved(_contractAddress);
        }
        contracts[_contractAddress].isSupported = false;
        contractsCount--;
    }

    function process() external onlyVaultOrGovernor {
        for (uint256 i = 0; i < allContracts.length; i++) {
            address _contractAddress = allContracts[i];
            Contract memory _contractInfo = contracts[_contractAddress];

            if (_contractInfo.isSupported && _contractInfo.isSatin) {
                // Prerequisites
                (
                    address _skimmableToken, // Ex: USDC
                    uint256 _skimmableTokenAmount, // Ex: USDC amount
                    uint256 _skimmableCashAmount // Ex: CASH amount
                ) = _calculateSkimmable(_contractAddress);

                if (_skimmableTokenAmount > 0) {
                    IERC20(_skimmableToken).transfer(governor(), _skimmableTokenAmount);
                    emit GovernorRemitted(_contractAddress, _skimmableToken, governor(), _skimmableTokenAmount);
                }

                if (_skimmableCashAmount == 0) {
                    console.log("No CASH to Skim: ", _contractAddress);
                    continue;
                }
                IUniswapV2Pair(_contractAddress).skim(address(this));

                if (_contractInfo.gauge == address(0)) {
                    _sendToTreasury(_contractAddress, _skimmableCashAmount);
                    continue;
                }

                _allowFeeGauge(_contractInfo.gauge, _skimmableCashAmount, _contractInfo.guageShare);
                uint256 _gaugeShare = gaugeCashAmount[_contractInfo.gauge];
                if (_gaugeShare > IMultiRewardsPool(_contractInfo.gauge).left(address(cash)) && _gaugeShare / DURATION > 0) {
                    gaugeCashAmount[_contractInfo.gauge] = 0;
                    try IGauge(_contractInfo.gauge).notifyRewardAmount(address(cash), _gaugeShare, _contractInfo.is4pool) {
                        emit GuageRemitted(_contractAddress, _contractInfo.gauge, _gaugeShare);
                    } catch {
                        console.log("GAUGE NOTIFY FAILED");
                        emit GuageNotifyFailed(_contractAddress, _contractInfo.bribe, _gaugeShare);
                    }
                }

                _allowFeeBribe(_contractInfo.bribe, _skimmableCashAmount, _contractInfo.bribeShare);
                uint256 _bribeShare = bribeCashAmount[_contractInfo.bribe];
                if (_bribeShare > IMultiRewardsPool(_contractInfo.bribe).left(address(cash))) {
                    bribeCashAmount[_contractInfo.bribe] = 0;
                    try IBribe(_contractInfo.bribe).notifyRewardAmount(address(cash), _bribeShare) {
                        emit BribeRemitted(_contractAddress, _contractInfo.bribe, _bribeShare);
                    } catch {
                        console.log("BRIBE NOTIFY FAILED");
                        emit BribeNotifyFailed(_contractAddress, _contractInfo.bribe, _bribeShare);
                    }
                }

                uint256 _treasuryShare = (_skimmableCashAmount * _contractInfo.treasuryShare) / BASE_FEE;
                _sendToTreasury(_contractAddress, _treasuryShare);
            } else {
                console.log("Contract not supported: ", _contractAddress);
            }
        }
    }

    function sendToTreasury(uint256 _amount) external onlyGovernor {
        _sendToTreasury(address(0), _amount);
    }

    function _sendToTreasury(address _contract, uint256 _amount) internal {
        cash.safeTransfer(treasury, _amount);
        emit TreasuryRemitted(_contract, treasury, _amount);
    }

    function _calculate4poolSkimmable(address _4PoolAddress) internal view returns (uint256 _skimmableCashAmount) {
        uint8 tokenIndex = I4Pool(_4PoolAddress).getTokenIndex(address(cash));
        uint256 cashReserve = I4Pool(_4PoolAddress).getTokenBalance(tokenIndex);
        _skimmableCashAmount = cash.balanceOf(_4PoolAddress) - cashReserve;
    }

    function _calculateSkimmable(address _contractAddress)
        internal
        view
        returns (
            address _skimmableToken,
            uint256 _skimmableTokenAmount,
            uint256 _skimmableCashAmount
        )
    {
        if (contracts[_contractAddress].is4pool == true) {
            return (address(0), 0, _calculate4poolSkimmable(_contractAddress));
        }
        IUniswapV2Pair _uniswapPair = IUniswapV2Pair(_contractAddress);
        address _token0 = _uniswapPair.token0();
        address _token1 = _uniswapPair.token1();
        (uint256 _reserve0, uint256 _reserve1, ) = _uniswapPair.getReserves();
        if (address(_token0) == address(cash)) {
            _skimmableCashAmount = cash.balanceOf(_contractAddress).subOrZero(_reserve0);
            _skimmableToken = _token1;
            _skimmableTokenAmount = IERC20(_token1).balanceOf(_contractAddress).subOrZero(_reserve1);
        } else if (address(_token1) == address(cash)) {
            _skimmableToken = _token0;
            _skimmableTokenAmount = IERC20(_token0).balanceOf(_contractAddress).subOrZero(_reserve0);
            _skimmableCashAmount = cash.balanceOf(_contractAddress).subOrZero(_reserve1);
        }
    }

    function _allowFeeGauge(
        address _recipient,
        uint256 _skimmableCashAmount,
        uint256 _share
    ) internal returns (uint256 _shareAmount) {
        _shareAmount = (_skimmableCashAmount * _share) / BASE_FEE;
        if (SATIN_CASH_LP_GAUGE == _recipient) {
            uint256 satinCashLPVeShare = IVoter(satinVoter).calculateSatinCashLPVeShare(_shareAmount);
            _shareAmount -= satinCashLPVeShare;
            cash.safeTransfer(veDist, satinCashLPVeShare);
        }
        gaugeCashAmount[_recipient] += _shareAmount;
        cash.safeIncreaseAllowance(_recipient, _shareAmount);
    }

    function _allowFeeBribe(
        address _recipient,
        uint256 _skimmableCashAmount,
        uint256 _share
    ) internal returns (uint256 _shareAmount) {
        _shareAmount = (_skimmableCashAmount * _share) / BASE_FEE;
        bribeCashAmount[_recipient] += _shareAmount;
        cash.safeIncreaseAllowance(_recipient, _shareAmount);
    }
}
