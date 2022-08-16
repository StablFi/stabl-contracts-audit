const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
    sleep
  } = require("../../../utils/deploy");

const { defaultFixture } = require("../../_fixture");
const {
  daiUnits,
  USDTUnits,
  cashUnits,
  usdtUnitsFormat,
  usdcUnitsFormat,
  daiUnitsFormat,
  quickUnits,
  meshUnits,
  dystPairUnits,
  units,
  loadFixture,
  expectApproxSupply,
  getBlockTimestamp,
  isFork,
  usdtUnits,
  advanceTime,
} = require("../../helpers");
const { min } = require("lodash");

describe("Synapse Strategy", function () {
  
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
    crv,
    wmatic,
    syn,
    nusd,
    synapseStrategyProxy
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
    crv = fixture.crv;
    Labs = fixture.Labs;
    Team = fixture.Team;
    
    synapseStrategy = fixture.cSynapseStrategyUSDT;
    syn = fixture.SYN;
    nUSD = fixture.nUSD;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the SynapseStrategy as default strategy for USDT");
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdt.address, synapseStrategy.address);
});

  describe("Synapse Strategy", function () {
    it("Should be able to mint USDT and it should show up in the SynapseStrategy core @fork", async function () {
        console.log("--------------------------------------------------------------------------------------------")
        console.log("Should be able to mint USDT and it should show up in the SynapseStrategy core")
        console.log("--------------------------------------------------------------------------------------------")
        
        console.log("Matt USDT Balance: ", usdtUnitsFormat(await usdt.balanceOf(matt.address)));

        console.log("Adding USDT")
        await usdt.connect(matt).approve(vault.address, usdtUnits("500.0"));
        await vault.connect(matt).justMint(usdt.address, usdtUnits("500.0"), 0);

        await expectApproxSupply(cash, cashUnits("700"));

        expect(await usdt.balanceOf(vault.address)).to.be.within(usdtUnits("499.0"), usdtUnits("500.0"));;

        console.log("Before Allocation - SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")

        await vault.allocate();

        console.log("After Allocation - SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log("After Allocation - SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
        console.log("After Allocation - SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
        console.log("After Allocation - SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
        console.log("After Allocation - SynapseStrategy - USDT equivalent in SynapseStrategy:", usdtUnitsFormat(await synapseStrategy.checkBalance()).toString());

        expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0); // All nUSD should be staked
        expect(await synapseStrategy.checkBalance()).to.be.within(usdtUnits("499.0"), usdtUnits("500.0"));

    });
    it("Should be able to withdrawAll @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt USDT Balance: ", usdtUnitsFormat(await usdt.balanceOf(matt.address)));

        console.log("Adding USDT")
        await usdt.connect(matt).approve(vault.address, usdtUnits("1000.0"));
        await vault.connect(matt).justMint(usdt.address, usdtUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        expect(await usdt.balanceOf(vault.address)).to.be.within(usdtUnits("999.0"), usdtUnits("1000.0"));;

        console.log("Before Allocation - SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        try {
          await vault.allocate();
        } catch (error) {
          console.error("Allocation failed", error.message);          
        }
        console.log("After Allocation - SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log("After Allocation - SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
        console.log("After Allocation - SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
        console.log("After Allocation - SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
        expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0); // All nUSD should be staked

        console.log("Withdrawing all through Vault")
        await vault
          .connect(governor)
          .withdrawAllFromStrategy(synapseStrategy.address);
          
          console.log("After Withdrawal - SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
          console.log("After Withdrawal - SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
          console.log("After Withdrawal - SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
          console.log("After Withdrawal - SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

        expect(await syn.balanceOf(synapseStrategy.address)).to.be.equal(0);
        expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0);
        expect(await usdt.balanceOf(vault.address)).to.be.within(usdtUnits("999.0"), usdtUnits("1000.0"));;
    });

    it("Should collect rewards @fork", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")

        console.log("Matt USDT Balance: ", usdtUnitsFormat(await usdt.balanceOf(matt.address)));

        console.log("Adding USDT")
        await usdt.connect(matt).approve(vault.address, usdtUnits("1000.0"));
        await vault.connect(matt).justMint(usdt.address, usdtUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        expect(await usdt.balanceOf(vault.address)).to.be.within(usdtUnits("999.0"), usdtUnits("1000.0"));;
        
        let prefix = "Before Allocation";
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        await vault.allocate();
        prefix = "After Allocation";
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in Harvester:", usdtUnitsFormat(await usdt.balanceOf(harvester.address)).toString());
        expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0); // All nUSD should be staked

        await harvester.connect(governor)["harvest(address)"](synapseStrategy.address);

        prefix = "After Harvest";
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

        console.log(prefix, "- SynapseStrategy - USDT in Harvester:", usdtUnitsFormat(await usdt.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 3; i++) {
            let wait = 4;
            console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);
            await harvester.connect(governor)["harvest(address)"](synapseStrategy.address);
            console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
            console.log(prefix, "- SynapseStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
            console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
    
            console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
            console.log(prefix, "- SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
            console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
            console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
    
            console.log(prefix, "- SynapseStrategy - USDT in Harvester:", usdtUnitsFormat(await usdt.balanceOf(harvester.address)).toString());
        }

        // await expect(await usdt.balanceOf(harvester.address)).to.be.above(0);
        prefix = "Before Harvest";
        console.log("Before Harvest - USDT in Matt :",usdtUnitsFormat(await usdt.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](synapseStrategy.address);
        prefix = "After Harvest & Distribute";
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in SynapseStrategy:", usdtUnitsFormat(await usdt.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

        console.log(prefix, "- SynapseStrategy - USDT in Harvester:", usdtUnitsFormat(await usdt.balanceOf(harvester.address)).toString());

        console.log(prefix, "- USDT in Dripper:", usdtUnitsFormat(await usdt.balanceOf(dripper.address)).toString()); 
        console.log(prefix, "- USDT in Matt (for calling h&S reward added) :",usdtUnitsFormat(await usdt.balanceOf(matt.address)).toString()); 

    });

  });
});
