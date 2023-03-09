const { utils } = require("ethers");
const { formatUnits } = utils;

const addresses = require("../utils/addresses");

async function allocate(taskArguments, hre) {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  console.log(
    "Sending a transaction to call allocate() on",
    vaultProxy.address
  );
  let transaction;
  transaction = await vault.connect(sDeployer).allocate();
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Allocate transaction confirmed");
}

async function rebalance(taskArguments, hre) {
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  console.log(
    "Sending a transaction to call rebalance() on",
    vaultProxy.address
  );
  let transaction;
  transaction = await vault.connect(sGovernor).balance();
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Rebalanace transaction confirmed");
}

async function harvest(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  if (isMainnet || isRinkeby) {
    throw new Error("The harvest task can not be used on mainnet or rinkeby");
  }
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  const harvesterProxy = await hre.ethers.getContract("HarvesterProxy");
  const harvester = await hre.ethers.getContractAt(
    "Harvester",
    harvesterProxy.address
  );
  let transaction;
  transaction = await harvester.connect(sGovernor)["harvest()"]();
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Harvest transaction confirmed");
}

async function harvestSupportStrategy(taskArguments, hre) {
  const { isMainnet, isRinkeby, isFork } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  if (isMainnet || isRinkeby) {
    throw new Error("The harvest task can not be used on mainnet or rinkeby");
  }
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  strategyAddress = taskArguments.strategy;
  console.log("Setting harvester to support", strategyAddress);

  const harvesterProxy = await hre.ethers.getContract("HarvesterProxy");
  const harvester = await hre.ethers.getContractAt(
    "Harvester",
    harvesterProxy.address
  );
  let transaction;
  transaction = await harvester
    .connect(sGovernor)
    ["setSupportedStrategy(address,bool)"](strategyAddress, true);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Harvest transaction confirmed");
}

async function removeStrategy(taskArguments, hre) {
  const { isMainnet, isRinkeby, isFork } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  if (isMainnet || isRinkeby) {
    throw new Error("The harvest task can not be used on mainnet or rinkeby");
  }
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  strategyAddress = taskArguments.strategy;
  console.log("Removing Strategy Support from the Vault", strategyAddress);

  const harvesterProxy = await hre.ethers.getContract("HarvesterProxy");
  const harvester = await hre.ethers.getContractAt(
    "Harvester",
    harvesterProxy.address
  );
  let transaction;
  transaction = await harvester
    .connect(sGovernor)
    ["setSupportedStrategy(address,bool)"](strategyAddress, false);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Harvester transaction confirmed");

  transaction = await vault
    .connect(sGovernor)
    ["removeStrategy(address)"](strategyAddress);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("Vault transaction confirmed");
}

async function rebase(taskArguments, hre) {
  const { withConfirmation } = require("../utils/deploy");

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt("VaultCore", vaultProxy.address);

  console.log("Sending a transaction to call rebase() on", vaultProxy.address);
  await withConfirmation(vault.connect(sDeployer).rebase());
  console.log("Rebase transaction confirmed");
}

/**
 * Artificially generate yield on the vault by sending it USDT.
 */
async function yield(taskArguments, hre) {
  const usdtAbi = require("../test/abi/usdt.json").abi;
  const {
    cashUnitsFormat,
    usdtUnits,
    usdtUnitsFormat,
    isFork,
    isLocalhost,
  } = require("../test/helpers");
  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  let richSigner, usdt;
  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    richSigner = await hre.ethers.provider.getSigner(addresses.mainnet.Binance);
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
  } else {
    const signers = await hre.ethers.getSigners();
    richSigner = signers;
    usdt = await hre.ethers.getContract("MockUSDT");
  }

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  const cashProxy = await ethers.getContract("CASHProxy");
  const cash = await ethers.getContractAt("CASH", cashProxy.address);

  console.log("Sending yield to vault");
  let usdtBalance = await usdt.balanceOf(vaultProxy.address);
  console.log("USDT vault balance", usdtUnitsFormat(usdtBalance));
  let vaultValue = await vault.totalValue();
  console.log("Vault value", cashUnitsFormat(vaultValue));
  let supply = await cash.totalSupply();
  console.log("CASH supply", cashUnitsFormat(supply));

  // Transfer 100k USDT to the vault.
  await usdt
    .connect(richSigner)
    .transfer(vaultProxy.address, usdtUnits("100000"));

  usdtBalance = await usdt.balanceOf(vaultProxy.address);
  console.log("USDT vault balance", usdtUnitsFormat(usdtBalance));
  vaultValue = await vault.totalValue();
  console.log("Vault value", cashUnitsFormat(vaultValue));
  supply = await cash.totalSupply();
  console.log("CASH supply", cashUnitsFormat(supply));
}

/**
 * Call the Vault's admin pauseCapital method.
 */
async function capital(taskArguments, hre) {
  const { isMainnet, isFork } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const param = taskArguments.pause.toLowerCase();
  if (param !== "true" && param !== "false")
    throw new Error("Set unpause param to true or false");
  const pause = param === "true";
  console.log("Setting Vault capitalPause to", pause);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await hre.ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await hre.ethers.getContract("VaultProxy");
  const cVault = await hre.ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );

  const propDescription = pause ? "Call pauseCapital" : "Call unpauseCapital";
  const signature = pause ? "pauseCapital()" : "unpauseCapital()";
  const propArgs = await proposeArgs([{ contract: cVault, signature }]);

  if (isMainnet) {
    // On Mainnet this has to be handled manually via a multi-sig tx.
    console.log("propose, enqueue and execute a governance proposal.");
    console.log(`Governor address: ${governorAddr}`);
    console.log(`Proposal [targets, values, sigs, datas]:`);
    console.log(JSON.stringify(propArgs, null, 2));
  } else if (isFork) {
    // On Fork, simulate the governance proposal and execution flow that takes place on Mainnet.
    await executeProposal(propArgs, propDescription);
  } else {
    if (pause) {
      cVault.connect(sGovernor).pauseCapital();
      console.log("Capital paused on vault.");
    } else {
      cVault.connect(sGovernor).unpauseCapital();
      console.log("Capital unpaused on vault.");
    }
  }
}

/**
 * Reallocate assets from one Strategy to another.
 */
async function reallocate(taskArguments, hre) {
  const { isFork, isMainnet, isRinkeby } = require("../test/helpers");
  const { formatUnits } = hre.ethers.utils;

  if (isMainnet || isRinkeby) {
    throw new Error("reallocate task can not be used on Mainnet or Rinkeby");
  }

  const { strategistAddr } = await getNamedAccounts();
  const sStrategist = hre.ethers.provider.getSigner(strategistAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  const allAssets = [
    {
      symbol: "DAI",
      address: addresses.mainnet.DAI,
      decimals: 18,
    },
    {
      symbol: "USDC",
      address: addresses.mainnet.USDC,
      decimals: 6,
    },
    {
      symbol: "USDT",
      address: addresses.mainnet.USDT,
      decimals: 6,
    },
  ];

  const assets = allAssets.filter((a) =>
    taskArguments.assets
      .split(",")
      .map((b) => b.toLowerCase())
      .includes(a.address.toLowerCase())
  );
  const amounts = taskArguments.amounts.split(",");

  const fromStrategy = await hre.ethers.getContractAt(
    "IStrategy",
    taskArguments.from
  );
  const toStrategy = await hre.ethers.getContractAt(
    "IStrategy",
    taskArguments.to
  );

  for (const asset of assets) {
    if (!(await fromStrategy.supportsAsset(asset.address))) {
      throw new Error(
        `From strategy ${taskArguments.from} does not support ${asset.address}`
      );
    }
    if (!(await toStrategy.supportsAsset(asset.address))) {
      throw new Error(
        `To strategy ${taskArguments.to} does not support ${asset.address}`
      );
    }
  }

  console.log(
    "Vault totalValue():\t",
    formatUnits((await vault.totalValue()).toString(), 18)
  );

  // Print balances before
  const printBalances = async (assets) => {
    for (const asset of assets) {
      if (await fromStrategy.supportsAsset(asset.address)) {
        const balanceFromRaw = await fromStrategy.checkBalance(asset.address);
        const balanceFrom = formatUnits(
          balanceFromRaw.toString(),
          asset.decimals
        );
        console.log(`From Strategy ${asset.symbol}:\t balance=${balanceFrom}`);
      }
    }
    for (const asset of assets) {
      if (await toStrategy.supportsAsset(asset.address)) {
        const balanceToRaw = await toStrategy.checkBalance(asset.address);
        const balanceTo = formatUnits(balanceToRaw.toString(), asset.decimals);
        console.log(`To Strategy ${asset.symbol}:\t balance=${balanceTo}`);
      }
    }
  };

  await printBalances(allAssets);

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    const binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: strategistAddr,
      value: utils.parseEther("100"),
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [strategistAddr],
    });
  }

  console.log("Reallocating assets...");

  await vault.connect(sStrategist).reallocate(
    taskArguments.from,
    taskArguments.to,
    assets.map((a) => a.address),
    amounts
  );

  console.log(
    "Vault totalValue():\t",
    formatUnits((await vault.totalValue()).toString(), 18)
  );

  await printBalances(allAssets);
}

async function payout(taskArguments, hre) {
  const { withConfirmation } = require("../utils/deploy");

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  // Print ether balance of govenor
  const balance = await sGovernor.getBalance();
  console.log("Governor balance:", hre.ethers.utils.formatEther(balance)); 

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  console.log("Sending a transaction to call payout() on", vaultProxy.address);
  await vault.connect(sGovernor).payout({
    // gasLimit: 24000000,
  });
  console.log("Payout transaction confirmed");
}

async function collectAndRebase(taskArguments, hre) {
  const { withConfirmation } = require("../utils/deploy");

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const dripperProxy = await hre.ethers.getContract("DripperProxy");
  const dripper = await hre.ethers.getContractAt(
    "Dripper",
    dripperProxy.address
  );

  console.log(
    "Sending a transaction to call collectAndRebase() on",
    dripperProxy.address
  );
  await withConfirmation(dripper.connect(sGovernor).collectAndRebase(), {
    gasLimit: 40000000,
  });
  console.log("collectAndRebase transaction confirmed");
}

async function setMaxSupplyDiff(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  percent = taskArguments.value;
  console.log("Setting MaxSupplyDiff to ", percent);
  if (!(isMainnet || isPolygonStaging)) {
    const prodGovernor = await vault.governor();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [prodGovernor],
    });
    sGovernor = await ethers.provider.getSigner(prodGovernor);
  }
  let transaction;
  // Diff  = 2246344070078799 = 0.22%
  // 0.05% =  500000000000000
  // 0.5%  = 5000000000000000
  // await vaultAdmin.connect(prodGovernorSigner).setMaxSupplyDiff("500000000000000");
  transaction = await vault
    .connect(sGovernor)
    ["setMaxSupplyDiff(uint256)"](percent);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("MaxSupplyDiff transaction confirmed");
}

async function setQuickDepositStrategy(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let allStrategies = await vault.getAllStrategies();

  strategyAddress = taskArguments.strategy;
  console.log("Setting Strategy as QuickDeposit: ", strategyAddress);
  if (!allStrategies.includes(strategyAddress)) {
    console.error("Strategy not approved: ", strategyAddress);
    return;
  } else {
    console.log("Strategy pre-approved. Continuing...");
  }

  let transaction;
  transaction = await vault
    .connect(sGovernor)
    ["setQuickDepositStrategies(address[])"]([strategyAddress]);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("QuickDeposit Strategy:  transaction confirmed");
}

async function setMintFeeBps(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let bps = taskArguments.value;
  console.log("Setting setMintFeeBps to ", bps / 100, "%");
  if (!(isMainnet || isPolygonStaging)) {
    const prodGovernor = await vault.governor();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [prodGovernor],
    });
    sGovernor = await ethers.provider.getSigner(prodGovernor);
  }
  let transaction;
  // Diff  = 2246344070078799 = 0.22%
  // 0.05% =  500000000000000
  // 0.5%  = 5000000000000000
  // await vaultAdmin.connect(prodGovernorSigner).setMaxSupplyDiff("500000000000000");
  transaction = await vault.connect(sGovernor)["setMintFeeBps(uint256)"](bps);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("setMintFeeBps transaction confirmed");
}
async function setRedeemFeeBps(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let bps = taskArguments.value;
  console.log("Setting setRedeemFeeBps to ", bps / 100, "%");
  if (!(isMainnet || isPolygonStaging)) {
    const prodGovernor = await vault.governor();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [prodGovernor],
    });
    sGovernor = await ethers.provider.getSigner(prodGovernor);
  }
  let transaction;
  transaction = await vault.connect(sGovernor)["setRedeemFeeBps(uint256)"](bps);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("setRedeemFeeBps transaction confirmed");
}

async function setFeeCollectors(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let labs = taskArguments.labs;
  let team = taskArguments.team;
  let treasury = taskArguments.treasury;
  console.log("Setting");
  console.log("Labs: ", labs);
  console.log("Team: ", team);
  console.log("Treasury: ", treasury);

  let transaction;
  transaction = await vault
    .connect(sGovernor)
    ["setFeeParams(address,address,address)"](labs, team, treasury);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("setFeeParams transaction confirmed");
}

async function setPerformanceFee(taskArguments, hre) {
  const {
    isMainnet,
    isRinkeby,
    isFork,
    isPolygonStaging,
  } = require("../test/helpers");
  const { executeProposal } = require("../utils/deploy");
  const { proposeArgs } = require("../utils/governor");

  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let labsBps = taskArguments.labsbps;
  let teamBps = taskArguments.teambps;
  console.log("Setting");
  console.log("Labs: ", labsBps / 100, "%");
  console.log("Team: ", teamBps / 100, "%");

  let transaction;
  transaction = await vault
    .connect(sGovernor)
    ["setHarvesterFeeParams(uint256,uint256)"](labsBps, teamBps);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("setFeeParams transaction confirmed");
}

async function withdrawAllFromStrategy(taskArguments, hre) {
  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let strategyAddress = taskArguments.strategy;

  let transaction;
  transaction = await vault
    .connect(sGovernor)
    ["withdrawAllFromStrategy(address)"](strategyAddress);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("withdrawAllFromStrategy transaction confirmed");
}

async function withdrawFromStrategy(taskArguments, hre) {
  const { governorAddr } = await getNamedAccounts();
  let sGovernor = hre.ethers.provider.getSigner(governorAddr);

  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );

  let strategyAddress = taskArguments.strategy;
  let amount = taskArguments.amount;

  let transaction;
  transaction = await vault
    .connect(sGovernor)
    ["withdrawFromStrategy(address,uint256)"](strategyAddress, amount);
  console.log("Sent. Transaction hash:", transaction.hash);
  console.log("Waiting for confirmation...");
  await hre.ethers.provider.waitForTransaction(transaction.hash);
  console.log("withdrawAllFromStrategy transaction confirmed");
}

module.exports = {
  allocate,
  capital,
  harvest,
  reallocate,
  rebalance,
  rebase,
  yield,
  payout,
  collectAndRebase,
  harvestSupportStrategy,
  removeStrategy,
  setMaxSupplyDiff,
  setQuickDepositStrategy,
  setMintFeeBps,
  setRedeemFeeBps,
  setFeeCollectors,
  setPerformanceFee,
  withdrawAllFromStrategy,
  withdrawFromStrategy
};
