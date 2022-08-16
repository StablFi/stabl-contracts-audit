const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
    sleep
  } = require("../../utils/deploy");

const { defaultFixture } = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  cashUnits,
  quickUnits,
  meshUnits,
  dystPairUnits,
  units,
  loadFixture,
  expectApproxSupply,
  getBlockTimestamp,
  isFork,
  usdcUnitsFormat,
  daiUnitsFormat,
} = require("../helpers");
const { min } = require("lodash");

// DISABLED
describe("AaveStrategy USDC Strategy", function () {
  
  let anna,
    matt,
    josh,
    cash,
    vault,
    harvester,
    governor,
    usdt,
    usdc,
    dai,
    aaveStrategyUSDC,
    amUSDC,
    aaveVDebtUSDC,
    wmatic
    ;

  const emptyVault = async () => {
    await vault.connect(matt).redeemAll(0);
    await vault.connect(josh).redeemAll(0);
  };

  const mint = async (amount, asset) => {
    await asset.connect(anna).justMint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    await vault.connect(anna).justMint(asset.address, units(amount, asset), 0);
  };

  beforeEach(async function () {
    const fixture = await loadFixture(defaultFixture);
    anna = fixture.anna;
    matt = fixture.matt;
    josh = fixture.josh;
    vault = fixture.vault;
    harvester = fixture.harvester;
    cash = fixture.cash;
    governor = fixture.governor;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    wmatic = fixture.wmatic;
    dai = fixture.dai;
    Labs = fixture.Labs;
    Team = fixture.Team;
    
    aaveStrategyUSDC = fixture.cAaveStrategyUSDC;
    aaveVDebtUSDC = fixture.aaveVDebtUSDC;
    amUSDC = fixture.amUSDC;
    erc20Abi = fixture.erc20Abi;

    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the AaveStrategy (USDC) as default strategy for USDC");
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, aaveStrategyUSDC.address);

});

  describe("AaveStrategy USDC Strategy", function () {
    it("Should be able to mint USDC and it should show up in the AaveStrategy USDC core", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("Should be able to mint USDC and it should show up in the AaveStrategy USDC core")
        console.log("---------------------------------------------------------------------------")

        await usdc.connect(matt).approve(vault.address, usdcUnits("200.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("200.0"), 0);

        await usdc.connect(anna).approve(vault.address, usdcUnits("200.0"));
        await vault.connect(anna).justMint(usdc.address, usdcUnits("200.0"), 0);

        //  matt: 100 (DAI) + 200 (USDC)
        //  anna: 100 (DAI) + 200 (USDC)
        // total: 600 (CASH)
        await expectApproxSupply(cash, cashUnits("600"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("399.0"), usdcUnits("400.0"));;
        console.log("Before Allocation of USDC to Aave USDC Strategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        await vault.allocate();
        console.log("After Allocation of USDC to Aave USDC Strategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation of USDC to Aave USDC Strategy - USDC in AaveStrategyUSDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Allocation of USDC to Aave USDC Strategy - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Allocation of USDC to Aave USDC Strategy - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Allocation of USDC to Aave USDC Strategy - USDC equivalent in AaveStrategyUSDC:", usdcUnitsFormat(await aaveStrategyUSDC.checkBalance()).toString());
        expect(await amUSDC.balanceOf(aaveStrategyUSDC.address)).to.be.above(0);
        expect(await aaveStrategyUSDC.checkBalance()).to.be.within(usdcUnits("399.0"), usdcUnits("400.0"));;

    });

    it("Should be able to withdrawAll", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
      await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());

      await usdc.connect(matt).approve(vault.address, usdcUnits("900.0"));
      await vault.connect(matt).justMint(usdc.address, usdcUnits("900.0"), 0);
      
      await usdc.connect(anna).approve(vault.address, usdcUnits("900.0"));
      await vault.connect(anna).justMint(usdc.address, usdcUnits("900.0"), 0);
      
      console.log("Before Allocation of USDC to Aave USDC Strategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      await vault.allocate();
      console.log("After Allocation of USDC to Aave USDC Strategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Allocation of USDC to Aave USDC Strategy - USDC in AaveStrategyUSDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
      console.log("After Allocation of USDC to Aave USDC Strategy - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
      console.log("After Allocation of USDC to Aave USDC Strategy - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        expect(await amUSDC.balanceOf(aaveStrategyUSDC.address)).to.be.above(0);

      await vault
        .connect(governor)
        .withdrawAllFromStrategy(aaveStrategyUSDC.address);
      console.log("After Withdrawal from Aave USDC Strategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Withdrawal of USDC to Aave USDC Strategy - USDC in AaveStrategyUSDC:",usdcUnitsFormat (await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
      console.log("After Withdrawal from Aave USDC Strategy  - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
      console.log("After Withdrawal of USDC to Aave USDC Strategy - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString());

      await expect(aaveStrategyUSDC).to.have.a.balanceOf("0", amUSDC);
      await expect(aaveStrategyUSDC).to.have.a.balanceOf("0", amUSDC);

    });

    it("Should collect rewards", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt USDC balance: ",  (await usdc.balanceOf(matt.address)).toString())

        await expectApproxSupply(cash, cashUnits("200"));

        console.log("Initial USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Initial USDC in Aave Strategy USDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());

        console.log("Adding USDC to Vault: ", usdcUnits("20.78").toString());
        await usdc.connect(matt).approve(vault.address, usdcUnits("10.78"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("10.78"), 0);

        await usdc.connect(anna).approve(vault.address, usdcUnits("10.0"));
        await vault.connect(anna).justMint(usdc.address, usdcUnits("10.0"), 0);

        console.log("Before Allocation of USDC to Aave Strategy USDC-  USDC in Vault:",usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        await vault.allocate();

        console.log("After Allocation of USDC to Aave Strategy USDC - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation of USDC to Aave Strategy USDC - USDC in Aave USDC Strategy:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Allocation of USDC to Aave Strategy USDC - wMATIC in Aave USDC Strategy:", daiUnitsFormat(await wmatic.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Allocation of USDC to Aave USDC Strategy - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Allocation of USDC to Aave USDC Strategy - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString());

        expect(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).to.be.above(0);
        expect(await amUSDC.balanceOf(aaveStrategyUSDC.address)).to.be.above(0);

        await harvester.connect(governor)["harvest(address)"](aaveStrategyUSDC.address);
        console.log("After Harvest - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest - USDC in AaveStrategyUSDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Harvest - wMATIC in Aave USDC Strategy:", daiUnitsFormat(await wmatic.balanceOf(aaveStrategyUSDC.address)).toString());

        console.log("After Harvest - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Harvest - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString())
        console.log("After Harvest - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 5; i++) {
            let wait = 4;
            console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);
            await harvester.connect(governor)["harvest(address)"](aaveStrategyUSDC.address);
            console.log("After Harvest - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - wMATIC in Aave USDC Strategy:", daiUnitsFormat(await wmatic.balanceOf(aaveStrategyUSDC.address)).toString());
            console.log("After Harvest - USDC in AaveStrategyUSDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
            console.log("After Harvest - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
            console.log("After Harvest - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString())
            console.log("After Harvest - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString()); 
        }

        // await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        console.log("Before Harvest & Distribute - USDC in Matt :", usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](aaveStrategyUSDC.address);
        console.log("After Harvest & Distribute - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest & Distribute - wMATIC in Aave USDC Strategy:", daiUnitsFormat(await wmatic.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Harvest & Distribute - USDC in AaveStrategyUSDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Harvest & Distribute - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Harvest & Distribute - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString())
        console.log("After Harvest & Distribute - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Dripper:", usdcUnitsFormat(await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Matt (for calling h&S reward added) :", usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString()); 

        await vault
          .connect(governor)
          .withdrawAllFromStrategy(aaveStrategyUSDC.address);
        console.log("After Withdrawal from Aave USDC Strategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Withdrawal of USDC to Aave USDC Strategy - USDC in AaveStrategyUSDC:", usdcUnitsFormat(await usdc.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Withdrawal from Aave USDC Strategy  - amUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await amUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
        console.log("After Withdrawal of USDC to Aave USDC Strategy - aaveVDebtUSDC in AaveStrategyUSDC:", usdcUnitsFormat(await aaveVDebtUSDC.balanceOf(aaveStrategyUSDC.address)).toString());
      
    });

  });
});
