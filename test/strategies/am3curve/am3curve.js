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

describe("Am3CurveStrategy Strategy", function () {
  
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
    am3CurveStrategy,
    am3crv,
    amUSDC,
    amDAI,
    amUSDT,
    am3CurveGauge,
    vDebtUSDC,
    vDebtDAI,
    vDebtUSDT,

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
    crv = fixture.crv;
    Labs = fixture.Labs;
    Team = fixture.Team;

    Am3CurveStrategy = fixture.cAm3CurveStrategy;
    am3CurveGauge = fixture.am3CurveGauge;
    am3crv = fixture.am3crv;
    amDAI = fixture.amDAI;
    amUSDC = fixture.amUSDC;
    amUSDT = fixture.amUSDT;
    vDebtUSDC = fixture.aaveVDebtUSDC;
    vDebtDAI = fixture.aaveVDebtDAI;
    vDebtUSDT = fixture.aaveVDebtUSDT;
    erc20Abi = fixture.erc20Abi;

    harvester = fixture.harvester;
    dripper = fixture.dripper;

    console.log("Setting the Am3CurveStrategy as default strategy for USDC");
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, Am3CurveStrategy.address);
});

  describe("Am3CurveStrategy Strategy @fast", function () {
    it("Should be able to mint USDC and it should show up in the Am3CurveStrategy core @fast @fork", async function () {
        console.log("--------------------------------------------------------------------------------------------")
        console.log("Should be able to mint USDC and it should show up in the Am3CurveStrategy core")
        console.log("--------------------------------------------------------------------------------------------")
        
        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("500.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("500.0"), 0);

        await expectApproxSupply(cash, cashUnits("700"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("699.0"), usdcUnits("700.0"));;

        console.log("Before Allocation - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")

        await vault.allocate();

        console.log("After Allocation - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - amUSDC in Am3CurveStrategy:", usdcUnitsFormat(await amUSDC.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - USDC equivalent in Am3CurveStrategy:", usdcUnitsFormat(await Am3CurveStrategy.checkBalance()).toString());

        expect(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).to.be.above(0);
        expect(await Am3CurveStrategy.checkBalance()).to.be.within(usdcUnits("699.0"), usdcUnits("700.0"));;

    });

    it("Should be able to withdrawAll @fast @fork", async function () {
        console.log("---------------------------------------------------------------------------")
        console.log("                       Should be able to withdrawAll")
        console.log("---------------------------------------------------------------------------")
        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("1199.0"), usdcUnits("1200.0"));;

        console.log("Before Allocation - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        try {
          await vault.allocate();
        } catch (error) {
          console.error("Allocation failed", error.message);          
        }
        console.log("After Allocation - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - amUSDC in Am3CurveStrategy:", usdcUnitsFormat(await amUSDC.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());
        expect(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).to.be.above(0);

        console.log("Withdrawing all through Vault")
        await vault
          .connect(governor)
          .withdrawAllFromStrategy(Am3CurveStrategy.address);
          
        console.log("After Withdrawal - Am3CurveStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log("After Withdrawal - Am3CurveStrategy - amUSDC in Vault:", usdcUnitsFormat(await amUSDC.balanceOf(vault.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - amDAI in Vault:", daiUnitsFormat(await amDAI.balanceOf(vault.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - amUSDT in Vault:", usdtUnitsFormat(await amUSDT.balanceOf(vault.address)).toString());

        console.log("After Withdrawal - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - DAI in Am3CurveStrategy:", daiUnitsFormat(await dai.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - USDT in Am3CurveStrategy:", usdtUnitsFormat(await usdt.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Withdrawal - Am3CurveStrategy - amUSDC in Am3CurveStrategy:", usdcUnitsFormat(await amUSDC.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - amDAI in Am3CurveStrategy:", daiUnitsFormat(await amDAI.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - amUSDT in Am3CurveStrategy:", usdtUnitsFormat(await amUSDT.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Withdrawal - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Withdrawal - Am3CurveStrategy - am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());

        expect(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).to.be.equal(0);
        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("1199.0"), usdcUnits("1200.0"));;
    });

    it("Should collect rewards @slow @fork", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("                        Should collect rewards")
        console.log("---------------------------------------------------------------------------")

        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        console.log("Adding USDC")
        await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
        await vault.connect(matt).justMint(usdc.address, usdcUnits("1000.0"), 0);

        await expectApproxSupply(cash, cashUnits("1200"));

        expect(await usdc.balanceOf(vault.address)).to.be.within(usdcUnits("1199.0"), usdcUnits("1200.0"));;

        console.log("Before Allocation - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        
        await vault.allocate();

        console.log("After Allocation - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - amUSDC in Am3CurveStrategy:", usdcUnitsFormat(await amUSDC.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Allocation - Am3CurveStrategy - am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());
        expect(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).to.be.above(0);

        await harvester.connect(governor)["harvest(address)"](Am3CurveStrategy.address);

        console.log("After Harvest - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest - Am3CurveStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log("After Harvest - Am3CurveStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log("After Harvest - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest - Am3CurveStrategy - DAI in Am3CurveStrategy:", daiUnitsFormat(await dai.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest - Am3CurveStrategy - USDT in Am3CurveStrategy:", usdtUnitsFormat(await usdt.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Harvest - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest - Am3CurveStrategy - am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Harvest - Am3CurveStrategy - wMATIC in Am3CurveStrategy:", daiUnitsFormat(await wmatic.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest - Am3CurveStrategy - CRV in Am3CurveStrategy:", daiUnitsFormat(await crv.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Harvest - Am3CurveStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());

        for (let i = 0; i < 5; i++) {
            let wait = 10;
            console.log("Simulating wait for " + wait + " minutes - Started at: " + new Date().toLocaleString());
            await advanceTime(wait*60*1000);
            await harvester.connect(governor)["harvest(address)"](Am3CurveStrategy.address);

            console.log("After Harvest - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
            console.log("After Harvest - Am3CurveStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
            console.log("After Harvest - Am3CurveStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());
    
            console.log("After Harvest - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
            console.log("After Harvest - Am3CurveStrategy - DAI in Am3CurveStrategy:", daiUnitsFormat(await dai.balanceOf(Am3CurveStrategy.address)).toString());
            console.log("After Harvest - Am3CurveStrategy - USDT in Am3CurveStrategy:", usdtUnitsFormat(await usdt.balanceOf(Am3CurveStrategy.address)).toString());

            console.log("After Harvest - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
            console.log("After Harvest - Am3CurveStrategy -  am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());
            
            console.log("After Harvest - Am3CurveStrategy - wMATIC in Am3CurveStrategy:", daiUnitsFormat(await wmatic.balanceOf(Am3CurveStrategy.address)).toString());
            console.log("After Harvest - Am3CurveStrategy - CRV in Am3CurveStrategy:", daiUnitsFormat(await crv.balanceOf(Am3CurveStrategy.address)).toString());
            
            console.log("After Harvest - Am3CurveStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());
        }

        // await expect(await usdc.balanceOf(harvester.address)).to.be.above(0);
        console.log("Before Harvest & Distribute - USDC in Matt :",(await usdc.balanceOf(matt.address)).toString()); 
        console.log("Performing Harvest & Distribute")
        await harvester.connect(governor)["harvestAndDistribute(address)"](Am3CurveStrategy.address);

        console.log("After Harvest & Distribute - Am3CurveStrategy - USDC in Vault:", usdcUnitsFormat(await usdc.balanceOf(vault.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - DAI in Vault:", daiUnitsFormat(await dai.balanceOf(vault.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - USDT in Vault:", usdtUnitsFormat(await usdt.balanceOf(vault.address)).toString());

        console.log("After Harvest & Distribute - Am3CurveStrategy - USDC in Am3CurveStrategy:", usdcUnitsFormat(await usdc.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - DAI in Am3CurveStrategy:", daiUnitsFormat(await dai.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - USDT in Am3CurveStrategy:", usdtUnitsFormat(await usdt.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Harvest & Distribute - Am3CurveStrategy - am3crv in Am3CurveStrategy:", daiUnitsFormat(await am3crv.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - am3CurveGauge in Am3CurveStrategy:", daiUnitsFormat(await am3CurveGauge.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - wMATIC in Am3CurveStrategy:", daiUnitsFormat(await wmatic.balanceOf(Am3CurveStrategy.address)).toString());
        console.log("After Harvest & Distribute - Am3CurveStrategy - CRV in Am3CurveStrategy:", daiUnitsFormat(await crv.balanceOf(Am3CurveStrategy.address)).toString());

        console.log("After Harvest & Distribute - Am3CurveStrategy - USDC in Harvester:", usdcUnitsFormat(await usdc.balanceOf(harvester.address)).toString());

        console.log("After Harvest & Distribute - USDC in Dripper:", usdcUnitsFormat(await usdc.balanceOf(dripper.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Labs:", usdcUnitsFormat(await usdc.balanceOf(Labs.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Team:", usdcUnitsFormat(await usdc.balanceOf(Team.address)).toString()); 
        console.log("After Harvest & Distribute - USDC in Matt (for calling h&S reward added) :",usdcUnitsFormat(await usdc.balanceOf(matt.address)).toString()); 

    });

  });
});
