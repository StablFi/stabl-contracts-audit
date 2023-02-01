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

    modifier onlyGovernorOrRebaseManager() {
        require(
            isGovernor() || rebaseManagers[msg.sender],
            "Caller is not the Governor or Rebase Manager"
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


        // Removing strategy from quickDeposit
        strategyIndex = quickDepositStrategies.length;
        for (uint256 i = 0; i < quickDepositStrategies.length; i++) {
            if (quickDepositStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < quickDepositStrategies.length) {
            quickDepositStrategies[strategyIndex] = quickDepositStrategies[
                quickDepositStrategies.length - 1
            ];
            quickDepositStrategies.pop();
            emit StrategyRemoved(_addr);
        }

        // Removing strategy from weights
        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        strategyIndex = strategyWithWeights.length;
        for (uint256 i = 0; i < strategyWithWeights.length; i++) {
            if (strategyWithWeights[i].strategy == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < strategyWithWeights.length) {
            // RECOMMENDED: To reset weights through its setStrategyWithWeights() function after strategy removal.
            uint256 weightOfRemovable = strategyWithWeights[strategyIndex].targetWeight;
            strategyWithWeights[strategyIndex] = strategyWithWeights[
                strategyWithWeights.length - 1
            ];
            strategyWithWeights.pop();
            if (strategyWithWeights.length > 0) {
                strategyWithWeights[0].targetWeight += weightOfRemovable;
            }

            delete strategyWithWeightPositions[_addr];
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
     * @dev Change the CASH supply without any checks
     */
    function changeCASHSupply(uint256 _newTotalSupply) external onlyGovernor {
        cash.changeSupply(_newTotalSupply);
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
        // require(!assets[_asset].isSupported, "Only unsupported assets");
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
     * @dev Withdraws assets from the strategy and sends assets to the Vault.
     * @param _strategyAddr Strategy address.
     * @param _amount Amount to withdraw
     */
    function withdrawFromStrategy(address _strategyAddr, uint256 _amount)
        external
        onlyGovernorOrStrategist
    {
        require(
            strategies[_strategyAddr].isSupported,
            "Strategy is not supported"
        );
        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.withdraw(address(this), primaryStableAddress, _amount);
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
    /**
     * @dev Sort the StrategyWithWeight[] by weight property
     * @param weights Array of StrategyWithWeight structs to sort to
     * @return sorted Sorted array by weight of StrategyWithWeight structs
     */
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


    /**
    * @dev Set the Weight against each strategy
    * @param _strategyWithWeights Array of StrategyWithWeight structs to set
    */
    function setStrategyWithWeights(StrategyWithWeight[] calldata _strategyWithWeights) external onlyGovernor  {
        _setStrategyWithWeights(_strategyWithWeights);
    }

    /**
    * @dev Set the Weight against each strategy
    * @param _strategyWithWeights Array of StrategyWithWeight structs to set
    */
    function _setStrategyWithWeights(StrategyWithWeight[] calldata _strategyWithWeights) internal onlyGovernor {
        uint256 totalTarget = 0;
        for (uint8 i = 0; i < _strategyWithWeights.length; i++) {
            StrategyWithWeight memory strategyWithWeight = _strategyWithWeights[i];
            require(strategies[strategyWithWeight.strategy].isSupported, "Strategy should be supported by the Vault");
            require(strategyWithWeight.strategy != address(0), "Weight without strategy");
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
    }


    /**
    * @dev Utility function to set StrategyWithWeight struct to specific postion in the strategyWithWeights[]
    * @param strategyWithWeight StrategyWithWeight struct object to set
    * @param index Position to set the _strategyWithWeights in  strategyWithWeights[]
    */
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

    /**
    * @dev Utility function to return the StrategyWithWeight object by strategy address
    * @param strategy address of the strategy
    * @return StrategyWithWeight object against the address
    */
    function getStrategyWithWeight(address strategy) public view returns (StrategyWithWeight memory) {
        return strategyWithWeights[strategyWithWeightPositions[strategy]];
    }

    /**
    * @dev Accessor function for strategyWithWeights
    * @return strategyWithWeights StrategyWithWeight[] object
    */
    function getAllStrategyWithWeights() public view returns (StrategyWithWeight[] memory) {
        return strategyWithWeights;
    }
    /***************************
            PRIMARY STABLE
    ****************************/
    /**
    * @dev Set the Primary Stable address
    * @param _primaryStable Address of the Primary Stable
    */
    function setPrimaryStable(address _primaryStable) external onlyGovernor {
        require(_primaryStable != address(0), "PrimaryStable should not be empty.");
        primaryStableAddress = _primaryStable;

    }

    /***********************************
            QuickDepositStartegies
    ************************************/
    /**
    * @dev Set the quick deposit strategies for quickAllocation of funds.
    * @param _quickDepositStrategies Array of pre-appproved startegy addresses
    */
    function setQuickDepositStrategies(address[] calldata _quickDepositStrategies) external onlyGovernor {
        for (uint8 i = 0; i < _quickDepositStrategies.length; i++) {
            require(strategies[_quickDepositStrategies[i]].isSupported, "Strategy should be supported by the Vault");
        }
        quickDepositStrategies = _quickDepositStrategies;
    }
    /**
    * @dev Get the quick deposit strategies for quickAllocation of funds.
    * @return QuickDepositStrategies Array of pre-appproved startegy addresses
    */
    function getQuickDepositStrategies() external onlyGovernor view returns (address[] memory) {
        return quickDepositStrategies;
    }
    /***********************************
                setSwapper
    ************************************/
    /**
    * @dev Set the Balancer Vault as primary swapper for the Vault
    * @param _swappingPool Address of Pool
    * @param _swappingPoolId Id of the Pool to use for swapping
    */
    function setSwapper(address _swappingPool, bytes32 _swappingPoolId) external onlyGovernor {
        swappingPool = _swappingPool;
        swappingPoolId = _swappingPoolId;
    }

    /***********************************
                Harvester & Dripper
    ************************************/
    /**
    * @dev Set the Harvester address in the Vault
    * @param _harvester Address of Harvester
    */
    function setHarvester(address _harvester) external onlyGovernor {
        require(_harvester != address(0), "Empty Harvester Address");
        harvesterAddress = _harvester;
    }

    /**
    * @dev Set the Dripper address in the Value
    * @param _dripper Address of the Dripper
    */
    function setDripper(address _dripper) external onlyGovernor {
        require(_dripper != address(0), "Empty Dripper Address");
        dripperAddress = _dripper;
    }


    /***********************************
            Fee Parameters
    ************************************/
    /**
    * @dev Set the Fee Distribution Parameters for Vault
    * @param _labsAddress address of the Labs account
    * @param _teamAddress address of the Team account
    * @param _treasuryAddress address of the Treasury account
    */
    function setFeeParams(address _labsAddress, address _teamAddress, address _treasuryAddress) external onlyGovernor {
        labsAddress = _labsAddress;
        teamAddress = _teamAddress;
        treasuryAddress = _treasuryAddress;
        emit FeeAddressesChanged(_labsAddress, _teamAddress, _treasuryAddress);
    }
    /**
    * @dev Set Harvester Fee Parameters
    * @param _labsFeeBps Fee in BPS for Labs
    * @param _teamFeeBps Fee in BPS for Team
    */
    function setHarvesterFeeParams(uint256 _labsFeeBps, uint256 _teamFeeBps) external onlyGovernor {
        require((labsAddress != address(0)) && (teamAddress != address(0)), "!SET");
        IHarvester(harvesterAddress).setLabs(labsAddress, _labsFeeBps);
        IHarvester(harvesterAddress).setTeam(teamAddress, _teamFeeBps);
        emit HarvesterFeeParamsChanged(labsAddress, _labsFeeBps, teamAddress, _teamFeeBps);
    }

    /**
    * @dev Get Fee parameters for Labs and Team
    * @return Tuple containing the Lab address, Lab % in Bps, Team address, Team % in Bps
    */
    function getFeeParams() public view returns (address, uint256, address, uint256)  {
        return (labsAddress, labsFeeBps, teamAddress, teamFeeBps);
    }
    /**
    * @dev Set the fee % that would be deducted at the time minting
    *      all of the mint fees would be sent to the Treasury
    *      Hence, seperate Bps for Labs & Treasury is not needed.
    * @param _mintFeeBps % in bps which would be deducted at the time of minting
    */
    function setMintFeeBps(uint256 _mintFeeBps) external onlyGovernor {
        require(_mintFeeBps > 0 && _mintFeeBps <= 10000, "Invalid MintFee");
        uint256 _previousMintFeeBps = mintFeeBps;
        mintFeeBps = _mintFeeBps;
        emit MintFeeChanged(msg.sender, _previousMintFeeBps, _mintFeeBps);
    }
    /********************************
            PAYOUT TIMESTAMPS
    *********************************/
    /**
    * @dev Set nextPayoutTime timestamp. Should be called once at the time initialization
           Can be arbitary as it will auto set by payout()
    * @param _nextPayoutTime timestamp of next Payout
    */
    function setNextPayoutTime(uint256 _nextPayoutTime) external onlyGovernor {
        require(_nextPayoutTime > 0, "Time cannot be 0");
        nextPayoutTime = _nextPayoutTime;
    }

    /**
    * @dev Set _payoutPeriod and _payoutPeriod duration.
|    * @param _payoutPeriod Period for the payout. Ex: 24 * 60 * 60;
|    * @param _payoutTimeRange duration to honor payout time. Ex: 15 * 60;
    */
    function setPayoutIntervals(uint256 _payoutPeriod, uint256 _payoutTimeRange) external onlyGovernor {
        require((_payoutPeriod > 0) && (_payoutTimeRange > 0), "Time cannot be 0");
        payoutPeriod = _payoutPeriod;
        payoutTimeRange = _payoutTimeRange;
    }

    /********************************
            REBASE MANAGER
    *********************************/
    /**
    * @dev Set rebase managers to allow rebasing to specific external users
    * @param _rebaseManager Candidate for Rebase Manager
    */
    function addRebaseManager(address _rebaseManager) external onlyGovernor {
        require(_rebaseManager != address(0), "No Rebase Manager Provided");
        require(!rebaseManagers[_rebaseManager], "Rebase Manager already whitelisted");
        rebaseManagers[_rebaseManager] = true;
    }

    /**
    * @dev Check if the an address is actually a Rebase Manager
    * @param _sender address to check if it is among Rebase Managers
    */
    function isRebaseManager(address _sender) external view returns (bool) {
        return rebaseManagers[_sender];
    }

    /**
     * Rebase Handler 
     * @dev Set the rebase handler
     * @param _rebaseHandler Address of the rebase handler
     */
    function setRebaseHandler(address _rebaseHandler) external onlyGovernor {
        require(_rebaseHandler != address(0));
        rebaseHandler = _rebaseHandler;
    }   
    /***************************
              PAYOUT
    ****************************/
    /**
    * @dev Function to collect rewards from Strategies and Balance the Vault
    */
    function payout() external onlyGovernorOrRebaseManager {
        _payout();
    }
    /**
    * @dev Function to collect rewards from Strategies and Balance the Vault
    */
    function _payout() internal {
        if (block.timestamp + payoutTimeRange < nextPayoutTime) {
            return;
        }

        IHarvester(harvesterAddress).harvestAndDistribute();
        uint256 totalUSDCInDripper = IERC20(primaryStableAddress).balanceOf(dripperAddress);
        IDripper(dripperAddress).collectAndRebase();
        emit Payout(IERC20(primaryStableAddress).balanceOf(dripperAddress).subFromBigger(totalUSDCInDripper));
        _balance();

        // update next payout time. Cycle for preventing gaps
        for (; block.timestamp >= nextPayoutTime - payoutTimeRange;) {
            nextPayoutTime = nextPayoutTime + payoutPeriod;
        }
    }

    /***************************
            REBALANCE
    ****************************/
    function invokeDeposits() external onlyGovernor {
        StrategyWithWeight[] memory stratsWithWeights = getAllStrategyWithWeights();
        for (uint8 i; i < stratsWithWeights.length; i++) {
            uint256 totalAssetInStrat = IStrategy(stratsWithWeights[i].strategy).checkBalance();
            if (totalAssetInStrat > 0) {
                console.log("Depositing %s from %s", totalAssetInStrat, stratsWithWeights[i].strategy);
                IStrategy(stratsWithWeights[i].strategy).deposit(primaryStableAddress, totalAssetInStrat);
            }
        }
    }
    /**
    * @dev Balance the Vault with predefined weights
    */
    function balance() external onlyGovernorOrStrategist {
        _balance();
    }
    /**
    * @dev Balance the Vault with predefined weights
    */
    function _balance() internal {
        IERC20 asset = IERC20(primaryStableAddress);
        StrategyWithWeight[] memory stratsWithWeights = getAllStrategyWithWeights();
        require(stratsWithWeights.length > 0, "Weights not set");
        require(primaryStableAddress != address(0), "PS not set");

        // 1. calc total USDC equivalent
        uint256 totalAssetInStrat = 0;
        uint256 totalWeight = 0;
        for (uint8 i; i < stratsWithWeights.length; i++) {
            if (!stratsWithWeights[i].enabled) {// Skip if strategy is not enabled
                continue;
            }

            // UnstakeFull from stratsWithWeights with targetWeight == 0
            if(stratsWithWeights[i].targetWeight == 0){
                IStrategy(stratsWithWeights[i].strategy).withdrawAll();
            }else {
                totalAssetInStrat += IStrategy(stratsWithWeights[i].strategy).checkBalance();
                totalWeight += stratsWithWeights[i].targetWeight;
            }

        }
        uint256 totalAsset = totalAssetInStrat + asset.balanceOf(address(this));

        // 3. calc diffs for stratsWithWeights liquidity
        Order[] memory stakeOrders = new Order[](stratsWithWeights.length);
        uint8 stakeOrdersCount = 0;
        uint256 stakeRequirement = 0;
        for (uint8 i; i < stratsWithWeights.length; i++) {

            if (!stratsWithWeights[i].enabled) {// Skip if strategy is not enabled
                continue;
            }

            uint256 targetLiquidity;
            if (stratsWithWeights[i].targetWeight == 0) {
                targetLiquidity = 0;
            } else {
                targetLiquidity = (totalAsset * stratsWithWeights[i].targetWeight) / totalWeight;
            }

            uint256 currentLiquidity = IStrategy(stratsWithWeights[i].strategy).checkBalance();
            if (targetLiquidity == currentLiquidity) {
                // skip already at target stratsWithWeights
                continue;
            }

            if (targetLiquidity < currentLiquidity) {
                // unstake now
                IStrategy(stratsWithWeights[i].strategy).withdraw(
                    address(this),
                    address(asset),
                    currentLiquidity - targetLiquidity
                );
            } else {
                // save to stake later
                stakeOrders[stakeOrdersCount] = Order(
                    true,
                    stratsWithWeights[i].strategy,
                    targetLiquidity - currentLiquidity
                );
                stakeOrdersCount++;
                stakeRequirement += targetLiquidity - currentLiquidity;
            }
        }
        console.log("REBALANCE: Balance available to stake %s", asset.balanceOf(address(this)));
        console.log("REBALANCE: Balance required to stake %s", stakeRequirement);
        // 4.  make staking
        for (uint8 i; i < stakeOrdersCount; i++) {

            address strategy = stakeOrders[i].strategy;
            uint256 amount = stakeOrders[i].amount;

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
