// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH VaultInitializer Contract
 * @notice The Vault contract initializes the vault.
 * @author Stabl Protocol Inc
 */

import "./VaultStorage.sol";

contract VaultInitializer is VaultStorage {
    function initialize(address _priceProvider, address _cash)
        external
        onlyGovernor
        initializer
    {
        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_cash != address(0), "cash address is zero");

        cash = CASH(_cash);

        priceProvider = _priceProvider;

        rebasePaused = false;
        capitalPaused = true;

        // Initial  fee of 0 basis points
        redeemFeeBps = 0;
        teamFeeBps = 0;
        labsFeeBps = 0;
        // Initial Vault buffer of 0%
        vaultBuffer = 0;
        // Initial allocate threshold of 25,000 CASH
        autoAllocateThreshold = 25000e18;
        // Threshold for rebasing
        rebaseThreshold = 1000e18;
        // Initialize all strategies
        allStrategies = new address[](0);
        // Initialize all quick deposit strategies
        quickDepositStrategies = new address[](0);
    }
}
