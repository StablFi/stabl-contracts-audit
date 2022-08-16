const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
    sleep
  } = require("../../utils/deploy");

const { defaultFixture } = require("../_fixture");
let {
  daiUnits,
  usdcUnits,
  cashUnits,
  nUSDUnits,
  dystPairUnits,
  units,
  loadFixture,
  expectApproxSupply,
  getBlockTimestamp,
  isFork,
  daiUnitsFormat,
  primaryStable,
  primaryStableUnits,
  primaryStableUnitsFormat,
  token1,
  token1Units,
  token1UnitsFormat,
  strategyName,
  strategy,
  nUSD,
  usdcUnitsFormat,
  usdtUnits,
  usdtUnitsFormat,
  advanceTime

} = require("../helpers");
const { min } = require("lodash");

strategyName = "Synapse";

primaryStableName = "USDC";
describe("Harvester", function () {
  
  let anna,
    matt,
    josh,
    cash,
    vault,
    vaultAdmin,
    harvester,
    governor,
    usdc,
    usdt,
    primaryStable,
    dai,
    strategy,
    syn,
    nUSDSwapUsdc,
    nUSD;

  const emptyVault = async () => {
    await vault.connect(matt).redeemAll(0);
    await vault.connect(josh).redeemAll(0);
  };

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    await vault.connect(anna).mint(asset.address, units(amount, asset), 0);
  };

  beforeEach(async function () {
      const fixture = await loadFixture(defaultFixture);
      anna = fixture.anna;
      matt = fixture.matt;
      josh = fixture.josh;
      rio = fixture.rio;
      vault = fixture.vault;
      vaultAdmin = fixture.vaultAdmin;
      vaultCore = fixture.vaultCore;
      harvester = fixture.harvester;
      cash = fixture.cash;
      governor = fixture.governor;
      usdt = fixture.usdt;
      usdc = fixture.usdc;
      dai = fixture.dai;

      primaryStable = usdc;
      primaryStableUnits = usdcUnits;
      primaryStableUnitsFormat = usdcUnitsFormat;

      strategy = fixture.cSynapseStrategy;
      syn = fixture.SYN;
      nUSD = fixture.nUSD;

      erc20Abi = fixture.erc20Abi;
      harvester = fixture.harvester;
      dripper = fixture.dripper;

      console.log("Setting the", strategyName ,"as default strategy for ", primaryStableName);
      await vault
        .connect(governor)
        .setAssetDefaultStrategy(primaryStable.address, strategy.address);
      await vaultAdmin.connect(governor).setQuickDepositStrategies([strategy.address]);
      await vaultAdmin.connect(governor).setHarvester(harvester.address);
      await vaultAdmin.connect(governor).setDripper(dripper.address);

  });

  describe("Harvester", function () {
    it("1. Should properly distribute rewards with separate harvest and distribute @slow @fork", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("   Should properly distribute rewards with separate harvest and distribute ")
        console.log("---------------------------------------------------------------------------")
        await harvester.connect(governor).setLabs(rio.address, 1000);
        await harvester.connect(governor).setTeam(anna.address, 1000);
        console.log("Matt", primaryStableName , "balance: ",  primaryStableUnitsFormat(await primaryStable.balanceOf(matt.address)).toString())
        console.log("USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 

        // await expectApproxSupply(cash, cashUnits("200"));

        console.log("Initial nUSD LP Tokens: ",  usdcUnitsFormat(await nUSD.balanceOf(strategy.address)).toString())
        console.log("Initial", primaryStableName , "in Vault:", (await primaryStable.balanceOf(vault.address)).toString());
        console.log("Initial", primaryStableName , "in ", strategyName , ":", (await primaryStable.balanceOf(strategy.address)).toString());

        console.log("Adding", primaryStableName , "to Vault: ", primaryStableUnits("500.0").toString());
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("500.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("500.0"), 0);

        console.log("Before Allocation of", primaryStableName , "to ", strategyName, "- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("Allocating funds from vault to first default strategy")
        await vault.quickAllocate();

        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in nUSDSwap", primaryStableName , "Strategy:",primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -  nUSD LP Tokens: ", usdcUnitsFormat(await nUSD.balanceOf(strategy.address)).toString())
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " - SYN in ", strategyName, ":", (await syn.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

        // expect(await nUSD.balanceOf(strategy.address)).to.be.within(usdcUnits("249.0"), usdcUnits("250.0"));

        await harvester.connect(governor)["harvest(address)"](strategy.address);
        console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest-  nUSD LP Tokens: ", (await nUSD.balanceOf(strategy.address)).toString())
        console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 1; i++) {
            let wait = 4;
            console.log("Wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);

            console.log("SYN in ", strategyName, "Strategy:", (await syn.balanceOf(strategy.address)).toString());
            await harvester.connect(governor)["harvest(address)"](strategy.address);
            console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - nUSD LP Tokens: ", (await nUSD.balanceOf(strategy.address)).toString())
            console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        }

        await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);

        let previousAnnaBalance = parseInt(await usdc.balanceOf(anna.address));
        let previousRioBalance = parseInt(await usdc.balanceOf(rio.address));
        let previousDripperBalance = parseInt(await usdc.balanceOf(dripper.address));

        let harvesterBase = await usdc.balanceOf(harvester.address);
        console.log("Harvester Base:", harvesterBase.toString());
        let annaPart = parseInt(harvesterBase * .1);
        let annaShouldHave = previousAnnaBalance + annaPart;
        console.log("annaShouldHave", annaShouldHave);
        let rioPart = parseInt(harvesterBase * .1);
        let rioShouldHave = previousRioBalance + rioPart;
        console.log("rioShouldHave", rioShouldHave);
        let dripperShouldHave = previousDripperBalance + harvesterBase - annaPart - rioPart;
        console.log("dripperShouldHave", dripperShouldHave);

        console.log("After Harvest - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("After Harvest - USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("After Harvest - USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 
        await harvester.connect(governor)["distributeFees()"]();
        console.log("After Fee Distribution - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Fee Distribution - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Fee Distribution - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("After Fee Distribution - USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("After Fee Distribution - USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 
        await harvester.connect(governor)["distributeProceeds()"]();
        console.log("After Proceeds Distribution - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Proceeds Distribution - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Proceeds Distribution - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("After Proceeds Distribution - USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("After Proceeds Distribution - USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 

        expect(await usdc.balanceOf(harvester.address)).to.be.equal(0);
        expect(await usdc.balanceOf(anna.address)).to.be.equal(annaShouldHave);
        expect(await usdc.balanceOf(rio.address)).to.be.equal(rioShouldHave);
        expect(await usdc.balanceOf(dripper.address)).to.be.equal(dripperShouldHave);

    });
    it("2. Should properly distribute rewards with harvestAndDistribute  @slow @fork", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("      Should properly distribute rewards with harvestAndDistribute")
        console.log("---------------------------------------------------------------------------")
        await harvester.connect(governor).setLabs(rio.address, 1000);
        await harvester.connect(governor).setTeam(anna.address, 1000);
        console.log("Matt", primaryStableName , "balance: ",  primaryStableUnitsFormat(await primaryStable.balanceOf(matt.address)).toString())
        console.log("USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 

        // await expectApproxSupply(cash, cashUnits("200"));

        console.log("Initial nUSD LP Tokens: ",  usdcUnitsFormat(await nUSD.balanceOf(strategy.address)).toString())
        console.log("Initial", primaryStableName , "in Vault:", (await primaryStable.balanceOf(vault.address)).toString());
        console.log("Initial", primaryStableName , "in ", strategyName , ":", (await primaryStable.balanceOf(strategy.address)).toString());

        console.log("Adding", primaryStableName , "to Vault: ", primaryStableUnits("500.0").toString());
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("500.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("500.0"), 0);

        console.log("Before Allocation of", primaryStableName , "to ", strategyName, "- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("Allocating funds from vault to first default strategy")
        await vault.quickAllocate();

        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in nUSDSwap", primaryStableName , "Strategy:",primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -  nUSD LP Tokens: ", usdcUnitsFormat(await nUSD.balanceOf(strategy.address)).toString())
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " - SYN in ", strategyName, ":", (await syn.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

        // expect(await nUSD.balanceOf(strategy.address)).to.be.within(usdcUnits("249.0"), usdcUnits("250.0"));

        let previousAnnaBalance = parseInt(await usdc.balanceOf(anna.address));
        let previousRioBalance = parseInt(await usdc.balanceOf(rio.address));
        let previousDripperBalance = parseInt(await usdc.balanceOf(dripper.address));

        await harvester.connect(governor)["harvest(address)"](strategy.address);
        console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest-  nUSD LP Tokens: ", (await nUSD.balanceOf(strategy.address)).toString())
        console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 1; i++) {
            let wait = 4;
            console.log("Simulating Wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);

            console.log("SYN in ", strategyName, "Strategy:", (await syn.balanceOf(strategy.address)).toString());
            await harvester.connect(governor)["harvest(address)"](strategy.address);
            console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - nUSD LP Tokens: ", (await nUSD.balanceOf(strategy.address)).toString())
            console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        }

        await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        console.log("After Harvest - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("After Harvest - USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("After Harvest - USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 

        await harvester.connect(governor)["harvestAndDistribute()"]();
        console.log("After Harvest & Distribute - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Rio :",(await usdc.balanceOf(rio.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Anna :",(await usdc.balanceOf(anna.address)).toString()); 

        expect(await usdc.balanceOf(harvester.address)).to.be.equal(0);
        expect(await usdc.balanceOf(anna.address)).to.be.above(previousAnnaBalance);
        expect(await usdc.balanceOf(rio.address)).to.be.above(previousRioBalance);
        expect(await usdc.balanceOf(dripper.address)).to.be.above(previousDripperBalance);

    });

    it("Should fail when calling harvest  with the non valid strategy address  @fast @fork", async () => {
      const { harvester, governor, anna } = await loadFixture(
        defaultFixture
      );
      const CASH = await ethers.getContract("CASH");
      await expect(
        harvester.connect(governor)["harvest(address)"](CASH.address)
      ).to.be.revertedWith("Not a valid strategy address");
    });
    it("Should only allow Governor to set treasury and team config @fast @fork", async() => {
      const { harvester, governor, anna, josh} = await loadFixture(
        defaultFixture
      );
   
      await expect(
        harvester.connect(anna)["setLabs(address,uint256)"](anna.address, 10*100)
      ).to.be.revertedWith("Caller is not the Vault or Governor");
      await expect(
        harvester.connect(anna)["setTeam(address,uint256)"](anna.address, 10*100)
      ).to.be.revertedWith("Caller is not the Vault or Governor");

      await  harvester.connect(governor)["setLabs(address,uint256)"](anna.address, 10*100);
      await  harvester.connect(governor)["setTeam(address,uint256)"](josh.address, 20*100);
      await expect((await harvester.connect(anna)["getLabs()"]())[0]).to.be.equal(anna.address);
      await expect((await harvester.connect(anna)["getTeam()"]())[0]).to.be.equal(josh.address);
    })
  });
});
