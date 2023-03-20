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
const { deployWithConfirmation } = require('../../utils/deploy');


const whale = "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245" // Make sure address have USDC & MATIC  both
const mintUSDC = async (recipiet, amount) => {
      await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [whale],
      });
      console.log("Impersonated WHALE", whale)
      const provider = ethers.getDefaultProvider("https://internal-rpc.stabl.fi");
      const whaleSigner = await provider.getSigner(whale);
      usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
      await usdc
          .connect(whaleSigner)
          .transfer(recipiet, amount);
}
async function upgradeCASH(signer, cashProxy) {
  const upgradable = "CASH";
  const toUpgrade = [
    cashProxy
  ];
  const implementation = await deployWithConfirmation(upgradable);
  const PROXY = await ethers.getContractAt("CASHProxy", toUpgrade[0]);
  await PROXY.connect(signer).upgradeTo(implementation.address);

}
async function upgradeRebaseHandler(signer, proxy) {
  const upgradable = "RebaseToNonEoaHandler";
  const toUpgrade = [
    proxy
  ];
  const implementation = await deployWithConfirmation(upgradable);
  const PROXY = await ethers.getContractAt("RebaseToNonEoaHandlerProxy", toUpgrade[0]);
  await PROXY.connect(signer).upgradeTo(implementation.address);

}
async function main() {
    const staging = true;
    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let vaultAdmin = await hre.ethers.getContractAt( "VaultAdmin", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt( "Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt( "Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");
    if (staging) {
      cash = await hre.ethers.getContractAt( "CASH", "0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809");
      vault = await hre.ethers.getContractAt( "VaultCore", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
      vaultAdmin = await hre.ethers.getContractAt( "VaultAdmin", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
      dripper = await hre.ethers.getContractAt( "Dripper", "0xe5FDf6f6EC63271d8ed1056891BE0998d9ad8fa9");
      harvester = await hre.ethers.getContractAt( "Harvester", "0xb659Cbde75D7aaB10490c86170b50fb0364Bd573");
    }
    let governor = await vault.governor()
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governor],
    });
    const governorSigner = await ethers.provider.getSigner(governor);
    // await upgradeCASH(governorSigner, cash.address);
    // await upgradeRebaseHandler(governorSigner,  await vault.rebaseHandler());

    let cashTotalSupply = await cash.totalSupply();
    let vaultCheckBalance = await vault.checkBalance();
    let vaultNav = await vault.nav();
    // Print block number
    let blockNumber = await ethers.provider.getBlockNumber();
    console.log("Block number: ", blockNumber);
    console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
    console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
    console.log("Vault.nav() : ", usdcUnitsFormat(vaultNav))
    console.log("Dripper USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(dripper.address)))
    console.log("Harvester USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(harvester.address)))
    console.log("Strategy count: ", (await vault.getStrategyCount()).toString())
    console.log("Current time: ",  new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) )
    await network.provider.send("hardhat_setBalance", [governor, "0x90000000000000000"]);
    await dripper.connect(governorSigner).setDripDuration(7*24*60*60)
    await mintUSDC(governor, usdcUnits("100000"));
    let total = 0;
    let dateJson = {};
    // Deposit 2 USDC each hours in dripper
    while(total < 1) {
        total += 10;
        // Print current utc time
        console.log("--------------------------------------------------")
        let blockNumber = await ethers.provider.getBlockNumber();
        console.log("Block number: ", blockNumber);
        console.log("Current time: ",  new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) )
        let cashBalance = await cash.balanceOf(governor);
        console.log("Governor CASH Balance: ", cashUnitsFormat(cashBalance));
        console.log("Transferring 100 USDC to vault");
        await usdc.connect(governorSigner).transfer(vault.address, usdcUnits("100"));
        console.log("Vault.rebase()");
        await  vault.connect(governorSigner).rebase();
        // console.log("Time travel to 6 hour")
        // await advanceTime(6*60*60)
        // await advanceBlocks(42000/4);

        let cashTotalSupply = await cash.totalSupply();
        let vaultCheckBalance = await vault.checkBalance();
        let vaultNav = await vault.nav();
        cashBalance = await cash.balanceOf(governor);
        console.log("Governor CASH Balance: ", cashUnitsFormat(cashBalance));
        console.log("CASH.totalSupply() : ", cashUnitsFormat(cashTotalSupply))
        console.log("Vault.checkBalance() : ", usdcUnitsFormat(vaultCheckBalance))
        console.log("Vault.nav() : ", usdcUnitsFormat(vaultNav))
        console.log("CASH bal  of 0x260D7a32e856a2bFf0fb8012D29262067424B15d", cashUnitsFormat(await cash.balanceOf("0x260D7a32e856a2bFf0fb8012D29262067424B15d")));

        console.log("Rebase State: ", (await cash.rebaseState(governor)).toString())
        console.log("Non-rebasing supply: ", (await cash.nonRebasingSupply()).toString())
        console.log("Rebasing credits: ", (await cash.rebasingCreditsHighres()).toString())
        console.log("Rebasing credits per token: ", (await cash.rebasingCreditsPerTokenHighres()).toString())

        break;
        // Increment the transfer for today in the dateJson
        let date = new Date( (await ethers.provider.getBlock(blockNumber)).timestamp * 1000) ;
        let dateString = date.toDateString();
        if (dateJson[dateString] == undefined) {
            dateJson[dateString] = 0;
        }
        dateJson[dateString] += 10;
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
