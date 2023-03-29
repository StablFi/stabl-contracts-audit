// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { utils } = require("ethers");
const { ethers } = require('hardhat');
const erc20Abi = require("../../test/abi/erc20.json");
const addresses = require("../../utils/addresses");

const {
  cashUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  getOracleAddresses,
  isFork,
  usdcUnitsFormat,
  cashUnitsFormat,
  daiUnitsFormat,
  usdUnitsFormat,
} = require("../../test/helpers");
const { deployWithConfirmation } = require('../../utils/deploy');

async function upgradeVault(signer) {
  // Deploy a new vault core contract.
  const dVaultCore = await deployWithConfirmation("VaultCore");
  console.log("Deployed VaultCore");
  // Deploy a new vault admin contract.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
  console.log("Deployed VaultAdmin");

  const cVaultProxy = await ethers.getContractAt(
    "VaultProxy",
    "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF"
  );
  const cVaultCore = await ethers.getContract("VaultCore");
  const cVaultAdmin = await ethers.getContract("VaultAdmin");

  const cVaultCoreAtProxy = await ethers.getContractAt("VaultCore", cVaultProxy.address);

  await cVaultProxy.connect(signer).upgradeTo(cVaultCore.address);
  await cVaultCoreAtProxy.connect(signer).setAdminImpl(cVaultAdmin.address);
}
async function upgradeTetu(signer) {
  const upgradable = "TetuStrategy";
  // const toUpgrade = [
  //   "0x21a5683b28D732479958A16f32485ff8474138EC", // USDC
  //   "0xC87A68d140Dba5BEF1B4fa1acDb89FD4C2547d40", // USDT
  //   "0x0B76799f1Fe8859E03EE84E2AD8F7D8950b3a8d6", // DAI
  // ];
  const toUpgrade = [
    "0x9D7416C2Ce07CB7a71335fbcdE2f89A30B262064", // USDC
    "0x407889eD44bEe744907675d52ae4d996e8425be2", // USDT
    "0x58D85fAb1aE932244643E133e267b1952217E81a",  // DAI
  ];
  await deployWithConfirmation(upgradable);
  const USDC = await ethers.getContractAt("TetuStrategyUSDCProxy", toUpgrade[0]);
  const USDT = await ethers.getContractAt("TetuStrategyUSDTProxy", toUpgrade[1]);
  const DAI = await ethers.getContractAt("TetuStrategyDAIProxy", toUpgrade[2]);
  const implementation = await ethers.getContract(upgradable);
  await USDC.connect(signer).upgradeTo(implementation.address);
  await DAI.connect(signer).upgradeTo(implementation.address);
  await USDT.connect(signer).upgradeTo(implementation.address);

}
async function upgradeDripper(signer) {
  const upgradable = "Dripper";
  const toUpgrade = [
    "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1",
  ];
  await deployWithConfirmation(upgradable);
  const USDC = await ethers.getContractAt("DripperProxy", toUpgrade[0]);
  const implementation = await ethers.getContract(upgradable);
  await USDC.connect(signer).upgradeTo(implementation.address);

}

async function upgradeHarvester(signer) {
  const upgradable = "Harvester";
  const toUpgrade = [
    "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe",
  ];
  await deployWithConfirmation(upgradable);
  const USDC = await ethers.getContractAt("HarvesterProxy", toUpgrade[0]);
  const implementation = await ethers.getContract(upgradable);
  await USDC.connect(signer).upgradeTo(implementation.address);

}

async function main() {
  let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  let dai = await ethers.getContractAt(erc20Abi, addresses.polygon.DAI);
  let usdt = await ethers.getContractAt(erc20Abi, addresses.polygon.USDT);

  let staging = false;
  let cash = await hre.ethers.getContractAt("CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
  let vault = await hre.ethers.getContractAt("VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let vaultAdmin = await hre.ethers.getContractAt("VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let dripper = await hre.ethers.getContractAt("Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
  let harvester = await hre.ethers.getContractAt("Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");

  if (staging) {
    cash = await hre.ethers.getContractAt("CASH", "0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809");
    vault = await hre.ethers.getContractAt("VaultCore", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
    vaultAdmin = await hre.ethers.getContractAt("VaultAdmin", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
    dripper = await hre.ethers.getContractAt("Dripper", "0xe5FDf6f6EC63271d8ed1056891BE0998d9ad8fa9");
    harvester = await hre.ethers.getContractAt("Harvester", "0xb659Cbde75D7aaB10490c86170b50fb0364Bd573");
  }

  let governor = await vault.governor();
  // Impersonate as governor
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governor],
  });
  let signer = await ethers.provider.getSigner(governor);
  await upgradeVault(signer);
  await upgradeTetu(signer);
  await upgradeHarvester(signer);
  // await upgradeDripper(signer);

  let cashTotalSupply = await cash.totalSupply();
  let nav = await vault.nav();
  // Print block number
  console.log("Block number: ", await ethers.provider.getBlockNumber());
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  console.log("Vault.nav() : ", usdUnitsFormat(nav))
  console.log("Vault.price() : ", daiUnitsFormat(await vault.price()));
  console.log("Dripper USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(dripper.address)))
  console.log("Harvester USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(harvester.address)))
  console.log("Strategy count: ", (await vault.getStrategyCount()).toString())
  let allStrategies = await vault.getAllStrategies();
  let total = 0;
  for (let index = 0; index < allStrategies.length; index++) {
    const element = allStrategies[index];
    let strat = await hre.ethers.getContractAt("IStrategy", element);
    let balance = (await strat.checkBalance()).toString();
    total += parseInt(balance)
    let lpBalance = "NA";
    let nav = "NA";
    try {
      lpBalance = (await strat.lpBalance()).toString();
    } catch (error) {
    }
    try {
      nav = usdUnitsFormat(await strat.netAssetValue());
    } catch (error) {
    }
    console.log("Balance of ", element, ":", usdcUnitsFormat(await strat.checkBalance()), " - LP: ", lpBalance);
    console.log(" - NAV: ", nav);
    console.log(" - Stray USDC: ", usdcUnitsFormat(await usdc.balanceOf(element)));
    console.log(" - Stray USDT: ", usdcUnitsFormat(await usdt.balanceOf(element)));
    console.log(" - Stray DAI : ", daiUnitsFormat(await dai.balanceOf(element)));
  }
  console.log("Total Balance in Strategies: ", usdcUnitsFormat(total.toString()));
  let vaultBalance = await usdc.balanceOf(vault.address);
  console.log("Stray USDC in Vault: ", usdcUnitsFormat(vaultBalance.toString()));
  console.log("USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(vaultBalance) + total).toString()));
  console.log("NAV: ", usdUnitsFormat(await vault.nav()));
  console.log("CASH TS: ", cashUnitsFormat(await cash.totalSupply()));

  let original = await vault.checkBalance();

  console.log("Setting new weights");

  const weights = [{
    // strategy: "0x0B76799f1Fe8859E03EE84E2AD8F7D8950b3a8d6", // DAI
    strategy: "0x58D85fAb1aE932244643E133e267b1952217E81a", // DAI
    contract: "TetuStrategy",
    minWeight: 0,
    targetWeight: 30000,
    maxWeight: 100000,
    enabled: true,
    enabledReward: true,
  },
  {
    // strategy: "0xC87A68d140Dba5BEF1B4fa1acDb89FD4C2547d40", // USDT
    strategy: "0x407889eD44bEe744907675d52ae4d996e8425be2", // USDT
    contract: "TetuStrategy",
    minWeight: 0,
    targetWeight: 25000,
    maxWeight: 100000,
    enabled: true,
    enabledReward: true,
  },
  {
    // strategy: "0x21a5683b28D732479958A16f32485ff8474138EC", // USDC
    strategy: "0x9D7416C2Ce07CB7a71335fbcdE2f89A30B262064", // USDC
    contract: "TetuStrategy",
    minWeight: 0,
    targetWeight: 45000,
    maxWeight: 100000,
    enabled: true,
    enabledReward: true,
  }];

  await vaultAdmin.connect(signer).setStrategyWithWeights(weights);
  // console.log("New weights");
  const set_weights = {};
  let i = 0;
  while (true) {
    let strat;
    try {
      strat = await vault.strategyWithWeights(i);

    } catch {
      break;
    }
    set_weights[strat.strategy] = parseInt(strat.targetWeight.toString()) / 1000;
    i++;
  }

  console.log("Payout...")
  await vaultAdmin.connect(signer).setNextPayoutTime(Math.floor((new Date()).getTime() / 1000) - 1000);
  await vaultAdmin.connect(signer).payout();

  cashTotalSupply = await cash.totalSupply();
  nav = await vault.nav();
  // Print block number
  console.log("Block number: ", await ethers.provider.getBlockNumber());
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  console.log("Vault.nav() : ", usdUnitsFormat(nav))
  console.log("Vault.price() : ", daiUnitsFormat(await vault.price()));
  console.log("Dripper USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(dripper.address)))
  console.log("Harvester USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(harvester.address)))
  console.log("Strategy count: ", (await vault.getStrategyCount()).toString())
  allStrategies = await vault.getAllStrategies();
  total = 0;
  for (let index = 0; index < allStrategies.length; index++) {
    const element = allStrategies[index];
    let strat = await hre.ethers.getContractAt("IStrategy", element);
    let balance = (await strat.checkBalance()).toString();
    total += parseInt(balance)
    let lpBalance = "NA";
    try {
      lpBalance = (await strat.lpBalance()).toString();
    } catch (error) {
    }
    let nav = "NA";
    try {
      nav = usdUnitsFormat(await strat.netAssetValue());
    } catch (error) {
    }

    console.log("Balance of ", element, " [Weight:", (set_weights[element]) ? set_weights[element] : 0, " %] :", usdcUnitsFormat(await strat.checkBalance()), " - LP: ", lpBalance);
    console.log(" - NAV: ", nav);
    console.log(" - Stray USDC: ", usdcUnitsFormat(await usdc.balanceOf(element)));
    console.log(" - Stray USDT: ", usdcUnitsFormat(await usdt.balanceOf(element)));
    console.log(" - Stray DAI : ", daiUnitsFormat(await dai.balanceOf(element)));
  }
  console.log("Total Balance in Strategies: ", usdcUnitsFormat(total.toString()));
  vaultBalance = await usdc.balanceOf(vault.address);
  console.log("Stray USDC in Vault: ", usdcUnitsFormat(vaultBalance.toString()));
  console.log("USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(vaultBalance) + total).toString()));

  let later = await vault.checkBalance();
  console.log("Slippage: ", usdcUnitsFormat((parseInt(later) - parseInt(original)).toString()));
  console.log("NAV: ", usdUnitsFormat(await vault.nav()));
  console.log("CASH TS: ", cashUnitsFormat(await cash.totalSupply()));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
