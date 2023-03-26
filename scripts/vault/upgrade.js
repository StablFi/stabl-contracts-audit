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


const provider = ethers.getDefaultProvider("https://internal-rpc.stabl.fi");

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
  const cVaultAdminAtProxy = await ethers.getContractAt("VaultAdmin", cVaultProxy.address);

  await cVaultProxy.connect(signer).upgradeTo(cVaultCore.address);
  await cVaultCoreAtProxy.connect(signer).setAdminImpl(cVaultAdmin.address);
  await cVaultAdminAtProxy.connect(signer).setDepegParams(true,100);
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
  let signer = await provider.getSigner(governor);
  await upgradeVault(signer);
  await upgradeTetu(signer);
  // await upgradeDripper(signer);
  // await upgradeHarvester(signer);

  // await vaultAdmin.connect(signer).addRebaseManager("0xE1E2a51292a094aaF6Dc0485e1D0C93b44f569Ba");
 
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
