// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH VaultInitializer Contract
 * @notice The VaultInitializer sets up the initial contract.
 * @author Stabl Protocol Inc
 */
import { VaultInitializer } from "./VaultInitializer.sol";
import { VaultAdmin } from "./VaultAdmin.sol";


contract Vault is VaultInitializer, VaultAdmin {}
