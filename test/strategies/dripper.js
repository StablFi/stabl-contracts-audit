const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");

const { loadFixture, usdtUnits, advanceTime, usdtUnitsFormat, cashUnitsFormat, usdcUnitsFormat, usdcUnits} = require("../helpers");

describe("Dripper", async () => {
  let dripper, usdc, vault, cash, governor, josh;
  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    dripper = fixture.dripper;
    usdc = fixture.usdc;
    vault = fixture.vault;
    cash = fixture.cash;
    governor = fixture.governor;
    josh = fixture.josh;

    await usdc.mintTo(dripper.address, usdtUnits("1000"));
  });

  async function emptyDripper() {
    const balance = await usdc.balanceOf(dripper.address);
    await dripper.connect(governor).transferToken(usdc.address, balance);
  }

  async function expectApproxCollectOf(amount, fn) {
    const before = await usdc.balanceOf(vault.address);
    await fn();
    const after = await usdc.balanceOf(vault.address);
    const collected = after.sub(before);
    expect(collected).gte(usdtUnits(amount).mul(998).div(1000));
    expect(collected).lte(usdtUnits(amount).mul(1002).div(1000));
  }

  describe("availableFunds()", async () => {
    it("shows zero available before any duration has been set", async () => {
      await advanceTime(1000);
      expect(await dripper.availableFunds()).to.equal(0);
    });
    it("returns a number after a duration has been set", async () => {
      await dripper.connect(governor).setDripDuration("2000");
      await advanceTime(1000);
      expect(await dripper.availableFunds()).to.equal(usdtUnits("500"));
    });
    it("returns zero if no balance", async () => {
      await dripper.connect(governor).setDripDuration("2000");
      await advanceTime(1000);
      await emptyDripper();
      expect(await dripper.availableFunds()).to.equal(usdtUnits("0"));
    });
  });
  describe("collect()", async () => {
    it("transfers funds to the vault", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(1000);
      await expectApproxCollectOf("50", dripper.collect);
    });
    it("collects what is reported by availableFunds()", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(17890);
      const expected = ((await dripper.availableFunds()) / 1e6).toString();
      await expectApproxCollectOf(expected, dripper.collect);
    });
  });

  describe("Drip math", async () => {
    it("gives all funds if collect is after the duration end", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(20001);
      await expectApproxCollectOf("1000", dripper.collect);
    });
    it("gives 98% of funds if the collect is 98% to the duration", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(19600);
      await expectApproxCollectOf("980", dripper.collect);
    });
    it("adding funds does not change the current drip rate", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await usdc.mintTo(dripper.address, usdtUnits("3000"));
      await advanceTime(19600);
      await expectApproxCollectOf("980", dripper.collect);
    });
    it("rounds down the rate", async () => {
      await emptyDripper();
      await usdc.mintTo(dripper.address, 999); // 1/1000 of a USDC
      await dripper.connect(governor).setDripDuration("1000");
      await advanceTime(500);
      // Per block rate should be zero
      await expectApproxCollectOf("0", dripper.collect);
    });
  });
  describe("collectTokens()", async () => {
    it("transfers funds to governor", async () => {
      await expect(governor).to.have.balanceOf("1000", usdc);
      await expect(dripper).to.have.balanceOf("1000", usdc);
      const balance = usdc.balanceOf(dripper.address);
      await dripper.connect(governor).transferToken(usdc.address, balance);
      await expect(dripper).to.have.balanceOf("0", usdc);
      await expect(governor).to.have.balanceOf("2000", usdc);
    });
    it("cannot be called by the public", async () => {
      await expect(dripper.connect(josh).transferToken(usdc.address, 1)).to.be
        .reverted;
    });
  });
  describe("setDripDuration()", async () => {
    it("transfers funds to governor", async () => {
      await dripper.connect(governor).setDripDuration(1000);
      expect(await dripper.dripDuration()).to.equal(1000);
    });
    it("cannot be called by the public", async () => {
      await expect(dripper.connect(josh).setDripDuration(1000)).to.be.reverted;
    });
    it("cannot be set to zero by the public", async () => {
      await expect(
        dripper.connect(governor).setDripDuration(0)
      ).to.be.revertedWith("duration must be non-zero");
    });
  });
});

describe("Dripper's collectAndRebase()", async () => {
  it("Should correctly drip funds to the Vault @fork ", async () => {
    const {
      cash,
      vault,
      usdc,
      matt,
      Labs,
      Team,
      josh,
      dripper,
      harvester,
      governor,
      cSynapseStrategy,
      cMeshSwapStrategyUSDC,
      cDodoStrategy
    } = await loadFixture(defaultFixture);

    console.log("Setting new weights...")
    let weights = [
      {
        strategy: cSynapseStrategy.address,
        contract: "SynapseStrategy",
        name: "Synapse - USDC",
        minWeight: 0,
        targetWeight: 70,
        maxWeight: 100,
        enabled: true,
        enabledReward: true,
      },
      {
        strategy: cDodoStrategy.address,
        contract: "DodoStrategy",
        name: "Dodo - USDC",
        minWeight: 0,
        targetWeight: 20,
        maxWeight: 100,
        enabled: true,
        enabledReward: true,
      },
      {
        "strategy": cMeshSwapStrategyUSDC.address,
        "contract": "MeshSwapStrategy",
        "name": "MeshSwap USDC",
        "minWeight": 0,
        "targetWeight": 10,
        "maxWeight": 100,
        "enabled": true,
        "enabledReward": true
      },
    ];
    weights = weights.map(value => {

        delete value.name
        value.targetWeight = value.targetWeight * 1000;
        value.maxWeight = value.maxWeight * 1000;

        return value;
    })
    await vault.setStrategyWithWeights(weights);

    console.log("MATT CASH Balance: ",cashUnitsFormat((await cash.balanceOf(matt.address)).toString()));
    console.log("MATT USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()));
    console.log("Labs USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()));
    console.log("Team USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()));

    console.log("Minting 1000 USDC");
    await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);

    console.log("Setting the Josh as a Rebase Manager");
    await vault.connect(governor).addRebaseManager(josh.address);

    console.log("Performing payout...");
    await vault.connect(josh).payout();

    let wait = 24 * 60;
    console.log("Simulating wait for " +wait +" minutes - Started at: " +new Date().toLocaleString());
    await advanceTime(wait * 60 * 1000);

    console.log("Performing payout...");
    await vault.connect(josh).payout();

    console.log("MATT CASH Balance: ",cashUnitsFormat((await cash.balanceOf(matt.address)).toString()));
    console.log("JOSH CASH Balance: ",cashUnitsFormat((await cash.balanceOf(josh.address)).toString()));
    console.log("Labs USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()));
    console.log("Team USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()));
    console.log("Harvester USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(harvester.address)).toString()));
    console.log("Dripper USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(dripper.address)).toString()));
    console.log("Vault USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(vault.address)).toString()));

    let baseVaultAmount = await usdc.balanceOf(vault.address);
    let baseDripperAmount = await usdc.balanceOf(dripper.address);

    for (let index = 0; index < 10; index++) {
      let wait = 4;
      console.log("Simulating wait for " +wait +" minutes - Started at: " +new Date().toLocaleString());
      await advanceTime(wait * 60 * 1000);
      await dripper.connect(josh).collectAndRebase();  
      console.log("Dripper USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(dripper.address)).toString()));
      console.log("Vault USDC Balance: ",usdcUnitsFormat((await usdc.balanceOf(vault.address)).toString()));
      if ((await usdc.balanceOf(dripper.address)) == 0 ) {
        console.log("Dripper is now empty. Breaking...")
      }
    }

    expect(await usdc.balanceOf(vault.address)).to.be.above(baseVaultAmount);
    expect(await usdc.balanceOf(dripper.address)).to.be.below(baseDripperAmount);
    
  });

});