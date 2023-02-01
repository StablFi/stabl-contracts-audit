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
async function main() {
    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let vaultAdmin = await hre.ethers.getContractAt( "VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt( "Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt( "Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
    let governor = await vault.governor()
    let cashWhale = "0x0b07cfdf4772cc7d6110621e9114ce527f41bb66";
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [governor],
    });
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [cashWhale],
    });
    const governorSigner = await ethers.provider.getSigner(governor);
    let cashWhaleSigner = await ethers.provider.getSigner(cashWhale);


    const whaleSigner = await ethers.provider.getSigner(whale);
    let cashTotalSupply = await cash.totalSupply();
    let vaultCheckBalance = await vault.checkBalance();
    // Print block number
    let blockNumber = await ethers.provider.getBlockNumber();
    console.log("Block number: ", blockNumber);
    console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
    console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
    console.log("Dripper USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(dripper.address)))
    console.log("Harvester USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(harvester.address)))
    console.log("Strategy count: ", (await vault.getStrategyCount()).toString())
    console.log("Current time: ",  new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) )
    console.log("Difference in Value & Supply : ", cashUnitsFormat(cashTotalSupply.sub( BigNumber.from(cashUnits(usdcUnitsFormat(vaultCheckBalance))))) )
    
    console.log("Redeeming 10000 CASH...")
    await vault.connect(cashWhaleSigner).redeem(cashUnits("10000"), "0")

    cashTotalSupply = await cash.totalSupply();
    vaultCheckBalance = await vault.checkBalance();
    blockNumber = await ethers.provider.getBlockNumber();
    console.log("Current time: ",  new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) )
    console.log("Block number: ", blockNumber);
    console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
    console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
    console.log("Difference in Value & Supply : ", cashUnitsFormat(cashTotalSupply.sub( BigNumber.from(cashUnits(usdcUnitsFormat(vaultCheckBalance))))) )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
