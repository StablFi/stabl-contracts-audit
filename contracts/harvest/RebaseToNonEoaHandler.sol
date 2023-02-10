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
import "hardhat/console.sol";

contract RebaseToNonEoaHandler is Initializable, Governable {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeMath for uint256;

    IVault public vault;
    IERC20 public primaryStable;
    IERC20 public cash;

    uint constant BASE_FEE = 1e6;

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
    }
    mapping(address => Contract) public contracts;
    address[] public allContracts;
    uint256 public contractsCount;

    address public treasury;
    address public satinVoter;

    event ContractAdded(address _contract);
    event ContractRemoved(address _contract);
    event GuageNotifyFailed(address _pair, address _recipient, uint256 _amount);
    event BribeNotifyFailed(address _pair, address _recipient, uint256 _amount);
    event GuageRemitted(address _pair, address _recipient, uint256 _amount);
    event BribeRemitted(address _pair, address _recipient, uint256 _amount);
    event TreasuryRemitted(address _pair, address _recipient, uint256 _amount);
    event GovernorRemitted(
        address _pair,
        address _token,
        address _recipient,
        uint256 _amount
    );

    /**
     * @dev Verifies that the caller is the Vault or Governor.
     */
    modifier onlyVaultOrGovernor() {
        require(
            msg.sender == address(vault) || msg.sender == governor(),
            "Caller is not the Vault or Governor"
        );
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

    function addContract(
        address _contractAddress,
        bytes32 _poolId,
        address _gauge,
        address _bribe,
        uint256 _guageShare,
        uint256 _bribeShare,
        uint256 _treasuryShare,
        bool _isSatin
    ) public onlyGovernor {
        require(address(_contractAddress) != address(0), "!CONTRACT");
        require(
            _guageShare.add(_bribeShare).add(_treasuryShare) == BASE_FEE,
            "FEES != BASE_FEE"
        );
        require(
            (contracts[_contractAddress].contractAddress == address(0)) || (contracts[_contractAddress].isSupported == false),
            "ALREADY_ADDED"
        );

        contracts[_contractAddress] = Contract(
            _contractAddress,
            _poolId,
            _gauge,
            _bribe,
            _guageShare,
            _bribeShare,
            _treasuryShare,
            _isSatin,
            true
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
        if (_gaugeAddress != address(0)) {
            _bribeAddress = IVoter(satinVoter).bribes(_gaugeAddress);
        }

        addContract(
            _satinPoolAddress,
            bytes32(0),
            _gaugeAddress,
            _bribeAddress,
            _guageShare,
            _bribeShare,
            _treasuryShare,
            true
        );
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
                if (_skimmableCashAmount > 0) {
                    IUniswapV2Pair(_contractAddress).skim(address(this));
                    if (_contractInfo.gauge != address(0)) {
                        // Allow gauge contract to have his share
                        uint _gaugeShare = _allowFee(_contractInfo.gauge,_skimmableCashAmount,_contractInfo.guageShare);

                        try IGauge(_contractInfo.gauge).notifyRewardAmount(address(cash),_gaugeShare,false)
                        {
                            emit GuageRemitted(_contractAddress,_contractInfo.gauge,_gaugeShare);
                        } catch  {
                            console.log("GAUGE NOTIFY FAILED");
                            emit GuageNotifyFailed(_contractAddress, _contractInfo.bribe, _gaugeShare);
                        }

                        // Allow bribe contract to have his share
                        uint _bribeShare = _allowFee(_contractInfo.bribe,_skimmableCashAmount,_contractInfo.bribeShare);
                        try
                            IBribe(_contractInfo.bribe).notifyRewardAmount(address(cash),_bribeShare)
                        {
                            emit BribeRemitted(_contractAddress,_contractInfo.bribe,_bribeShare);
                        } catch {
                            console.log("BRIBE NOTIFY FAILED");
                            emit BribeNotifyFailed(_contractAddress, _contractInfo.bribe, _bribeShare);
                        }

                        // Transfer Treasury Share
                        uint _treasuryShare = (_skimmableCashAmount * _contractInfo.treasuryShare) / BASE_FEE;
                        cash.safeTransfer(treasury, _treasuryShare);
                        emit TreasuryRemitted(_contractAddress,treasury,_treasuryShare);
                    } else {
                        cash.safeTransfer(treasury, _skimmableCashAmount);
                        emit TreasuryRemitted(_contractAddress,treasury,_skimmableCashAmount);
                    }
                } else {
                    console.log("Nothing to skim: ", _contractAddress);
                }

                // Send other token (if any) to the governor
                if (_skimmableTokenAmount > 0) {
                    IERC20(_skimmableToken).transfer(governor(),_skimmableTokenAmount);
                    emit GovernorRemitted(_contractAddress,_skimmableToken,governor(),_skimmableTokenAmount);
                }
            }
        }
    }

    function _calculateSkimmable(
        address _contractAddress
    )
        internal
        view
        returns (
            address _skimmableToken,
            uint256 _skimmableTokenAmount,
            uint256 _skimmableCashAmount
        )
    {
        IUniswapV2Pair _uniswapPair = IUniswapV2Pair(_contractAddress);
        address _token0 = _uniswapPair.token0();
        address _token1 = _uniswapPair.token1();
        (uint256 _reserve0, uint256 _reserve1, ) = _uniswapPair.getReserves();
        if (address(_token0) == address(cash)) {
            _skimmableCashAmount = cash.balanceOf(_contractAddress) - _reserve0;
            _skimmableToken = _token1;
            _skimmableTokenAmount =
                IERC20(_token1).balanceOf(_contractAddress) -
                _reserve1;
        } else if (address(_token1) == address(cash)) {
            _skimmableToken = _token0;
            _skimmableTokenAmount =
                IERC20(_token0).balanceOf(_contractAddress) -
                _reserve0;
            _skimmableCashAmount = cash.balanceOf(_contractAddress) - _reserve1;
        }
    }
    function _allowFee(
        address _recipient,
        uint256 _skimmableCashAmount,
        uint256 _share
    ) internal returns (uint _shareAmount) {
        _shareAmount = (_skimmableCashAmount * _share) / BASE_FEE;
        cash.safeIncreaseAllowance(_recipient, _shareAmount);
    }
}
