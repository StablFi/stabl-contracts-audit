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
    deploymentWithProposal,
    withConfirmation,
    deployWithConfirmation,
  } = require("../../utils/deploy");
  
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
  } = require("../../test/helpers");

async function main() {
    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let vaultAdmin = await hre.ethers.getContractAt( "VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt( "Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt( "Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
    let cashTotalSupply = await cash.totalSupply();
    let vaultCheckBalance = await vault.checkBalance();
    const prodGovernor = await vault.governor();
    let cashWhale = "0x826b8d2d523e7af40888754e3de64348c00b99f4"
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [prodGovernor],
    });
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [cashWhale],
    });
    const prodGovernorSigner = await ethers.provider.getSigner(prodGovernor);
    const cashWhaleSigner = await ethers.provider.getSigner(cashWhale);

    // Print block number
    console.log("Block number: ", await ethers.provider.getBlockNumber());
    console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
    console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
    console.log("Vault.maxSupplyDiff() : ", daiUnitsFormat(await vault.maxSupplyDiff()))
    console.log("Governor: ", prodGovernor)
    console.log("Governor's CASH: ", cashUnitsFormat(await cash.balanceOf(prodGovernor)))
    // console.log("Set Max Supply Diff to 0.5...")
    // Diff  = 2246344070078799 = 0.22%
    // 0.05% =  500000000000000
    // 0.5%  = 5000000000000000
    await vaultAdmin.connect(prodGovernorSigner).setMaxSupplyDiff("5000000000000000");
    await upgradeVault(prodGovernorSigner)
    console.log("Vault.maxSupplyDiff() : ", daiUnitsFormat(await vault.maxSupplyDiff()))
    console.log("Redeeming 1 CASH")
    await vault.connect(cashWhaleSigner).redeem(cashUnits("1"), "0");
    console.log("1 CASH redeemed")

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
    
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
