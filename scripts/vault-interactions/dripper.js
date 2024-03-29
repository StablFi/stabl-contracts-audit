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
    advanceTime,
    advanceBlocks,
  } = require("../../test/helpers");

const whale = "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245" // Make sure address have USDC & MATIC  both
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
const toUTC = (date) => {
    return new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
}
async function main() {
    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let vaultAdmin = await hre.ethers.getContractAt( "VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt( "Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt( "Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
    let governor = await vault.governor()
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [governor],
    });
    const governorSigner = await ethers.provider.getSigner(governor);

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
    console.log("Current time: ",  toUTC(new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000)) )
    await dripper.connect(governorSigner).setDripDuration(7*24*60*60)
    await mintUSDC("0x930D1F949631FC8aAEBAf174e286a3ECf5093C46", usdcUnits("100000"));
    console.log("Dripper USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf("0x930D1F949631FC8aAEBAf174e286a3ECf5093C46")))
    return;

    console.log("Starting simulation")
    let total = 0;
    let dateJson = {};
    // Deposit 2 USDC each hours in dripper
    while(total < 200) {
        total += 50;
        // Print current utc time
        console.log("--------------------------------------------------")
        let blockNumber = await ethers.provider.getBlockNumber();
        console.log("Block number: ", blockNumber);
        console.log("Current time (UTC): ",  toUTC(new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000)) )

        console.log("Transferring 50 USDC to dripper");
        await usdc.connect(governorSigner).transfer(dripper.address, usdcUnits("50"));
        console.log("Time travel to 24 hour")
        await advanceBlocks(42000);
        console.log("Now time: ",  toUTC(new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000)) )
        const currentNodeTime = toUTC(new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000));
        // Calculate time difference for 9 AM next day
        const nextDay = new Date(currentNodeTime);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(9, 0, 0, 0);
        const timeDiff = nextDay.getTime() - currentNodeTime.getTime();
        console.log("Time difference: ", timeDiff/1000/60/60, " hours")

        console.log("Time travel to 9 AM next day")
        await advanceTime(timeDiff/1000);
        console.log("After moving, now time: ",  new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) )

        _beforeDripperUsdcBalance = await usdc.balanceOf(dripper.address);
        console.log("Dripper.collectAndRebase()");
        await  dripper.connect(governorSigner).collectAndRebase();
        _afterDripperUsdcBalance = await usdc.balanceOf(dripper.address);
        console.log("Dripper USDC Balance: ", usdcUnitsFormat(_beforeDripperUsdcBalance), " -> ", usdcUnitsFormat(_afterDripperUsdcBalance))
        console.log("Sent to vault from dripper: ", usdcUnitsFormat(_beforeDripperUsdcBalance.sub(_afterDripperUsdcBalance)))

        console.log("Rebase State: ", (await cash.rebaseState(governor)).toString())
        console.log("Non-rebasing supply: ", (await cash.nonRebasingSupply()).toString())
        console.log("Rebasing credits: ", (await cash.rebasingCreditsHighres()).toString())
        console.log("Rebasing credits per token: ", (await cash.rebasingCreditsPerTokenHighres()).toString())

        // Increment the transfer for today in the dateJson
        let date = new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) ;
        let dateString = date.toDateString();
        if (dateJson[dateString] == undefined) {
            dateJson[dateString] = 0;
        }
        dateJson[dateString] += parseInt(usdcUnitsFormat(_beforeDripperUsdcBalance.sub(_afterDripperUsdcBalance)));
    }

    console.table(dateJson);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
