const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const { usdcUnits, loadFixture, isFork } = require("../helpers");

describe("Vault deposit pausing @mock", async () => {
  
  it("Governor can pause and unpause  @fast @mock", async () => {
    const { anna, governor, vault } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Strategist can pause and unpause  @fast @mock", async () => {
    const { anna, strategist, vault } = await loadFixture(defaultFixture);
    await vault.connect(strategist).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(strategist).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Other can not pause and unpause  @fast @mock", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).pauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it("Pausing deposits stops mint  @fast @mock", async () => {
    const { anna, governor, vault, usdc } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0))
      .to.be.reverted;
  });

  it("Unpausing deposits allows mint  @fast @mock", async () => {
    const { anna, matt,  governor, vault, usdc } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
    await usdc.connect(matt).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("50.0"), 0);
  });

  it("Deposit pause status can be read  @fast @mock", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Only governor can set the mint fee @mock", async  () => {
    const { anna, matt,  governor, vault } = await loadFixture(
      defaultFixture
    );
    await expect(vault.connect(matt).setMintFeeBps(100)).to.be.revertedWith("Caller is not the Governor");
    await vault.connect(governor).setMintFeeBps(100);
    expect(await vault.connect(anna).mintFeeBps()).to.equal(100);
  });

  it("Mint fee change should relay an event @mock", async  () => {
    const { governor, vault } = await loadFixture(
      defaultFixture
    );
    await expect(vault.connect(governor).setMintFeeBps(100))
      .to.emit(vault, "MintFeeChanged(address,uint256,uint256)")
      .withArgs(governor.address, 0, 100);
  });

});
