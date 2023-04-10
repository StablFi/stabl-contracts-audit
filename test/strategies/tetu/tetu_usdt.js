const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
    sleep
  } = require("../../../utils/deploy");

const { defaultFixture } = require("../../_fixture");

let {
  daiUnits,
  usdcUnits,
  cashUnits,
  meshUnits,
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
  strategy,
  TetuLPToken,
  usdcUnitsFormat,
  usdtUnits,
  usdtUnitsFormat,
  advanceTime,
  runStrategyLogic,
  usdUnitsFormat,
  usdUnits
} = require("../../helpers");
const { min } = require("lodash");

const strategyName = "Tetu Strategy USDT";
const token0Name = "USDT";

const primaryStableName = "USDC";
describe("Tetu Strategy", function () {
  
  let anna,
    matt,
    josh,
    cash,
    vault,
    harvester,
    governor,
    usdc,
    usdt,
    primaryStable,
    dai,
    strategy,
    TETU,
    TetuLPToken;

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
    dai = fixture.dai;
    Labs = fixture.Labs;
    Team = fixture.Team;

    token0 = usdt;
    token0Units = usdtUnits;
    token0UnitsFormat = usdtUnitsFormat;

    primaryStable = usdc;
    primaryStableUnits = usdcUnits;
    primaryStableUnitsFormat = usdcUnitsFormat;

    strategy = fixture.cTetuUsdtStrategyProxy;
    TETU = fixture.TETU;
    TetuLPToken = fixture.TetuLPToken;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

    await runStrategyLogic(governor, "Tetu Strategy", strategy.address); // require whitelisting first.
    console.log("strategy set & whitelisted");
});

  describe(strategyName + " Strategy", function () {
    it("Should be able to mint " +  primaryStableName + " and it should show up in the " + strategyName + " @fast @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("Should be able to mint", primaryStableName ,  "and it should show up in the", strategyName)
        console.log("---------------------------------------------------------------------------")

        // await expectApproxSupply(cash, cashUnits("300"));
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("45000.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("45000.0"), 0);

        console.log("Auto allocating funds from vault")

        console.log("After Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("After Allocation of", primaryStableName , "to",strategyName,"- netAssetValue()", primaryStableName , "in Vault:", usdUnitsFormat(await vault.nav()).toString());

        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "in", strategyName, "Strategy:", (await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " - TetuLPToken in", strategyName, "Strategy:", (await TetuLPToken.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " - LP Balance in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.lpBalance()).toString());
        console.log("After Allocation of",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", usdUnitsFormat(await  strategy.netAssetValue()).toString());
      
        // expect(await TetuLPToken.balanceOf(strategy.address)).to.be.within(usdcUnits("99.0"), usdcUnits("100.0"));
        expect(await vault.checkBalance()).to.be.within(usdUnits("44850.0"), usdUnits("45000.0")); // investments + balance
    });

    it("Should be able to withdrawAll"+ " @fast @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
      // await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
 
      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("45000.0"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("45000.0"), 0);

      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      
      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      console.log("After Allocation of", primaryStableName , "to", strategyName, " - LP Balance in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.lpBalance()).toString());
      console.log("After Allocation of",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());
      await vault
        .connect(governor)
        .withdrawAllFromStrategy(strategy.address);
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString() );
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal of", primaryStableName , "from", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      console.log("After Withdrawal from ",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());
      console.log("After Withdrawal of", primaryStableName , "from", strategyName, " - LP Balance in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.lpBalance()).toString());
      expect(await strategy.checkBalance()).to.be.within(usdcUnits("0"), usdcUnits("0.1"));

    });

    it("Should be able to withdraw"+ " @fast @fork", async function () {
      console.log("---------------------------------------------------------------------------")
      console.log("                       Should be able to withdraw")
      console.log("---------------------------------------------------------------------------")
      // await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());

      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("10.0"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("10.0"), 0);

      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      
      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - TetuLPToken in", strategyName, " Strategy:", usdcUnitsFormat(await TetuLPToken.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - TETU in", strategyName, " Strategy:", (await TETU.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      console.log("After Allocation of",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());

      // Impersonate vault
      await ethers.provider.send("hardhat_impersonateAccount", [vault.address]);
      const vaultSigner = await ethers.provider.getSigner(vault.address);
      // Governor sent some ether to vault
      await governor.sendTransaction({
        to: vault.address,
        value: ethers.utils.parseEther("100.0"),
      });
      await strategy
        .connect(vaultSigner)
        .withdrawUsd(usdUnits("2.0"));
      console.log("After Withdrawal from",strategyName," - NAV in Vault:", usdUnitsFormat(await vault.vaultNav()));
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - TetuLPToken in", strategyName, " Strategy:", usdcUnitsFormat(await TetuLPToken.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - TETU in", strategyName, " Strategy:", (await TETU.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      console.log("After Withdrawal from ",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());

      expect(await vault.vaultNav()).to.be.within(usdUnits("1.9"), usdUnits("2.1"));

    });

    it("Should collect rewards"+ " @slow @fork", async() => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt", primaryStableName , "balance: ",  primaryStableUnitsFormat(await primaryStable.balanceOf(matt.address)).toString())

        console.log("Initial Tetu LP Tokens: ",  usdcUnitsFormat(await TetuLPToken.balanceOf(strategy.address)).toString())
        console.log("Initial", primaryStableName , "in Vault:", (await primaryStable.balanceOf(vault.address)).toString());
        console.log("Initial", primaryStableName , "in Tetu", primaryStableName , "Strategy:", (await primaryStable.balanceOf(strategy.address)).toString());

        console.log("Adding", primaryStableName , "to Vault 500");
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("500.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("500.0"), 0);

        console.log("Before Allocation of", primaryStableName , "to ", strategyName, "- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Tetu", primaryStableName , "Strategy:",primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -  Tetu LP Tokens: ", usdcUnitsFormat(await TetuLPToken.balanceOf(strategy.address)).toString())
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " - TETU in ", strategyName, ":", (await TETU.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
        console.log("After Allocation of",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());

        // expect(await TetuLPToken.balanceOf(strategy.address)).to.be.within(usdcUnits("495.0"), usdcUnits("500.0")); // yet to find where amount goes
        // expect(await strategy.checkBalance()).to.be.within(usdcUnits("495.0"), usdcUnits("500.0"));

        // await harvester.connect(governor)["harvest(address)"](strategy.address);
        // console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        // console.log("After Harvest-  Tetu LP Tokens: ", (await TetuLPToken.balanceOf(strategy.address)).toString())
        // console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 6; i++) {
            let wait = 24*60;
            console.log("Simulating wait for " + wait + " minutes");
            await advanceTime(wait*60*1000);

            console.log("TETU in ", strategyName, "Strategy:", daiUnitsFormat(await TETU.balanceOf(strategy.address)).toString());
            await harvester.connect(governor)["harvest(address)"](strategy.address);
            console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - Tetu LP Tokens: ", (await TetuLPToken.balanceOf(strategy.address)).toString())
            console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        }

        await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        console.log("Before Harvest & Distribute - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](strategy.address);
        console.log("After Harvest & Distribute - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest & Distribute - Tetu LP Tokens: ", (await TetuLPToken.balanceOf(strategy.address)).toString())
        console.log("After Harvest & Distribute - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Matt (for calling h&S reward added) :",(await usdc.balanceOf(matt.address)).toString()); 

    });

  });
});
