const ethers = require("ethers");

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
require("solidity-coverage");
require("@openzeppelin/hardhat-upgrades");

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
  collectAndRebase
} = require("./tasks/vault");

const MAINNET_DEPLOYER = "0x442bB41E499bB21aFc6a42327C9E257a7d09872e";
// Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x442bB41E499bB21aFc6a42327C9E257a7d09872e";
// Multi-sig that controls the Governor. Aka "Guardian".
const MAINNET_MULTISIG = "0x442bB41E499bB21aFc6a42327C9E257a7d09872e";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;
const MAINNET_STRATEGIST = "0x442bB41E499bB21aFc6a42327C9E257a7d09872e";

const mnemonic =
  "about dismiss pony claim little cradle wild force fun meat awkward make";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

// Environment tasks.
task("env", "Check env vars are properly set for a Mainnet deployment", env);

// Account tasks.
task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});
task("fund", "Fund accounts on local or fork")
  .addOptionalParam("num", "Number of accounts to fund")
  .addOptionalParam("index", "Account start index")
  .addOptionalParam("amount", "Stable coin amount to fund each account with")
  .addOptionalParam(
    "accountsfromenv",
    "Fund accounts from the .env file instead of mnemonic"
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
task("collectAndRebase", "Call collectAndRebase() on the Dripper", collectAndRebase);
task("yield", "Artificially generate yield on the Vault", yield);
task("reallocate", "Allocate assets from one Strategy to another")
  .addParam("from", "Address to withdraw asset from")
  .addParam("to", "Address to deposit asset to")
  .addParam("assets", "Address of asset to reallocate")
  .addParam("amounts", "Amount of asset to reallocate")
  .setAction(reallocate);

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
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: 1337,
      initialBaseFeePerGas: 0,
      
      timeout: 30*200000,

    },
    localhost: {
      timeout: 30*200000,
    },
    rinkeby: {
      url: `${process.env.RINKERBY_PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
      chainId: 4
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        privateKeys[1],
        privateKeys[2],
      ],
      // gas: 24500000,
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
    timeout: 30*200000,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: 0,
      mainnet: MAINNET_DEPLOYER,
    },
    governorAddr: {
      default: 0,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost: process.env.FORK === "true" ? MAINNET_GOVERNOR : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_GOVERNOR : 0,
      mainnet: MAINNET_GOVERNOR,
    },
    guardianAddr: {
      default: 0,
      // On mainnet and fork, the guardian is the multi-sig.
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_MULTISIG : 0,
      mainnet: MAINNET_MULTISIG,
    },
    adjusterAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      mainnet: MAINNET_CLAIM_ADJUSTER,
    },
    strategistAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_STRATEGIST : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_STRATEGIST : 0,
      mainnet: MAINNET_STRATEGIST,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: {
      rinkeby: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGON_API_KEY
    },
    customChains: [
      {
        network: "rinkeby",
        chainId: 4,
        urls: {
          apiURL: "https://api-rinkeby.etherscan.io/api",
          browserURL: "https://rinkeby.etherscan.io"
        }
      },
      {
        network: "mainnet",
        chainId: 4,
        urls: {
          apiURL: "https://api.polygonscan.com/",
          browserURL: "https://polygonscan.com"
        }
      }
    ]
  },
  ethernal: {
    disableSync: false, // If set to true, plugin will not sync blocks & txs
    disableTrace: false, // If set to true, plugin won't trace transaction
    workspace: undefined, // Set the workspace to use, will default to the default workspace (latest one used in the dashboard). It is also possible to set it through the ETHERNAL_WORKSPACE env variable
    uploadAst: true, // If set to true, plugin will upload AST, and you'll be able to use the storage feature (longer sync time though)
    disabled: false, // If set to true, the plugin will be disabled, nohting will be synced, ethernal.push won't do anything either
    resetOnStart: undefined // Pass a workspace name to reset it automatically when restarting the node, note that if the workspace doesn't exist it won't error
}
};
