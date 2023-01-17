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
  quickSwapPair,
  usdcUnitsFormat,
  usdtUnits,
  usdtUnitsFormat,
  advanceTime

} = require("../../helpers");
const { min } = require("lodash");

strategyName = "QuickSwap USDC/USDT";
primaryStableName = "USDC";
token1Name = "USDT";

primaryStableName = "USDC";
describe("QuickSwap Strategy", function () {
  
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
    quickSwapStakingReward,
    quickSwapPair;

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
    vault = fixture.vault;
    harvester = fixture.harvester;
    cash = fixture.cash;
    governor = fixture.governor;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;
    Labs = fixture.Labs;
    Team = fixture.Team;

    token0 = usdc;
    token0Units = usdcUnits;
    token0UnitsFormat = usdcUnitsFormat;

    token1 = dai;
    token1Units = daiUnits;
    token1UnitsFormat = daiUnitsFormat;

    primaryStable = usdc;
    primaryStableUnits = usdcUnits;
    primaryStableUnitsFormat = usdcUnitsFormat;

    strategy = fixture.cQuickSwapStrategyUSDCUSDT;
    quickSwapStakingReward = fixture.quickSwapStakingRewardUSDCUSDT;
    quickSwapPair = fixture.quickSwapUSDCUSDTPair;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the", strategyName ,"as quick deposit strategy");
    await vault
      .connect(governor)
      .setQuickDepositStrategies([strategy.address]);

});

  describe(strategyName + " Strategy", function () {
    it("Should be able to mint " +  primaryStableName + " and it should show up in the " + strategyName + " @fast", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("Should be able to mint", primaryStableName ,  "and it should show up in the", strategyName)
        console.log("---------------------------------------------------------------------------")

        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("100.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("100.0"), 0);

        await expectApproxSupply(cash, cashUnits("300"));


        console.log("Auto allocating funds from vault")
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "in", strategyName, "Strategy:", (await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " - quickSwapPair in", strategyName, "Strategy:", (await quickSwapPair.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " - quickSwapStakingReward in", strategyName, "Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
        
        expect(await quickSwapStakingReward.balanceOf(strategy.address)).to.be.above("0");
        expect(await strategy.checkBalance()).to.be.within(primaryStableUnits("99.0"), primaryStableUnits("100.0"));

    });

    it("Should be able to withdrawAll"+ " @fast", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
      await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
 
      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("10.0"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("10.0"), 0);

      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      

      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - quickSwapPair in", strategyName, " Strategy:", usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - quickSwapStakingReward in", strategyName, " Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

      await vault
        .connect(governor)
        .withdrawAllFromStrategy(strategy.address);
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString() );
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - quickSwapPair in", strategyName, " Strategy:", usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - quickSwapStakingReward in", strategyName, " Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

      await expect(strategy).to.have.a.balanceOf("0", primaryStable);

    });

    it("Should be able to deposit when there is 1 GWei of token1 present in the strategy"+ " @fast @fork", async function () {
      console.log("-----------------------------------------------------------------------------------------")
      console.log("    Should be able to deposit when there is 1 GWei of token1 present in the strategy")
      console.log("-----------------------------------------------------------------------------------------")
      await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
   
      console.log("Adding 0.000000000000000001 DAI to the Startegy")
      await dai.connect(matt).transfer(strategy.address,"1");
      
      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("1000.0"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("1000.0"), 0);


      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")

      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - quickSwapPair in", strategyName, " Strategy:", usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - quickSwapStakingReward in", strategyName, " Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
    });


    it("Should be able to withdraw when there is 1 GWei of token1 present in the strategy"+ " @fast @fork", async function () {
      // REQUIRE withdraw function to be available with Governor
      console.log("-----------------------------------------------------------------------------------------")
      console.log("    Should be able to withdraw when there is 1 GWei of token1 present in the strategy")
      console.log("-----------------------------------------------------------------------------------------")
      await expectApproxSupply(cash, cashUnits("200"));

      console.log("Initial", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());

      await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("1000.0"));
      await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("1000.0"), 0);

      console.log("Adding 0.000000000000000001 DAI to the Startegy")
      await dai.connect(matt).transfer(strategy.address,"1");

      console.log("Before Allocation of", primaryStableName , "to",strategyName,"- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("Auto allocating funds from vault")
      
      console.log("After Allocation of", primaryStableName , "to ",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - quickSwapPair in", strategyName, " Strategy:", usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " - quickSwapStakingReward in", strategyName, " Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
      console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
     
      await strategy
        .connect(governor)
        .withdraw(vault.address, usdc.address, primaryStableUnits("30.0"));

      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString() );
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "in", strategyName, " Strategy:", primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - quickSwapPair in", strategyName, " Strategy:", usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," - quickSwapStakingReward in", strategyName, " Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
      console.log("After Withdrawal from",strategyName," -", primaryStableName , "equivalent in", strategyName, " Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());
      
      expect(await strategy.checkBalance()).to.be.within(primaryStableUnits("969.0"), primaryStableUnits("971.0"));
    });

    it("Should collect rewards"+ " @slow", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt", primaryStableName , "balance: ",  primaryStableUnitsFormat(await primaryStable.balanceOf(matt.address)).toString())

        await expectApproxSupply(cash, cashUnits("200"));

        console.log("Initial Quick LP Tokens: ",  usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString())
        console.log("Initial", primaryStableName , "in Vault:", (await primaryStable.balanceOf(vault.address)).toString());
        console.log("Initial", primaryStableName , "in ", strategyName , " :", (await primaryStable.balanceOf(strategy.address)).toString());

        console.log("Adding", primaryStableName , "to Vault: ", primaryStableUnits("500.0").toString());
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("500.0"));
        await vault.connect(matt).mint(primaryStable.address, primaryStableUnits("500.0"), 0);

        console.log("Before Allocation of", primaryStableName , "to ", strategyName, "- ", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        

        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -", primaryStableName , "in ", strategyName , ":",primaryStableUnitsFormat(await primaryStable.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " -  Quick LP Tokens: ", usdcUnitsFormat(await quickSwapPair.balanceOf(strategy.address)).toString())
        console.log("After Allocation of", primaryStableName , "to ", strategyName, " - QuickRewardToken in ", strategyName, ":", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
        console.log("After Allocation of", primaryStableName , "to", strategyName, " -", primaryStableName , "equivalent in", strategyName, "Strategy:", primaryStableUnitsFormat(await  strategy.checkBalance()).toString());

        expect(await quickSwapStakingReward.balanceOf(strategy.address)).to.be.above("0");

        await harvester.connect(governor)["harvest(address)"](strategy.address);
        console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest-  Quick LP Tokens: ", (await quickSwapPair.balanceOf(strategy.address)).toString())
        console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 6; i++) {
            let wait = 4;
            console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);

            console.log("QuickRewardToken in ", strategyName, "Strategy:", (await quickSwapStakingReward.balanceOf(strategy.address)).toString());
            await harvester.connect(governor)["harvest(address)"](strategy.address);
            console.log("After Harvest - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - Quick LP Tokens: ", (await quickSwapPair.balanceOf(strategy.address)).toString())
            console.log("After Harvest - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        }

        await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        console.log("Before Harvest & Distribute - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](strategy.address);
        console.log("After Harvest & Distribute - USDC in Vault:", (await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest & Distribute - Quick LP Tokens: ", (await quickSwapPair.balanceOf(strategy.address)).toString())
        console.log("After Harvest & Distribute - USDC in Harvester:", (await usdc.balanceOf(harvester.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Dripper:", (await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Matt (for calling h&S reward added) :",(await usdc.balanceOf(matt.address)).toString()); 

    });

  });
});
