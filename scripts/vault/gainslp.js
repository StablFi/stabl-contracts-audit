// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { utils } = require("ethers");
const { ethers } = require('hardhat');
const erc20Abi = require("../../test/abi/erc20.json");
const gainsVaultAbi = require("../../test/abi/gainsVault.json");
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
  } = require("../../test/helpers");

async function main() {
    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt( "Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt( "Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
    
    let gainsStrategy = "0xbC69EB87c3C7772B1Fbc1c174f57669Fbb673858";
    let gainsStrat = await hre.ethers.getContractAt("GainsStrategy",gainsStrategy);
    let gainsVault = await hre.ethers.getContractAt(gainsVaultAbi, "0xd7052ec0fe1fe25b20b7d65f6f3d490fce58804f");

    console.log("GainsVault.daiDeposited()", daiUnitsFormat((await gainsVault.users(gainsStrategy))["daiDeposited"]));
    console.log("GainsVault.maxDaiDeposited()", daiUnitsFormat((await gainsVault.users(gainsStrategy))["maxDaiDeposited"]));
    console.log("GainsVault.withdrawBlock()", ((await gainsVault.users(gainsStrategy))["withdrawBlock"]).toString());
    console.log("GainsVault.debtDai()", daiUnitsFormat((await gainsVault.users(gainsStrategy))["debtDai"]));
    console.log("GainsVault.debtMatic()", daiUnitsFormat((await gainsVault.users(gainsStrategy))["debtMatic"]));
    console.log("GainsStrategy.checkBalance()", usdcUnitsFormat(await gainsStrat.checkBalance()));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
