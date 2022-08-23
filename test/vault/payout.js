const { BigNumber } = require("ethers");

const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  cashUnits,
  daiUnits,
  usdcUnits,
  usdcUnitsFormat,
  daiUnitsFormat,
  cashUnitsFormat,
  usdtUnits,
  loadFixture,
  setOracleTokenPriceUsd,
  isFork,
  expectApproxSupply,
  advanceTime

} = require("../helpers");

describe("Vault Redeem", function () {

    it("Should payout correctly with primary stable", async () => {
        const { cash, vault, usdc, matt, Labs, Team,  dai, josh, dripper, harvester } = await loadFixture(defaultFixture);
        console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
        console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
        console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
        console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    
        console.log("Minting 1000 USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
        await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);
        
        console.log("Performing payout...")
        await vault.connect(josh).payout();
        
        let wait = 24*60;
        console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
        await advanceTime(wait*60*1000);

        console.log("Performing payout...")
        await vault.connect(josh).payout();


        console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
        console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
        console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
        console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
        console.log("Harvester USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(harvester.address)).toString()))
        console.log("Dripper USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(dripper.address)).toString()))
        console.log("Vault USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(vault.address)).toString()))
      });

});
