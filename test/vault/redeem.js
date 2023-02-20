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
  runStrategyLogic,
} = require("../helpers");

describe("Vault Redeem", function () {
  beforeEach(async function () {
    const fixture = await loadFixture(defaultFixture);
    await runStrategyLogic(fixture.governor, "Tetu Strategy", fixture.cTetuUsdcStrategyProxy.address); // require whitelisting first.
    await runStrategyLogic(fixture.governor, "Tetu Strategy", fixture.cTetuDaiStrategyProxy.address); // require whitelisting first.
    await runStrategyLogic(fixture.governor, "Tetu Strategy", fixture.cTetuUsdtStrategyProxy.address); // require whitelisting first.
    console.log("strategy set & whitelisted");
  });
  it("Should allow a redeem with DAI @fork @special", async () => {
    const { cash, vault, dai, matt, Labs, Team, usdc } = await loadFixture(defaultFixture);
    console.log("")

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())

    console.log("Minting 100 DAI")
    await dai.connect(matt).approve(vault.address, daiUnits("100.0"));
    await vault.connect(matt).mint(dai.address, daiUnits("100.0"), 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    
    console.log("Rebasing the vault")
    await vault.rebase();

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    console.log("---")
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Redeeming All the CASH of Matt: ",  cashUnitsFormat(await cash.balanceOf(matt.address)).toString(), "CASH")
    await vault.connect(matt).redeem(await cash.balanceOf(matt.address) , 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())

    console.log("Rebasing the vault");
    await vault.rebase();
    
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    await expect(matt).has.a.balanceOf("0.00", cash);

  });

  it("Should allow a redeem with DAI and rebalance @fork @now", async () => {
    const { cash, vault, dai, matt, josh, Labs, Team, usdc } = await loadFixture(defaultFixture);
    console.log("")

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())

    console.log("Minting 100 DAI")
    await dai.connect(matt).approve(vault.address, daiUnits("100.0"));
    await vault.connect(matt).mint(dai.address, daiUnits("100.0"), 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    
    console.log("Balance the vault")
    await vault.balance();
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())

    console.log("Simulating 1 USDC harvest to Vault")
    await usdc.connect(josh).transfer(vault.address, usdcUnits("1.0"));

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    console.log("---")
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Redeeming All the CASH of Matt: ",  cashUnitsFormat(await cash.balanceOf(matt.address)).toString(), "CASH")
    await vault.connect(matt).redeem(await cash.balanceOf(matt.address) , 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    await expect(matt).has.a.balanceOf("0.00", cash);
  });

  it("Should allow a redeem with primary stable", async () => {
    const { cash, vault, usdc, matt, Labs, Team,  dai } = await loadFixture(defaultFixture);
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", ((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", ((await usdc.balanceOf(Team.address)).toString()))

    console.log("Minting 100 USDC")
    await usdc.connect(matt).approve(vault.address, usdcUnits("100.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("100.0"), 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    
    console.log("Rebasing the vault");
    vault.rebase();

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    
    console.log("Redeeming 90 CASH")
    await vault.connect(matt).redeem(cashUnits("90.0"), 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))

    console.log("Rebasing the vault");
    vault.rebase();
    
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    await expect(matt).has.a.balanceOf("0.00", cash);

  });

  it("Should correctly provide redeem outputs @fast @mock @redeemtest", async () => {
    const { cash, vault, usdc, matt, josh, Labs, Team,  dai } = await loadFixture(defaultFixture);
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    console.log("Setting AutoRebasing Threshold to 0")
    await vault.setRebaseThreshold(0);
    console.log("Vault Rebase Threshold (CASH): ", cashUnitsFormat(await vault.rebaseThreshold()).toString() );
    let redeemAmount = cashUnits("10.0");
    console.log("Redeeming 10 CASH from Matt")
    await vault.connect(matt).redeem(redeemAmount, 0);
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    
  });

  it("Should correctly provide redeem outputs @fast @mock @redeemtest", async () => {
    const { cash, vault, usdc, matt, josh, Labs, Team,  dai } = await loadFixture(defaultFixture);
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    let redeemAmount = cashUnits("10.0");
    console.log("Vault Redeem Fee Bps: ", (await vault.redeemFeeBps()).toString() );
    console.log("Vault Redeem Output - What redeemer get (1e6) : ", (await vault.redeemOutputs(redeemAmount))[0].toString() )
    console.log("Vault REDEEM Output - PrimaryStable (1e18): ", (await vault.redeemOutputs(redeemAmount))[1].toString())
    console.log("Vault Redeem Output - redeemFee on _amount (1e6): ", (await vault.redeemOutputs(redeemAmount))[2].toString() )
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    expect(await vault.redeemOutputs(redeemAmount)).to.deep.equal([
      usdcUnits("9.975"),
      cashUnits("200.0"),
      usdcUnits("0.025")
    ]);

  });

  it("Should correctly provide multiuser redeem outputs when CASH supply > Total Vault Value depreciates @fork", async () => {
    const { cash, governor, vault, usdc, matt, josh, Labs, Team,  dai } = await loadFixture(defaultFixture);
    
    let totalCashSupply = await cash.totalSupply();
    console.log("Total CASH Supply: ", cashUnitsFormat(totalCashSupply.toString()));
    console.log("Vault.checkBalance(): ", usdcUnitsFormat((await vault.checkBalance()).toString()));
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    console.log("JOSH USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(josh.address)).toString()))
    console.log("Labs USDC Balance: ", ((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", ((await usdc.balanceOf(Team.address)).toString()))
    // Initial MATT USDC
    let mattUSDCBalance = await usdc.balanceOf(matt.address);
    // Initial JOSH USDC
    let joshUSDCBalance = await usdc.balanceOf(josh.address);

    console.log("MATT - Minting 100 USDC")
    await usdc.connect(matt).approve(vault.address, usdcUnits("100.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("100.0"), 0);
    // need to add this in quickdeposit - Meshswap
  //   if (primaryStableBalanceFromToken0 + primaryStableBalance > 0) {
  //     return (primaryStableBalanceFromToken0 + primaryStableBalance) /2;
  // }
    console.log("JOSH - Minting 200 USDC")
    await usdc.connect(josh).approve(vault.address, usdcUnits("200.0"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("200.0"), 0);

    totalCashSupply = await cash.totalSupply();
    console.log("Total CASH Supply: ", cashUnitsFormat(totalCashSupply.toString()));
    console.log("Vault.checkBalance(): ", usdcUnitsFormat((await vault.checkBalance()).toString()));
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    console.log("JOSH USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(josh.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))

    totalCashSupply = await cash.totalSupply();
    console.log("Total CASH Supply: ", cashUnitsFormat(totalCashSupply.toString()));
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    console.log("JOSH USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(josh.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    
    console.log("MATT - Redeeming 100 CASH")
    await vault.connect(matt).redeem(cashUnits("100.0"), 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("JOSH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(josh.address)).toString()))
    console.log("JOSH USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(josh.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    // expect(await usdc.balanceOf(matt.address)).closeTo(mattUSDCBalance.sub(usdcUnits("100")), usdcUnits("1"));
    // expect(await usdc.balanceOf(josh.address)).closeTo(mattUSDCBalance.sub(usdcUnits("100")), usdcUnits("1"));

  });
  it("Check if redeem outputs are working correctly @fork @redeemoutputs", async () => {
    const { cash, vault, dai, matt, Labs, Team, usdc, governor, cTetuUsdtStrategyProxy } = await loadFixture(defaultFixture);
    console.log("")

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())

    // Setting fee to 0.25%
    await vault.setMintFeeBps(25);

    console.log("Minting 100 DAI")
    await dai.connect(matt).approve(vault.address, daiUnits("100.0"));
    await vault.connect(matt).mint(dai.address, daiUnits("100.0"), 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    
    console.log("Rebasing the vault")
    await vault.rebase();

    console.log("Quickdeposit startegy:", await vault.getQuickDepositStrategies())

    console.log("Withdrawing everything from quickdeposit")
    await vault.connect(governor).withdrawAllFromStrategy((await vault.getQuickDepositStrategies())[0]);


    console.log("Tranferring 100 USDC from the vault")
    await vault.connect(governor).transferToken(usdc.address, usdcUnits("100.0"));

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    console.log("---")
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Redeeming All the CASH of Matt: ",  cashUnitsFormat(await cash.balanceOf(matt.address)).toString(), "CASH")
    await vault.connect(matt).redeem(await cash.balanceOf(matt.address) , 0);

    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())

    console.log("Rebasing the vault");
    await vault.rebase();
    
    console.log("MATT CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
    console.log("MATT DAI Balance: ", daiUnitsFormat((await dai.balanceOf(matt.address)).toString()))
    console.log("Labs USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Labs.address)).toString()))
    console.log("Team USDC Balance: ", usdcUnitsFormat((await usdc.balanceOf(Team.address)).toString()))
    console.log("Total Vault Value: ", usdcUnitsFormat(await vault.totalValue()).toString())
    console.log("Total Cash Supply: ", cashUnitsFormat(await cash.totalSupply()).toString())
    await expect(matt).has.a.balanceOf("0.00", cash);

  });

  // it("Should allow a redeem @fast", async () => {
  //   const { cash, vault, usdc, anna, dai } = await loadFixture(defaultFixture);
  //   await expect(anna).has.a.balanceOf("1000.00", usdc);
  //   await expect(anna).has.a.balanceOf("1000.00", dai);
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
  //   await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);

  //   await expect(anna).has.a.balanceOf("50.00", cash);

  //   await vault.connect(anna).redeem(cashUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("0.00", cash);

  //   // Redeem outputs will be 50/250 * 50 USDC and 200/250 * 50 DAI from fixture

  //   await expect(anna).has.a.balanceOf("960.00", usdc);
  //   await expect(anna).has.a.balanceOf("1040.00", dai);
  //   expect(await cash.totalSupply()).to.eq(cashUnits("200.0"));
  // });

  // it("Should allow a redeem over the rebase threshold @fast", async () => {
  //   const { cash, vault, usdc, anna, matt, dai } = await loadFixture(
  //     defaultFixture
  //   );

  //   await expect(anna).has.a.balanceOf("1000.00", usdc);
  //   await expect(anna).has.a.balanceOf("1000.00", dai);

  //   await expect(anna).has.a.balanceOf("0.00", cash);
  //   await expect(matt).has.a.balanceOf("100.00", cash);

  //   // Anna mints CASH with USDC
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("1000.00"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("1000.00"), 0);
  //   await expect(anna).has.a.balanceOf("1000.00", cash);
  //   await expect(matt).has.a.balanceOf("100.00", cash);

  //   // Anna mints CASH with DAI
  //   await dai.connect(anna).approve(vault.address, daiUnits("1000.00"));
  //   await vault.connect(anna).justMint(dai.address, daiUnits("1000.00"), 0);
  //   await expect(anna).has.a.balanceOf("2000.00", cash);
  //   await expect(matt).has.a.balanceOf("100.00", cash);

  //   // Rebase should do nothing
  //   await vault.rebase();
  //   await expect(anna).has.a.balanceOf("2000.00", cash);
  //   await expect(matt).has.a.balanceOf("100.00", cash);

  //   // Anna redeems over the rebase threshold
  //   await vault.connect(anna).redeem(cashUnits("1500.0"), 0);
  //   await expect(anna).has.a.approxBalanceOf("500.00", cash);
  //   await expect(matt).has.a.approxBalanceOf("100.00", cash);

  //   // Redeem outputs will be 1000/2200 * 1500 USDC and 1200/2200 * 1500 DAI from fixture
  //   await expect(anna).has.an.approxBalanceOf("681.8181", usdc);
  //   await expect(anna).has.a.approxBalanceOf("818.1818", dai);

  //   await expectApproxSupply(cash, cashUnits("700.0"));
  // });

  // it("Changing an asset price affects a redeem @fast", async () => {
  //   const { cash, vault, usdc, matt } = await loadFixture(defaultFixture);
  //   await expectApproxSupply(cash, cashUnits("200"));
  //   await expect(matt).has.a.balanceOf("100.00", cash);
  //   await expect(matt).has.a.balanceOf("900.00", usdc);

  //   await setOracleTokenPriceUsd("USDC", "1.25");
  //   await vault.rebase();

  //   await vault.connect(matt).redeem(cashUnits("2.0"), 0);
  //   await expectApproxSupply(cash, cashUnits("198"));
  //   // Amount of DAI collected is affected by redeem oracles
  //   await expect(matt).has.a.approxBalanceOf("901.60", usdc);
  // });

  // it("Should allow redeems of non-standard tokens @fast", async () => {
  //   const { cash, vault, anna, usdc, governor, nonStandardToken } = await loadFixture(
  //     defaultFixture
  //   );

  //   await vault.connect(governor).supportAsset(nonStandardToken.address);

  //   await setOracleTokenPriceUsd("NonStandardToken", "1.00");

  //   await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);

  //   // Mint 100 CASH for 100 tokens
  //   await nonStandardToken
  //     .connect(anna)
  //     .approve(vault.address, usdtUnits("100.0"));
  //   await vault
  //     .connect(anna)
  //     .justMint(nonStandardToken.address, usdtUnits("100.0"), 0);
  //   await expect(anna).has.a.balanceOf("100.00", cash);

  //   // Redeem 100 tokens for 100 CASH
  //   await vault.connect(anna).redeem(cashUnits("100.0"), 0);

  //   await expect(anna).has.a.balanceOf("0.00", cash);
  //   await expect(anna).has.a.balanceOf("100.00", usdc);

  //   // 66.66 would have come back as USDC because there is 100 NST and 200 USDC
  //   await expect(anna).has.an.approxBalanceOf("933.33", nonStandardToken);
  // });

  // it("Should have a default redeem fee of 0 @fast", async () => {
  //   const { vault } = await loadFixture(defaultFixture);
  //   await expect(await vault.redeemFeeBps()).to.equal("0");
  // });

  // it("Should charge a redeem fee if redeem fee set @fast", async () => {
  //   const { cash, vault, usdc, anna, governor } = await loadFixture(
  //     defaultFixture
  //   );
  //   // 1000 basis points = 10%
  //   await vault.connect(governor).setRedeemFeeBps(1000);
  //   await expect(anna).has.a.balanceOf("1000.00", usdc);
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("50.00", cash);
  //   await vault.connect(anna).redeem(cashUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("0.00", cash);
  //   // 45 after redeem fee
  //   // USDC is 50/250 of total assets, so balance should be 950 + 50/250 * 45 = 959
  //   await expect(anna).has.a.balanceOf("959.00", usdc);
  // });

  // it("Should revert redeem if balance is insufficient @fast", async () => {
  //   const { cash, vault, usdc, anna } = await loadFixture(defaultFixture);

  //   // Mint some CASH tokens
  //   await expect(anna).has.a.balanceOf("1000.00", usdc);
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("50.00", cash);

  //   // Try to withdraw more than balance
  //   await expect(
  //     vault.connect(anna).redeem(cashUnits("100.0"), 0)
  //   ).to.be.revertedWith("Remove exceeds balance");
  // });

  // it("Should only allow Governor to set a redeem fee @fast", async () => {
  //   const { vault, anna } = await loadFixture(defaultFixture);
  //   await expect(vault.connect(anna).setRedeemFeeBps(100)).to.be.revertedWith(
  //     "Caller is not the Governor"
  //   );
  // });

  // it("Should redeem entire CASH balance @fast", async () => {
  //   const { cash, vault, usdc, dai, anna } = await loadFixture(defaultFixture);

  //   await expect(anna).has.a.balanceOf("1000.00", usdc);

  //   // Mint 100 CASH tokens using USDC
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("100.0"), 0);
  //   await expect(anna).has.a.balanceOf("100.00", cash);

  //   // Mint 150 CASH tokens using DAI
  //   await dai.connect(anna).approve(vault.address, daiUnits("150.0"));
  //   await vault.connect(anna).justMint(dai.address, daiUnits("150.0"), 0);
  //   await expect(anna).has.a.balanceOf("250.00", cash);

  //   // Withdraw all
  //   await vault.connect(anna).redeemAll(0);

  //   // 100 USDC and 350 DAI in contract
  //   // (1000-100) + 100/450 * 250 USDC
  //   // (1000-150) + 350/450 * 250 DAI
  //   await expect(anna).has.an.approxBalanceOf("955.55", usdc);
  //   await expect(anna).has.an.approxBalanceOf("1044.44", dai);
  // });

  // it("Should redeem entire CASH balance, with a higher oracle price @fast", async () => {
  //   const { cash, vault, usdc, dai, anna, governor } = await loadFixture(
  //     defaultFixture
  //   );

  //   await expect(anna).has.a.balanceOf("1000.00", usdc);

  //   // Mint 100 CASH tokens using USDC
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("100.0"), 0);
  //   await expect(anna).has.a.balanceOf("100.00", cash);

  //   // Mint 150 CASH tokens using DAI
  //   await dai.connect(anna).approve(vault.address, daiUnits("150.0"));
  //   await vault.connect(anna).justMint(dai.address, daiUnits("150.0"), 0);
  //   await expect(anna).has.a.balanceOf("250.00", cash);

  //   await setOracleTokenPriceUsd("USDC", "1.30");
  //   await setOracleTokenPriceUsd("DAI", "1.20");
  //   await vault.connect(governor).rebase();

  //   // Anna's balance does not change with the rebase
  //   await expect(anna).has.an.approxBalanceOf("250.00", cash);

  //   // Withdraw all
  //   await vault.connect(anna).redeemAll(0);

  //   // CASH to Withdraw	250
  //   // Total Vault Coins	450
  //   // USDC Percentage	100	/	450	=	0.222222222222222
  //   // DAI Percentage	350	/	450	=	0.777777777777778
  //   // USDC Value Percentage			0.222222222222222	*	1.3	=	0.288888888888889
  //   // DAI Value Percentage			0.777777777777778	*	1.2	=	0.933333333333333
  //   // Output to Dollar Ratio	1.22222222222222
  //   // USDC Output	250	*	0.222222222222222	/	1.22222222222222	=	45.4545454545454
  //   // DAI Output	250	*	0.777777777777778	/	1.22222222222222	=	159.090909090909
  //   // Expected USDC	900	+	45.4545454545454	=	945.454545454545
  //   // Expected DAI	850	+	159.090909090909	=	1009.09090909091
  //   await expect(anna).has.an.approxBalanceOf(
  //     "945.4545",
  //     usdc,
  //     "USDC has wrong balance"
  //   );
  //   await expect(anna).has.an.approxBalanceOf(
  //     "1009.09",
  //     dai,
  //     "DAI has wrong balance"
  //   );
  // });

  // it("Should redeem entire CASH balance, with a lower oracle price @fast", async () => {
  //   const { cash, vault, usdc, dai, anna, governor } = await loadFixture(
  //     defaultFixture
  //   );

  //   await expect(anna).has.a.balanceOf("1000.00", usdc);

  //   // Mint 100 CASH tokens using USDC
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("100.0"), 0);
  //   await expect(anna).has.a.balanceOf("100.00", cash);

  //   // Mint 150 CASH tokens using DAI
  //   await dai.connect(anna).approve(vault.address, daiUnits("150.0"));
  //   await vault.connect(anna).justMint(dai.address, daiUnits("150.0"), 0);
  //   await expect(anna).has.a.balanceOf("250.00", cash);

  //   await setOracleTokenPriceUsd("USDC", "0.90");
  //   await setOracleTokenPriceUsd("DAI", "0.80");
  //   await vault.connect(governor).rebase();

  //   // Anna's share of CASH is unaffected
  //   await expect(anna).has.an.approxBalanceOf("250.00", cash);

  //   // Withdraw all
  //   await cash.connect(anna).approve(vault.address, cashUnits("500"));
  //   await vault.connect(anna).redeemAll(0);

  //   // CASH to Withdraw	250
  //   // Total Vault Coins	450
  //   // USDC Percentage	100	/	450	=	0.2222
  //   // DAI Percentage	350	/	450	=	0.7778
  //   // USDC Value Percentage			0.2222	*	1	=	0.2222
  //   // DAI Value Percentage			0.7778	*	1	=	0.7778
  //   // Output to Dollar Ratio	1.0000
  //   // USDC Output	250	*	0.2222	/	1.0000	=	55.5556
  //   // DAI Output	250	*	0.7778	/	1.0000	=	194.4444
  //   // Expected USDC	900	+	55.5556	=	955.5556
  //   // Expected DAI	850	+	194.4444	=	1044.4444
  //   await expect(anna).has.an.approxBalanceOf(
  //     "955.5556",
  //     usdc,
  //     "USDC has wrong balance"
  //   );
  //   await expect(anna).has.an.approxBalanceOf(
  //     "1044.44",
  //     dai,
  //     "DAI has wrong balance"
  //   );
  // });

  // it("Should have correct balances on consecutive mint and redeem @fast", async () => {
  //   const { cash, vault, usdc, dai, anna, matt, josh } = await loadFixture(
  //     defaultFixture
  //   );

  //   const usersWithBalances = [
  //     [anna, 0],
  //     [matt, 100],
  //     [josh, 100],
  //   ];

  //   const assetsWithUnits = [
  //     [dai, daiUnits],
  //     [usdc, usdcUnits],
  //   ];

  //   for (const [user, startBalance] of usersWithBalances) {
  //     for (const [asset, units] of assetsWithUnits) {
  //       for (const amount of [5.09, 10.32, 20.99, 100.01]) {
  //         asset.connect(user).approve(vault.address, units(amount.toString()));
  //         vault.connect(user).mint(asset.address, units(amount.toString()), 0);
  //         await expect(user).has.an.approxBalanceOf(
  //           (startBalance + amount).toString(),
  //           cash
  //         );
  //         await vault.connect(user).redeem(cashUnits(amount.toString()), 0);
  //         await expect(user).has.an.approxBalanceOf(
  //           startBalance.toString(),
  //           cash
  //         );
  //       }
  //     }
  //   }
  // });

  // it("Should have correct balances on consecutive mint and redeem with varying oracle prices @fast", async () => {
  //   const { cash, vault, dai, usdc, matt, josh } = await loadFixture(
  //     defaultFixture
  //   );

  //   const users = [matt, josh];
  //   const assetsWithUnits = [
  //     [dai, daiUnits],
  //     [usdc, usdcUnits],
  //   ];
  //   const prices = [0.998, 1.02, 1.09];
  //   const amounts = [5.09, 10.32, 20.99, 100.01];

  //   const getUserCASHBalance = async (user) => {
  //     const bn = await cash.balanceOf(await user.getAddress());
  //     return parseFloat(bn.toString() / 1e12 / 1e6);
  //   };

  //   for (const user of users) {
  //     for (const [asset, units] of assetsWithUnits) {
  //       for (const price of prices) {
  //         await setOracleTokenPriceUsd(await asset.symbol(), price.toString());
  //         // Manually call rebase because not triggered by mint
  //         await vault.rebase();
  //         // Rebase could have changed user balance
  //         // as there could have been yield from different
  //         // oracle prices on redeems during a previous loop.
  //         let userBalance = await getUserCASHBalance(user);
  //         for (const amount of amounts) {
  //           const cashToReceive = amount * Math.min(price, 1);
  //           await expect(user).has.an.approxBalanceOf(
  //             userBalance.toString(),
  //             cash
  //           );
  //           await asset
  //             .connect(user)
  //             .approve(vault.address, units(amount.toString()));
  //           await vault
  //             .connect(user)
  //             .mint(asset.address, units(amount.toString()), 0);
  //           await expect(user).has.an.approxBalanceOf(
  //             (userBalance + cashToReceive).toString(),
  //             cash
  //           );
  //           await vault
  //             .connect(user)
  //             .redeem(cashUnits(cashToReceive.toString()), 0);
  //           await expect(user).has.an.approxBalanceOf(
  //             userBalance.toString(),
  //             cash
  //           );
  //         }
  //       }
  //     }
  //   }
  // });

  // it("Should correctly handle redeem without a rebase and then redeemAll @fast", async function () {
  //   const { cash, vault, usdc, anna } = await loadFixture(defaultFixture);
  //   await expect(anna).has.a.balanceOf("0.00", cash);
  //   await usdc.connect(anna).mint(usdcUnits("3000.0"));
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("3000.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("3000.0"), 0);
  //   await expect(anna).has.a.balanceOf("3000.00", cash);

  //   //peturb the oracle a slight bit.
  //   await setOracleTokenPriceUsd("USDC", "1.000001");
  //   //redeem without rebasing (not over threshold)
  //   await vault.connect(anna).redeem(cashUnits("200.00"), 0);
  //   //redeem with rebasing (over threshold)
  //   await vault.connect(anna).redeemAll(0);

  //   await expect(anna).has.a.balanceOf("0.00", cash);
  // });

  // it("Should have redeemAll result in zero balance @fast", async () => {
  //   const { cash, vault, usdc, dai, anna, governor, josh, matt } =
  //     await loadFixture(defaultFixture);

  //   await expect(anna).has.a.balanceOf("1000", usdc);
  //   await expect(anna).has.a.balanceOf("1000", dai);

  //   // Mint 1000 CASH tokens using USDC
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("1000"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("1000"), 0);
  //   await expect(anna).has.balanceOf("1000", cash);

  //   await vault.connect(governor).setRedeemFeeBps("500");
  //   await setOracleTokenPriceUsd("USDC", "1.005");
  //   await setOracleTokenPriceUsd("DAI", "1");
  //   await vault.connect(governor).rebase();

  //   await vault.connect(anna).redeemAll(0);

  //   dai.connect(josh).approve(vault.address, daiUnits("50"));
  //   vault.connect(josh).mint(dai.address, daiUnits("50"), 0);
  //   dai.connect(matt).approve(vault.address, daiUnits("100"));
  //   vault.connect(matt).justMint(dai.address, daiUnits("100"), 0);

  //   let newBalance = await usdc.balanceOf(await anna.getAddress());
  //   let newDaiBalance = await dai.balanceOf(await anna.getAddress());
  //   await usdc.connect(anna).approve(vault.address, newBalance);
  //   await vault.connect(anna).justMint(usdc.address, newBalance, 0);
  //   await dai.connect(anna).approve(vault.address, newDaiBalance);
  //   await vault.connect(anna).justMint(dai.address, newDaiBalance, 0);
  //   await vault.connect(anna).redeemAll(0);
  //   await expect(anna).has.a.balanceOf("0.00", cash);
  // });

  // it("Should respect minimum unit amount argument in redeem @fast", async () => {
  //   const { cash, vault, usdc, anna, dai } = await loadFixture(defaultFixture);
  //   await expect(anna).has.a.balanceOf("1000.00", usdc);
  //   await expect(anna).has.a.balanceOf("1000.00", dai);
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("50.00", cash);
  //   await vault.connect(anna).redeem(cashUnits("50.0"), cashUnits("50"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(
  //     vault.connect(anna).redeem(cashUnits("50.0"), cashUnits("51"))
  //   ).to.be.revertedWith("Redeem amount lower than minimum");
  // });

  // it("Should respect minimum unit amount argument in redeemAll @fast", async () => {
  //   const { cash, vault, usdc, anna, dai } = await loadFixture(defaultFixture);
  //   await expect(anna).has.a.balanceOf("1000.00", usdc);
  //   await expect(anna).has.a.balanceOf("1000.00", dai);
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("50.00", cash);
  //   await vault.connect(anna).redeemAll(cashUnits("50"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(
  //     vault.connect(anna).redeemAll(cashUnits("51"))
  //   ).to.be.revertedWith("Redeem amount lower than minimum");
  // });

  // it("Should calculate redeem outputs @fast", async () => {
  //   const { vault, anna, usdc, cash } = await loadFixture(defaultFixture);

  //   // CASH total supply is 200 backed by 200 DAI
  //   await expect(
  //     await vault.calculateRedeemOutputs(cashUnits("50"))
  //   ).to.deep.equal([
  //     daiUnits("50"), // DAI
  //     BigNumber.from(0), // USDT
  //     BigNumber.from(0), // USDC
  //     BigNumber.from(0), // TUSD
  //   ]);

  //   // Mint an additional 600 USDC, so CASH is backed by 600 USDC and 200 DAI
  //   // meaning 1/4 of any redeem should come from DAI and 2/3 from USDC
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("600"));
  //   await vault.connect(anna).justMint(usdc.address, usdcUnits("600"), 0);
  //   await expect(anna).has.a.balanceOf("600", cash);
  //   await expect(
  //     await vault.calculateRedeemOutputs(cashUnits("100"))
  //   ).to.deep.equal([
  //     daiUnits("25"), // DAI
  //     BigNumber.from(0), // USDT
  //     usdcUnits("75"), // USDC
  //     BigNumber.from(0), // TUSD
  //   ]);
  // });
});
