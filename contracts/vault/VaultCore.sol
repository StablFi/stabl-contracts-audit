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
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IBuyback } from "../interfaces/IBuyback.sol";
import "../exchanges/BalancerExchange.sol";
import "./VaultStorage.sol";
import "hardhat/console.sol";

contract VaultCore is VaultStorage, BalancerExchange {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeMath for uint256;

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

    /**
     * @dev Deposit a supported asset and mint CASH.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @param _minimumCASHAmount Minimum CASH to mint
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) external whenNotCapitalPaused nonReentrant {
        _mint(_asset, _amount, _minimumCASHAmount);

        // Swap to primaryStable
        _swapAsset(_asset, primaryStableAddress);

        _quickAllocate(); // _allocate(); // Change this to _quickAllocate()
    }
    function justMint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) external whenNotCapitalPaused nonReentrant {
        _mint(_asset, _amount, _minimumCASHAmount);
    }
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) internal {
        require(assets[_asset].isSupported, "Asset is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 price = IOracle(priceProvider).price(_asset);
        if (price > 1e8) {
            price = 1e8;
        }
        require(price >= MINT_MINIMUM_ORACLE, "Asset price below peg");
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        // Scale up to 18 decimal
        uint256 unitAdjustedDeposit = _amount.scaleBy(18, assetDecimals);
        uint256 priceAdjustedDeposit = _amount.mulTruncateScale(
            price.scaleBy(18, 8), // Oracles have 8 decimal precision
            10**assetDecimals
        );

        if (_minimumCASHAmount > 0) {
            require(
                priceAdjustedDeposit >= _minimumCASHAmount,
                "Mint amount lower than minimum"
            );
        }

        emit Mint(msg.sender, priceAdjustedDeposit);

        // Rebase must happen before any transfers occur.
        if (unitAdjustedDeposit >= rebaseThreshold && !rebasePaused) {
            _rebase();
        }

        // Mint matching CASH
        cash.mint(msg.sender, priceAdjustedDeposit);

        // Transfer the deposited coins to the vault
        IERC20 asset = IERC20(_asset);
        asset.safeTransferFrom(msg.sender, address(this), _amount);
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
     * @dev Withdraw a supported asset and burn CASH.
     * @param _amount Amount of CASH to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount) internal {
        require(_amount > 0, "Amount must be greater than 0");

        // Calculate redemption outputs
        (
            uint256 output,
            uint256 backingValue,
            uint256 redeemFee
        ) = _calculateRedeemOutput(_amount);
        // console.log("Redeem output:", output);
        // console.log("Backing value:", backingValue);
        // console.log("Redeem Fee:", redeemFee);
        // console.log("Redeem Total:", output + redeemFee);
        
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
        uint8 strategyIndex = 0;
        uint8  index = 0;
        while((totalAmount <= (output + redeemFee)) && (strategyIndex < strategyWithWeights.length)) {
            uint256 currentStratBal = IStrategy(strategyWithWeights[strategyIndex].strategy).checkBalance();
            // console.log("Current strategy balance:", strategyWithWeights[strategyIndex].strategy, currentStratBal);
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
            // console.log("Total amount after:", strategyWithWeights[strategyIndex].strategy, totalAmount);

            strategyIndex++;
        }
        // console.log("Total amount:", totalAmount);
        require(totalAmount >= (output + redeemFee), "Not enough funds anywhere to redeem.");

        // Withdraw from strategies
        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            if (strategiesToWithdrawFrom[i] == address(0)) {
                break;
            }
            // console.log("VaultCore - Redeem - Balance in strategy: ",IStrategy(strategiesToWithdrawFrom[i]).checkBalance() );
            if (amountsToWithdraw[i] > 0) {
                // console.log("VaultCore - Redeem - Withdraw from strategy: ", strategiesToWithdrawFrom[i], amountsToWithdraw[i]);
                IStrategy(strategiesToWithdrawFrom[i]).withdraw(address(this), primaryStableAddress, amountsToWithdraw[i]);
            } else {
                // console.log("VaultCore - Redeem - Withdraw all from strategy: ",IStrategy(strategiesToWithdrawFrom[i]).checkBalance() );
                IStrategy(strategiesToWithdrawFrom[i]).withdrawAll();
            }
            
        }
        require(primaryStable.balanceOf(address(this)) >= (output + redeemFee), "Not enough funds after withdrawl.");

        primaryStable.safeTransfer(msg.sender, output);
        _distributeFees(redeemFee);
        cash.burn(msg.sender, _amount);

        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        if (_amount > rebaseThreshold && !rebasePaused) {
            _rebase();
        }
    }

    function _distributeFees(uint256 _amount) internal {
        require(
            _amount > 0,
            "Amount should be greater than zero"
        );
        // console.log("Distributing fee:", _amount);
        uint256 labsfees = _amount.mul(labsFeeBps*10).div(10000);  // Since, we have already made the 10% of redeem amount, we need to make take labsFeeBps*10 percent of the fee amount
        // console.log("labsFeeBps:", labsFeeBps);
        // console.log("Sending labs fees:", labsfees);
        uint256 teamfees =  _amount.mul(teamFeeBps*10).div(10000); 
        // console.log("teamFeeBps:", teamFeeBps);
        // console.log("Sending team fees:", teamfees);
        IERC20(primaryStableAddress).transfer(
            labsAddress,
            labsfees
        );
        IERC20(primaryStableAddress).transfer(
            teamAddress,
            teamfees
        );
    }


    /**
     * @notice Withdraw a supported asset and burn all CASH.
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
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() external whenNotCapitalPaused nonReentrant {
        _allocate();
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     * @dev Allocate unallocated funds on Vault to strategies.
     **/
    function _allocate() internal {
        uint256 vaultValue = _totalValueInVault();
        // Nothing in vault to allocate
        if (vaultValue == 0) return;
        uint256 strategiesValue = _totalValueInStrategies();
        // We have a method that does the same as this, gas optimisation
        uint256 calculatedTotalValue = vaultValue.add(strategiesValue);

        // We want to maintain a buffer on the Vault so calculate a percentage
        // modifier to multiply each amount being allocated by to enforce the
        // vault buffer
        uint256 vaultBufferModifier;
        if (strategiesValue == 0) {
            // Nothing in Strategies, allocate 100% minus the vault buffer to
            // strategies
            vaultBufferModifier = uint256(1e18).sub(vaultBuffer);
        } else {
            vaultBufferModifier = vaultBuffer.mul(calculatedTotalValue).div(
                vaultValue
            );
            if (1e18 > vaultBufferModifier) {
                // E.g. 1e18 - (1e17 * 10e18)/5e18 = 8e17
                // (5e18 * 8e17) / 1e18 = 4e18 allocated from Vault
                vaultBufferModifier = uint256(1e18).sub(vaultBufferModifier);
            } else {
                // We need to let the buffer fill
                return;
            }
        }
        if (vaultBufferModifier == 0) return;

        // Iterate over all assets in the Vault and allocate to the appropriate
        // strategy
        for (uint256 i = 0; i < allAssets.length; i++) {
            IERC20 asset = IERC20(allAssets[i]);
            uint256 assetBalance = asset.balanceOf(address(this));
            // console.log(allAssets[i], "assetBalance: ", assetBalance);
            // No balance, nothing to do here
            if (assetBalance == 0) continue;

            // Multiply the balance by the vault buffer modifier and truncate
            // to the scale of the asset decimals
            uint256 allocateAmount = assetBalance.mulTruncate(
                vaultBufferModifier
            );

            address depositStrategyAddr = assetDefaultStrategies[
                address(asset)
            ];

            if (depositStrategyAddr != address(0) && allocateAmount > 0) {
                // console.log("Sending " , allocateAmount , " to " , depositStrategyAddr);
                IStrategy strategy = IStrategy(depositStrategyAddr);
                // Transfer asset to Strategy and call deposit method to
                // mint or take required action
                asset.safeTransfer(address(strategy), allocateAmount);
                strategy.deposit(address(asset), allocateAmount);
                emit AssetAllocated(
                    address(asset),
                    depositStrategyAddr,
                    allocateAmount
                );
            }
        }

        // Trigger OGN Buyback
        address _trusteeAddress = trusteeAddress; // gas savings
        if (_trusteeAddress != address(0)) {
            IBuyback(trusteeAddress).swap();
        }
    }


    /**
     * @notice Allocate unallocated funds on Vault to quick deposit strategies.
     * @dev Allocate unallocated funds on Vault to quick deposit strategies.
     **/

    function quickAllocate() external whenNotCapitalPaused nonReentrant {
        _quickAllocate();
    }
    function _quickAllocate() internal {
        // console.log("quickAllocate -  primaryStableBalance: ", IERC20(primaryStableAddress).balanceOf(address(this)));
        uint256 index =  block.number  % quickDepositStrategies.length;
        address quickDepositStrategyAddr = quickDepositStrategies[index];
        uint256 allocateAmount = IERC20(primaryStableAddress).balanceOf(address(this));
        if (quickDepositStrategyAddr != address(0)   && allocateAmount > 0 ) {
            IStrategy strategy = IStrategy(quickDepositStrategyAddr);
            // console.log("Quick Depositing " , allocateAmount , " to " , quickDepositStrategyAddr);
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
    function rebase() external virtual nonReentrant {
        _rebase();
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of CASH, optionally sending a
     *      portion of the yield to the trustee.
     */
    function _rebase() internal whenNotRebasePaused {
        uint256 cashSupply = cash.totalSupply();
        // console.log("Total CASH Supply: ", cashSupply);
        if (cashSupply == 0) {
            return;
        }
        uint256 primaryStableDecimals = Helpers.getDecimals(primaryStableAddress);
        uint256 vaultValue = _totalValue().scaleBy(18, primaryStableDecimals);
        // console.log("Total Vault Value: ", vaultValue);

        // Yield fee collection
        address _trusteeAddress = trusteeAddress; // gas savings
        // console.log("Trustee Address: ", _trusteeAddress);
        if (_trusteeAddress != address(0) && (vaultValue > cashSupply)) {
            // console.log("Yield fee collection");
            uint256 yield = vaultValue.sub(cashSupply);
            // console.log("Yield: ", yield);
            uint256 fee = yield.mul(trusteeFeeBps).div(10000);
            // console.log("Fee: ", fee);
            require(yield > fee, "Fee must not be greater than yield");
            if (fee > 0) {
                // console.log("Minting CASH for fee " , fee , " to " , _trusteeAddress);
                cash.mint(_trusteeAddress, fee);
            }
            emit YieldDistribution(_trusteeAddress, yield, fee);
        }

        // Only rachet CASH supply upwards
        cashSupply = cash.totalSupply(); // Final check should use latest value
        if (vaultValue > cashSupply) {
            // console.log("Still vault value greater than supply, changing supply of CASH for vaultValue " , vaultValue);
            cash.changeSupply(vaultValue);
        }
    }

    /**
     * @dev Determine the total value of assets held by the vault and its
     *         strategies.
     * @return value Total value in USD (1e18)
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return value Total value in USD (1e18)
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        return _totalValueInVault().add(_totalValueInStrategies());
    }

    /**
     * @dev Internal to calculate total value of all assets held in Vault.
     * @return value Total value in ETH (1e6)
     */
    function _totalValueInVault() internal view returns (uint256 value) {
        uint256 balance = IERC20(primaryStableAddress).balanceOf(address(this));
        if (balance > 0) {
            value = value.add(balance);
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held in Strategies.
     * @return value Total value in ETH (1e18)
     */
    function _totalValueInStrategies() internal view returns (uint256 value) {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            value = value.add(_totalValueInStrategy(allStrategies[i]));
        }
    }

    /**
     * @dev Internal to calculate total value of all assets held by strategy.
     * @param _strategyAddr Address of the strategy
     */
    function _totalValueInStrategy(address _strategyAddr)
        internal
        view
        returns (uint256)
    {
        IStrategy strategy = IStrategy(_strategyAddr);
        return strategy.checkBalance();
        
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @return uint256 Balance of asset in decimals of asset
     */
    function checkBalance() external view returns (uint256) {
        return _checkBalance();
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @return balance Balance of asset in decimals of asset
     */
    function _checkBalance()
        internal
        view
        virtual
        returns (uint256 balance)
    {
        IERC20 asset = IERC20(primaryStableAddress);
        balance = asset.balanceOf(address(this));

        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            balance = balance.add(strategy.checkBalance());
        }
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
     * @return output  amount respective to the primary stable
     * @return totalBalance Total balance of Vault
     */
    function _calculateRedeemOutput(uint256 _amount)
        internal
        view
        returns (uint256, uint256, uint256)
    {

        IOracle oracle = IOracle(priceProvider);
        uint256 primaryStablePrice =  oracle.price(primaryStableAddress).scaleBy(18, 8);
        uint256 primaryStableBalance = _checkBalance();
        uint256 primaryStableDecimals =  Helpers.getDecimals(primaryStableAddress);
        uint256 totalBalance = 0;
        uint256 redeemFee = 0;
        // Calculate redeem fee
        if (labsFeeBps > 0  || teamFeeBps > 0) {
            redeemFee = _amount.mul(redeemFeeBps).div(10000);
            _amount = _amount.sub(redeemFee);
        }

        totalBalance = totalBalance.add(primaryStableBalance.scaleBy(18, primaryStableDecimals));

        // Never give out more than one
        // stablecoin per dollar of CASH
        if (primaryStablePrice < 1e18) {
            primaryStablePrice = 1e18;
        }
        
        // Calculate totalOutputRatio
        uint256 ratio = primaryStableBalance
            .scaleBy(18,primaryStableDecimals)
            .mul(primaryStablePrice)
            .div(totalBalance);

        // Calculate final outputs
        uint256 factor = _amount.divPrecisely(ratio);
        return (primaryStableBalance.mul(factor).div(totalBalance), totalBalance, redeemFee.div(10**(18 - primaryStableDecimals)));
    }

    /**
     * @notice Get an array of the supported asset prices in USD.
     * @return assetPrices Array of asset prices in USD (1e18)
     */
    function _getAssetPrices()
        internal
        view
        returns (uint256[] memory assetPrices)
    {
        assetPrices = new uint256[](getAssetCount());

        IOracle oracle = IOracle(priceProvider);
        // Price from Oracle is returned with 8 decimals
        // _amount is in assetDecimals
        for (uint256 i = 0; i < allAssets.length; i++) {
            assetPrices[i] = oracle.price(allAssets[i]).scaleBy(18, 8);
        }
    }

    /********************************
                Swapping
    *********************************/
    function _swapAsset(address tokenFrom, address tokenTo) internal {
        setBalancerVault(balancerVault);
        if ( ( tokenFrom != tokenTo) && (IERC20(tokenFrom).balanceOf(address(this)) > 0) )  {
            // console.log("VaultCore: Swapping from ", tokenFrom, tokenTo);
            swap(
                balancerPoolId,
                IVault.SwapKind.GIVEN_IN,
                IAsset(address(tokenFrom)),
                IAsset(address(tokenTo)),
                address(this),
                address(this),
                IERC20(tokenFrom).balanceOf(address(this)),
                0
            );
        }
        
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
}
