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

async function main() {
    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt( "Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt( "Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
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
      let strat = await hre.ethers.getContractAt( "IStrategy", element);
      let balance = (await strat.checkBalance()).toString();
      total += parseInt(balance)
      let lpBalance = "NA";
      try {
        lpBalance = (await strat.lpBalance()).toString();
      } catch(error) {
      }
      console.log("Balance of ", element, ":", usdcUnitsFormat(await strat.checkBalance()), " - LP: ", lpBalance, " - Stray: ", usdcUnitsFormat(await usdc.balanceOf(element)));
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
