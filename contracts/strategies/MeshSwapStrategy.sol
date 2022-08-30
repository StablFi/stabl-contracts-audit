// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title MeshSwap Strategy
 * @notice Investment strategy for investing stablecoins via NeshSwap Strategy
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"  ;


import { StableMath } from "../utils/StableMath.sol";
import "../exchanges/UniswapV2Exchange.sol";
import "../interfaces/IMeshSwapLP.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import "../exchanges/BalancerExchange.sol";
import "hardhat/console.sol";


contract MeshSwapStrategy is InitializableAbstractStrategy, UniswapV2Exchange, BalancerExchange   {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using OvnMath for uint256;


    IERC20 public token0;
    IERC20 public primaryStable;
    IERC20 public meshToken;

    IMeshSwapLP public meshSwapToken0;


    bytes32 poolId;
    address public balancerVault;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as MeshSwap strategies don't fit
     * well within that abstraction.
     */
    function initialize(
        address _platformAddress, // MeshToken address
        address _vaultAddress,    // VaultProxy address
        address[] calldata _rewardTokenAddresses, // USDC - as in end USDC will be sent to Harvester
        address[] calldata _assets, // USDC
        address[] calldata _pTokens, // meshSwapToken0
        address _router,  // meshSwapRouter
        address _primaryStable
    ) external onlyGovernor initializer {
        require(_rewardTokenAddresses[0] != address(0), "Zero address not allowed");
        require(_pTokens[0] != address(0), "Zero address not allowed");
        require(_platformAddress != address(0), "Zero address not allowed");
        require(_router != address(0), "Zero address not allowed");
        require(_primaryStable != address(0), "Zero address not allowed");

        token0 = IERC20(_assets[0]);
        primaryStable = IERC20(_primaryStable);
        meshToken = IERC20(_platformAddress);
        meshSwapToken0 = IMeshSwapLP(_pTokens[0]);
        _setUniswapRouter(_router);
        _abstractSetPToken(_assets[0],_pTokens[0]);

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    function setBalancer(address _balancerVault, bytes32 _balancerPoolIdUsdcTusdDaiUsdt) external onlyGovernor {
        require(_balancerVault != address(0), "Zero address not allowed");
        require(_balancerPoolIdUsdcTusdDaiUsdt != "", "Empty pool id not allowed");
        balancerVault = _balancerVault;
        poolId = _balancerPoolIdUsdcTusdDaiUsdt;
    }
    // TODO: Deposit is not making use of _amount
    function _deposit(
        address _asset,
        uint256 _amount
    )  internal {
        require(_asset == address(primaryStable), "Token not compatible.");
        _swapPrimaryStableToToken0();
        // console.log("primaryStable Balance:", primaryStable.balanceOf(address(this)));
        // console.log("Token0 Balance:", token0.balanceOf(address(this)));
        token0.approve(address(meshSwapToken0), token0.balanceOf(address(this)) );
        // console.log("Depositing ", token0.balanceOf(address(this)));
        meshSwapToken0.depositToken(token0.balanceOf(address(this)));
    }

    function deposit(
        address _asset,
        uint256 _amount
    )   external
        override
        onlyVault
        nonReentrant {
        require(_asset == address(primaryStable), "Token not compatible.");
        _deposit(_asset, _amount);
    }

    function depositAll() external override onlyVault nonReentrant {
        _deposit(address(token0), token0.balanceOf(address(this)));
    }


    function withdraw(
        address _beneficiary,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant  {
        require(_asset == address(primaryStable), "Token not compatible.");
        meshSwapToken0.withdrawToken(_amount);
        console.log("MeshSwapStrategy - withdraw - token0: ", token0.balanceOf(address(this)));

        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        console.log("MeshSwapStrategy - withdraw - PrimaryStable: ",primaryStableBalance);
        primaryStable.safeTransfer(_beneficiary, primaryStableBalance);
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant  {
        meshSwapToken0.withdrawTokenByAmount(meshSwapToken0.balanceOf(address(this)));
        _swapAssetToPrimaryStable();
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        // console.log("withdraw - PrimaryStable",primaryStableBalance);
        primaryStable.safeTransfer(vaultAddress, primaryStableBalance);
        _collectRewards();
    }
    function checkBalance()
        external
        view
        override
        returns (uint256)
    {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        uint256 token0Balance;
        uint256 lpTokenBalance = meshSwapToken0.balanceOf(address(this));
        // console.log("lpTokenBalance:", lpTokenBalance);

        // TODO: MoreClean workground for handling non-six decimal token0
        // Fix for handling token0 with 18 decimals
        if (IERC20Metadata(address(token0)).decimals() != IERC20Metadata(address(primaryStable)).decimals()) {
            lpTokenBalance = lpTokenBalance.div(10 ** (IERC20Metadata(address(token0)).decimals() - IERC20Metadata(address(primaryStable)).decimals())); // e12 = e18 - e6
        }
        // console.log("lpTokenBalance:", lpTokenBalance);
        if (lpTokenBalance > 0) {
            uint256 exchangeRateStored = meshSwapToken0.exchangeRateStored();
            // console.log("exchangeRateStored:", exchangeRateStored);
            token0Balance = exchangeRateStored.mul(lpTokenBalance).div(1e18);
        }
        // console.log("token0Balance:", token0Balance.scaleBy(IERC20Metadata(address(token0)).decimals() , 6 ));
        uint256 primaryStableBalanceFromToken0;
        if ( (address(token0) != address(primaryStable))  ) {
            if (token0Balance > 0) {
                primaryStableBalanceFromToken0 = onSwap(
                    balancerVault,
                    poolId,
                    IVault.SwapKind.GIVEN_IN,
                    token0,
                    primaryStable,
                    token0Balance.scaleBy(IERC20Metadata(address(token0)).decimals() , 6 )
                );
                // console.log("Token0 swap -  primaryStableBalanceFromToken0 ", primaryStableBalanceFromToken0);
            }
        } else {
            primaryStableBalanceFromToken0 += token0Balance;
        }
        return primaryStableBalanceFromToken0 + primaryStableBalance;
    }

    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        _collectRewards();
    }
    function _collectRewards() internal {
        // console.log("Starting collection of rewards");
        // claim rewards
        meshSwapToken0.claimReward();
        // console.log("claimStakingRewards called");
        // sell rewards
        uint256 totalUsdc = 0;
        uint256 meshBalance = meshToken.balanceOf(address(this));
        // console.log("meshBalance: ", meshBalance);
        if (meshBalance > 10 ** 13) {
            // console.log("Swapping MeshToken for USDC");
            uint256 meshUsdc = _swapExactTokensForTokens(
                address(meshToken),
                address(primaryStable),
                meshBalance,
                address(this)
            );
            // console.log("Mesh USDC", meshUsdc);
            totalUsdc += meshUsdc;
        }
        // console.log("totalUsdc", totalUsdc);
        uint256 balance = primaryStable.balanceOf(address(this));
        // console.log("balance", balance);
        if (balance > 0) {
            emit RewardTokenCollected(
                harvesterAddress,
                address(primaryStable),
                balance
            );
            primaryStable.transfer(harvesterAddress, balance);
        }
    }
    function _swapAssetToPrimaryStable() internal {
        if ( (address(token0) != address(primaryStable)) && (token0.balanceOf(address(this)) > 0) )  {
            // console.log("Swapping token0");
            swap(
                balancerVault,
                poolId,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(token0)),
                IAsset(address(primaryStable)),
                address(this),
                address(this),
                token0.balanceOf(address(this)),
                0
            );
            if(token0.balanceOf(address(this)) > 0) {
                revert("MeshSwap Strategy - Token0 to PrimarySwap failed");
            }
        }
    }
    function _swapPrimaryStableToToken0() internal {
        uint256 primaryStableBalance = primaryStable.balanceOf(address(this));
        if (address(primaryStable) != address(token0)) {
            swap(
                balancerVault,
                poolId, 
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(primaryStable)),
                IAsset(address(token0)),
                address(this),
                address(this),
                primaryStableBalance,
                0
            );
        }
    }

     /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(primaryStable);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        // Not needed
    }

    /**
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _cToken The cToken for the approval
     */
    function _abstractSetPToken(address _asset, address _cToken)
        internal
        override
    {
        // Not needed
    }
   
}
