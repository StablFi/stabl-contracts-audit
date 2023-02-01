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
    runStrategyLogic,
  } = require("../../test/helpers");

async function main() {
    let vaultProxy = await ethers.getContract("VaultProxy");
    let vault = await ethers.getContractAt("VaultCore", vaultProxy.address);

    let governor = await vault.governor();
    // Impersonate governor
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [governor],
    });
    governorSigner = await ethers.provider.getSigner(governor);
    let tetu = {
        "TetuStrategyUSDC" : (await ethers.getContractAt("TetuStrategy", (await ethers.getContract("TetuStrategyUSDCProxy")).address )).address,
        "TetuStrategyUSDT" : (await ethers.getContractAt("TetuStrategy", (await ethers.getContract("TetuStrategyUSDTProxy")).address )).address,
        "TetuStrategyDAI" : (await ethers.getContractAt("TetuStrategy", (await ethers.getContract("TetuStrategyDAIProxy")).address )).address,
    }
    // Loop for all strategies
    for (const [key, value] of Object.entries(tetu)) {
        console.log("Strategy: ", key, " address: ", value);
        await runStrategyLogic(governorSigner, "Tetu Strategy",value )
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
