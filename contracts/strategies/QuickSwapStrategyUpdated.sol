// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title QuickSwap Strategy
 * @notice Investment strategy for investing stablecoins via QuickSwap Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../exchanges/UniswapV2Exchange.sol";
import "../exchanges/CurveExchange.sol";
import "../connectors/uniswap/v2/interfaces/IUniswapV2Router02.sol";
import "../connectors/quickswap/IStakingRewards.sol";
import "../connectors/uniswap/v2/interfaces/IUniswapV2Pair.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../interfaces/IMiniVault.sol";
import { IHyperVisor } from "../interfaces/quickswap-gamma/IHyperVisor.sol";
import { IMasterChef, IRewarder } from "../interfaces/quickswap-gamma/IMasterChef.sol";
import { IUniProxy } from "../interfaces/quickswap-gamma/IUniProxy.sol";

import "hardhat/console.sol";

contract QuickSwapStrategy is InitializableAbstractStrategy, UniswapV2Exchange, CurveExchange {
    using SafeMath for uint256;
    using OvnMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public token0;
    IERC20 public token1;
    IERC20 public primaryStable;
    IERC20 public quickTokenNew;
    IERC20 public quickDragon;

    address public quickSwapMasterchef;
    address public hyperVisor;
    address public uniProxy;

    uint256 public rewardTokenCount;
    uint256 public poolId;
    uint256 public depositedLP;

    mapping(address => uint256) public assetToDenominator;

    address public swappingPool;
    uint256[] public minThresholds;
    address public oracleRouter;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as QuickSwap strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // QuickToken address
        address _vaultAddress, // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // USDC + USDT
        address[] calldata _pTokens, //  quickSwapUSDCUSDTPair
        address _primaryStable, // USDC address
        address _router, // quickSwapRouter02
        address _masterchef, // gamma quickSwap Masterchef
        uint256 _rewardTokenCount, // masterchef reward tokens, dQUICK and WMATIC in case of USDC-USDT
        uint256 _poolId // 11 for USDC/USDT pair
    ) external onlyGovernor initializer {
        require(_rewardTokenAddresses[0] != address(0), "Zero address not allowed");
        require(_pTokens[0] != address(0), "Zero address not allowed");
        require(_platformAddress != address(0), "Zero address not allowed");
        require(_router != address(0), "Zero address not allowed");
        require(_masterchef != address(0), "Zero address not allowed");
        require(_rewardTokenCount != 0, "No reward tokens are not allowed");

        token0 = IERC20(_assets[0]);
        token1 = IERC20(_assets[1]);

        poolId = _poolId;
        rewardTokenCount = _rewardTokenCount;

        primaryStable = IERC20(_primaryStable);
        quickTokenNew = IERC20(_platformAddress);

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; i++) {
            assetToDenominator[_assets[i]] = 10 ** IERC20Metadata(_assets[i]).decimals();
        }

        quickSwapMasterchef = _masterchef;
        hyperVisor = IMasterChef(quickSwapMasterchef).lpToken(poolId);
        uniProxy = IHyperVisor(hyperVisor).whitelistedAddress();

        _setUniswapRouter(_router);

        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
        for (uint8 i = 0; i < 5; i++) {
            minThresholds.push(0);
        }
    }

    function setOracleRouterPriceProvider() external onlyGovernor {
        swappingPool = IMiniVault(vaultAddress).swappingPool();
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function stakeLPToMasterchef() internal {
        uint256 lpTokenBalance = IERC20(hyperVisor).balanceOf(address(this));
        console.log("Staking lpTokenBalance", lpTokenBalance);

        IERC20(hyperVisor).approve(quickSwapMasterchef, lpTokenBalance);
        IMasterChef(quickSwapMasterchef).deposit(poolId, lpTokenBalance, address(this));

        depositedLP += lpTokenBalance;
        console.log("LP Balance staked: ", IERC20(hyperVisor).balanceOf(address(this)));
    }

    function directDeposit() internal {
        console.log("------------deposit------------");

        uint256 token0Amount = IERC20(token0).balanceOf(address(this));
        uint256 token1Amount = IERC20(token1).balanceOf(address(this));

        token0.approve(hyperVisor, token0Amount);
        token1.approve(hyperVisor, token1Amount);

        uint256[4] memory inMin;

        console.log("deposit: LP balance Before deposit", IERC20(hyperVisor).balanceOf(address(this)));
        console.log("deposit: USDC balance Before deposit", IERC20(token0).balanceOf(address(this)));
        console.log("deposit: USDT balance Before deposit", IERC20(token1).balanceOf(address(this)));

        (uint256 test1Min, uint256 test1Max) = IUniProxy(uniProxy).getDepositAmount(hyperVisor, address(token0), token0Amount);

        console.log("deposit: test1Min, test1Max, token1Amount", test1Min, test1Max, token1Amount);

        (uint256 test0Min, uint256 test0Max) = IUniProxy(uniProxy).getDepositAmount(hyperVisor, address(token1), token1Amount);

        console.log("deposit: test0Min, test0Max, token0Amount", test0Min, test0Max, token0Amount);

        IUniProxy(uniProxy).deposit(token0Amount, token1Amount, address(this), hyperVisor, inMin);

        console.log("deposit: LP balance after deposit", IERC20(hyperVisor).balanceOf(address(this)));
        console.log("deposit: USDC balance after deposit", IERC20(token0).balanceOf(address(this)));
        console.log("deposit: USDT balance after deposit", IERC20(token1).balanceOf(address(this)));
    }

    function divideToken0(uint256 balance) internal {
        console.log("------------divide token------------");
        (uint256 test1Min, uint256 test1Max) = IUniProxy(uniProxy).getDepositAmount(hyperVisor, address(token0), balance);

        console.log("divide token: Before swap, test1Min, test1Max, token1Amount", test1Min, test1Max, IERC20(token1).balanceOf(address(this)));
        uint256 average = (test1Min + test1Max) / 2;
        uint256 toSwap = (balance * average) / (balance + average);

        console.log("divide token: USDC balance Before swap", IERC20(token0).balanceOf(address(this)));
        console.log("divide token: USDT balance Before swap", IERC20(token1).balanceOf(address(this)));
        _swapExactTokensForTokens(address(token0), address(token1), toSwap, address(this));

        console.log("divide token: USDC balance After swap", IERC20(token0).balanceOf(address(this)));
        console.log("divide token: USDT balance After swap", IERC20(token1).balanceOf(address(this)));

        (test1Min, test1Max) = IUniProxy(uniProxy).getDepositAmount(hyperVisor, address(token0), IERC20(token0).balanceOf(address(this)));
        console.log("divide token: After swap, test1Min, test1Max, token1Amount", test1Min, test1Max, IERC20(token1).balanceOf(address(this)));
    }

    function unstakeLP(uint256 _amount) internal {
        console.log("Unstaking lpTokenBalance", _amount);
        IMasterChef(quickSwapMasterchef).withdraw(poolId, _amount, address(this));
        depositedLP -= _amount;
    }

    function _collectRewards() internal {
        // claim rewards
        IMasterChef(quickSwapMasterchef).harvest(poolId, address(this));

        // sell rewards
        for (uint i; i < 2; ++i) {
            address rewarder = IMasterChef(quickSwapMasterchef).getRewarder(poolId, i);
            console.log("collectRewards: Rewarder Address", rewarder);
            address rewardToken = IRewarder(rewarder).rewardToken();
            console.log("collectRewards: Rewarder token", rewardToken);
            uint256 rewardBalance = IERC20(rewardToken).balanceOf(address(this));
            console.log("collectRewards: Rewarder token balance after collectRewards", rewardBalance);
            console.log("collectRewards: USDC token balance before swap", primaryStable.balanceOf(address(this)));
            _swapExactTokensForTokens(rewardToken, address(primaryStable), rewardBalance, address(this));
            console.log("collectRewards: USDC token balance after swap", primaryStable.balanceOf(address(this)));
        }

        uint256 balance = primaryStable.balanceOf(address(this));
        console.log("RewardCollection - dQUICK, WMATIC -> USDC Balance: ", balance);
        if (balance > 0) {
            emit RewardTokenCollected(harvesterAddress, address(primaryStable), balance);
            primaryStable.transfer(harvesterAddress, balance);
        }
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        _collectRewards();
    }

    function _swapAssetsToPrimaryStable() internal {
        if ((address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > minThresholds[0])) {
            swap(swappingPool, address(token0), address(primaryStable), token0.balanceOf(address(this)), oracleRouter);
        }
        if ((address(token1) != address(primaryStable)) && (token1.balanceOf(address(this)) > minThresholds[1])) {
            swap(swappingPool, address(token1), address(primaryStable), token1.balanceOf(address(this)), oracleRouter);
        }
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(swappingPool, address(primaryStable), address(token0), primaryStableBalance, oracleRouter);
        }
    }

    function setThresholds(uint256[] calldata _minThresholds) external onlyVaultOrGovernor nonReentrant {
        require(_minThresholds.length == 5, "5 thresholds needed");
        // minThresholds[0] - token0 minimum swapping threshold
        // minThresholds[1] - token1 minimum swapping threshold
        // minThresholds[2] - primaryStable to token0 minimum swapping threshold
        // minThresholds[3] - lp token minimum swapping threshold
        // minThresholds[4] - reward token (QUICKDRAGON) minimum swapping threshold
        minThresholds = _minThresholds;
    }

    function lpBalance() public view returns (uint256) {
        return depositedLP + IERC20(hyperVisor).balanceOf(address(this));
    }

    function netAssetValue() external view returns (uint256) {
        (uint256 _dai, uint256 _usdt, uint256 _usdc) = assetsInUsd();
        return _dai + _usdt + _usdc;
    }

    function _inUsd(address _asset, uint256 _amount) internal view returns (uint256) {
        return (IOracle(oracleRouter).price(_asset) * _amount) / (10 ** Helpers.getDecimals(_asset));
    }

    function _getAssetAmount(address _asset) internal view returns (uint256, uint256) {
        if (address(token0) == _asset) {
            return (token0.balanceOf(address(this)), lpBalance());
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
        require(_amountInUsd <= _daiInUsd + _usdtInUsd + _usdcInUsd, "TetuStrategy - LOW_BAL");

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

    function _withdrawAsset(address _asset, uint256 _amountInUsd) internal returns (uint256) {
        if (_amountInUsd == 0) {
            return 0;
        }
        uint256 _inTokenAmount = (_amountInUsd * (10 ** Helpers.getDecimals(_asset))) / IOracle(oracleRouter).price(_asset); // USD -> Token
        uint256 _toUnstakeAmount = _inTokenAmount.subOrZero(IERC20(_asset).balanceOf(address(this)));
        if (_toUnstakeAmount > 0 && address(token0) == _asset) {
            _directWithdraw(_toUnstakeAmount);
        }
        require(IERC20(_asset).balanceOf(address(this)) >= _inTokenAmount, "TetuStrategy - LOW_BAL_IN_TOKEN");
        IERC20(_asset).safeTransfer(vaultAddress, _inTokenAmount);
        return _inTokenAmount;
    }

    function _withdrawAll() internal {
        console.log("------------withdraw------------");
        unstakeLP(lpBalance());

        uint256 LpBalance = IERC20(hyperVisor).balanceOf(address(this));
        console.log("withdraw: LP balance after stake", LpBalance);

        uint256[4] memory inMin;

        console.log("withdraw: USDC balance Before withdraw", IERC20(token0).balanceOf(msg.sender));
        console.log("withdraw: USDT balance Before withdraw", IERC20(token1).balanceOf(msg.sender));
        IHyperVisor(hyperVisor).withdraw(LpBalance, msg.sender, address(this), inMin);

        console.log("withdraw: USDC balance after withdraw", IERC20(token0).balanceOf(msg.sender));
        console.log("withdraw: USDT balance after withdraw", IERC20(token1).balanceOf(msg.sender));
    }

    function _directWithdraw(uint256 _amountOfToken0) internal {
        _withdrawAll();
        if (_amountOfToken0 >= primaryStable.balanceOf(address(this))) {
            _amountOfToken0 = primaryStable.balanceOf(address(this));
        }

        primaryStable.transfer(msg.sender, _amountOfToken0);

        // withdraw all and deposit remaining amount
        directDeposit();
    }
}
