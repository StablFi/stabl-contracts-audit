// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH Vault Admin Contract
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Stabl Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IHarvester } from "../interfaces/IHarvester.sol";
import { IDripper } from "../interfaces/IDripper.sol";
import "./VaultStorage.sol";
import "../utils/Sort.sol";
import "hardhat/console.sol";

contract VaultAdmin is VaultStorage {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @dev Verifies that the caller is the Vault, Governor, or Strategist.
     */
    modifier onlyVaultOrGovernorOrStrategist() {
        require(
            msg.sender == address(this) ||
                msg.sender == strategistAddr ||
                isGovernor(),
            "Caller is not the Vault, Governor, or Strategist"
        );
        _;
    }

    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @dev Set address of price provider.
     * @param _priceProvider Address of price provider
     */
    function setPriceProvider(address _priceProvider) external onlyGovernor {
        priceProvider = _priceProvider;
        emit PriceProviderUpdated(_priceProvider);
    }
 
    /**
     * @dev Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        require(_redeemFeeBps <= 1000, "Redeem fee should not be over 10%");
        redeemFeeBps = _redeemFeeBps;
        emit RedeemFeeUpdated(_redeemFeeBps);
    }

    /**
     * @dev Set a buffer of assets to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding assets from a Strategy.
     * @param _vaultBuffer Percentage using 18 decimals. 100% = 1e18.
     */
    function setVaultBuffer(uint256 _vaultBuffer)
        external
        onlyGovernorOrStrategist
    {
        require(_vaultBuffer <= 1e18, "Invalid value");
        vaultBuffer = _vaultBuffer;
        emit VaultBufferUpdated(_vaultBuffer);
    }

    /**
     * @dev Sets the minimum amount of CASH in a mint to trigger an
     * automatic allocation of funds afterwords.
     * @param _threshold CASH amount with 18 fixed decimals.
     */
    function setAutoAllocateThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        autoAllocateThreshold = _threshold;
        emit AllocateThresholdUpdated(_threshold);
    }

    /**
     * @dev Set a minimum amount of CASH in a mint or redeem that triggers a
     * rebase
     * @param _threshold CASH amount with 18 fixed decimals.
     */
    function setRebaseThreshold(uint256 _threshold) external onlyGovernor {
        rebaseThreshold = _threshold;
        emit RebaseThresholdUpdated(_threshold);
    }

    /**
     * @dev Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }

    /**
     * @dev Set the default Strategy for an asset, i.e. the one which the asset
            will be automatically allocated to and withdrawn from
     * @param _asset Address of the asset
     * @param _strategy Address of the Strategy
     */
    function setAssetDefaultStrategy(address _asset, address _strategy)
        external
        onlyGovernorOrStrategist
    {
        emit AssetDefaultStrategyUpdated(_asset, _strategy);
        // If its a zero address being passed for the strategy we are removing
        // the default strategy
        if (_strategy != address(0)) {
            // Make sure the strategy meets some criteria
            require(strategies[_strategy].isSupported, "Strategy not approved");
            IStrategy strategy = IStrategy(_strategy);
            require(assets[_asset].isSupported, "Asset is not supported");
            require(
                strategy.supportsAsset(_asset),
                "Asset not supported by Strategy"
            );
        }
        assetDefaultStrategies[_asset] = _strategy;
    }

    /**
     * @dev Add a supported asset to the contract, i.e. one that can be
     *         to mint CASH.
     * @param _asset Address of asset
     */
    function supportAsset(address _asset) external onlyGovernor {
        require(!assets[_asset].isSupported, "Asset already supported");

        assets[_asset] = Asset({ isSupported: true });
        allAssets.push(_asset);

        // Verify that our oracle supports the asset
        // slither-disable-next-line unused-return
        console.log("priceProvider",priceProvider);
        IOracle(priceProvider).price(_asset);

        emit AssetSupported(_asset);
    }

    /**
     * @dev Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     */
    function approveStrategy(address _addr) external onlyGovernor {
        require(!strategies[_addr].isSupported, "Strategy already approved");
        strategies[_addr] = Strategy({ isSupported: true, _deprecated: 0 });
        allStrategies.push(_addr);
        emit StrategyApproved(_addr);
    }

    /**
     * @dev Remove a strategy from the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not approved");

        for (uint256 i = 0; i < allAssets.length; i++) {
            require(
                assetDefaultStrategies[allAssets[i]] != _addr,
                "Strategy is default for an asset"
            );
        }

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 strategyIndex = allStrategies.length;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < allStrategies.length) {
            allStrategies[strategyIndex] = allStrategies[
                allStrategies.length - 1
            ];
            allStrategies.pop();

            // Mark the strategy as not supported
            strategies[_addr].isSupported = false;

            // Withdraw all assets
            IStrategy strategy = IStrategy(_addr);
            strategy.withdrawAll();

            emit StrategyRemoved(_addr);
        }
    }

    /**
     * @notice Move assets from one Strategy to another
     * @param _strategyFromAddress Address of Strategy to move assets from.
     * @param _strategyToAddress Address of Strategy to move assets to.
     * @param _assets Array of asset address that will be moved
     * @param _amounts Array of amounts of each corresponding asset to move.
     */
    function reallocate(
        address _strategyFromAddress,
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist {
        require(
            strategies[_strategyFromAddress].isSupported,
            "Invalid from Strategy"
        );
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        IStrategy strategyFrom = IStrategy(_strategyFromAddress);
        IStrategy strategyTo = IStrategy(_strategyToAddress);

        for (uint256 i = 0; i < _assets.length; i++) {
            require(strategyTo.supportsAsset(_assets[i]), "Asset unsupported");
            // Withdraw from Strategy and pass other Strategy as recipient
            strategyFrom.withdraw(address(strategyTo), _assets[i], _amounts[i]);
        }
        // Tell new Strategy to deposit into protocol
        strategyTo.depositAll();
    }

    /**
     * @dev Sets the maximum allowable difference between
     * total supply and backing assets' value.
     */
    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
        emit MaxSupplyDiffChanged(_maxSupplyDiff);
    }

    /**
     * @dev Sets the trusteeAddress that can receive a portion of yield.
     *      Setting to the zero address disables this feature.
     */
    function setTrusteeAddress(address _address) external onlyGovernor {
        trusteeAddress = _address;
        emit TrusteeAddressChanged(_address);
    }

    /**
     * @dev Sets the TrusteeFeeBps to the percentage of yield that should be
     *      received in basis points.
     */
    function setTrusteeFeeBps(uint256 _basis) external onlyGovernor {
        require(_basis <= 5000, "basis cannot exceed 50%");
        trusteeFeeBps = _basis;
        emit TrusteeFeeBpsChanged(_basis);
    }

    /***************************************
                    Pause
    ****************************************/

    /**
     * @dev Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = true;
        emit RebasePaused();
    }

    /**
     * @dev Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernor {
        rebasePaused = false;
        emit RebaseUnpaused();
    }

    /**
     * @dev Set the deposit paused flag to true to prevent capital movement.
     */
    function pauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = true;
        emit CapitalPaused();
    }

    /**
     * @dev Set the deposit paused flag to false to enable capital movement.
     */
    function unpauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = false;
        emit CapitalUnpaused();
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        require(!assets[_asset].isSupported, "Only unsupported assets");
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /***************************************
                    Pricing
    ****************************************/

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Never goes above 1, since that is how we price mints
     * @param asset address of the asset
     * @return uint256 USD price of 1 of the asset, in 18 decimal fixed
     */
    function priceUSDMint(address asset) external view returns (uint256) {
        uint256 price = IOracle(priceProvider).price(asset);
        require(price >= MINT_MINIMUM_ORACLE, "Asset price below peg");
        if (price > 1e8) {
            price = 1e8;
        }
        // Price from Oracle is returned with 8 decimals so scale to 18
        return price.scaleBy(18, 8);
    }

    /**
     * @dev Returns the total price in 18 digit USD for a given asset.
     *      Never goes below 1, since that is how we price redeems
     * @param asset Address of the asset
     * @return uint256 USD price of 1 of the asset, in 18 decimal fixed
     */
    function priceUSDRedeem(address asset) external view returns (uint256) {
        uint256 price = IOracle(priceProvider).price(asset);
        if (price < 1e8) {
            price = 1e8;
        }
        // Price from Oracle is returned with 8 decimals so scale to 18
        return price.scaleBy(18, 8);
    }

    /***************************************
             Strategies Admin
    ****************************************/

    /**
     * @dev Withdraws all assets from the strategy and sends assets to the Vault.
     * @param _strategyAddr Strategy address.
     */
    function withdrawAllFromStrategy(address _strategyAddr)
        external
        onlyGovernorOrStrategist
    {
        require(
            strategies[_strategyAddr].isSupported,
            "Strategy is not supported"
        );
        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.withdrawAll();
    }

    /**
     * @dev Withdraws all assets from all the strategies and sends assets to the Vault.
     */
    function withdrawAllFromStrategies() external onlyGovernorOrStrategist {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            strategy.withdrawAll();
        }
    }

    /*************************************
              Startegies Weights
    *************************************/
    
    function sortWeightsByTarget(StrategyWithWeight[] memory weights) internal pure returns(StrategyWithWeight[] memory) {
        uint[] memory targets = new uint[](weights.length);
        for(uint i = 0; i < weights.length; i++) {
            targets[i] = weights[i].targetWeight;
        }
        uint[] memory indices = new uint[](targets.length);
        for (uint z = 0; z < indices.length; z++) {
            indices[z] = z;
        }
        Sort.quickSort(targets, 0, int(targets.length-1), indices);
        StrategyWithWeight[] memory sorted = new StrategyWithWeight[](targets.length);
        for (uint z = 0; z < indices.length; z++) {
            sorted[z] = weights[indices[z]];
        }
        return sorted;
    }

    function setStrategyWithWeights(StrategyWithWeight[] calldata _strategyWithWeights) external onlyGovernorOrStrategist {
        uint256 totalTarget = 0;
        for (uint8 i = 0; i < _strategyWithWeights.length; i++) {
            StrategyWithWeight memory strategyWithWeight = _strategyWithWeights[i];
            require(strategyWithWeight.strategy != address(0), "weight without strategy");
            require(
                strategyWithWeight.minWeight <= strategyWithWeight.targetWeight,
                "minWeight shouldn't higher than targetWeight"
            );
            require(
                strategyWithWeight.targetWeight <= strategyWithWeight.maxWeight,
                "targetWeight shouldn't higher than maxWeight"
            );
            totalTarget += strategyWithWeight.targetWeight;
        }
        require(totalTarget == TOTAL_WEIGHT, "Total target should equal to TOTAL_WEIGHT");
        StrategyWithWeight[] memory sorted = sortWeightsByTarget(_strategyWithWeights);
        for (uint8 i = 0; i < sorted.length; i++) {
            _addStrategyWithWeightAt(sorted[i], i);
            strategyWithWeightPositions[strategyWithWeights[i].strategy] = i;
        }
        // truncate if need
        if (strategyWithWeights.length > sorted.length) {
            uint256 removeCount = strategyWithWeights.length - sorted.length;
            for (uint8 i = 0; i < removeCount; i++) {
                strategyWithWeights.pop();
            }
        }

        // console.log from strategyWithWeights
        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            StrategyWithWeight memory strategyWithWeight = strategyWithWeights[i];
            console.log(strategyWithWeight.strategy, strategyWithWeight.targetWeight);
        }

    }
    function _addStrategyWithWeightAt(StrategyWithWeight memory strategyWithWeight, uint256 index) internal {
        uint256 currentLength = strategyWithWeights.length;
        // expand if need
        if (currentLength == 0 || currentLength - 1 < index) {
            uint256 additionalCount = index - currentLength + 1;
            for (uint8 i = 0; i < additionalCount; i++) {
                strategyWithWeights.push();
            }
        }
        strategyWithWeights[index] = strategyWithWeight;
    }
    function getStrategyWithWeight(address strategy) public view returns (StrategyWithWeight memory) {
        return strategyWithWeights[strategyWithWeightPositions[strategy]];
    }

    function getAllStrategyWithWeights() public view returns (StrategyWithWeight[] memory) {
        return strategyWithWeights;
    }
    /***************************
            PRIMARY STABLE
    ****************************/
    function setPrimaryStable(address _primaryStable) external onlyGovernorOrStrategist {
        primaryStableAddress = _primaryStable;
    }

    /***********************************
            QuickDepositStartegies
    ************************************/
    function setQuickDepositStrategies(address[] calldata _quickDepositStrategies) external onlyGovernorOrStrategist {
        quickDepositStrategies = _quickDepositStrategies;
    }
    /***********************************
                setSwapper
    ************************************/
    function setSwapper(address _balancerVault, bytes32 _balancerPoolId) external onlyGovernorOrStrategist {
        balancerVault = _balancerVault;
        balancerPoolId = _balancerPoolId;
    }

    /***********************************
                Harvester & Dripper
    ************************************/
    function setHarvester(address _harvester) external onlyGovernorOrStrategist {
        harvesterAddress = _harvester;
    }
    function setDripper(address _dripper) external onlyGovernorOrStrategist {
        dripperAddress = _dripper;
    }


    /***********************************
            Fee Parameters
    ************************************/
    function setFeeParams(address _labsAddress, uint256 _labsFeeBps, address _teamAddress, uint256 _teamFeeBps) external onlyGovernor {
        labsAddress = _labsAddress;
        labsFeeBps = _labsFeeBps;
        teamAddress = _teamAddress;
        teamFeeBps = _teamFeeBps;
        IHarvester(harvesterAddress).setLabs(labsAddress, labsFeeBps);
        IHarvester(harvesterAddress).setTeam(teamAddress, teamFeeBps);
    }
    function getFeeParams() public view returns (address, uint256, address, uint256)  {
        return (labsAddress, labsFeeBps, teamAddress, teamFeeBps);
    }



    /***************************
              PAYOUT
    ****************************/
    function payout() external {
        _payout();
    }
    function _payout() internal {
        IHarvester(harvesterAddress).harvestAndDistribute();
        IDripper(dripperAddress).collectAndRebase();
        _balance();
    }

    /***************************
            REBALANCE
    ****************************/
    function balance() external onlyGovernorOrStrategist {
        _balance();
    }
    function _balance() internal {
        IERC20 asset = IERC20(primaryStableAddress);
        StrategyWithWeight[] memory strategies = getAllStrategyWithWeights();

        // 1. calc total USDC equivalent
        uint256 totalAssetInStrat = 0;
        uint256 totalWeight = 0;
        for (uint8 i; i < strategies.length; i++) {
            if (!strategies[i].enabled) {// Skip if strategy is not enabled
                continue;
            }

            // UnstakeFull from Strategies with targetWeight == 0
            if(strategies[i].targetWeight == 0){
                IStrategy(strategies[i].strategy).withdrawAll();
            }else {
                console.log("Balance in startegy: ",IStrategy(strategies[i].strategy).checkBalance());
                totalAssetInStrat += IStrategy(strategies[i].strategy).checkBalance();
                totalWeight += strategies[i].targetWeight;
            }

        }
        uint256 totalAsset = totalAssetInStrat +  asset.balanceOf(address(this));
        console.log("Total asset: ", totalAsset);

        
        // 3. calc diffs for strategies liquidity
        Order[] memory stakeOrders = new Order[](strategies.length);
        uint8 stakeOrdersCount = 0;
        for (uint8 i; i < strategies.length; i++) {

            if (!strategies[i].enabled) {// Skip if strategy is not enabled
                continue;
            }

            uint256 targetLiquidity;
            if (strategies[i].targetWeight == 0) {
                targetLiquidity = 0;
            } else {
                targetLiquidity = (totalAsset * strategies[i].targetWeight) / totalWeight;
            }

            uint256 currentLiquidity = IStrategy(strategies[i].strategy).checkBalance();
            if (targetLiquidity == currentLiquidity) {
                // skip already at target strategies
                continue;
            }

            if (targetLiquidity < currentLiquidity) {
                // unstake now
                console.log("Withdraw now amount from", currentLiquidity - targetLiquidity, strategies[i].strategy);
                IStrategy(strategies[i].strategy).withdraw(
                    address(this),
                    address(asset),
                    currentLiquidity - targetLiquidity
                );
            } else {
                console.log("Deposit later amount from", targetLiquidity - currentLiquidity, strategies[i].strategy);
                // save to stake later
                stakeOrders[stakeOrdersCount] = Order(
                    true,
                    strategies[i].strategy,
                    targetLiquidity - currentLiquidity
                );
                stakeOrdersCount++;
            }
        }
        console.log("_asset Balance available after withdrawing", asset.balanceOf(address(this)));
        // 4.  make staking
        for (uint8 i; i < stakeOrdersCount; i++) {

            address strategy = stakeOrders[i].strategy;
            uint256 amount = stakeOrders[i].amount;
            console.log("Processing stake order of", strategy, amount );

            uint256 currentBalance = asset.balanceOf(address(this));
            if (currentBalance < amount) {
                amount = currentBalance;
            }
            asset.transfer(strategy, amount);

            IStrategy(strategy).deposit(
                address(asset),
                amount
            );
        }

    }
}
