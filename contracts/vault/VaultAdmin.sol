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
import { IVaultCore } from "../interfaces/IVaultCore.sol";
import { IDripper } from "../interfaces/IDripper.sol";
import { IRebaseHandler } from "../interfaces/IRebaseHandler.sol";

import "./VaultStorage.sol";
import "../utils/Array.sol";
import "hardhat/console.sol";

contract VaultAdmin is VaultStorage {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @dev Verifies that the caller is the Vault, Governor, or Strategist.
     */
    modifier onlyVaultOrGovernorOrStrategist() {
        require(msg.sender == address(this) || msg.sender == strategistAddr || isGovernor(), "!VAULT_GOV_STRAT");
        _;
    }

    modifier onlyGovernorOrStrategist() {
        require(msg.sender == strategistAddr || isGovernor(), "!GOV_STRAT");
        _;
    }

    modifier onlyGovernorOrRebaseManager() {
        require(isGovernor() || rebaseManagers[msg.sender], "!GOV_RBM");
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
        for (uint8 i = 0; i < allStrategies.length; i++) {
            if (strategies[allStrategies[i]].isSupported) {
                try IStrategy(allStrategies[i]).setOracleRouter() {
                    emit PriceProviderStrategyUpdated(_priceProvider, allStrategies[i]);
                } catch {
                    emit PriceProviderStrategyUpdationFailed(_priceProvider, allStrategies[i]);
                }
            }
        }
    }

    /**
     * @dev Set a fee in basis points to be charged for a redeem.
     * @param _redeemFeeBps Basis point fee to be charged
     */
    function setRedeemFeeBps(uint256 _redeemFeeBps) external onlyGovernor {
        require(_redeemFeeBps <= 1000, "!FEE");
        redeemFeeBps = _redeemFeeBps;
        emit RedeemFeeUpdated(_redeemFeeBps);
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
     * @dev Add a supported asset to the contract, i.e. one that can be
     *         to mint CASH.
     * @param _asset Address of asset
     */
    function supportAsset(address _asset) external onlyGovernor {
        require(!assets[_asset].isSupported, "ALRDY");

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
        require(!strategies[_addr].isSupported, "ALRDY");
        strategies[_addr] = Strategy({ isSupported: true, _deprecated: 0 });
        allStrategies.push(_addr);
        emit StrategyApproved(_addr);
    }

    /**
     * @dev Remove a strategy from the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        _removeStrategy(_addr);
    }

    function _removeStrategy(address _addr) internal {
        require(strategies[_addr].isSupported, "!APRVD");

        uint256 strategyIndex = allStrategies.length;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < allStrategies.length) {
            allStrategies[strategyIndex] = allStrategies[allStrategies.length - 1];
            allStrategies.pop();

            // Mark the strategy as not supported
            strategies[_addr].isSupported = false;

            // Try to collectRewards
            IStrategy strategy = IStrategy(_addr);
            try strategy.collectRewardTokens() {} catch {
                // If it fails, we don't care
            }
            strategy.liquidateAll();
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
            strategyWithWeights[strategyIndex] = strategyWithWeights[strategyWithWeights.length - 1];
            
            strategyWithWeightPositions[strategyWithWeights[strategyIndex].strategy] = strategyIndex;

            strategyWithWeights.pop();
            if (strategyWithWeights.length > 0) {
                strategyWithWeights[0].targetWeight += weightOfRemovable;
            }

            delete strategyWithWeightPositions[_addr];
        }

        // Remove support from Harvestor
        IHarvester(harvesterAddress).setSupportedStrategy(_addr, false);
    }

    /**
     * @dev Sets the maximum allowable difference between
     * total supply and backing assets' value.
     */
    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
        emit MaxSupplyDiffChanged(_maxSupplyDiff);
    }

    /***************************************
                    Pause
    ****************************************/
    
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
    function transferToken(address _asset, uint256 _amount) external onlyGovernor {
        require(!assets[_asset].isSupported, "!SPRTD");
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
    function withdrawAllFromStrategy(address _strategyAddr) external onlyGovernorOrStrategist {
        require(strategies[_strategyAddr].isSupported, "!APVD");
        IStrategy(_strategyAddr).liquidateAll();
    }

    /**
     * @dev Withdraws assets from the strategy and sends assets to the Vault.
     * @param _strategyAddr Strategy address.
     * @param _usd _usd to withdraw
     */
    function withdrawFromStrategy(address _strategyAddr, uint256 _usd) external onlyGovernorOrStrategist {
        require(strategies[_strategyAddr].isSupported, "!APVD");
        IStrategy(_strategyAddr).withdrawUsd(_usd);
    }

    /**
     * @dev Withdraws all assets from all the strategies and sends assets to the Vault.
     */
    function withdrawAllFromStrategies() external onlyGovernorOrStrategist {
        for (uint256 i = 0; i < allStrategies.length; i++) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            strategy.liquidateAll();
        }
    }

    /*************************************
              Startegies Weights
    *************************************/
    /**
     * @dev Set the Weight against each strategy
     * @param _strategyWithWeights Array of StrategyWithWeight structs to set
     */
    function setStrategyWithWeights(StrategyWithWeight[] calldata _strategyWithWeights) external onlyGovernor {
        _setStrategyWithWeights(_strategyWithWeights);
    }

    /**
     * @dev Set the Weight against each strategy
     * @param _strategyWithWeights Array of StrategyWithWeight structs to set
     */
    function _setStrategyWithWeights(StrategyWithWeight[] calldata _strategyWithWeights) internal onlyGovernor {
        uint256 totalTarget = 0;
        address[] memory _oldStrategies = new address[](strategyWithWeights.length);
        address[] memory _newStrategies = new address[](_strategyWithWeights.length);
        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            delete strategyWithWeightPositions[strategyWithWeights[i].strategy];
            _oldStrategies[i] = strategyWithWeights[i].strategy;
        }
        for (uint8 i = 0; i < _strategyWithWeights.length; i++) {
            StrategyWithWeight memory strategyWithWeight = _strategyWithWeights[i];
            require(strategies[strategyWithWeight.strategy].isSupported, "!SPRTED");
            require(strategyWithWeight.strategy != address(0), "!STRGY");
            require(strategyWithWeight.minWeight <= strategyWithWeight.targetWeight, "MIN<TAR");
            require(strategyWithWeight.targetWeight <= strategyWithWeight.maxWeight, "TAR>MAX");
            totalTarget += strategyWithWeight.targetWeight;
            _newStrategies[i] = _strategyWithWeights[i].strategy;
        }
        require(totalTarget == TOTAL_WEIGHT, "!=TOTAL_WEIGHT");

        address[] memory _removedStrategies = Array.diff(_oldStrategies, _newStrategies);

        for (uint8 i = 0; i < _removedStrategies.length; i++) {
            _removeStrategy(_removedStrategies[i]);
        }

        for (uint8 i = 0; i < _strategyWithWeights.length; i++) {
            _addStrategyWithWeightAt(_strategyWithWeights[i], i);
            strategyWithWeightPositions[strategyWithWeights[i].strategy] = i;
        }

        // truncate if need
        if (strategyWithWeights.length > _strategyWithWeights.length) {
            uint256 removeCount = strategyWithWeights.length - _strategyWithWeights.length;
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

    function getStrategiesFromWeights() public view returns (address[] memory) {
        address[] memory _strategies = new address[](strategyWithWeights.length);
        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            _strategies[i] = strategyWithWeights[i].strategy;
        }
        return _strategies;
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
        harvesterAddress = _harvester;
    }

    /**
     * @dev Set the Dripper address in the Value
     * @param _dripper Address of the Dripper
     */
    function setDripper(address _dripper) external onlyGovernor {
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
    function setFeeParams(
        address _labsAddress,
        address _teamAddress,
        address _treasuryAddress
    ) external onlyGovernor {
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
    function getFeeParams()
        public
        view
        returns (
            address,
            uint256,
            address,
            uint256
        )
    {
        return (labsAddress, labsFeeBps, teamAddress, teamFeeBps);
    }

    /**
     * @dev Set the fee % that would be deducted at the time minting
     *      all of the mint fees would be sent to the Treasury
     *      Hence, seperate Bps for Labs & Treasury is not needed.
     * @param _mintFeeBps % in bps which would be deducted at the time of minting
     */
    function setMintFeeBps(uint256 _mintFeeBps) external onlyGovernor {
        require(_mintFeeBps > 0 && _mintFeeBps <= 10000, "!FEE");
        uint256 _previousMintFeeBps = mintFeeBps;
        mintFeeBps = _mintFeeBps;
        emit MintFeeChanged(msg.sender, _previousMintFeeBps, _mintFeeBps);
    }

    function setPoolBalanceCheckExponent(uint256 _poolBalanceCheckExponent) external onlyGovernor {
        require(_poolBalanceCheckExponent > 0, "!EXP");
        poolBalanceCheckExponent = _poolBalanceCheckExponent;
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
        require(_nextPayoutTime > 0, "T>0");
        nextPayoutTime = _nextPayoutTime;
    }

    /**
    * @dev Set _payoutPeriod and _payoutPeriod duration.
|    * @param _payoutPeriod Period for the payout. Ex: 24 * 60 * 60;
|    * @param _payoutTimeRange duration to honor payout time. Ex: 15 * 60;
    */
    function setPayoutIntervals(uint256 _payoutPeriod, uint256 _payoutTimeRange) external onlyGovernor {
        require((_payoutPeriod > 0) && (_payoutTimeRange > 0), "T>0");
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
        require(_rebaseManager != address(0), "!RBM");
        require(!rebaseManagers[_rebaseManager], "RBM_ALDY");
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
    /**
     * @dev Set Daily Expected Yield
     * @param _dailyExpectedYieldBps 1 bps = 0.01%
     */
    function setDailyExpectedYieldBps(uint256 _dailyExpectedYieldBps) external onlyGovernor {
        dailyExpectedYieldBps = _dailyExpectedYieldBps;
    }
    /**
     * @dev Stop and start payout/rebase during depeg
     * @param _dontRebaseDuringDepeg true to enable checking for depeg
     */
    function setDepegParams(bool _dontRebaseDuringDepeg, uint256 _depegMargin) external onlyGovernor {
        dontRebaseDuringDepeg = _dontRebaseDuringDepeg;
        depegMargin = _depegMargin;
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

        if (dontRebaseDuringDepeg) {
            for(uint8 i = 0; i < allAssets.length; i++) {
                IVaultCore(address(this)).validateAssetPeg(allAssets[i], depegMargin); // 100 = 1% tolerance
            }
        }

        // log Initial State of vault
        uint256 _t = cash.totalSupply();
        uint256 _nav = IVaultCore(address(this)).nav();
        uint256 _initNav  = _nav;

        console.log("I-TS: %s NAV: %s", _t, _nav);
        IHarvester(harvesterAddress).harvestAndDistribute();

        // Log state after Harvest and Distribute
        _t = cash.totalSupply();
        _nav = IVaultCore(address(this)).nav();
        console.log("H-TS: %s, NAV: %s", _t, _nav);

        // Collect yield from Dripper
        IDripper(dripperAddress).collect();

        // Log state
        _t = cash.totalSupply();
        _nav = IVaultCore(address(this)).nav();
        console.log("COLL-TS: %s, NAV: %s", _t, _nav);

        // Balance the Vault
        _balance();

        // Log the state
        _t = cash.totalSupply();
        _nav = IVaultCore(address(this)).nav();
        console.log("R-TS: %s, NAV: %s", _t, _nav);

        uint256 _navDiff = _nav.subOrZero(_initNav);
        console.log("NAV_DIFF: ", _navDiff);
        if (_navDiff > 0) {
            uint256 _extraCASH = (_navDiff.scaleBy(18, 8) * 10**18 ) / (IVaultCore(address(this)).price());
            console.log("EXTRA_CASH: ", _extraCASH);
            cash.changeSupply(cash.totalSupply() + _extraCASH);
            
            if (rebaseHandler != address(0)) {
                IRebaseHandler(rebaseHandler).process();
            }
        }

        emit Payout(_navDiff);
        // update next payout time. Cycle for preventing gaps
        for (; block.timestamp >= nextPayoutTime - payoutTimeRange; ) {
            nextPayoutTime = nextPayoutTime + payoutPeriod;
        }
    }

    /**
     * @dev Function to get the index of most stable asset using Oracle
     */
    function getMostStableAssetIndex() view internal returns (uint256) {
        // Loop through all assets and find the one with price most close to 10**8
        uint256 _mostStableAssetIndex = 0;
        uint256 _leastDifference = 1000000000; // 10 USD - Stable coin max cannot reach $10
        uint256 _mostStableAssetPrice = 10**8;
        for (uint8 i; i < allAssets.length; i++) {
            uint256 _price = IOracle(priceProvider).price(allAssets[i]);
            uint256 _diff = _price.subFromBigger(_mostStableAssetPrice);
            if (_diff < _leastDifference) {
                _mostStableAssetIndex = i;
                _leastDifference = _diff;
            }
        }
        return _mostStableAssetIndex;
    }

    /***************************
            REBALANCE
    ****************************/

    /**
     * @dev Balance the Vault with predefined weights
     */
    function balance() external onlyVaultOrGovernorOrStrategist {
        _balance();
    }

    /**
     * @dev Balance the Vault with predefined weights
     */
    function _balance() internal {
        require(strategyWithWeights.length > 0, "!WGT");


        // 1. calc total USDC equivalent
        uint256 totalWeight = 0;
        for (uint8 i; i < strategyWithWeights.length; i++) {
            if (!strategyWithWeights[i].enabled) {
                continue;
            }

            if (strategyWithWeights[i].targetWeight == 0) {
                // console.log("LIQUIDATE_ALL: ", strategyWithWeights[i].strategy);
                IStrategy(strategyWithWeights[i].strategy).liquidateAll();
            } else {
                IStrategy(strategyWithWeights[i].strategy).withdrawStrayAssets();
                totalWeight += strategyWithWeights[i].targetWeight;
            }
        }

        uint256 _nav = IVaultCore(address(this)).nav();
        // console.log("RBL : INIT_NAV :", _nav);


        // 3. calc diffs for strategyWithWeights liquidity
        Order[] memory stakeOrders = new Order[](strategyWithWeights.length);
        uint8 stakeOrdersCount = 0;
        uint256 stakeRequirement = 0;
        for (uint8 i; i < strategyWithWeights.length; i++) {
            if (!strategyWithWeights[i].enabled) {
                // Skip if strategy is not enabled
                continue;
            }

            uint256 targetLiquidity;
            if (strategyWithWeights[i].targetWeight == 0) {
                targetLiquidity = 0;
            } else {
                targetLiquidity = (_nav * strategyWithWeights[i].targetWeight) / totalWeight;
            }

            uint256 currentLiquidity = IStrategy(strategyWithWeights[i].strategy).netAssetValue();
            if (targetLiquidity == currentLiquidity) {
                continue;
            }

            if (targetLiquidity < currentLiquidity) {
                IStrategy(strategyWithWeights[i].strategy).withdrawUsd(currentLiquidity - targetLiquidity);
            } else {
                stakeOrders[stakeOrdersCount] = Order(true, strategyWithWeights[i].strategy, targetLiquidity - currentLiquidity);
                stakeOrdersCount++;
                stakeRequirement += targetLiquidity - currentLiquidity;
            }
        }
        console.log("RBL: AV: %s", IVaultCore(address(this)).vaultNav());
        console.log("RBL: RQ: %s", stakeRequirement);

        IStrategy _strategy;
        address _token0;
        uint256[] memory _neededAmounts  = new uint256[](3);
        // 4.  Try to make staking without swapping
        for (uint8 i; i < stakeOrdersCount; i++) {
            _strategy = IStrategy(stakeOrders[i].strategy);
            _token0 = _strategy.token0();
            // Converting USD to _token0
            uint256 amount = (stakeOrders[i].amount * (10**Helpers.getDecimals(_token0)))/ (IOracle(priceProvider).price(_token0));
            stakeOrders[i].amount = amount; 
            uint256 currentBalance = IERC20(_token0).balanceOf(address(this));
            if (amount >  currentBalance) {
                for(uint8 j=0; j < allAssets.length; j++) {
                    if (allAssets[j] == _token0) {
                        _neededAmounts[j] += amount - currentBalance;
                        break;
                    }
                }
            }
            if (currentBalance == 0) {
                continue;
            }
            if (currentBalance < amount) {
                amount = currentBalance;
            }
            IERC20(_token0).safeTransfer(address(_strategy), amount);
            stakeOrders[i].amount -= amount;
        }

        if (_neededAmounts[0] == 0 && _neededAmounts[1] == 0 && _neededAmounts[2] == 0) {
            return;
        }
        
        uint256 _totalNeededAmounts = 0;
        // Ensuring everything is in Most Stable Asset
        address _swapTo = allAssets[getMostStableAssetIndex()];
        for(uint8 i=0; i < allAssets.length; i++) {
            _totalNeededAmounts += _neededAmounts[i].scaleBy(18, Helpers.getDecimals(allAssets[i]));
            if (allAssets[i] == _swapTo  || IERC20(allAssets[i]).balanceOf(address(this)) == 0)  {
                continue;
            }
            IVaultCore(address(this)).swapAsset(allAssets[i], _swapTo, IERC20(allAssets[i]).balanceOf(address(this)));
        }

        // Calculating proportions
        uint256 _stableAssetBalance = IERC20(_swapTo).balanceOf(address(this));
        uint256[] memory _proportionsOfMSA = new uint256[](3);
        for(uint8 i=0; i < allAssets.length; i++) {
            _proportionsOfMSA[i] = (_stableAssetBalance * _neededAmounts[i].scaleBy(18, Helpers.getDecimals(allAssets[i])) / _totalNeededAmounts); // Amount of MSA, that will be used for ith Asset
        }

        for (uint8 i; i < stakeOrdersCount; i++) {
            _strategy = IStrategy(stakeOrders[i].strategy);
            _token0 = _strategy.token0();
            uint256 _tIndex = IVaultCore(address(this)).getAssetIndex(_token0);
            // Converted in previous step
            uint256 amount = stakeOrders[i].amount;
            if (amount == 0) {
                continue;
            }
            // Calculate proportion of MSA to use for _amount
            uint256 _amountToTransfer = IERC20(_token0).balanceOf(address(this));
            if (_swapTo != _token0) {
                IVaultCore(address(this)).swapAsset(_swapTo, _token0, (amount * _proportionsOfMSA[_tIndex]) / _neededAmounts[_tIndex]);
                _amountToTransfer = IERC20(_token0).balanceOf(address(this)) - _amountToTransfer;
            } else {
                _amountToTransfer = (amount * _proportionsOfMSA[_tIndex]) / _neededAmounts[_tIndex];
            }
            IERC20(_token0).safeTransfer(address(_strategy), _amountToTransfer);
        }
        // Direct-deposit all at once, GAS savings
        for(uint8 i=0; i < strategyWithWeights.length; i++) {
            if (IERC20(IStrategy(strategyWithWeights[i].strategy).token0()).balanceOf(strategyWithWeights[i].strategy) > 0) {
                IStrategy(strategyWithWeights[i].strategy).directDeposit();
            }
        }
        // Loop through allAssets and print balance
        for(uint8 i=0; i < allAssets.length; i++) {
            // Not allowing more than 10^(decimal - 3) of any currency in the vault after rebalance
            require(IERC20(allAssets[i]).balanceOf(address(this)) < 10^(Helpers.getDecimals(allAssets[i]) - 3), "RBL_NOT_GOOD");
        }

    }
}
