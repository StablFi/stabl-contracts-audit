// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { utils, BigNumber } = require("ethers");
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
  advanceTime,
  usdUnitsFormat,
} = require("../../test/helpers");
const { deployWithConfirmation } = require('../../utils/deploy');

const whale = "0xF977814e90dA44bFA03b6295A0616a897441aceC" // Make sure address have USDC & MATIC  both
const mintUSDC = async (recipiet, amount) => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whale],
  });
  const whaleSigner = await ethers.provider.getSigner(whale);
  usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  await usdc
    .connect(whaleSigner)
    .transfer(recipiet, amount);
}
async function upgradeVault(signer) {
  // Deploy a new vault core contract.
  const dVaultCore = await deployWithConfirmation("VaultCore");
  console.log("Deployed VaultCore");
  // Deploy a new vault admin contract.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
  console.log("Deployed VaultAdmin");

  const cVaultProxy = await ethers.getContractAt(
    "VaultProxy",
    "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E"
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
    "0x21a5683b28D732479958A16f32485ff8474138EC",
    "0xC87A68d140Dba5BEF1B4fa1acDb89FD4C2547d40",
    "0x0B76799f1Fe8859E03EE84E2AD8F7D8950b3a8d6",
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
  let staging = true;
  let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  let cash = await hre.ethers.getContractAt("CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
  let vault = await hre.ethers.getContractAt("VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let vaultAdmin = await hre.ethers.getContractAt("VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let dripper = await hre.ethers.getContractAt("Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
  let harvester = await hre.ethers.getContractAt("Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
  let cashWhale = "0x0b07cfdf4772cc7d6110621e9114ce527f41bb66";

  if (staging) {
    cash = await hre.ethers.getContractAt("CASH", "0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809");
    vault = await hre.ethers.getContractAt("VaultCore", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
    dripper = await hre.ethers.getContractAt("Dripper", "0xe5FDf6f6EC63271d8ed1056891BE0998d9ad8fa9");
    harvester = await hre.ethers.getContractAt("Harvester", "0xb659Cbde75D7aaB10490c86170b50fb0364Bd573");
    cashWhale = "0xa46df52e5349a87141cf48d5806a97a774be4d74";
  }
  let governor = await vault.governor()
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governor],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [cashWhale],
  });
  const governorSigner = await ethers.provider.getSigner(governor);

  await upgradeVault(governorSigner);
  await upgradeTetu(governorSigner);

  let cashWhaleSigner = await ethers.provider.getSigner(cashWhale);

  const whaleSigner = await ethers.provider.getSigner(whale);
  let cashTotalSupply = await cash.totalSupply();
  let vaultCheckBalance = await vault.checkBalance();
  let nav = await vault.nav();
  // Print block number
  let blockNumber = await ethers.provider.getBlockNumber();
  console.log("Block number: ", blockNumber);
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
  console.log("Vault.nav() : ", usdUnitsFormat(nav))
  console.log("Dripper USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(dripper.address)))
  console.log("Harvester USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(harvester.address)))
  console.log("Strategy count: ", (await vault.getStrategyCount()).toString())
  console.log("Current time: ", new Date((await ethers.provider.getBlock(blockNumber)).timestamp * 1000))
  console.log("Difference in Value & Supply : ", cashUnitsFormat(cashTotalSupply.sub(BigNumber.from(cashUnits(usdcUnitsFormat(vaultCheckBalance))))))
  console.log("CASH Balance of cashWhale: ", cashUnitsFormat(await cash.balanceOf(cashWhale)))

  console.log("Redeeming 100 CASH...")
  await vault.connect(cashWhaleSigner).redeem(cashUnits("100"), "0")

  cashTotalSupply = await cash.totalSupply();
  vaultCheckBalance = await vault.checkBalance();
  blockNumber = await ethers.provider.getBlockNumber();
  nav = await vault.nav();
  console.log("Current time: ", new Date((await ethers.provider.getBlock(blockNumber)).timestamp * 1000))
  console.log("Block number: ", blockNumber);
  console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
  console.log("Vault.nav() : ", usdUnitsFormat(nav))
  console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
  console.log("Difference in Value & Supply : ", cashUnitsFormat(cashTotalSupply.sub(BigNumber.from(cashUnits(usdcUnitsFormat(vaultCheckBalance))))))
  console.log("CASH Balance of cashWhale: ", cashUnitsFormat(await cash.balanceOf(cashWhale)))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
