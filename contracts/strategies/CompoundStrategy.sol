// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Compound Strategy
 * @notice Investment strategy for investing stablecoins via Compound
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { Comet, CometRewards, CometStructs } from "../interfaces/ICompound.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import "../exchanges/CurveExchange.sol";
import "../interfaces/IMiniVault.sol";
import "../interfaces/IOracle.sol";

contract CompoundStrategy is InitializableAbstractStrategy, CurveExchange {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using OvnMath for uint256;

    uint256 public constant MAX_UINT = type(uint256).max;
    uint256 public storedPrimaryTokenBalance;

    IERC20 public token0;
    IERC20 public primaryStable; // 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

    address internal pTokenAddress; // 0x8505b9d2254A7Ae468c0E9dd10Ccea3A837aef5c

    address public oracleRouter;
    address public cometAddress; // 0xF25212E676D1F7F89Cd72fFEe66158f541246445
    address public cometRewardAddress; // 0x45939657d1CA34A8FA39A924B71D28Fe8431e581
    address public curvePool;

    mapping(address => int128) internal curvePoolIndices;

    bool public isDirectDepositAllowed;

    /**
     * Initializer for setting up compound strategy internal state.
     * @param _platformAddress Address of COMP
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of USDC
     * @param _assets Addresses of supported assets
     * @param _pTokens Platform Token corresponding addresses, COMP
     * @param _primaryStable Primary Stable address (USDC)
     * @param _cometContracts Comet
     */
    function initialize(
        address _platformAddress, // COMP address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC / DAI / USDT
        address[] calldata _pTokens, // COMP address
        address _primaryStable,
        address[] calldata _cometContracts // COMET, CometRewards
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        pTokenAddress = _pTokens[0];

        token0 = IERC20(_assets[0]);
        primaryStable = IERC20(_primaryStable); // Primary stable
        cometAddress = _cometContracts[0];
        cometRewardAddress = _cometContracts[1];

        isDirectDepositAllowed = true;
        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
    }

    function setDirectDepositAllowed(bool _isDirectDepositAllowed) external onlyGovernor {
        isDirectDepositAllowed = _isDirectDepositAllowed;
    }

    function setCurvePool(address _curvePool) external onlyGovernor {
        curvePool = _curvePool;
    }

    function setOracleRouter() external onlyVaultOrGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function directDeposit() external onlyVault {
        uint256 balance = token0.balanceOf(address(this));
        _swapAssetToPrimaryStable(); // Compound only supports USDC supply
        _stake(primaryStable.balanceOf(address(this)));

        emit Deposit(address(token0), address(platformAddress), balance);
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        if (lpBalance() == 0) {
            return;
        }

        uint256 interest = lpBalance() - storedPrimaryTokenBalance;
        if (interest > 0) {
            uint256 beforeBal = primaryStable.balanceOf(address(this));

            Comet(cometAddress).withdraw(address(primaryStable), interest);

            uint256 afterBal = primaryStable.balanceOf(address(this)) - beforeBal;
            if (afterBal > 0) {
                primaryStable.transfer(harvesterAddress, afterBal);
                emit RewardTokenCollected(harvesterAddress, address(primaryStable), afterBal);
            }
        }
    }

    function netAssetValue() external view returns (uint256) {
        (uint256 _dai, uint256 _usdt, uint256 _usdc) = assetsInUsd();
        return _dai + _usdt + _usdc;
    }

    function lpBalance() public view returns (uint256) {
        return Comet(cometAddress).balanceOf(address(this));
    }

    function _inUsd(address _asset, uint256 _amount) internal view returns (uint256) {
        return (IOracle(oracleRouter).price(_asset) * _amount) / (10 ** Helpers.getDecimals(_asset));
    }

    function _getAssetAmount(address _asset) internal view returns (uint256, uint256) {
        if (address(primaryStable) == _asset) {
            return (primaryStable.balanceOf(address(this)), lpBalance()); // Compound only supports USDC supply
        }
        return (IERC20(_asset).balanceOf(address(this)), 0);
    }

    function assetsInUsd() public view returns (uint256, uint256, uint256) {
        address[] memory _assets = IMiniVault(vaultAddress).getSupportedAssets();
        uint256[] memory _assetsInUsd = new uint256[](_assets.length);
        for (uint256 i = 0; i < _assets.length; i++) {
            (uint256 _stray, uint256 _staked) = _getAssetAmount(_assets[i]);
            _assetsInUsd[i] = _inUsd(_assets[i], _stray + _staked);
        }
        return (_assetsInUsd[0], _assetsInUsd[1], _assetsInUsd[2]);
    }

    function liquidateAll() external onlyVault nonReentrant {
        _withdrawAll();
        _withdrawStrayAssets();
    }

    function withdrawUsd(uint256 _amountInUsd) external onlyVault nonReentrant returns (uint256, uint256, uint256) {
        (uint256 _daiInUsd, uint256 _usdtInUsd, uint256 _usdcInUsd) = _calculateUsd(_amountInUsd);
        address[] memory _assets = IMiniVault(vaultAddress).getSupportedAssets();

        // @dev _withdrawAsset will return the amount of asset withdrawn (not their worth in USD),
        // we are using the previous variable for potential gas savings
        _daiInUsd = _withdrawAsset(_assets[0], _daiInUsd);
        _usdtInUsd = _withdrawAsset(_assets[1], _usdtInUsd);
        _usdcInUsd = _withdrawAsset(_assets[2], _usdcInUsd);
        return (_daiInUsd, _usdtInUsd, _usdcInUsd);
    }

    function _calculateUsd(uint256 _amountInUsd) internal view returns (uint256, uint256, uint256) {
        (uint256 _daiInUsd, uint256 _usdtInUsd, uint256 _usdcInUsd) = assetsInUsd();
        uint256 _totalInUsd = _daiInUsd + _usdtInUsd + _usdcInUsd;
        require(_amountInUsd <= _daiInUsd + _usdtInUsd + _usdcInUsd, "CompoundStrategy - LOW_BAL");

        // Vars reused: daiInUsd = _daiInUsdWithdraw and so on | Preventing Stack deep errors.
        _daiInUsd = _daiInUsd.mul(_amountInUsd).div(_totalInUsd);
        _usdtInUsd = _usdtInUsd.mul(_amountInUsd).div(_totalInUsd);
        _usdcInUsd = _usdcInUsd.mul(_amountInUsd).div(_totalInUsd);

        return (_daiInUsd, _usdtInUsd, _usdcInUsd);
    }

    function calculateUsd(uint256 _amountInUsd) external view returns (uint256, uint256, uint256) {
        return _calculateUsd(_amountInUsd);
    }

    function withdrawStrayAssets() external onlyVault nonReentrant {
        _withdrawStrayAssets();
    }

    function _withdrawStrayAssets() internal {
        address[] memory _assets = IMiniVault(vaultAddress).getSupportedAssets();
        for (uint256 i = 0; i < _assets.length; i++) {
            IERC20(_assets[i]).safeTransfer(vaultAddress, IERC20(_assets[i]).balanceOf(address(this)));
        }
    }

    function directDepositRequirement(uint256 _psAmount) external view onlyVault returns (uint256) {
        if (address(token0) == address(primaryStable)) {
            return _psAmount;
        }
        return howMuchToSwap(curvePool, address(token0), address(primaryStable), _psAmount);
    }

    function _stake(uint256 _amount) internal {
        primaryStable.approve(cometAddress, _amount);
        storedPrimaryTokenBalance += _amount;
        Comet(cometAddress).supply(address(primaryStable), _amount);
    }

    function depositAll() public onlyVault nonReentrant {
        _swapAssetToPrimaryStable();
        _stake(primaryStable.balanceOf(address(this)));
    }

    function _withdrawAsset(address _asset, uint256 _amountInUsd) internal returns (uint256) {
        if (_amountInUsd == 0) {
            return 0;
        }
        uint256 _inTokenAmount = (_amountInUsd * (10 ** Helpers.getDecimals(_asset))) / IOracle(oracleRouter).price(_asset); // USD -> Token
        uint256 _toUnstakeAmount = _inTokenAmount.subOrZero(IERC20(_asset).balanceOf(address(this)));
        if (_toUnstakeAmount > 0 && address(token0) == _asset) {
            _directWithdraw(_toUnstakeAmount);
        }
        require(IERC20(_asset).balanceOf(address(this)) >= _inTokenAmount, "CompoundStrategy - LOW_BAL_IN_TOKEN");
        IERC20(_asset).safeTransfer(vaultAddress, _inTokenAmount);
        return _inTokenAmount;
    }

    function _directWithdraw(uint256 _amountOfToken0) internal {
        uint256 _eq = _equivalentInPrimary(_amountOfToken0);
        uint256 numberOfPrimary = _eq.addBasisPoints(40);
        uint256 primaryBalance = primaryStable.balanceOf(address(this));

        if (numberOfPrimary > primaryBalance) {
            numberOfPrimary -= primaryBalance;

            if (numberOfPrimary > storedPrimaryTokenBalance) {
                numberOfPrimary = storedPrimaryTokenBalance;
            }
            if (numberOfPrimary > 0) {
                storedPrimaryTokenBalance -= numberOfPrimary;
                Comet(cometAddress).withdraw(address(primaryStable), numberOfPrimary);
            }
        }

        require(primaryStable.balanceOf(address(this)) >= numberOfPrimary, "Compound: Not enough primaryStable balance");
        _swapPrimaryStableToToken0(numberOfPrimary);
        require(token0.balanceOf(address(this)) >= _amountOfToken0, "Compound: Not enough token0 balance");
    }

    function _equivalentInPrimary(uint256 _amount) internal view returns (uint256) {
        uint256 _eq = _amount;
        if (address(primaryStable) != address(token0)) {
            _eq = onSwap(curvePool, address(token0), address(primaryStable), _amount);
        }
        return _eq;
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function _withdrawAll() internal {
        if (lpBalance() > 0) {
            storedPrimaryTokenBalance = 0;
            Comet(cometAddress).withdraw(address(primaryStable), MAX_UINT);
        }

        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
    }

    function checkBalance() external view returns (uint256) {
        uint256 balanceWithInvestments = storedPrimaryTokenBalance;

        // swap to PrimaryStable
        if (address(token0) != address(primaryStable) && balanceWithInvestments > 0) {
            balanceWithInvestments = onSwap(curvePool, address(token0), address(primaryStable), balanceWithInvestments);
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function _convert(address from, address to, uint256 _amount, bool limit) internal view returns (uint256) {
        if (from == to) {
            return _amount;
        }
        uint256 fromPrice = IOracle(oracleRouter).price(from);
        uint256 toPrice = IOracle(oracleRouter).price(to);
        if ((toPrice > 10 ** 8) && limit) {
            toPrice = 10 ** 8;
        }
        return (_amount * fromPrice) / toPrice;
    }

    function _convert(address from, address to, uint256 _amount) internal view returns (uint256) {
        return _convert(from, to, _amount, true);
    }

    function _swapAssetToPrimaryStable() internal {
        if ((address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > 0)) {
            swap(curvePool, address(token0), address(primaryStable), token0.balanceOf(address(this)), oracleRouter);
            require(token0.balanceOf(address(this)) == 0, "Leftover token0");
        }
    }

    function _swapAssetToPrimaryStable(uint256 swapAmount) internal {
        if ((address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) >= swapAmount)) {
            swap(curvePool, address(token0), address(primaryStable), swapAmount, oracleRouter);
            require(token0.balanceOf(address(this)) == 0, "Leftover token0");
        }
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(curvePool, address(primaryStable), address(token0), primaryStableBalance, oracleRouter);
        }
    }

    function _swapPrimaryStableToToken0(uint256 swapAmount) internal {
        if (address(primaryStable) != address(token0) && (primaryStable.balanceOf(address(this)) >= swapAmount)) {
            swap(curvePool, address(primaryStable), address(token0), swapAmount, oracleRouter);
        }
    }
}
