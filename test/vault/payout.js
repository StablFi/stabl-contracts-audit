const { BigNumber } = require("ethers");

const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  cashUnits,
  daiUnits,
  usdcUnits,
  usdcUnitsFormat,
  daiUnitsFormat,
  cashUnitsFormat,
  usdtUnits,
  loadFixture,
  setOracleTokenPriceUsd,
  isFork,
  expectApproxSupply,
  advanceTime,
} = require("../helpers");

describe("Vault Redeem", function () {
  it("Should payout correctly with primary stable @fork", async () => {
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

    console.log(
      "MATT CASH Balance: ",
      cashUnitsFormat((await cash.balanceOf(matt.address)).toString())
    );
    console.log(
      "MATT USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString())
    );
    console.log(
      "Labs USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString())
    );
    console.log(
      "Team USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString())
    );

    console.log("Minting 1000 USDC");
    await usdc.connect(matt).approve(vault.address, usdcUnits("1000.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("1000.0"), 0);

    console.log("Setting the Josh as a Rebase Manager");
    await vault.connect(governor).addRebaseManager(josh.address);

    console.log("Performing payout...");
    await vault.connect(josh).payout();

    let wait = 24 * 60;
    console.log(
      "Simulating wait for " +
        wait +
        " minutes - Started at: " +
        new Date().toLocaleString()
    );
    await advanceTime(wait * 60 * 1000);

    console.log("Performing payout...");
    await vault.connect(josh).payout();

    console.log(
      "MATT CASH Balance: ",
      cashUnitsFormat((await cash.balanceOf(matt.address)).toString())
    );
    console.log(
      "JOSH CASH Balance: ",
      cashUnitsFormat((await cash.balanceOf(josh.address)).toString())
    );
    console.log(
      "Labs USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString())
    );
    console.log(
      "Team USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString())
    );
    console.log(
      "Harvester USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(harvester.address)).toString())
    );
    console.log(
      "Dripper USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(dripper.address)).toString())
    );
    console.log(
      "Vault USDC Balance: ",
      usdcUnitsFormat((await usdc.balanceOf(vault.address)).toString())
    );
  });
  it("Should not allow anyone to do payout @mock", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(anna).payout()
    ).to.be.revertedWith("Caller is not the Governor or Rebase Manager");
  });
  it("Should not allow anyone to set payout timings @mock", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(anna).setNextPayoutTime(2000)
    ).to.be.revertedWith("Caller is not the Governor");
    await expect(
      vault.connect(anna).setPayoutIntervals(2000, 2000)
    ).to.be.revertedWith("Caller is not the Governor");
  });

});
