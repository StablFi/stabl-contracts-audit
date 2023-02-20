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
  sUSDT,
  usdcUnitsFormat,
  usdtUnits,
  usdtUnitsFormat,
  advanceTime,
  runStrategyLogic
} = require("../../helpers");
const { min } = require("lodash");

const strategyName = "Stargate Strategy USDT";
const token0Name = "USDT";

const primaryStableName = "USDC";
describe("Stargate Strategy", function () {
  
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
    STG,
    sUSDT;

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
    token0Units = usdcUnits;
    token0UnitsFormat = usdcUnitsFormat;

    primaryStable = usdc;
    primaryStableUnits = usdcUnits;
    primaryStableUnitsFormat = usdcUnitsFormat;

    strategy = fixture.cStargateUsdtStrategyProxy;
    STG = fixture.STG;
    sUSDT = fixture.sUSDT;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the", strategyName ,"as quick deposit strategy");
    await vault
      .connect(governor)
      .setQuickDepositStrategies([strategy.address]);

    await runStrategyLogic(governor, "Stargate Strategy", strategy.address); // require whitelisting first.
    console.log("strategy set & whitelisted");
});

  describe(strategyName + " Strategy", function () {
    it("Should be able to mint " +  primaryStableName + " and it should show up in the " + strategyName + " @fast @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("Should be able to mint", primaryStableName ,  "and it should show up in the", strategyName)
        console.log("---------------------------------------------------------------------------")

        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("1000.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("1000.0"), 0);

        // await expectApproxSupply(cash, cashUnits("300"));

        console.log("Auto allocating funds from vault")
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "in", strategyName, "Strategy:", (await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " - sUSDT in", strategyName, "Strategy:", (await sUSDT.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " - LP Balance in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.lpBalance()).toString());
        console.log("After Allocation of",strategyName," -", primaryStableName , " NAV in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      
        // expect(await sUSDT.balanceOf(strategy.address)).to.be.within(usdcUnits("99.0"), usdcUnits("100.0"));
        expect(await strategy.checkBalance()).to.be.within(usdcUnits("950.0"), usdcUnits("1100.0")); // investments + balance
    });

    it("Should be able to withdrawAll"+ " @fast @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
      //await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
 
      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("1000.0"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("1000.0"), 0);

      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      
      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - sUSDT in", strategyName, " Strategy:", daiUnitsFormat(await strategy.lpBalance()).toString().toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - STG in", strategyName, " Strategy:", (await STG.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName , "Oracle in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());
      console.log("After Allocation of", primaryStableName , "to", strategyName, " - LP Balance in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.lpBalance()).toString());
      await vault
        .connect(governor)
        .withdrawAllFromStrategy(strategy.address);
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString() );
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - sUSDT in", strategyName, " Strategy:", daiUnitsFormat(await strategy.lpBalance()).toString().toString());
      console.log("After Withdrawal from",strategyName," - STG in", strategyName, " Strategy:", (await STG.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "oracle in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.netAssetValue()).toString());
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      console.log("After Allocation of", primaryStableName , "to", strategyName, " - LP Balance in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.lpBalance()).toString());

      expect(await strategy.checkBalance()).to.be.within(usdcUnits("0"), usdcUnits("0.1"));

    });

    it("Should be able to withdraw"+ " @fast @fork", async function () {
      console.log("---------------------------------------------------------------------------")
      console.log("                       Should be able to withdraw")
      console.log("---------------------------------------------------------------------------")
      //await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      
      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("10"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("10"), 0);

      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      
      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - sUSDT in", strategyName, " Strategy:", daiUnitsFormat(await strategy.lpBalance()).toString().toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - STG in", strategyName, " Strategy:", (await STG.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

      await vault
        .connect(matt)
        .redeem(cashUnits("5.0"), cashUnits("3.0"));
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString() );
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - sUSDT in", strategyName, " Strategy:", daiUnitsFormat(await strategy.lpBalance()).toString().toString());
      console.log("After Withdrawal from",strategyName," - STG in", strategyName, " Strategy:", (await STG.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      
      expect(await strategy.checkBalance()).to.be.within(usdcUnits("4"), usdcUnits("5"));

    });

    it("Should collect rewards"+ " @slow @fork", async() => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt", primaryStableName , "balance: ",  primaryStableUnitsFormat(await primaryStable.balanceOf(matt.address)).toString())

        //await expectApproxSupply(cash, cashUnits("200"));

        console.log("Initial Stargate LP Tokens: ",  daiUnitsFormat(await strategy.lpBalance()).toString().toString())
        console.log("Initial", primaryStableName , "in Vault:", (await primaryStable.balanceOf(vault.address)).toString());
        console.log("Initial", primaryStableName , "in Stargate", primaryStableName , "Strategy:", (await primaryStable.balanceOf(strategy.address)).toString());

        console.log("Adding", primaryStableName , "to Vault: ", primaryStableUnits("500.0").toString());
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("500.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("500.0"), 0);

        console.log("Before Allocation of", primaryStableName , "to ", strategyName, "- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Stargate", primaryStableName , "Strategy:",primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -  Stargate LP Tokens: ", daiUnitsFormat(await strategy.lpBalance()).toString())
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " - STG in ", strategyName, ":", (await STG.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

        // expect(await sUSDT.balanceOf(strategy.address)).to.be.within(usdcUnits("495.0"), usdcUnits("500.0")); // yet to find where amount goes
        expect(await strategy.checkBalance()).to.be.within(usdcUnits("498.0"), usdcUnits("500.0"));

        // await harvester.connect(governor)["harvest(address)"](strategy.address);
        // console.log("After Harvest - USDT in Vault:", (await usdt.balanceOf(vault.address)).toString());
        // console.log("After Harvest-  Stargate LP Tokens: ", (await sUSDT.balanceOf(strategy.address)).toString())
        // console.log("After Harvest - USDT in Harvester:", (await usdt.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 6; i++) {
            console.log("\n\n🎉claiming rewards");
            let wait = 200;
            console.log("Simulating wait for " + wait + " minutes");
            await advanceTime(wait*60*1000);

            console.log("STG in ", strategyName, "Strategy:", daiUnitsFormat(await STG.balanceOf(strategy.address)).toString());
            await harvester.connect(governor)["harvest(address)"](strategy.address);
            console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - Stargate LP Tokens: ", (await strategy.lpBalance()).toString())
            console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        }

        await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        console.log("Before Harvest & Distribute - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](strategy.address);
        console.log("After Harvest & Distribute - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest & Distribute - Stargate LP Tokens: ", (await strategy.lpBalance()).toString())
        console.log("After Harvest & Distribute - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Matt (for calling h&S reward added) :",(await usdc.balanceOf(matt.address)).toString()); 

    });

  });
});