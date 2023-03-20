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
} = require("../../test/helpers");
const { deployWithConfirmation } = require('../../utils/deploy');

const provider = ethers.provider;
const whale = "0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245" // Make sure address have USDC & MATIC  both
const mintUSDC = async (recipiet, amount) => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whale],
  });
  const whaleSigner = await provider.getSigner(whale);
  usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  await usdc
    .connect(whaleSigner)
    .transfer(recipiet, amount);
}
async function upgradeCASH(signer) {
  const dCASH = await deployWithConfirmation("CASH");
  console.log("Deployed CASH");

  const cCASHProxy = await ethers.getContractAt(
      "CASHProxy",
      "0x80487b4f8f70e793A81a42367c225ee0B94315DF"
  );
  const cCASH = await ethers.getContract("CASH");
  await cCASHProxy.connect(signer).upgradeTo(cCASH.address);
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
  let staging = false;

  let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  let cash = await hre.ethers.getContractAt("CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
  let vault = await hre.ethers.getContractAt("VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let vaultAdmin = await hre.ethers.getContractAt("VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
  let dripper = await hre.ethers.getContractAt("Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
  let harvester = await hre.ethers.getContractAt("Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");

  if (staging) {
    cash = await hre.ethers.getContractAt("CASH", "0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809");
    vault = await hre.ethers.getContractAt("VaultCore", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
    dripper = await hre.ethers.getContractAt("Dripper", "0xe5FDf6f6EC63271d8ed1056891BE0998d9ad8fa9");
    harvester = await hre.ethers.getContractAt("Harvester", "0xb659Cbde75D7aaB10490c86170b50fb0364Bd573");
  }
  let governor = await vault.governor()

  const minter = "0x930D1F949631FC8aAEBAf174e286a3ECf5093C46";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [minter],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governor],
  });
  const governorSigner = await provider.getSigner(governor);
  const minterSigner = await provider.getSigner(minter);
  await network.provider.send("hardhat_setBalance", [minter, "0x90000000000000000"]);

  // await mintUSDC(minter, usdcUnits("100000"));
  const fs = require('fs');
  const accounts = fs.readFileSync('./scripts/vault/accounts.csv', 'utf8').split('\n')
  await upgradeCASH(governorSigner)

  // await cash.mint(minter, cashUnits("1000"));

  for (let i = 0; i < accounts.length; i=i+100) {
    console.log("Burn 1000 CASH...", accounts[i].trim())
    await cash.burn(accounts[i].trim(), cashUnits("1000"));
  }
  // await usdc.connect(minterSigner).approve(vault.address, usdcUnits("100000"))
  // await vault.connect(minterSigner).mint(usdc.address, usdcUnits("100"), "0")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
