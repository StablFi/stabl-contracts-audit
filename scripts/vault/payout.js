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
  const toUpgrade = [
    "0x9D7416C2Ce07CB7a71335fbcdE2f89A30B262064",
    "0x407889eD44bEe744907675d52ae4d996e8425be2",
    "0x58D85fAb1aE932244643E133e267b1952217E81a",
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
    "0x4b2b1dC2ecc46551D88389f7F06ef2BEde77b4E1",
  ];
  await deployWithConfirmation(upgradable);
  const USDC = await ethers.getContractAt("DripperProxy", toUpgrade[0]);
  const implementation = await ethers.getContract(upgradable);
  await USDC.connect(signer).upgradeTo(implementation.address);

}


async function main() {
  let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  let cash = await hre.ethers.getContractAt("CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
  let vault = await hre.ethers.getContractAt("VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let vaultAdmin = await hre.ethers.getContractAt("VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let dripper = await hre.ethers.getContractAt("Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
  let harvester = await hre.ethers.getContractAt("Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
  let governor = await vault.governor();
  // Impersonate as governor
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governor],
  });
  let signer = await ethers.provider.getSigner(governor);
  await upgradeVault(signer);
  await upgradeTetu(signer);
  await upgradeDripper(signer);

  let cashTotalSupply = await cash.totalSupply();
  let vaultCheckBalance = await vault.checkBalance();
  // Print block number
  console.log("Block number: ", await ethers.provider.getBlockNumber());
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
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
    try {
      lpBalance = (await strat.lpBalance()).toString();
    } catch (error) {
    }
    console.log("Balance of ", element, ":", usdcUnitsFormat(await strat.checkBalance()), " - LP: ", lpBalance);
  }
  console.log("Total Balance in Strategies: ", usdcUnitsFormat(total.toString()));
  let vaultBalance = await usdc.balanceOf(vault.address);
  console.log("Stray USDC in Vault: ", usdcUnitsFormat(vaultBalance.toString()));
  console.log("USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(vaultBalance) + total).toString()));

  let original = await vault.checkBalance();

  console.log("Setting new weights");

  const weights = [{
    strategy: "0x58D85fAb1aE932244643E133e267b1952217E81a",
    contract: "TetuStrategy",
    minWeight: 0,
    targetWeight: 30000,
    maxWeight: 100000,
    enabled: true,
    enabledReward: true,
  },
  {
    strategy: "0x407889eD44bEe744907675d52ae4d996e8425be2",
    contract: "TetuStrategy",
    minWeight: 0,
    targetWeight: 45000,
    maxWeight: 100000,
    enabled: true,
    enabledReward: true,
  },
  {
    strategy: "0x9D7416C2Ce07CB7a71335fbcdE2f89A30B262064",
    contract: "TetuStrategy",
    minWeight: 0,
    targetWeight: 25000,
    maxWeight: 100000,
    enabled: true,
    enabledReward: true,
  }];

  await vaultAdmin.connect(signer).setStrategyWithWeights(weights);
  console.log("New weights");
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
  await vaultAdmin.connect(signer).balance();

  cashTotalSupply = await cash.totalSupply();
  vaultCheckBalance = await vault.checkBalance();
  // Print block number
  console.log("Block number: ", await ethers.provider.getBlockNumber());
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
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

    console.log("Balance of ", element, " [Weight:", (set_weights[element]) ? set_weights[element] : 0, " %] :", usdcUnitsFormat(await strat.checkBalance()), " - LP: ", lpBalance, " - Stray: ", usdcUnitsFormat(await usdc.balanceOf(element)));
  }
  console.log("Total Balance in Strategies: ", usdcUnitsFormat(total.toString()));
  vaultBalance = await usdc.balanceOf(vault.address);
  console.log("Stray USDC in Vault: ", usdcUnitsFormat(vaultBalance.toString()));
  console.log("USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(vaultBalance) + total).toString()));

  let later = await vault.checkBalance();
  console.log("Slippage: ", usdcUnitsFormat((parseInt(later) - parseInt(original)).toString()));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
