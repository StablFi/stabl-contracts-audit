const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  cashUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  getOracleAddress,
  setOracleTokenPriceUsd,
  expectApproxSupply,
  loadFixture,
} = require("../helpers");

describe("Vault rebase pausing @fast @mock", async () => {
  it("Should allow governor to call rebase @fast @mock", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).rebase();
  });

  it("Should not allow anyone to call rebase @fast @mock", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).rebase()).to.be.revertedWith(
      "Caller is not the Governor or Rebase Manager"
    );
  });

  it("Should allow rebase manager to call rebase @fast @mock", async () => {
    let { vault, anna, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).addRebaseManager(anna.address);
    await vault.connect(anna).rebase();
  });

  it("Should handle rebase pause flag correctly @fast @mock", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseRebase();
    await expect(vault.rebase()).to.be.revertedWith("Rebasing paused");
    await vault.connect(governor).unpauseRebase();
    await vault.rebase();
  });

  it("Should not allow the public to pause or unpause rebasing @fast @mock", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).pauseRebase()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseRebase()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow strategist to pause rebasing @fast @mock", async () => {
    let { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(josh.address);
    await vault.connect(josh).pauseRebase();
  });

  it("Should allow strategist to unpause rebasing @fast @mock", async () => {
    let { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(josh.address);
    await expect(vault.connect(josh).unpauseRebase()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow governor tonpause rebasing @fast @mock", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseRebase();
  });

  it("Should allow governor to unpause rebasing @fast @mock", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).unpauseRebase();
  });

  it("Rebase pause status can be read @fast @mock", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(await vault.connect(anna).rebasePaused()).to.be.false;
  });
});

describe("Vault rebasing @fast @mock", async () => {
  
  it("Should not alter balances after an asset price change @fast @mock", async () => {
    let { cash, vault, matt } = await loadFixture(defaultFixture);
    await expect(matt).has.a.balanceOf("100.00", cash);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", cash);
    await setOracleTokenPriceUsd("DAI", "1.30");

    await vault.rebase();
    await expect(matt).has.a.approxBalanceOf("100.00", cash);
    await setOracleTokenPriceUsd("DAI", "1.00");
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", cash);
  });

  it("Should not alter balances after an asset price change, single @fast @mock", async () => {
    let { cash, vault, matt } = await loadFixture(defaultFixture);
    await expect(matt).has.a.balanceOf("100.00", cash);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", cash);
    await setOracleTokenPriceUsd("DAI", "1.30");
    await vault.rebase();
    await expect(matt).has.a.approxBalanceOf("100.00", cash);
    await setOracleTokenPriceUsd("DAI", "1.00");
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", cash);
  });

  it("Should not alter balances after an asset price change with multiple assets @fast @mock", async () => {
    let { cash, vault, matt, usdc } = await loadFixture(defaultFixture);

    await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200"), 0);
    expect(await cash.totalSupply()).to.eq(cashUnits("400.0"));
    await expect(matt).has.a.balanceOf("300.00", cash);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("300.00", cash);

    await setOracleTokenPriceUsd("DAI", "1.30");
    await vault.rebase();
    expect(await cash.totalSupply()).to.eq(cashUnits("400.0"));
    await expect(matt).has.an.approxBalanceOf("300.00", cash);

    await setOracleTokenPriceUsd("DAI", "1.00");
    await vault.rebase();
    expect(await cash.totalSupply()).to.eq(
      cashUnits("400.0"),
      "After assets go back"
    );
    await expect(matt).has.a.balanceOf("300.00", cash);
  });

  it("Should alter balances after supported asset deposited and rebase called for rebasing accounts @fast @mock", async () => {
    let { cash, vault, matt, usdc, josh } = await loadFixture(defaultFixture);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("100.00", cash);
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf(
      "200.00",
      cash,
      "Matt has wrong balance"
    );
    await expect(josh).has.an.approxBalanceOf(
      "200.00",
      cash,
      "Josh has wrong balance"
    );
  });

  it("Should not alter balances after supported asset deposited and rebase called for non-rebasing accounts @fast @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("100.00", cash);

    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));

    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);

    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    await expect(matt).has.an.approxBalanceOf("300.00", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
  });

  //  NOTE: NOT AVAILABLE IN CURRENT MOCK TEST ENVIRONMENT
  // it("Should not allocate unallocated assets when no Strategy configured @fast @mock", async () => {
  //   const { anna, governor, dai, usdc, usdt, tusd, vault } = await loadFixture(
  //     defaultFixture
  //   );

  //   await dai.connect(anna).transfer(vault.address, daiUnits("100"));
  //   await usdc.connect(anna).transfer(vault.address, usdcUnits("200"));
  //   await usdt.connect(anna).transfer(vault.address, usdtUnits("300"));
  //   await tusd.connect(anna).transfer(vault.address, tusdUnits("400"));

  //   await expect(await vault.getStrategyCount()).to.equal(0);
  //   await vault.connect(governor).allocate();

  //   // All assets should still remain in Vault

  //   // Note defaultFixture sets up with 200 DAI already in the Strategy
  //   // 200 + 100 = 300
  //   await expect(await dai.balanceOf(vault.address)).to.equal(daiUnits("300"));
  //   await expect(await usdc.balanceOf(vault.address)).to.equal(
  //     usdcUnits("200")
  //   );
  //   await expect(await usdt.balanceOf(vault.address)).to.equal(
  //     usdtUnits("300")
  //   );
  //   await expect(await tusd.balanceOf(vault.address)).to.equal(
  //     tusdUnits("400")
  //   );
  // });

  it("Should correctly handle a deposit of USDC (6 decimals) @fast @mock", async function () {
    const { anna, cash, usdc, vault } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0", cash);
    // The price should be limited by the code to $1
    await setOracleTokenPriceUsd("USDC", "1.20");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50"), 0);
    await expect(anna).has.a.balanceOf("50", cash);
  });

  it("Should allow priceProvider to be changed @fast @mock", async function () {
    const { anna, governor, vault } = await loadFixture(defaultFixture);
    const oracle = await getOracleAddress(deployments);
    await expect(await vault.priceProvider()).to.be.equal(oracle);
    const annaAddress = await anna.getAddress();
    await vault.connect(governor).setPriceProvider(annaAddress);
    await expect(await vault.priceProvider()).to.be.equal(annaAddress);

    // Only governor should be able to set it
    await expect(
      vault.connect(anna).setPriceProvider(oracle)
    ).to.be.revertedWith("Caller is not the Governor");

    await vault.connect(governor).setPriceProvider(oracle);
    await expect(await vault.priceProvider()).to.be.equal(oracle);
  });
});
