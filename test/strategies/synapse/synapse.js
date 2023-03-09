const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
  sleep
} = require("../../../utils/deploy");

const { defaultFixture } = require("../../_fixture");
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
  advanceTime,
} = require("../../helpers");
const { min } = require("lodash");
strategyName = "Synapse Strategy - USDC"
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
    synapseStrategy,
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
    crv = fixture.crv;
    Labs = fixture.Labs;
    Team = fixture.Team;

    synapseStrategy = fixture.cSynapseStrategy;
    strategy = synapseStrategy;
    syn = fixture.SYN;
    nUSD = fixture.nUSD;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the SynapseStrategy as default strategy for USDC");
    try {
      await vault
        .connect(governor)
        .setQuickDepositStrategies([strategy.address]);
    } catch(error) {
      console.log("Error setting the", strategyName, "as quick deposit strategy");
    }
    try {
      await vault
        .connect(governor)
        .setAssetDefaultStrategy(usdc.address, "0x0000000000000000000000000000000000000000");
      await vault
        .connect(governor)
        .setAssetDefaultStrategy(dai.address, "0x0000000000000000000000000000000000000000");
      await vault
        .connect(governor)
        .setAssetDefaultStrategy(usdt.address, "0x0000000000000000000000000000000000000000");
      await vault
        .connect(governor)
        .setAssetDefaultStrategy(usdc.address, strategy.address);
    } catch (error) {
      console.log("Error setting the", strategyName, "as default strategy");
    }

    try {
      await vault
        .connect(governor)
        .setStrategyWithWeights([{
          strategy: strategy.address,
          contract: "Strategy",
          minWeight: 0,
          targetWeight: 100000,
          maxWeight: 100000,
          enabled: true,
          enabledReward: true,
        }]);
    } catch (error) {
      console.log("Error setting the", strategyName, "as default strategy");

    }
    try {

      await vault.connect(governor).approveStrategy(strategy.address);
    } catch (error) {
      console.log("Error approving the", strategyName, "as default strategy");

    }
  });

  describe("SynapseStrategy Strategy", function () {
    it("Should be able to mint USDC and it should show up in the SynapseStrategy core @fork" + " @fast", async function () {
      console.log("--------------------------------------------------------------------------------------------")
      console.log("Should be able to mint USDC and it should show up in the SynapseStrategy core")
      console.log("--------------------------------------------------------------------------------------------")

      console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

      console.log("Adding USDC")
      await usdc.connect(matt).approve(vault.address, usdcUnits("45000.0"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("45000.0"), 0);

      console.log("After Allocation - SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Allocation - SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
      console.log("After Allocation - SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
      console.log("After Allocation - SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
      console.log("After Allocation - SynapseStrategy - USDC equivalent in SynapseStrategy:", usdcUnitsFormat(await synapseStrategy.checkBalance()).toString());

      expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0); // All nUSD should be staked
      expect(await synapseStrategy.checkBalance()).to.be.within(usdcUnits("44887.4"), usdcUnits("44887.5"));

    });
    it("Should be able to withdrawAll" + " @fast" + " @fork", async function () {
      console.log("---------------------------------------------------------------------------")
      console.log("                       Should be able to withdrawAll")
      console.log("---------------------------------------------------------------------------")
      console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

      console.log("Adding USDC")
      await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);

      console.log("Before Allocation - SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Allocation - SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Allocation - SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
      console.log("After Allocation - SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
      console.log("After Allocation - SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
      expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0); // All nUSD should be staked

      console.log("Withdrawing all through Vault")
      await vault
        .connect(governor)
        .withdrawAllFromStrategy(synapseStrategy.address);

      console.log("After Withdrawal - SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log("After Withdrawal - SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
      console.log("After Withdrawal - SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
      console.log("After Withdrawal - SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

      expect(await syn.balanceOf(synapseStrategy.address)).to.be.equal(0);
      expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0);
      expect(await strategy.checkBalance()).to.be.equal(usdcUnits("0"));
    });

    it("Should collect rewards" + " @slow @fork", async () => {
      console.log("---------------------------------------------------------------------------")
      console.log("                        Should collect rewards")
      console.log("---------------------------------------------------------------------------")

      console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

      console.log("Adding USDC")
      await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);

      prefix = "After Allocation";
      console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());
      expect(await nUSD.balanceOf(synapseStrategy.address)).to.be.equal(0); // All nUSD should be staked

      await harvester.connect(governor)["harvest(address)"](synapseStrategy.address);

      prefix = "After Harvest";
      console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

      console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

      console.log(prefix, "- SynapseStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());

      for (let i = 0; i < 1; i++) {
        let wait = 4;
        console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
        await advanceTime(wait * 60 * 1000);
        await harvester.connect(governor)["harvest(address)"](synapseStrategy.address);
        console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log(prefix, "- SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
        console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

        console.log(prefix, "- SynapseStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());
      }

      // await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
      prefix = "Before Harvest";
      console.log("Before Harvest - USDC in Matt :", usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString());
      console.log("Performing Harvest & Distribute")
      await harvester.connect(governor)["harvestAndDistribute(address)"](synapseStrategy.address);
      prefix = "After Harvest & Distribute";
      console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

      console.log(prefix, "- SynapseStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDC in SynapseStrategy:", usdcUnitsFormat(await usdc.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - nUSD in SynapseStrategy:", daiUnitsFormat(await nUSD.balanceOf(synapseStrategy.address)).toString());
      console.log(prefix, "- SynapseStrategy - SYN in SynapseStrategy:", daiUnitsFormat(await syn.balanceOf(synapseStrategy.address)).toString());

      console.log(prefix, "- SynapseStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString());
      console.log(prefix, "- SynapseStrategy - USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString());

      console.log(prefix, "- USDC in Dripper:", usdcUnitsFormat(await usdc.balanceOf(dripper.address)).toString());
      console.log(prefix, "- USDC in Matt (for calling h&S reward added) :", usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString());

    });

  });
});
