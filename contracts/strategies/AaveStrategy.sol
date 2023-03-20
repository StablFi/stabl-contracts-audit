// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH Aave Strategy
 * @notice Investment strategy for investing stablecoins via Aave
 * @author Stabl Protocol Inc
 */ 
import { SafeERC20 } from     "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";


import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IAsset } from "../interfaces/balancer/interfaces/IAsset.sol";
import { IVault } from "../interfaces/balancer/interfaces/IVault.sol";
import { ILendingPoolAddressesProvider } from "../connectors/aave/interfaces/ILendingPoolAddressesProvider.sol";
import { ILendingPool } from "../connectors/aave/interfaces/ILendingPool.sol";
import { BalancerExchange } from "../exchanges/BalancerExchange.sol";
import { IProtocolDataProvider } from "../connectors/aave/interfaces/IProtocolDataProvider.sol";
import { IAaveIncentivesController } from "../connectors/aave/interfaces/IAaveIncentivesController.sol";


// TODO: Should be modified to work with primaryStable.
// TODO: SHOULD NOT BE USED FOR ANYTHING IN CURRENT STATE.

contract AaveStrategy is InitializableAbstractStrategy, BalancerExchange {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // TODO: Set referral code
    uint16 constant referralCode = 0;

    ILendingPoolAddressesProvider  public poolProvider;
    IProtocolDataProvider public dataProvider;
    IAaveIncentivesController public incentivesController;
    ILendingPool public pool;

    IERC20 public token;
    IERC20 public harvestingToken;
    IERC20 public variableDebtToken;

    bytes32 public poolId;

    uint256 public borrowRate;
    uint256 public borrowDepth = 6;
    uint256 public BORROW_DEPTH_MAX = 8;
    uint256 public minLeverage;
    uint256 public BORROW_RATE_MAX;
    uint256 public BORROW_RATE_MAX_HARD;
    uint256 public constant BORROW_RATE_DIVISOR = 10000;


    address public balancerVault;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as AAVE needs several extra
     * addresses for the rewards program.
     * @param _platformAddress Address of the AAVE pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of the AAVE token
     * @param _assets Addresses of supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address _platformAddress, // AAVE pool
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // AAVE
        address[] calldata _assets,
        address[] calldata _pTokens,
        address[] calldata aaveContracts // aavePoolProvider, aaveDataProvider, aaveIncentivesController, variableDebtToken (in order)
    ) external onlyGovernor initializer {
        // console.log("BorrowDepth:",borrowDepth);

        harvestingToken = IERC20(_rewardTokenAddresses[0]);
        token = IERC20(_assets[0]);


        poolProvider = ILendingPoolAddressesProvider(aaveContracts[0]);
        dataProvider = IProtocolDataProvider(aaveContracts[1]);
        incentivesController = IAaveIncentivesController(aaveContracts[2]);
        variableDebtToken =  IERC20(aaveContracts[3]);
        pool = ILendingPool(poolProvider.getLendingPool());
        // console.log("Pool:",address(pool));

        (,uint256 ltv,uint256 threshold,,,bool collateral,bool borrow,,,) = dataProvider.getReserveConfigurationData(address(token));
        BORROW_RATE_MAX = ltv.mul(99).div(100); // 1%
        BORROW_RATE_MAX_HARD = ltv.mul(999).div(1000); // 0.1%
        // At minimum, borrow rate always 10% lower than liquidation threshold
        if (threshold.mul(9).div(10) > BORROW_RATE_MAX) {
            borrowRate = BORROW_RATE_MAX;
        } else {
            borrowRate = threshold.mul(9).div(10);
        }
        // console.log("Borrow: ", borrow);
        // console.log("Collateral: ", collateral);
        // Only leverage if you can
        if (!(collateral && borrow)) {
            // console.log("Setting borrow depth to 0");
            borrowDepth = 0;
            BORROW_DEPTH_MAX = 0;
        } else  {
            // console.log("Setting borrow depth to 6");
            borrowDepth = 6;
            BORROW_DEPTH_MAX = 8;
        }
        // console.log("BorrowDepth:",borrowDepth);
        minLeverage = 10 ** IERC20Metadata(address(token)).decimals();


        InitializableAbstractStrategy._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }
    function setBalancer(address _balancerVault, bytes32 _balancerPoolId) external onlyGovernor {
        require(_balancerVault != address(0), "Zero address not allowed");
        require(_balancerPoolId != "", "Empty pool id not allowed");
        poolId = _balancerPoolId;
        balancerVault = _balancerVault;
    }

    /**
     * @dev Deposit asset into Aave
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        onlyVault
        nonReentrant
    {
        // _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit asset into Aave
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        // require(_asset == address(token), "Asset not supported");
        // require(_amount > 0, "Must deposit something");

        // // console.log("Depositing ", _amount, " of ", _asset);

        // // token.approve(address(pool), _amount);
        // _leverage(_amount);
        // emit Deposit(_asset, _getATokenFor(_asset), _amount);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Aave
     */
    function depositAll() external  onlyVault nonReentrant {
        // // console.log("Depositing All");

        // for (uint256 i = 0; i < assetsMapped.length; i++) {
        //     uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
        //     if (balance > 0) {
        //         _deposit(assetsMapped[i], balance);
        //     }
        // }
    }

    function _supply(uint256 _amount) internal {
        // console.log("Suppling: ", _amount);
        pool.deposit(address(token), _amount, address(this), referralCode);
    }
    function _removeSupply(uint256 _amount) internal {
        // console.log("Removing supply: ", _amount);
        pool.withdraw(address(token), _amount, address(this));
    }
    function _borrow(uint256 _amount) internal {
        // console.log("Borrowing: ", _amount);
        pool.borrow(address(token), _amount, 2, referralCode, address(this));
    }
    function _repayBorrow(uint256 _amount) internal {
        // console.log("Repay Borrow: ", _amount);
        pool.repay(address(token), _amount, 2, address(this));
    }
    // function _leverage(uint256 _amount) internal {
    //     // console.log("Calling leverage with borrowDepth", borrowDepth);
    //     if (_amount > minLeverage) {
    //         for (uint256 i = 0; i < borrowDepth; i++) {
    //             // console.log("Depositing", _amount, "at", i);
    //             _supply(_amount);
    //             _amount = _amount.mul(borrowRate).div(BORROW_RATE_DIVISOR);
    //             // console.log("Borrowing", _amount, "at", i);
    //             _borrow(_amount);
    //         }
    //     }
    // }
    // function _deleverage() internal {
    //     uint256 wantBal = _tokenBalance();
    //     // console.log("Deleveraging: ", wantBal, _debtTotal());

    //     while (wantBal < _debtTotal()) {
    //         // console.log("Deleveraging: ", wantBal, " is less than ", _debtTotal());
    //         _repayBorrow(wantBal);
    //         _removeSupply(_checkBalance(address(token)).sub(_supplyBalMin()));
    //         wantBal = _tokenBalance();
    //     }
    //     _repayBorrow(wantBal);
    //     // console.log(_tokenBalance());
    //     // console.log(_checkBalance(address(token)));
    //     // console.log(_checkBalance(address(token)).sub(_supplyBalMin()));
    //     _removeSupply(type(uint256).max);
    // }
    // function _debtTotal() internal returns (uint256) {
    //     uint256 debt = variableDebtToken.balanceOf(address(this));
    //     return debt;
    // }
    // function _supplyBalMin() internal returns (uint256) {
    //     return _debtTotal().mul(BORROW_RATE_DIVISOR).div(BORROW_RATE_MAX_HARD);
    // }
    // function _tokenBalance() internal view returns (uint256) {
    //     return IERC20(token).balanceOf(address(this));
    // }
    // function _assetLockedTotal() internal returns (uint256) {
    //     return _tokenBalance()
    //         .add(_checkBalance(address(token)))
    //         .sub(_debtTotal());
    // }


    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal  onlyVault  {
        // require(_amount > 0, "Must withdraw something");
        // require(_recipient != address(0), "Must specify recipient");
        // require(_asset == address(token), "Asset not supported");
        // emit Withdrawal(_asset, _getATokenFor(_asset), _amount);

        // // console.log("_Withdrawing ", _amount, " of ", _asset);

        // uint256 tokenBalance = _tokenBalance();
        // if (_amount >= tokenBalance) {
        //     // Fully deleverage, cheap in Polygon
        //     _deleverage();
        //     tokenBalance = _tokenBalance();
        // }
        // if (_amount > tokenBalance) {
        //     _amount = tokenBalance;
        // }
        // if (_amount > _assetLockedTotal()) {
        //     _amount = _assetLockedTotal();
        // }
        // // console.log("Transferring ", _amount, " to ", _recipient);
        // IERC20(token).safeTransfer(_recipient, _amount);
        // // console.log("Still there is token: ", _tokenBalance());
        // _leverage(token.balanceOf(address(this)));
    }

    /**
     * @dev Withdraw asset from Aave
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external  onlyVault nonReentrant {
        // _withdraw(_recipient, _asset, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external  onlyVaultOrGovernor nonReentrant {
        // console.log("Withdrawing All");
        // _withdraw(vaultAddress, address(token),_tokenBalance().add(_checkBalance(address(token))));
    }

    /**
     * @dev Get the total asset value held in the platform
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance()
        external
        view
        returns (uint256 balance)
    {
        // Balance is always with token aToken decimals
        // address aToken = _getATokenFor(_asset);
        // balance = IERC20(aToken).balanceOf(address(this));
    }
    function _checkBalance()
        internal
        returns (uint256 balance)
    {
        // Balance is always with token aToken decimals
        // address aToken = _getATokenFor(_asset);
        // balance = IERC20(aToken).balanceOf(address(this));
    }

    

    /**
     * @dev Get the aToken wrapped in the IERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return Corresponding aToken to this asset
     */
    function _getATokenFor(address _asset) internal view returns (address) {
        address aToken = assetToPToken[_asset];
        require(aToken != address(0), "aToken does not exist");
        return aToken;
    }
    function getRewardBalance() internal returns (uint256) {
        return IERC20(0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270).balanceOf(address(this)); //wMATIC
    }

    /**
     * @dev Collect stkAave, convert it to AAVE send to Vault.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // uint256 preEarn = getRewardBalance();
        // // console.log("Token Balance: ", preEarn);
        // // console.log("aToken Balance: ", _checkBalance(address(token)));
        // // console.log("DebtToken Balance: ", _debtTotal() );

        // // Harvest farm tokens
        // address[] memory deptTokens = new address[](1);
        // deptTokens[0] = 0x1a13F4Ca1d028320A707D99520AbFefca3998b7F; // amUSDC
        // // console.log("Claiming rewards");
        // // console.log("Rewards: ", IAaveIncentivesController(incentivesController).getUserUnclaimedRewards(address(this)));
        // // console.log("Rewards: ", IAaveIncentivesController(incentivesController).getRewardsBalance(deptTokens, address(this)));

        // IAaveIncentivesController(incentivesController).claimRewards(deptTokens, type(uint256).max, address(this));
        // // Because we keep some tokens in this contract, we have to do this if earned is the same as want
        // // console.log("New reward balance: ", getRewardBalance());
        // // console.log("New token balance: ", _tokenBalance());
        // // console.log("New aToken Balance: ", _checkBalance(address(token)));
        // // console.log("New DebtToken Balance: ", _debtTotal() );
        // uint256 earnedAmt = getRewardBalance().sub(preEarn);
        // // console.log("Reward Balance: ", earnedAmt);


        // if (earnedAmt > 0) {
        //     if (address(token) != address(harvestingToken)) {
        //         earnedAmt = swap(
        //             poolId,
        //             IVault.SwapKind.GIVEN_IN,
        //             IAsset(address(token)),
        //             IAsset(address(harvestingToken)),
        //             address(this),
        //             address(this),
        //             earnedAmt,
        //             0
        //         );
        //     }
        //     emit RewardTokenCollected(
        //         harvesterAddress,
        //         address(harvestingToken),
        //         earnedAmt
        //     );
        //     // console.log("Transferring ", earnedAmt, " to Harvester");
        //     harvestingToken.transfer(harvesterAddress, earnedAmt);
        //     // Releverage what is left in the startegy
        //     // _leverage(_tokenBalance());
        // }
    }
}
