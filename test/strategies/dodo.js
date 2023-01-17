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
  usdcUnitsFormat,
  daiUnitsFormat,
  usdtUnitsFormat,
  quickUnits,
  meshUnits,
  dystPairUnits,
  units,
  loadFixture,
  expectApproxSupply,
  getBlockTimestamp,
  isFork,
  usdtUnits,
  advanceTime
} = require("../helpers");
const { min } = require("lodash");
const { ethers } = require("hardhat");

const strategyNameMain  = "DodoStrategy";

describe(strategyNameMain , function () {
  
  let   anna,
        matt,
        josh,
        cash,
        vault,
        harvester,
        governor,
        usdt,
        usdc,
        dai,
        crv,
        wmatic,
        syn,
        nusd,
        DODO,
        usdcLPToken,
        strategyName  = strategyNameMain,
        strategy
        ;
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
    strategy = fixture.cDodoStrategy;
    usdcLPToken = fixture.usdcLPToken;
    DODO = fixture.DODO;
    Labs = fixture.Labs;
    Team = fixture.Team;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the",strategyName ,"as default strategy for USDC");
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, strategy.address);

    await vault
      .connect(governor)
      .setQuickDepositStrategies([strategy.address]);
});

  describe(strategyName  + " Strategy", function () {
    it("Should be able to mint USDC and it should show up in the strategy core"+ " @fast @fork", async function () {
        console.log("--------------------------------------------------------------------------------------------")
        console.log("Should be able to mint USDC and it should show up in the",strategyName ,"core")
        console.log("--------------------------------------------------------------------------------------------")
        
        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("500.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("500.0"), 0);

        await expectApproxSupply(cash, cashUnits("700"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("699.0"), usdcUnits("700.0"));

        console.log("Before Allocation -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")

        await vault.allocate();

        console.log("After Allocation -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation -",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- USDC equivalent in ", strategyName ,":", usdcUnitsFormat(await strategy.checkBalance()).toString());

        expect(await usdcLPToken.balanceOf(strategy.address)).to.be.equal(0); // All nUSD should be staked
        expect(await strategy.checkBalance()).to.be.within(usdcUnits("699.0"), usdcUnits("700.0"));

    });
    it("Should be able to withdrawAll"+ " @fast @see  @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("1199.0"), usdcUnits("1200.0"));

        console.log("Before Allocation -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        try {
          await vault.allocate();
        } catch (error) {
          console.error("Allocation failed", error.message);          
        }
        console.log("After Allocation -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation -",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());
        expect(await usdcLPToken.balanceOf(strategy.address)).to.be.equal(0); // All usdcLPToken should be staked

        console.log("Withdrawing all through Vault")
        await vault
          .connect(governor)
          .withdrawAllFromStrategy(strategy.address);
          
        console.log("After Withdrawal -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Withdrawal -",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log("After Withdrawal -",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log("After Withdrawal -",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("1199.0"), usdcUnits("1200.0"));
    });
    it("Testing DODO library with failing amount"+ " @see @fork", async function () {
      console.log("---------------------------------------------------------------------------")
      console.log("                Testing DODO library with failing amount")
      console.log("---------------------------------------------------------------------------")
      console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));
      const libary = await ethers.getContract("StrategyDodoLibrary");
      const output  = await libary._getAmountIn(248639, strategy.address)
      console.log("Output from Library: ", output);
    });

    it("Should be able to withdraw arbitrary amount"+ " @see @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                Should be able to withdraw arbitrary amount")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
        await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        console.log("After Allocation -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation -",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log("After Allocation -",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());
        expect(await usdcLPToken.balanceOf(strategy.address)).to.be.equal(0); // All usdcLPToken should be staked

        console.log("Withdrawing 100 through Vault")
        await strategy.connect(governor)["withdraw(address,address,uint256)"](vault.address, usdc.address, usdcUnits("100.0"));

        console.log("Withdrawing 900 through Vault")
        await strategy.connect(governor)["withdraw(address,address,uint256)"](vault.address, usdc.address, usdcUnits("900.0"));
          
        console.log("After Withdrawal -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Withdrawal -",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log("After Withdrawal -",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log("After Withdrawal -",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("999.0"), usdcUnits("1001.0"));
    });

    it("Should NOT be able to withdraw more amount than it holds"+ " @see @fork", async function () {
      console.log("---------------------------------------------------------------------------")
      console.log("               Should NOT be able to withdraw more amount than it holds")
      console.log("---------------------------------------------------------------------------")
      console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

      console.log("Adding USDC")
      await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);

      await expectApproxSupply(cash, cashUnits("1200"));

      console.log("After Allocation -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Allocation -",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
      console.log("After Allocation -",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
      console.log("After Allocation -",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());
      expect(await usdcLPToken.balanceOf(strategy.address)).to.be.equal(0); // All usdcLPToken should be staked

      console.log("Withdrawing 100 through Vault")
      await strategy.connect(governor)["withdraw(address,address,uint256)"](vault.address, usdc.address, usdcUnits("100.0"));
      expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("99.0"), usdcUnits("101.0"));
      console.log("After Withdrawal -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());

      console.log("Trying to Withdrawing 1000 through Vault")
      await strategy.connect(governor)["withdraw(address,address,uint256)"](vault.address, usdc.address, usdcUnits("1000.0"));
        
      console.log("After Withdrawal -",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
  });

    it("Should collect rewards"+ " @slow  @fork", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")

        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("1199.0"), usdcUnits("1200.0"));;
        
        let prefix = "Before Allocation";
        console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        await vault.allocate();
        prefix = "After Allocation";
        console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());
        expect(await usdcLPToken.balanceOf(strategy.address)).to.be.equal(0); // All nUSD should be staked

        await harvester.connect(governor)["harvest(address)"](strategy.address);

        prefix = "After Harvest";
        console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());

        console.log(prefix, "-",strategyName ,"- USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 2; i++) {
            let wait = 4;
            console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);
            await harvester.connect(governor)["harvest(address)"](strategy.address);
            console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
            console.log(prefix, "-",strategyName ,"- DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
            console.log(prefix, "-",strategyName ,"- USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
    
            console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
            console.log(prefix, "-",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
            console.log(prefix, "-",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
            console.log(prefix, "-",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());
    
            console.log(prefix, "-",strategyName ,"- USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());
        }

        await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        prefix = "Before Harvest";
        console.log("Before Harvest - USDC in Matt :",usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](strategy.address);
        prefix = "After Harvest & Distribute";
        console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log(prefix, "-",strategyName ,"- USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "-",strategyName ,"- USDC in ", strategyName ,":", usdcUnitsFormat(await usdc.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- usdcLPToken in ", strategyName ,":", daiUnitsFormat(await usdcLPToken.balanceOf(strategy.address)).toString());
        console.log(prefix, "-",strategyName ,"- DODO in ", strategyName ,":", daiUnitsFormat(await DODO.balanceOf(strategy.address)).toString());

        console.log(prefix, "-",strategyName ,"- USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());

        console.log(prefix, "- USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString()); 
        console.log(prefix, "- USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString()); 
        console.log(prefix, "- USDC in Dripper:", usdcUnitsFormat(await usdc.balanceOf(dripper.address)).toString()); 
        console.log(prefix, "- USDC in Matt (for calling h&S reward added) :",usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString()); 

    });

  });
});
