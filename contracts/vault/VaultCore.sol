// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH Vault Contract
 * @notice The Vault contract stores assets. On a deposit, CASH will be minted
           and sent to the depositor. On a withdrawal, CASH will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of CASH.
 * @author Stabl Protocol Inc

 * @dev The following are the meaning of abbreviations used in the contracts
        PS: Primary Stable
        PSD: Primary Stable Decimals
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { StableMath } from "../utils/StableMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IRebaseHandler } from "../interfaces/IRebaseHandler.sol";
import "../exchanges/MiniCurveExchange.sol";
import "./VaultStorage.sol";
import "hardhat/console.sol";

contract VaultCore is VaultStorage, MiniCurveExchange  {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeMath for uint256;
    using OvnMath for uint256;

    uint256 constant MAX_UINT =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    /**
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

    /**
     * @dev Verifies that the deposits are not paused.
     */
    modifier whenNotCapitalPaused() {
        require(!capitalPaused, "Capital paused");
        _;
    }

    modifier onlyGovernorOrDripperOrRebaseManager() {
        require(
            isGovernor() || rebaseManagers[msg.sender] || (msg.sender == dripperAddress),
            "Caller is not the Governor or Rebase Manager or Dripper"
        );
        _;
    }

    /**
     * @dev Deposit a supported asset to the Vault and mint CASH. Asset will be swapped to 
            the PS and allocated to Quick Deposit Strategies
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited (decimals based on _asset)
     * @param _minimumCASHAmount Minimum CASH to mint (1e18)
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) external whenNotCapitalPaused nonReentrant {
       
        _mint(_asset, _amount, _minimumCASHAmount);
    }


    /**
     * @dev Deposit a supported asset to the Vault and mint CASH.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited (decimals based on _asset)
     * @param _minimumCASHAmount Minimum CASH to mint (1e18)
     */
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) internal {
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        // Rebase must happen before any transfers occur.
        if (!rebasePaused) { 
            _rebase();
        }

        // Prequisites
        IERC20 _assetToken = IERC20(_asset);
        uint256 _assetDecimals = Helpers.getDecimals(_asset);
        uint256 _psDecimals = Helpers.getDecimals(primaryStableAddress);

        uint256 _toUseAsset = _amount;
        console.log("TREASURY: ", treasuryAddress, mintFeeBps);
        if ((mintFeeBps > 0) && (treasuryAddress != address(0))) {
            console.log("FEE: ", _toUseAsset.mul(mintFeeBps).div(10000));
            _toUseAsset = _toUseAsset.sub(_toUseAsset.mul(mintFeeBps).div(10000));
        }
        uint256 _toMintCASH = _toUseAsset.scaleBy(18,_assetDecimals);

        uint256 _quickDepositIndex = _getQuickDepositIndex();
        IStrategy _quickDepositStrategy = IStrategy(quickDepositStrategies[_quickDepositIndex]);
        bool _isDirectDepositAllowed = _quickDepositStrategy.isDirectDepositAllowed() ;
        bool _isDirectDeposited = false;
        uint256 _directDepositAmount = _quickDepositStrategy.directDepositRequirement(_toMintCASH.scaleBy(_psDecimals, 18)).addBasisPoints(1); // 1e(_assetDecimals)
        if (_directDepositAmount > _amount.scaleBy(_psDecimals, _assetDecimals)) {
            console.log("DDA > TO_USE_ASSET:", _directDepositAmount, _toUseAsset);
            _directDepositAmount = _toUseAsset;
        }
        uint256 _liquidationValueBefore = _totalValue();
        _assetToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        console.log("TO_USE_ASSET:", _toUseAsset);
        console.log("DDA:", _directDepositAmount);

        // Swap if needed
        uint256 _psAmount = _amount;
        if (_asset != primaryStableAddress) {
            if (_isDirectDepositAllowed == true && _asset == _quickDepositStrategy.token0()) {
                _isDirectDeposited = _handleDirectDeposit(_asset, _amount, _directDepositAmount, address(_quickDepositStrategy));
            } else if (_isDirectDepositAllowed == true && _asset != _quickDepositStrategy.token0()) {
                _isDirectDeposited = _handleDirectDepositWithUnalignedToken(_asset, _amount, _directDepositAmount, address(_quickDepositStrategy));
            } else {
                _psAmount = _handleTrivialDeposit(_asset, _amount, _psDecimals);
            }
        } 
        if (_isDirectDeposited == false) {
            if (mintFeeBps > 0 && treasuryAddress != address(0)) {
                uint256 mintFee = _psAmount.mul(mintFeeBps).div(10000);
                IERC20(primaryStableAddress).safeTransfer(treasuryAddress, mintFee);
                emit MintFeeCharged(msg.sender, mintFee);
            }
            _quickAllocate(_quickDepositIndex);
        } 

        uint256 _change = _totalValue().subOrZero(_liquidationValueBefore);
        require(
            _change > 0,
            "NO_DIFF_IN_LIQ"
        );

        require(_change.scaleBy(18, _psDecimals) >= _minimumCASHAmount, "Mint amount lower than minimum");
        console.log("_toMintCASH:", _toMintCASH);
        console.log("_lvChange:", _change);
        // Choose whichever is lower in value
        uint256 _mintAmount = _change.scaleBy(18, _psDecimals) < _toMintCASH ? _change.scaleBy(18, _psDecimals) : _toMintCASH;
        console.log("MINT", _mintAmount);
        emit Mint(msg.sender, _mintAmount);

        cash.mint(msg.sender, _mintAmount);
        lastMints[msg.sender] = block.number;
    }

    // In memoriam

    /**
     * @dev Withdraw a supported asset and burn CASH.
     * @param _amount Amount of CASH to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeem(uint256 _amount, uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(_amount, _minimumUnitAmount);
    }

    /**
     * @dev Withdraw the PS against CASH and burn CASH.
     * @param _amount Amount of CASH to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount) internal {
        require(_amount > 0, "Amount must be greater than 0");
        require( cash.balanceOf(msg.sender) >=  _amount, "Insufficient Amount!");
        require(block.number > lastMints[msg.sender], "Wait after mint");
        (
            uint256 output,
            uint256 backingValue,
            uint256 redeemFee
        ) = _calculateRedeemOutput(_amount);
        console.log("REDEEM OUTPUT:", output);
        console.log("BACKING VALUE:", backingValue);
        console.log("REDEEM FEE:", redeemFee);
        uint256 primaryStableDecimals = Helpers.getDecimals(primaryStableAddress);

        // Check that CASH is backed by enough assets
        uint256 _totalSupply = cash.totalSupply();
        if (maxSupplyDiff > 0) {
            // Allow a max difference of maxSupplyDiff% between
            // backing assets value and CASH total supply
            uint256 diff = _totalSupply.divPrecisely(backingValue);
            require(
                (diff > 1e18 ? diff.sub(1e18) : uint256(1e18).sub(diff)) <=
                    maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }
        if (_minimumUnitAmount > 0) {
            uint256 unitTotal = output.scaleBy(18, primaryStableDecimals);
            require(
                unitTotal >= _minimumUnitAmount,
                "Redeem amount lower than minimum"
            );
        }
        emit Redeem(msg.sender, _amount);

        // Send output
        require(output > 0, "Nothing to redeem");
        IERC20 primaryStable = IERC20(primaryStableAddress);
        address[] memory strategiesToWithdrawFrom = new address[](strategyWithWeights.length);
        uint256[] memory amountsToWithdraw = new uint256[](strategyWithWeights.length);
        uint256 totalAmount = primaryStable.balanceOf(address(this));
        if ((totalAmount < (output+redeemFee)) && (strategyWithWeights.length == 0)) {
            revert("Source strats not set");
        }
        uint8 strategyIndex = 0;
        uint8  index = 0;
        while((totalAmount < (output + redeemFee)) && (strategyIndex < strategyWithWeights.length)) {
            uint256 currentStratBal = IStrategy(strategyWithWeights[strategyIndex].strategy).checkBalance();
            if (currentStratBal > 0) {
                if ( (currentStratBal + totalAmount) > (output + redeemFee) ) {
                    strategiesToWithdrawFrom[index] = strategyWithWeights[strategyIndex].strategy;
                    amountsToWithdraw[index] = currentStratBal - ((currentStratBal + totalAmount) - (output + redeemFee));
                    totalAmount += currentStratBal - ((currentStratBal + totalAmount) - (output + redeemFee));
                } else {
                    strategiesToWithdrawFrom[index] = strategyWithWeights[strategyIndex].strategy;
                    amountsToWithdraw[index] = 0; // 0 means withdraw all
                    totalAmount += currentStratBal;
                }
                index++;
            }
            strategyIndex++;
        }
        require(totalAmount >= (output + redeemFee), "Not enough funds anywhere to redeem.");

        // Withdraw from strategies
        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            if (strategiesToWithdrawFrom[i] == address(0)) {
                break;
            }
            if (amountsToWithdraw[i] > 0) {
                IStrategy(strategiesToWithdrawFrom[i]).withdraw(address(this), primaryStableAddress, amountsToWithdraw[i]);
            } else {
                IStrategy(strategiesToWithdrawFrom[i]).withdrawAll();
            }
            
        }
        require(primaryStable.balanceOf(address(this)) >= (output + redeemFee), "Not enough funds after withdrawl.");

        primaryStable.safeTransfer(msg.sender, output);

        cash.burn(msg.sender, _amount);
        
        // Remaining amount i.e redeem fees will be rebased for all other CASH holders

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        if (_amount > rebaseThreshold && !rebasePaused) {
            _rebase();
        }
    }

    /**
     * @notice Withdraw PS against all the sender's CASH.
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeemAll(uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(cash.balanceOf(msg.sender), _minimumUnitAmount);
    }


    /**
     * @dev Allocate unallocated PS in the Vault to quick deposit strategies.
     **/
    function quickAllocate() external onlyGovernor whenNotCapitalPaused nonReentrant {
        _quickAllocate(_getQuickDepositIndex());
    }

    function _getQuickDepositIndex() internal view returns (uint256 _index) {
        require( quickDepositStrategies.length > 0, "Quick Deposit Strategy not set");
        _index = 0;
        if (quickDepositStrategies.length  != 0) {
            _index =  block.number  % quickDepositStrategies.length;
        }
    }

    /**
     * @dev Allocate unallocated PS in the Vault to quick deposit strategies.
     **/
    function _quickAllocate(uint256 _index) internal {
        address quickDepositStrategyAddr = quickDepositStrategies[_index];
        uint256 allocateAmount = IERC20(primaryStableAddress).balanceOf(address(this));
        if (quickDepositStrategyAddr != address(0)   && allocateAmount > 0 ) {
            IStrategy strategy = IStrategy(quickDepositStrategyAddr);
            IERC20(primaryStableAddress).safeTransfer(address(strategy), allocateAmount);
            strategy.deposit(primaryStableAddress, allocateAmount);
            emit AssetAllocated(
                primaryStableAddress,
                quickDepositStrategyAddr,
                allocateAmount
            );
        }

    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of CASH.
     */
    function rebase() external virtual nonReentrant onlyGovernorOrDripperOrRebaseManager {
        _rebase();
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of CASH, optionally sending a
     *      portion of the yield to the trustee.
     */
    function _rebase() internal whenNotRebasePaused {
        uint256 cashSupply = cash.totalSupply();
        if (cashSupply == 0) {
            return;
        }
        uint256 primaryStableDecimals = Helpers.getDecimals(primaryStableAddress);
        uint256 vaultValue = _checkBalance(true).scaleBy(18, primaryStableDecimals);

        // Only rachet CASH supply upwards
        cashSupply = cash.totalSupply(); // Final check should use latest value
        if (vaultValue > cashSupply) {
            cash.changeSupply(vaultValue);
            if (rebaseHandler != address(0)) {
                 IRebaseHandler(rebaseHandler).process()  ;
            }
        }
    }

    

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @return uint256 Balance of asset in decimals of asset
     */
    function checkBalance() external view returns (uint256) {
        return _checkBalance(false);
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @return balance Balance of asset in decimals of asset
     */
    function _checkBalance(bool _nav)
        internal
        view
        virtual
        returns (uint256 balance)
    {
        IERC20 asset = IERC20(primaryStableAddress);
        balance = asset.balanceOf(address(this));

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (_nav) {
                try strategy.netAssetValue() returns (uint256 _bal) {
                    balance = balance.add(_bal);
                } catch {
                    console.log("NAV_FAILED", allStrategies[i]);
                }

            } else {
                balance = balance.add(strategy.checkBalance());
            }
        }
    }


    /**
     * @dev Determine the total value of assets held by the vault and its
     *         strategies.
     * @return value Total value in USDC (1e6)
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return value Total value in USDC (1e6)
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        return _checkBalance(false);
    }

    function nav() public view returns (uint256) {
        return _checkBalance(true);
    }
    function available() public view returns (uint256) {
        return IERC20(primaryStableAddress).balanceOf(address(this));
    }

    /**
     * @notice Calculate the output for a redeem function
     */
    function calculateRedeemOutput(uint256 _amount)
        external
        view
        returns (uint256)
    {
        (uint256 output, ,) = _calculateRedeemOutput(_amount);
        return output;
    }
    /**
     * @notice Calculate the output for a redeem function
     */
    function redeemOutputs(uint256 _amount)
        external
        view
        returns (uint256,uint256,uint256)
    {
        return _calculateRedeemOutput(_amount);
    }

    /**
     * @notice Calculate the output for a redeem function
     * @param _amount Amount to redeem (1e18)
     * @return output  amount respective to the primary stable  (1e6)
     * @return totalBalance Total balance of Vault (1e18)
     * @return redeemFee redeem fee on _amount (1e6)
     */
    function _calculateRedeemOutput(uint256 _amount)
        internal
        view
        returns (uint256, uint256, uint256)
    {
        uint256 _psBalance = _checkBalance(false);
        uint256 _psDecimals =  Helpers.getDecimals(primaryStableAddress);
        uint256 _psBalanceIn18Decs = _psBalance.scaleBy(18, _psDecimals);
        uint256 _cashTS = cash.totalSupply();
        uint256 _give = (_amount.mul(_psBalanceIn18Decs)).div(_cashTS);
        console.log("LV", _psBalance);
        console.log("CASH_TS", _cashTS);
        console.log("TOTAL_REDEEM", _give);
        uint256 redeemFee = 0;
        if (redeemFeeBps > 0) {
            redeemFee = _give.mul(redeemFeeBps).div(10000);
            _give = _give.sub(redeemFee);

        }
        return (_give.scaleBy(_psDecimals,18), _psBalanceIn18Decs, redeemFee.scaleBy(_psDecimals, 18));
    }

    /********************************
                Swapping
    *********************************/
    /**
     * @dev Swapping one asset to another using the Swapper present inside Vault
     * @param tokenFrom address of token to swap from
     * @param tokenTo address of token to swap to
     */    
    function _swapAsset(address tokenFrom, address tokenTo, uint256 _amount) internal returns (uint256) {
        require(swappingPool != address(0), "Empty Swapper Address");
        if ( ( tokenFrom != tokenTo) && (_amount > 0) )  {
            return swap(
                swappingPool,
                tokenFrom,
                tokenTo,
                _amount,
                priceProvider
            );
        }
        return IERC20(tokenFrom).balanceOf(address(this));
    }

    function _swapAsset(address tokenFrom, address tokenTo) internal returns (uint256) {
        return _swapAsset(tokenFrom, tokenTo, IERC20(tokenFrom).balanceOf(address(this)));
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Return the number of assets supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return allAssets.length;
    }

    /**
     * @dev Return all asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        return allAssets;
    }

    /**
     * @dev Return the number of strategies active on the Vault.
     */
    function getStrategyCount() external view returns (uint256) {
        return allStrategies.length;
    }

    /**
     * @dev Return the array of all strategies
     */
    function getAllStrategies() external view returns (address[] memory) {
        return allStrategies;
    }

    function isSupportedAsset(address _asset) external view returns (bool) {
        return assets[_asset].isSupported;
    }

    receive() external payable {}

    /**
     * @dev Falldown to the admin implementation
     * @notice This is a catch all for all functions not declared in core
     */
    fallback() external payable {
        bytes32 slot = adminImplPosition;
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                sload(slot),
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    // Internal functions
    function _handleDirectDeposit(address _asset, uint256 _amount, uint256 _directDepositAmount, address _quickDepositStrategy) internal returns (bool) {
        console.log("HANDLE_DIRECT_DEPOSIT");
        if (mintFeeBps > 0 && treasuryAddress != address(0)) {
            uint256 _mintFee = _amount.sub(_directDepositAmount);  // 1e(_assetDecimals)
            _mintFee = _swapAsset(_asset, primaryStableAddress, _mintFee); // 1e(_psDecimals)
            IERC20(primaryStableAddress).safeTransfer(treasuryAddress, _mintFee);
            emit MintFeeCharged(msg.sender, _mintFee);
        }
        IERC20(_asset).safeTransfer(_quickDepositStrategy, _directDepositAmount);
        IStrategy(_quickDepositStrategy).directDeposit();
        return true;
    }

    function _handleDirectDepositWithUnalignedToken(address _asset, uint256 _amount, uint256 _directDepositAmount, address _quickDepositStrategy) internal returns (bool) {
        console.log("HANDLE_DIRECT_DEPOSIT_WITH_UNALIGNED_TOKEN");
        uint256 _assetBeforeSwapping = IERC20(_asset).balanceOf(address(this));
        uint256 _assetsToSwap = onSwap(swappingPool, IStrategy(_quickDepositStrategy).token0() , _asset , _directDepositAmount);
        uint256 _token0GeneratedAmount = swapTillSatisfied(swappingPool, _asset, IStrategy(_quickDepositStrategy).token0(), _assetsToSwap,_directDepositAmount, _amount, 1);
        uint256 _assetUsed = _assetBeforeSwapping.sub(IERC20(_asset).balanceOf(address(this)));

        if (mintFeeBps > 0 && treasuryAddress != address(0)) {
            uint256 _mintFee = _amount.sub(_assetUsed); // 1e(_assetDecimals)
            _mintFee = _swapAsset(_asset, primaryStableAddress, _mintFee); // 1e(_psDecimals)
            IERC20(primaryStableAddress).safeTransfer(treasuryAddress, _mintFee);
            emit MintFeeCharged(msg.sender, _mintFee);
        }
        IERC20(IStrategy(_quickDepositStrategy).token0()).safeTransfer(_quickDepositStrategy, _token0GeneratedAmount);
        IStrategy(_quickDepositStrategy).directDeposit();
        return true;
    }
    function _handleTrivialDeposit(address _asset, uint256 _amount, uint256 _psDecimals) internal returns (uint256) {
        console.log("HANDLE_TRIVIAL_DEPOSIT");
        // Swap the asset to PS
        uint256 _psAmount = _swapAsset(_asset, primaryStableAddress);
        // If the amount after swapping is more than provided amount, we need to max out the _psAmount to the amount provided
        if (_psAmount.scaleBy(18, _psDecimals) > _amount.scaleBy(18, Helpers.getDecimals(_asset))) {
            _psAmount = _amount.scaleBy(_psDecimals, Helpers.getDecimals(_asset));
        }
        return _psAmount;
    }
}
