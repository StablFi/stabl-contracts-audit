// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Stargate Strategy
 * @notice Investment strategy for investing stablecoins via Stargate
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IStargatePool } from "./../connectors/stargate/IStargatePool.sol";
import { IStargateRouter } from "./../connectors/stargate/IStargateRouter.sol";
import { IStargateChef } from "./../connectors/stargate/IStargateChef.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import "../exchanges/UniswapV2Exchange.sol";
import "../exchanges/CurveExchange.sol";
import "../interfaces/IMiniVault.sol";
import "../interfaces/IOracle.sol";

contract StargateStrategy is InitializableAbstractStrategy, UniswapV2Exchange, CurveExchange {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using OvnMath for uint256;

    struct StargateParams {
        address lpToken;
        address chef;
        address stargateRouter;
        uint256 routerPoolId;
        uint256 poolId;
        uint256 minSwap;
    }

    address internal pTokenAddress;

    IERC20 public token0;
    IERC20 public primaryStable;
    IERC20 public rewardToken;

    IStargatePool public lpToken;
    IStargateChef public chef;
    IStargateRouter public stargateRouter;

    uint256 public routerPoolId;
    uint256 public poolId;
    uint256 public minSwap;

    address public oracleRouter;

    address public curvePool;
    mapping(address => int128) internal curvePoolIndices;

    bool public isDirectDepositAllowed;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Stargate strategy doesn't fit
     * well within that abstraction.
     * @param _platformAddress Address of STG
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of USDC
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                USDC
     * @param _pTokens Platform Token corresponding addresses
     * @param _primaryStable Primary Stable address (USDC)
     * @param _params Stargate specific parameters
     */
    function initialize(
        address _platformAddress, // STG Token address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // USDC
        address[] calldata _assets, // USDC / DAI / USDT
        address[] calldata _pTokens, // STG Token address
        address _primaryStable,
        StargateParams calldata _params
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        pTokenAddress = _pTokens[0];

        token0 = IERC20(_assets[0]);
        rewardToken = IERC20(_pTokens[0]); // STG token
        primaryStable = IERC20(_primaryStable); // Primary stable

        lpToken = IStargatePool(_params.lpToken);
        chef = IStargateChef(_params.chef);
        stargateRouter = IStargateRouter(_params.stargateRouter);
        routerPoolId = _params.routerPoolId;
        poolId = _params.poolId;
        minSwap = _params.minSwap;

        isDirectDepositAllowed = true;
        super._initialize(_platformAddress, _vaultAddress, _rewardTokenAddresses, _assets, _pTokens);
    }

    function setDirectDepositAllowed(bool _isDirectDepositAllowed) external onlyGovernor {
        isDirectDepositAllowed = _isDirectDepositAllowed;
    }

    function _setRouter(address _stgSwapRouter) external onlyGovernor {
        require(_stgSwapRouter != address(0), "Zero address not allowed");
        _setUniswapRouter(_stgSwapRouter);
    }

    function setCurvePool(address _curvePool, address[] calldata tokens) external onlyGovernor {
        curvePool = _curvePool;
        curvePoolIndices[tokens[0]] = 0;
        curvePoolIndices[tokens[1]] = 1;
        curvePoolIndices[tokens[2]] = 2;
    }

    function poolBalanceCheckExponent() external view returns (uint256) {
        return IMiniVault(vaultAddress).poolBalanceCheckExponent();
    }

    function setOracleRouter() external onlyVaultOrGovernor {
        oracleRouter = IMiniVault(vaultAddress).priceProvider();
    }

    function directDeposit() external onlyVault {
        _stake(token0.balanceOf(address(this)));

        emit Deposit(address(token0), address(platformAddress), token0.balanceOf(address(this)));
    }

    function directDepositRequirement(uint256 _psAmount) external view onlyVault returns (uint256) {
        if (address(token0) == address(primaryStable)) {
            return _psAmount;
        }
        return howMuchToSwap(curvePool, address(token0), address(primaryStable), _psAmount);
    }

    function deposit(address _asset, uint256 _amount) external  onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        require(_amount > 0, "Must deposit something");
        _swapPrimaryStableToToken0();
        _stake(token0.balanceOf(address(this)));

        emit Deposit(_asset, address(platformAddress), token0.balanceOf(address(this)));
    }

    function _stake(uint256 _amount) internal {
        token0.approve(address(stargateRouter), _amount);
        stargateRouter.addLiquidity(routerPoolId, _amount, address(this));

        uint256 lpBal = lpToken.balanceOf(address(this));
        lpToken.approve(address(chef), lpBal);
        chef.deposit(poolId, lpBal);
    }

    function depositAll() public  onlyVault nonReentrant {
        _stake(token0.balanceOf(address(this)));
    }

    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external  onlyVault nonReentrant {
        require(_asset == address(primaryStable), "Token not supported.");
        uint256 _eq = _equivalentInToken0(_amount);
        uint256 numberOfShares = (_eq.addBasisPoints(40) * lpToken.totalSupply()) / lpToken.totalLiquidity() / lpToken.convertRate();
        if (numberOfShares > lpBalance()) {
            _withdrawAll();
        } else if (numberOfShares > 0) {
            chef.withdraw(poolId, numberOfShares);
            stargateRouter.instantRedeemLocal(uint16(routerPoolId), numberOfShares, address(this));
        }

        _swapAssetToPrimaryStable();
        require(primaryStable.balanceOf(address(this)) >= _amount, "Not enough balance");
        primaryStable.safeTransfer(_beneficiary, _amount);
    }

    function _equivalentInToken0(uint256 _amount) internal view returns (uint256) {
        uint256 _eq = _amount;
        if (address(primaryStable) != address(token0)) {
            _eq = onSwap(curvePool, address(primaryStable), address(token0), _amount);
        }
        return _eq;
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external  onlyVault nonReentrant {
        _withdrawAll();
        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
    }

    function _withdrawAll() internal {
        // exit from vault
        uint256 lpBal = lpBalance();
        if (lpBal > 0) {
            uint256 _nav = netAssetValue();
            chef.withdraw(poolId, lpBal);
            uint256 _amountSD = stargateRouter.instantRedeemLocal(uint16(routerPoolId), lpBal, address(this));
            // Calculate the total token0 present in the contract after withdrawl
            _amountSD =
                _convert(
                    address(token0),
                    address(primaryStable),
                    _amountSD + ((address(token0) != address(primaryStable)) ? token0.balanceOf(address(this)) : 0)
                ).scaleBy(Helpers.getDecimals(address(primaryStable)), Helpers.getDecimals(address(token0))) +
                ((address(token0) != address(primaryStable)) ? primaryStable.balanceOf(address(this)) : 0);
            console.log("Total withdrawn (in PS): %s", _amountSD);
            console.log("NAV: %s", _nav);
            // Total withdrawn (in PS) should not deviate by more than 0.3% from the NAV
            require(_amountSD >= _nav.subBasisPoints(30) && _amountSD <= _nav.addBasisPoints(30), "INCON_WITHD_ALL");
        }
    }

    function collectRewardTokens() external override onlyHarvester nonReentrant {
        if (lpBalance() == 0) {
            return;
        }

        chef.deposit(poolId, 0);

        uint256 rewardBal = rewardToken.balanceOf(address(this));
        uint256 _initialPS = primaryStable.balanceOf(address(this));
        if (rewardBal > minSwap) {
            _swapExactTokensForTokens(address(rewardToken), address(primaryStable), rewardBal, address(this));
        }
        uint256 rewardPrimaryStableBal = primaryStable.balanceOf(address(this)) - _initialPS;
        console.log("Stargate - STG -> USDC: ", rewardPrimaryStableBal);

        if (rewardPrimaryStableBal > 0) {
            primaryStable.transfer(harvesterAddress, rewardPrimaryStableBal);
            emit RewardTokenCollected(harvesterAddress, address(primaryStable), rewardPrimaryStableBal);
        }
    }

    function checkBalance() external view  returns (uint256) {
        uint256 balanceWithInvestments = (lpBalance() * lpToken.convertRate() * lpToken.totalLiquidity()) / lpToken.totalSupply();

        // swap to PrimaryStable
        if (address(token0) != address(primaryStable) && balanceWithInvestments > 0) {
            balanceWithInvestments = onSwap(curvePool, address(token0), address(primaryStable), balanceWithInvestments);
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function netAssetValue() public view returns (uint256) {
        uint256 balanceWithInvestments = (lpBalance() * lpToken.convertRate() * lpToken.totalLiquidity()) / lpToken.totalSupply();
        if (address(token0) != address(primaryStable) && balanceWithInvestments > 0) {
            balanceWithInvestments = _convert(address(token0), address(primaryStable), balanceWithInvestments).scaleBy(
                Helpers.getDecimals(address(primaryStable)),
                Helpers.getDecimals(address(token0))
            );
        }

        return balanceWithInvestments + primaryStable.balanceOf(address(this));
    }

    function lpBalance() public view returns (uint256) {
        (uint256 amount, ) = chef.userInfo(poolId, address(this));
        return amount;
    }

    function _convert(
        address from,
        address to,
        uint256 _amount,
        bool limit
    ) internal view returns (uint256) {
        if (from == to) {
            return _amount;
        }
        uint256 fromPrice = IOracle(oracleRouter).price(from);
        uint256 toPrice = IOracle(oracleRouter).price(to);
        if ((toPrice > 10**8) && limit) {
            toPrice = 10**8;
        }
        return (_amount * fromPrice) / toPrice;
    }

    function _convert(
        address from,
        address to,
        uint256 _amount
    ) internal view returns (uint256) {
        return _convert(from, to, _amount, true);
    }

    function _swapAssetToPrimaryStable() internal {
        if ((address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > 0)) {
            swap(curvePool, address(token0), address(primaryStable), token0.balanceOf(address(this)), oracleRouter);
            require(token0.balanceOf(address(this)) == 0, "Leftover token0");
        }
    }

    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(curvePool, address(primaryStable), address(token0), primaryStableBalance, oracleRouter);
        }
    }
}
