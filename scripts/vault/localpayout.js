// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { utils } = require("ethers");
const { ethers, getNamedAccounts, deployments } = require('hardhat');
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
    runStrategyLogic,
    advanceTime,
    getAssetAddresses,
    advanceBlocks,
  } = require("../../test/helpers");
const { withConfirmation } = require('../../utils/deploy');

async function main() {
    const { governorAddr } = await getNamedAccounts();
    // Signers
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    let vaultProxy = await ethers.getContract("VaultProxy");
    let vault = await ethers.getContractAt("VaultCore", vaultProxy.address);
    let vaultAdmin = await ethers.getContractAt("VaultAdmin", vaultProxy.address);
    let cashProxy = await hre.ethers.getContract("CASHProxy");
    let cash = await hre.ethers.getContractAt("CASH", cashProxy.address);

    let cashTotalSupply = await cash.totalSupply();
    let vaultCheckBalance = await vault.checkBalance();
    let vaultNetAssetValue = await vault.nav();
    const assetAddresses = await getAssetAddresses(deployments);

    await withConfirmation(
        vaultAdmin.connect(sGovernor).setHarvesterFeeParams(assetAddresses.LabsFeeBps, assetAddresses.TeamFeeBps)
    );



    console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
    console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
    console.log("Vault.netAssetValue() : ", usdcUnitsFormat(vaultNetAssetValue))

    // Cash balance of account 1
    let cashBalance = await cash.balanceOf("0xF714CA07AFdFa512Da7b18B1A1587738c9230BEb");
    console.log("CASH.balanceOf(accounts[1]) : ", cashUnitsFormat(cashBalance))
    cashBalance = await cash.balanceOf("0xA4144e5E5F0E90fc0fc67cC9C517Af402ad75461");
    console.log("CASH.balanceOf(accounts[2]) : ", cashUnitsFormat(cashBalance))

    let governor = await vault.governor();
    // Impersonate governor
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [governor],
    });
    governorSigner = await ethers.provider.getSigner(governor);

    console.log("Time travel for 30 days");
    await advanceTime(24*60*60*10);
    await advanceBlocks(42000);

    console.log("Payout: ")
    await vaultAdmin.payout();

    cashTotalSupply = await cash.totalSupply();
    vaultCheckBalance = await vault.checkBalance();
    vaultNetAssetValue = await vault.nav();

    console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
    console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
    console.log("Vault.netAssetValue() : ", usdcUnitsFormat(vaultNetAssetValue))
    
    cashBalance = await cash.balanceOf("0xF714CA07AFdFa512Da7b18B1A1587738c9230BEb");
    console.log("CASH.balanceOf(accounts[1]) : ", cashUnitsFormat(cashBalance))
    cashBalance = await cash.balanceOf("0xA4144e5E5F0E90fc0fc67cC9C517Af402ad75461");
    console.log("CASH.balanceOf(accounts[2]) : ", cashUnitsFormat(cashBalance))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
