const ethers = require("ethers");

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
require("solidity-coverage");
require("@openzeppelin/hardhat-upgrades");
const Cryptr = require('cryptr');
const os = require("os");
const fs = require("fs");
const path = require("path");
var master;
try {
  master = fs.readFileSync(path.join(__dirname, "safe/master"), "utf8");
} catch (error) {
  console.error("No master file found. Please create one in the safe folder.");
  process.exit(1);
}

const decryptr = new Cryptr(master);

const {
  accounts,
  fund,
  mint,
  redeem,
  redeemFor,
  transfer,
} = require("./tasks/account");
const { debug } = require("./tasks/debug");
const { env } = require("./tasks/env");
const {
  execute,
  executeOnFork,
  proposal,
  governors,
} = require("./tasks/governance");
const { balance } = require("./tasks/cash");
const {
  storeStorageLayoutForAllContracts,
  assertStorageLayoutChangeSafe,
  assertStorageLayoutChangeSafeForAll,
  showStorageLayout,
} = require("./tasks/storageSlots");

const {
  allocate,
  capital,
  harvest,
  rebalance,
  reallocate,
  rebase,
  yield,
  payout,
  collectAndRebase,
  harvestSupportStrategy,
  removeStrategy,
  setMaxSupplyDiff,
  setQuickDepositStrategy,
  setMintFeeBps,
  setFeeCollectors,
  setPerformanceFee,
  withdrawFromStrategy,
  withdrawAllFromStrategy,
} = require("./tasks/vault");
const { task } = require("hardhat/config");

const MAINNET_DEPLOYER = process.env.MAINNET_DEPLOYER;
const MAINNET_GOVERNOR = process.env.MAINNET_DEPLOYER;
var MAINNET_DEPLOYER_GATEPASS = "afdfd9c3d2095ef696114f6cedcae59e72dcd697e2a7521b1578140422a4f890"; // Public Sample - should not to used anywhere
try {
  MAINNET_DEPLOYER_GATEPASS = decryptr.decrypt(process.env.MAINNET_DEPLOYER_PK)
} catch (error) {
  console.error("No valid MAINNET_DEPLOYER_PK found.");
}

const LOCAL_DEPLOYER = process.env.LOCAL_DEPLOYER
var LOCAL_DEPLOYER_WORDMAP = "afdfd9c3d2095ef696194f6cedcae59e72dcd697e2a7521b1578140422a4f890"; // Public Sample - should not to used anywhere
try {
  LOCAL_DEPLOYER_WORDMAP = decryptr.decrypt(process.env.LOCAL_DEPLOYER_WORDMAP)
} catch (error) {
  console.error("No valid LOCAL_DEPLOYER_WORDMAP found.");
}

const STAGING_DEPLOYER = process.env.STAGING_DEPLOYER;
const STAGING_DEPLOYER_PK = process.env.STAGING_DEPLOYER_PK;

var STAGING_DEPLOYER_GATEPASS = "afdfd9c3d2091ef696594f6cedcae59e72dcd697e2a7521b1578140422a4f890"; // Public Sample - should not to used anywhere
try {
  STAGING_DEPLOYER_GATEPASS = decryptr.decrypt(process.env.STAGING_DEPLOYER_PK)
} catch (error) {
  console.error("No valid STAGING_DEPLOYER_PK found.");
}

// Environment tasks.
task("env", "Check env vars are properly set for a Mainnet deployment", env);

// Account tasks.
task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, CALCULATED_GATE_PASS);
});
task("fund", "Fund accounts on local or fork")
  .addOptionalParam("num", "Number of accounts to fund")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Stable coin amount to fund each account with")
  .addOptionalParam(
    "accountsfromenv",
    "Fund accounts from the .env file instead of STAGING_DEPLOYER_WORDMAP"
  )
  .setAction(fund);
task("mint", "Mint CASH on local or fork")
  .addOptionalParam("num", "Number of accounts to mint for")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Amount of CASH to mint")
  .setAction(mint);
task("redeem", "Redeem CASH on local or fork")
  .addOptionalParam("num", "Number of accounts to redeem for")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Amount of CASH to redeem")
  .setAction(redeem);
task("redeemFor", "Redeem CASH on local or fork")
  .addOptionalParam("account", "Account that calls the redeem")
  .addOptionalParam("amount", "Amount of CASH to redeem")
  .setAction(redeemFor);
task("transfer", "Transfer CASH")
  .addParam("index", "Account  index")
  .addParam("amount", "Amount of CASH to transfer")
  .addParam("to", "Destination address")
  .setAction(transfer);

// Debug tasks.
task("debug", "Print info about contracts and their configs", debug);

// CASH tasks.
task("balance", "Get CASH balance of an account")
  .addParam("account", "The account's address")
  .setAction(balance);

// Vault tasks.
task("allocate", "Call allocate() on the Vault", allocate);
task("rebalance", "Call rebalance() on the Vault", rebalance);
task("capital", "Set the Vault's pauseCapital flag", capital);
task("harvest", "Call harvest() on Vault", harvest);
task("rebase", "Call rebase() on the Vault", rebase);
task("payout", "Call payout() on the Vault", payout);
task(
  "collectAndRebase",
  "Call collectAndRebase() on the Dripper",
  collectAndRebase
);
task("yield", "Artificially generate yield on the Vault", yield);
task("reallocate", "Allocate assets from one Strategy to another")
  .addParam("from", "Address to withdraw asset from")
  .addParam("to", "Address to deposit asset to")
  .addParam("assets", "Address of asset to reallocate")
  .addParam("amounts", "Amount of asset to reallocate")
  .setAction(reallocate);
task("harvester_support_strategy", "Approve strategy in harvester")
  .addParam("strategy", "The strategy's address")
  .setAction(harvestSupportStrategy);
task("set_quick_deposit_strategy", "Set Quick Deposit Strategy")
  .addParam("strategy", "The strategy's address")
  .setAction(setQuickDepositStrategy);
task(
  "setMaxSupplyDiff",
  "Set max possible difference in the supply & vault value"
)
  .addParam("value", "The diff value")
  .setAction(setMaxSupplyDiff);

task("set_mint_fee_bps", "Set Mint Fee Bps")
  .addParam("value", "The BPS value")
  .setAction(setMintFeeBps);

task("set_fee_collectors", "Set Fee collecting accounts")
  .addParam("labs", "Labs address")
  .addParam("treasury", "Treasury address")
  .addParam("team", "Team address")
  .setAction(setFeeCollectors);

task("set_performance_fee", "Set Fee Bps for Harvester")
  .addParam("labsbps", "Labs BPS")
  .addParam("teambps", "Team BPS")
  .setAction(setPerformanceFee);

task("vault_support_strategy", "Removed strategy from Vault")
  .addParam("strategy", "The strategy's address")
  .setAction(removeStrategy);

task("withdraw_from_strategy", "Withdraw from strategy")
  .addParam("strategy", "The strategy's address")
  .addParam("amount", "Amount to withdraw")
  .setAction(withdrawFromStrategy);

task("withdraw_all_from_strategy", "Withdraw all from strategy")
  .addParam("strategy", "The strategy's address")
  .setAction(withdrawAllFromStrategy);

// Governance tasks
task("execute", "Execute a governance proposal")
  .addParam("id", "Proposal ID")
  .addOptionalParam("governor", "Override Governor address")
  .setAction(execute);
task("executeOnFork", "Enqueue and execute a proposal on the Fork")
  .addParam("id", "Id of the proposal")
  .addOptionalParam("gaslimit", "Execute proposal gas limit")
  .setAction(executeOnFork);
task("proposal", "Dumps the state of a proposal")
  .addParam("id", "Id of the proposal")
  .setAction(proposal);
task("governors", "Get list of governors for all contracts").setAction(
  governors
);

// Storage slots
task(
  "saveStorageSlotLayout",
  "Saves storage slot layout of all the current contracts in the code base to repo. Contract changes can use this file for future reference of storage layout for deployed contracts."
).setAction(storeStorageLayoutForAllContracts);

task(
  "checkUpgradability",
  "Checks storage slots of a contract to see if it is safe to upgrade it."
)
  .addParam("name", "Name of the contract.")
  .setAction(assertStorageLayoutChangeSafe);

task(
  "checkUpgradabilityAll",
  "Checks storage slot upgradability for all contracts"
).setAction(assertStorageLayoutChangeSafeForAll);

task("showStorageLayout", "Visually show the storage layout of the contract")
  .addParam("name", "Name of the contract.")
  .setAction(showStorageLayout);

module.exports = {
  solidity: {
    compilers: [
      { version: "0.5.16" },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        }
      }

    ]
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: LOCAL_DEPLOYER_WORDMAP,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        passphrase: "",
        accountsBalance: "10000000000000000000000"
      },
      chainId: 1337,
      initialBaseFeePerGas: 0,
      timeout: 30 * 200000,
      chains: {
        137: {
          hardforkHistory: {
            london: 20000000,
          },
        }
      }
    },
    localhost: {
      timeout: 30 * 200000,
    },

    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [MAINNET_DEPLOYER_GATEPASS],
      gasMultiplier: 3.5,
      gasPrice: 80e9,
      // blockGasLimit: 24000000
    },
    polygon_staging: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [STAGING_DEPLOYER_GATEPASS],
      gasPrice: 150e9,
      // gasMultiplier: 2,
      // gasPrice: 200000000000,
      // blockGasLimit: 20000000
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
    timeout: 30 * 200000,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? LOCAL_DEPLOYER : 0,
      hardhat: process.env.FORK === "true" ? LOCAL_DEPLOYER : 0,
      mainnet: MAINNET_DEPLOYER,
      polygon_staging: STAGING_DEPLOYER,
    },
    governorAddr: {
      default: 0,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: process.env.FORK === "true" ? LOCAL_DEPLOYER : 0,
      hardhat: process.env.FORK === "true" ? LOCAL_DEPLOYER : 0,
      mainnet: MAINNET_GOVERNOR,
      polygon_staging: STAGING_DEPLOYER,
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
  },
  etherscan: {
    apiKey: {
      rinkeby: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGON_API_KEY,
    },
    customChains: [
      {
        network: "rinkeby",
        chainId: 4,
        urls: {
          apiURL: "https://api-rinkeby.etherscan.io/api",
          browserURL: "https://rinkeby.etherscan.io",
        },
      },
      {
        network: "mainnet",
        chainId: 4,
        urls: {
          apiURL: "https://api.polygonscan.com/",
          browserURL: "https://polygonscan.com",
        },
      },
      {
        network: "polygon_staging",
        chainId: 4,
        urls: {
          apiURL: "https://api.polygonscan.com/",
          browserURL: "https://polygonscan.com",
        },
      },
    ],
  },
  ethernal: {
    disableSync: false, // If set to true, plugin will not sync blocks & txs
    disableTrace: false, // If set to true, plugin won't trace transaction
    workspace: undefined, // Set the workspace to use, will default to the default workspace (latest one used in the dashboard). It is also possible to set it through the ETHERNAL_WORKSPACE env variable
    uploadAst: true, // If set to true, plugin will upload AST, and you'll be able to use the storage feature (longer sync time though)
    disabled: false, // If set to true, the plugin will be disabled, nohting will be synced, ethernal.push won't do anything either
    resetOnStart: undefined, // Pass a workspace name to reset it automatically when restarting the node, note that if the workspace doesn't exist it won't error
  },
};
