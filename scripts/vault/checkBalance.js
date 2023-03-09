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

async function main() {
  const staging = false;

  let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  let cash = await hre.ethers.getContractAt("CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
  let vault = await hre.ethers.getContractAt("VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let dripper = await hre.ethers.getContractAt("Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
  let harvester = await hre.ethers.getContractAt("Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
  
  
  if (staging) {
    cash = await hre.ethers.getContractAt("CASH", "0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809");
    vault = await hre.ethers.getContractAt("VaultCore", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
    dripper = await hre.ethers.getContractAt("Dripper", "0xe5FDf6f6EC63271d8ed1056891BE0998d9ad8fa9");
    harvester = await hre.ethers.getContractAt("Harvester", "0xb659Cbde75D7aaB10490c86170b50fb0364Bd573");
  }


  let governor = await vault.governor();
  console.log("Governor:", governor)

  // if (hre.network.name === "hardhat") {
  //   // Impersonate as governor
  //   await hre.network.provider.request({
  //     method: "hardhat_impersonateAccount",
  //     params: [governor],
  //   });
  //   let signer = await ethers.provider.getSigner(governor);
  //   await upgradeVault(signer);
  //   await upgradeTetu(signer);
  // }



  // Print block number
  console.log("Block number: ", await ethers.provider.getBlockNumber());
  let cashTotalSupply = await cash.totalSupply();
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  let vaultCheckBalance = await vault.checkBalance();
  console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
  // let vaultNetAssetValue = await vault.nav();
  // console.log("Vault.netAssetValue() : ", usdcUnitsFormat(vaultNetAssetValue))
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

    let nav = "NA";
    try {
      nav = (await strat.netAssetValue()).toString();
    } catch (error) {
    }
    console.log("Balance of ", element, ":", usdcUnitsFormat(await strat.checkBalance()), " - LP: ", lpBalance, " - NAV: ", nav, " - Stray: ", usdcUnitsFormat(await usdc.balanceOf(element)));
  }
  console.log("Total Balance in Strategies: ", usdcUnitsFormat(total.toString()));
  let vaultBalance = await usdc.balanceOf(vault.address);
  console.log("Stray USDC in Vault: ", usdcUnitsFormat(vaultBalance.toString()));
  console.log("USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(vaultBalance) + total).toString()));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
