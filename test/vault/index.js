const { defaultFixture } = require("../_fixture");
const chai = require("chai");
const hre = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { utils } = require("ethers");

const {
  cashUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  getOracleAddresses,
  isFork,
  usdcUnitsFormat,
  cashUnitsFormat,
  daiUnitsFormat,
  runStrategyLogic,
  usdtUnitsFormat,
  usdUnitsFormat,
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;

describe("Vault", function () {
  beforeEach(async function () {
    // Send some 100 USDC, USDT, DAI  from josh to vault
    const { vault, josh, usdc, usdt, dai, cash } = await loadFixture(defaultFixture);
    console.log("Sending 100 USDC, USDT, DAI from Josh to Vault")
    await usdc.connect(josh).transfer(vault.address, usdcUnits("100"));
    await usdt.connect(josh).transfer(vault.address, usdtUnits("100"));
    await dai.connect(josh).transfer(vault.address, daiUnits("100"));
  });
  afterEach(async function () {
    // Send some 100 USDC, USDT, DAI  from josh to vault
    const { vault, josh, usdc, usdt, dai, cash } = await loadFixture(defaultFixture);
    // Print balance of usdc, dai, and usdt in vault
    console.log("Vault USDC balance: ", usdcUnitsFormat(await usdc.balanceOf(vault.address)));
    console.log("Vault USDT balance: ", usdtUnitsFormat(await usdt.balanceOf(vault.address)));
    console.log("Vault DAI balance: ", daiUnitsFormat(await dai.balanceOf(vault.address)));
  });
  it("Should support an asset  @mock", async () => {
    const { vault, oracleRouter, cash, governor } = await loadFixture(
      defaultFixture
    );
    const oracleAddresses = await getOracleAddresses(hre.deployments);
    const origAssetCount = await vault.connect(governor).getAssetCount();
    expect(await vault.isSupportedAsset(cash.address)).to.be.false;
    await oracleRouter.setFeed(cash.address, oracleAddresses.chainlink.DAI_USD);
    await expect(vault.connect(governor).supportAsset(cash.address)).to.emit(
      vault,
      "AssetSupported"
    );
    expect(await vault.getAssetCount()).to.equal(origAssetCount.add(1));
    const assets = await vault.connect(governor).getAllAssets();
    expect(assets.length).to.equal(origAssetCount.add(1));
    expect(await vault.isSupportedAsset(cash.address)).to.be.true;
  });
  const amounts = ["5", "1000", "20000", "50000", "100000", "300000", "1000000"]
  for (let i = 0; i < amounts.length; i++) {
    const csv = [];
    const redeem
    const amount = amounts[i]*1.2; //(Math.floor(Math.random() * 50000) + 1).toString();
    
    // Get random number from 0 to 2
    const stratIndex = Math.floor(Math.random() * 3);

    it("Should allow " + amount + " USDC minting with fee  mint_imp_mass mint_new mint_imp_usdc sss @fork", async function () {
      const { vault, governor, usdc, usdt, dai, anna, rio, cash, cAaveSupplyUsdtStrategyProxy, cTetuUsdtStrategyProxy, cTetuUsdcStrategyProxy, cTetuDaiStrategyProxy } = await loadFixture(defaultFixture);
      expect(await vault.isSupportedAsset(usdc.address)).to.be.true;

      let csv_string = "USDC";
      // Random amount from 1 to 1M
      csv_string += "," + amount;

      let cashSupply = cashUnitsFormat(await cash.totalSupply());
      let vaultNav = usdUnitsFormat(await vault.nav());
      let diff = parseFloat(cashSupply) - parseFloat(vaultNav);
      let annaCashBalance = cashUnitsFormat(await cash.balanceOf(anna.address));
      csv_string += "," + cashSupply + "," + vaultNav + "," + diff.toFixed(5) + "," + annaCashBalance;
      
      // Set treasury
      console.log("Anna USDC balance: ", usdcUnitsFormat(await usdc.balanceOf(anna.address)));
      console.log("Treasury: ", rio.address);
      await vault.setFeeParams(rio.address, rio.address, rio.address);
      const rioUsdcBalance = await usdc.balanceOf(rio.address);
      console.log("Rio USDC balance: ", usdcUnitsFormat(await usdc.balanceOf(rio.address)));

      // await vault.setAssetDefaultStrategy(usdc.address,  cAaveSupplyUsdtStrategyProxy.address);
      // await vault.setAssetDefaultStrategy(usdt.address, cAaveSupplyUsdtStrategyProxy.address);
      // await vault.setAssetDefaultStrategy(dai.address,  cAaveSupplyUsdtStrategyProxy.address);

      // KMake an array of tetu strats
      const tetuStrats = [cTetuUsdcStrategyProxy.address, cTetuUsdtStrategyProxy.address, cTetuDaiStrategyProxy.address];
      for (let i = 0; i < tetuStrats.length; i++) {
        await runStrategyLogic(governor, "Tetu Strategy", tetuStrats[i]);
      }
      // Get 1 random strat from the array
      // const randomStrat = tetuStrats[stratIndex];
      // console.log('Quick deposit strat: ', randomStrat);
      // await vault.setQuickDepositStrategies([randomStrat]);
      // Setting fee to 0.25%
      await vault.setMintFeeBps(25);

      await expect(anna).has.a.approxBalanceOf("0.00", cash);

      await usdc.connect(anna).approve(vault.address, usdcUnits(amount));
      await vault.connect(anna).mint(usdc.address, usdcUnits(amount), 0);

      const rioUsdcBalanceAfter = await usdc.balanceOf(rio.address);
      const changeInRioBalance = rioUsdcBalanceAfter.sub(rioUsdcBalance);
      const amountMinusFee = (amount - (amount * 0.0025)).toString();
      const fee = (amount * 0.0025).toString();

      annaCashBalance = cashUnitsFormat(await cash.balanceOf(anna.address));
      cashSupply = cashUnitsFormat(await cash.totalSupply());
      vaultNav = usdUnitsFormat(await vault.nav());
      diff = parseFloat(cashSupply) - parseFloat(vaultNav);
      csv_string += "," + cashSupply + "," + vaultNav + "," + diff.toFixed(5) + "," + annaCashBalance;

      // Print CASH of anna
      console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
      console.log("Anna CASH balance should be: ", amountMinusFee);
      // Calculate the 0.1% of amountMinusFee
      const allowedDifferenceAmount = ((amountMinusFee * 0.001).toFixed(2)).toString();

      console.log("Strategy checkBalance: ", usdcUnitsFormat(await cTetuUsdtStrategyProxy.checkBalance()));
      console.log("Treasury USDC should gain: ", fee);
      console.log("Treasury USDC gained: ", usdcUnitsFormat(changeInRioBalance));
      // expect(changeInRioBalance).to.be.above("0");
      // expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits(amountMinusFee), cashUnits(allowedDifferenceAmount));
      console.log("Vault USDC balance: ", usdcUnitsFormat(await usdc.balanceOf(vault.address)));

      const fs = require('fs');
      fs.writeFile('mix_amounts' + amounts[i]+ '.csv', csv_string, function (err) {
        if (err) throw err;
        console.log('Saved!');
      });

    });
    // write to file
    
  }
  for (let i = 0; i < 1; i++) {
    const amount = "1000"; // (Math.floor(Math.random() * 50000) + 1).toString();
    const stratIndex = Math.floor(Math.random() * 3);

    it("Should allow " + amount + " DAI minting (with swapping) with fee mint_imp_mass @fork mint_imp_dai mint_new", async function () {
      const { vault, dai, usdt, governor, anna, rio, cash, cAaveSupplyUsdtStrategyProxy, cTetuUsdtStrategyProxy, cTetuUsdcStrategyProxy, cTetuDaiStrategyProxy, usdc } = await loadFixture(defaultFixture);
      console.log("Vault: ", vault.address)
      console.log("cTetuUsdtStrategyProxy: ", cTetuUsdtStrategyProxy.address)
      expect(await vault.isSupportedAsset(dai.address)).to.be.true;

      // await vault.setAssetDefaultStrategy(usdc.address,  cAaveSupplyUsdtStrategyProxy.address);
      // await vault.setAssetDefaultStrategy(usdt.address, cAaveSupplyUsdtStrategyProxy.address);
      // await vault.setAssetDefaultStrategy(dai.address,  cAaveSupplyUsdtStrategyProxy.address);

      // Set treasury
      console.log("Anna DAI balance: ", daiUnitsFormat(await dai.balanceOf(anna.address)));
      console.log("Anna USDC balance: ", usdcUnitsFormat(await usdc.balanceOf(anna.address)));

      console.log("Treasury: ", rio.address);
      await vault.setFeeParams(rio.address, rio.address, rio.address);
      const rioDaiBalance = await dai.balanceOf(rio.address);
      console.log("Rio DAI balance: ", daiUnitsFormat(await dai.balanceOf(rio.address)));

      const tetuStrats = [cTetuUsdcStrategyProxy.address, cTetuUsdtStrategyProxy.address, cTetuDaiStrategyProxy.address];
      for (let i = 0; i < tetuStrats.length; i++) {
        await runStrategyLogic(governor, "Tetu Strategy", tetuStrats[i]);
      }
      // Get 1 random strat from the array
      const randomStrat = tetuStrats[stratIndex];
      // console.log('Quick deposit strat: ', randomStrat);
      // await vault.setQuickDepositStrategies([randomStrat]);

      // Setting fee to 0.25%
      await vault.setMintFeeBps(25);

      // Print mintFeeBps
      console.log("Mint fee: ", (await vault.mintFeeBps()).toString());

      await expect(anna).has.a.approxBalanceOf("0.00", cash);

      await dai.connect(anna).approve(vault.address, daiUnits(amount));
      await vault.connect(anna).mint(dai.address, daiUnits(amount), 0);

      const rioDaiBalanceAfter = await dai.balanceOf(rio.address);
      const changeInRioBalance = rioDaiBalanceAfter.sub(rioDaiBalance);
      const amountMinusFee = (amount - (amount * 0.0025)).toString();
      const fee = (amount * 0.0025).toString();

      // Print CASH of anna
      console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
      console.log("Anna CASH balance should be: ", amountMinusFee);
      // Calculate the 0.1% of amountMinusFee
      const allowedDifferenceAmount = ((amountMinusFee * 0.001).toFixed(2)).toString();

      console.log("Strategy checkBalance: ", usdcUnitsFormat(await cTetuUsdtStrategyProxy.checkBalance()));
      console.log("Treasury DAI should gain: ", fee);
      console.log("Treasury DAI gained: ", daiUnitsFormat(changeInRioBalance));
      // expect(changeInRioBalance).to.be.above("0");
      expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits(amountMinusFee), cashUnits(allowedDifferenceAmount));
     console.log("Vault DAI balance: ", daiUnitsFormat(await dai.balanceOf(vault.address)));

    });
  }
  for (let i = 0; i < 1; i++) {
    const amount = "1000"; // (Math.floor(Math.random() * 50000) + 1).toString();
    const stratIndex = Math.floor(Math.random() * 3);

    it("Should allow " + amount + " USDT minting (with swapping) with fee mint_imp_mass mint_imp_usdt mint_new @fork", async function () {
      const { vault, usdt, dai, governor, anna, usdc, rio, cash,cAaveSupplyUsdtStrategyProxy, cTetuUsdtStrategyProxy, cTetuUsdcStrategyProxy, cTetuDaiStrategyProxy } = await loadFixture(defaultFixture);
      expect(await vault.isSupportedAsset(usdt.address)).to.be.true;

      // await vault.setAssetDefaultStrategy(usdc.address,  cAaveSupplyUsdtStrategyProxy.address);
      // await vault.setAssetDefaultStrategy(usdt.address, cAaveSupplyUsdtStrategyProxy.address);
      // await vault.setAssetDefaultStrategy(dai.address,  cAaveSupplyUsdtStrategyProxy.address);

      // Set treasury
      console.log("Anna USDC balance: ", usdcUnitsFormat(await usdc.balanceOf(anna.address)));
      console.log("Treasury: ", rio.address);
      await vault.setFeeParams(rio.address, rio.address, rio.address);
      rioUsdtBalance = await usdt.balanceOf(rio.address);
      console.log("Rio USDT balance: ", usdtUnitsFormat(await usdt.balanceOf(rio.address)));

      const tetuStrats = [cTetuUsdcStrategyProxy.address, cTetuUsdtStrategyProxy.address, cTetuDaiStrategyProxy.address];
      for (let i = 0; i < tetuStrats.length; i++) {
        await runStrategyLogic(governor, "Tetu Strategy", tetuStrats[i]);
      }
      // Get 1 random strat from the array
      const randomStrat = tetuStrats[stratIndex];
      // console.log('Quick deposit strat: ', randomStrat);
      // await vault.setQuickDepositStrategies([randomStrat]);

      // Setting fee to 0.25%
      await vault.setMintFeeBps(25);

      await expect(anna).has.a.approxBalanceOf("0.00", cash);

      await usdt.connect(anna).approve(vault.address, usdtUnits(amount));
      await vault.connect(anna).mint(usdt.address, usdtUnits(amount), 0);

      rioUsdtBalanceAfter = await usdt.balanceOf(rio.address);
      changeInRioBalance = rioUsdtBalanceAfter.sub(rioUsdtBalance);
      amountMinusFee = (amount - (amount * 0.0025)).toString();
      fee = (amount * 0.0025).toString();

      // Print CASH of anna
      console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
      console.log("Anna CASH balance should be: ", amountMinusFee);
      // Calculate the 0.1% of amountMinusFee
      const allowedDifferenceAmount = ((amountMinusFee * 0.001).toFixed(2)).toString();

      console.log("Strategy checkBalance: ", usdcUnitsFormat(await cTetuUsdtStrategyProxy.checkBalance()));
      console.log("Treasury USDT should gain: ", fee);
      console.log("Treasury USDT gained: ", usdtUnitsFormat(changeInRioBalance));
      // expect(changeInRioBalance).to.be.above("0");
      expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits(amountMinusFee), cashUnits(allowedDifferenceAmount));
      console.log("Vault USDT balance: ", usdtUnitsFormat(await usdt.balanceOf(vault.address)));

    });
  }

  it("Should allow USDC minting with fee  mint_imp with non-direct deposit strategy @fork", async function () {
    const { vault, usdc, anna, cash, cMeshSwapStrategyDAI } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdc.address)).to.be.true;

    // await vault.setQuickDepositStrategies([cMeshSwapStrategyDAI.address]);
    // Setting fee to 5%
    await vault.setMintFeeBps(500);

    await expect(anna).has.a.approxBalanceOf("0.00", cash);

    await usdc.connect(anna).approve(vault.address, usdcUnits("10000"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("10000"), 0);

    // Print CASH of anna
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    console.log("Strategy checkBalance: ", usdcUnitsFormat(await cMeshSwapStrategyDAI.checkBalance()));
    expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits("95.0"), cashUnits("1"));
  });

  it("Should allow DAI minting (with swapping) with fee mint_imp with non-direct deposit strategy @fork", async function () {
    const { vault, dai, anna, cash, cMeshSwapStrategyDAI } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(dai.address)).to.be.true;
    // await vault.setQuickDepositStrategies([cMeshSwapStrategyDAI.address]);

    // Setting fee to 5%
    await vault.setMintFeeBps(500);

    await expect(anna).has.a.approxBalanceOf("0.00", cash);

    await dai.connect(anna).approve(vault.address, daiUnits("100"));
    await vault.connect(anna).mint(dai.address, daiUnits("100"), 0);
    // Print CASH of anna
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    console.log("Strategy checkBalance: ", usdcUnitsFormat(await cMeshSwapStrategyDAI.checkBalance()));
    expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits("95.0"), cashUnits("1"));
  });

  it("Should allow USDT minting (with swapping) with fee mint_imp with non-direct deposit strategy @fork", async function () {
    const { vault, usdt, anna, cash, cMeshSwapStrategyDAI } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdt.address)).to.be.true;
    // await vault.setQuickDepositStrategies([cMeshSwapStrategyDAI.address]);

    // Setting fee to 5%
    await vault.setMintFeeBps(500);

    await expect(anna).has.a.approxBalanceOf("0.00", cash);

    await usdt.connect(anna).approve(vault.address, usdtUnits("100"));
    await vault.connect(anna).mint(usdt.address, usdtUnits("100"), 0);
    // Print CASH of anna
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    console.log("Strategy checkBalance: ", usdcUnitsFormat(await cMeshSwapStrategyDAI.checkBalance()));
    expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits("95.0"), cashUnits("1"));
  });

  it("Should allow USDC minting  mint_imp @fork", async function () {
    const { vault, usdc, anna, cash } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdc.address)).to.be.true;

    await expect(anna).has.a.approxBalanceOf("0.00", cash);

    await usdc.connect(anna).approve(vault.address, usdcUnits("100"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("100"), 0);

    // Print CASH of anna
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits("100.0"), cashUnits("1"));
  });

  it("Should allow DAI minting (with swapping) mint_imp @fork", async function () {
    const { vault, dai, anna, cash } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(dai.address)).to.be.true;

    await expect(anna).has.a.approxBalanceOf("0.00", cash);

    await dai.connect(anna).approve(vault.address, daiUnits("100"));
    await vault.connect(anna).mint(dai.address, daiUnits("100"), 0);
    // Print CASH of anna
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits("100.0"), cashUnits("1"));
  });

  it("Should allow USDT minting (with swapping) mint_imp @fork", async function () {
    const { vault, usdt, anna, cash } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdt.address)).to.be.true;

    await expect(anna).has.a.approxBalanceOf("0.00", cash);

    await usdt.connect(anna).approve(vault.address, usdtUnits("100"));
    await vault.connect(anna).mint(usdt.address, usdtUnits("100"), 0);
    // Print CASH of anna
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    expect(await cash.balanceOf(anna.address)).to.be.closeTo(cashUnits("100.0"), cashUnits("1"));
  });

  it("Should revert when minimum CASH not satisfied mint_imp @fork", async function () {
    const { vault, usdt, anna, cash } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdt.address)).to.be.true;

    await expect(anna).has.a.approxBalanceOf("0.00", cash);
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    console.log("Anna USDT balance: ", usdcUnitsFormat(await usdt.balanceOf(anna.address)));

    const initialUSDTBalance = await usdt.balanceOf(anna.address);

    await usdt.connect(anna).approve(vault.address, usdtUnits("100"));
    await expect(
      vault.connect(anna).mint(usdt.address, usdtUnits("100"), cashUnits("100"))
    ).to.be.revertedWith("Mint amount lower than minimum");
    // Print CASH of anna
    console.log("Anna USDT balance: ", usdcUnitsFormat(await usdt.balanceOf(anna.address)));
    console.log("Anna CASH balance: ", cashUnitsFormat(await cash.balanceOf(anna.address)));
    expect(await usdt.balanceOf(anna.address)).to.be.equal(initialUSDTBalance);
  });

  it("Should revert when adding an asset that is already supported  @mock", async function () {
    const { vault, usdt, governor } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdt.address)).to.be.true;
    await expect(
      vault.connect(governor).supportAsset(usdt.address)
    ).to.be.revertedWith("Asset already supported");
  });

  it("Should revert when attempting to support an asset and not governor @mock", async function () {
    const { vault, tusd, matt } = await loadFixture(defaultFixture);
    await expect(vault.connect(matt).supportAsset(tusd.address)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should revert when adding a strategy that is already approved @mock", async function () {
    const { vault, governor, cMeshSwapStrategyUSDC } = await loadFixture(
      defaultFixture
    );
    await expect(
      vault.connect(governor).approveStrategy(cMeshSwapStrategyUSDC.address)
    ).to.be.revertedWith("Strategy already approved");
  });

  it("Should revert when attempting to approve a strategy and not Governor @mock", async function () {
    const { vault, josh, cMeshSwapStrategyUSDC } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(josh).approveStrategy(cMeshSwapStrategyUSDC.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should correctly ratio deposited currencies of differing decimals @mock", async function () {
    const { cash, vault, usdc, dai, matt } = await loadFixture(defaultFixture);

    await expect(matt).has.a.balanceOf("100.00", cash);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).justMint(usdc.address, usdcUnits("2.0"), 0);
    await expect(matt).has.a.balanceOf("102.00", cash);

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(vault.address, daiUnits("4.0"));
    await vault.connect(matt).justMint(dai.address, daiUnits("4.0"), 0);
    await expect(matt).has.a.balanceOf("106.00", cash);
  });

  it("Should correctly handle a deposit of DAI (18 decimals) @mock", async function () {
    const { cash, vault, dai, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", cash);
    // We limit to paying to $1 CASH for for one stable coin,
    // so this will deposit at a rate of $1.
    await setOracleTokenPriceUsd("DAI", "1.30");
    await dai.connect(anna).approve(vault.address, daiUnits("3.0"));
    await vault.connect(anna).justMint(dai.address, daiUnits("3.0"), 0);
    await expect(anna).has.a.balanceOf("3.00", cash);
  });

  it("Should correctly handle a deposit of USDC (6 decimals) @mock", async function () {
    const { cash, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", cash);
    await setOracleTokenPriceUsd("USDC", "0.998");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("49.90", cash);
  });

  it("Should not allow a below peg deposit @mock", async function () {
    const { cash, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", cash);
    await setOracleTokenPriceUsd("USDC", "0.95");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(
      vault.connect(anna).justMint(usdc.address, usdcUnits("50.0"), 0)
    ).to.be.revertedWith("Asset price below Peg");
  });

  it("Should correctly handle a deposit failure of Non-Standard ERC20 Token @mock", async function () {
    const { cash, vault, anna, nonStandardToken, governor } = await loadFixture(
      defaultFixture
    );

    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceUsd("NonStandardToken", "1.30");
    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("1500.0"));

    // Anna has a balance of 1000 tokens and she is trying to
    // transfer 1500 tokens. The contract doesn't throw but
    // fails silently, so Anna's CASH balance should be zero.
    try {
      await vault
        .connect(anna)
        .mint(nonStandardToken.address, usdtUnits("1500.0"), 0);
    } catch (err) {
      expect(
        /reverted with reason string 'SafeERC20: ERC20 operation did not succeed/gi.test(
          err.message
        )
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expect(anna).has.a.balanceOf("0.00", cash);
      await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    }
  });

  it("Should correctly handle a deposit of Non-Standard ERC20 Token @mock", async function () {
    const { cash, vault, anna, nonStandardToken, governor } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("100.0"));
    await vault
      .connect(anna)
      .justMint(nonStandardToken.address, usdtUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("100.00", cash);
    await expect(anna).has.a.balanceOf("900.00", nonStandardToken);
  });

  it("Should calculate the balance correctly with DAI @mock", async () => {
    const { vault } = await loadFixture(defaultFixture);
    // Vault already has DAI from default ficture
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("200", 6)
    );
  });

  it("Should calculate the balance correctly with USDC @mock", async () => {
    const { vault, usdc, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).justMint(usdc.address, usdcUnits("2.0"), 0);
    // Fixture loads 200 DAI, so result should be 202
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("202", 6)
    );
  });

  it("Should calculate the balance correctly with DAI, USDC, USDT, TUSD @mock", async () => {
    const { vault, usdc, usdt, tusd, matt, governor } = await loadFixture(defaultFixture);

    await vault.connect(governor).supportAsset(tusd.address);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).justMint(usdc.address, usdcUnits("8.0"), 0);
    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("20.0"));
    await vault.connect(matt).justMint(usdt.address, usdtUnits("20.0"), 0);
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).justMint(tusd.address, tusdUnits("9.0"), 0);
    // Fixture loads 200 USDC and Vault should not report 
    // asset other than USDC balance, so result should be 208
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("208", 6)
    );
  });

  it("Should allow transfer of arbitrary token by Governor @mock", async () => {
    const { vault, cash, usdc, matt, governor } = await loadFixture(
      defaultFixture
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).justMint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his CASH directly to Vault
    await cash.connect(matt).transfer(vault.address, cashUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(cash.address, cashUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", cash);
  });

  it("Should not allow transfer of arbitrary token by non-Governor @mock", async () => {
    const { vault, cash, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(cash.address, cashUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should not allow transfer of supported token by governor @mock", async () => {
    const { vault, usdc, governor } = await loadFixture(defaultFixture);
    // Matt puts USDC in vault
    await usdc.transfer(vault.address, usdcUnits("8.0"));
    // Governor cannot move USDC because it is a supported token.
    await expect(
      vault.connect(governor).transferToken(usdc.address, cashUnits("8.0"))
    ).to.be.revertedWith("Only unsupported assets");
  });

  it("Should allow Governor to add Strategy @mock", async () => {
    const { vault, governor, cash } = await loadFixture(defaultFixture);
    // Pretend CASH is a strategy and add its address
    await vault.connect(governor).approveStrategy(cash.address);
  });

  it("Should revert when removing a Strategy that has not been added @mock", async () => {
    const { vault, governor, cash } = await loadFixture(defaultFixture);
    // Pretend CASH is a strategy and remove its address
    await expect(
      vault.connect(governor).removeStrategy(cash.address)
    ).to.be.revertedWith("Strategy not approved");
  });

  it("Should correctly handle a mint with auto rebase @mock", async function () {
    const { cash, vault, usdc, matt, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", cash);
    await expect(matt).has.a.balanceOf("100.00", cash);
    await usdc.connect(anna).mint(usdcUnits("5000.0"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("5000.0"));
    await vault.connect(anna).justMint(usdc.address, usdcUnits("5000.0"), 0);
    await expect(anna).has.a.balanceOf("5000.00", cash);
    await expect(matt).has.a.balanceOf("100.00", cash);
  });

  it("Should revert mint if minMintAmount check fails @mock", async () => {
    const { vault, matt, cash, dai, usdt } = await loadFixture(defaultFixture);

    await usdt.connect(matt).approve(vault.address, usdtUnits("50.0"));
    await dai.connect(matt).approve(vault.address, daiUnits("25.0"));

    await expect(
      vault.connect(matt).justMint(usdt.address, usdtUnits("50"), daiUnits("100"))
    ).to.be.revertedWith("Mint amount lower than minimum");

    await expect(matt).has.a.balanceOf("100.00", cash);
    expect(await cash.totalSupply()).to.eq(cashUnits("200.0"));
  });

  it("Should allow transfer of arbitrary token by Governor @mock", async () => {
    const { vault, cash, usdc, matt, governor } = await loadFixture(
      defaultFixture
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).justMint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his CASH directly to Vault
    await cash.connect(matt).transfer(vault.address, cashUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(cash.address, cashUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", cash);
  });

  it("Should not allow transfer of arbitrary token by non-Governor @mock", async () => {
    const { vault, cash, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(cash.address, cashUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow governor to change rebase threshold @mock", async () => {
    const { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).setRebaseThreshold(cashUnits("400"));
  });

  it("Should not allow non-governor to change rebase threshold @mock", async () => {
    const { vault } = await loadFixture(defaultFixture);
    expect(vault.setRebaseThreshold(cashUnits("400"))).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow governor to change Strategist address @mock", async () => {
    const { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(await josh.getAddress());
  });

  it("Should not allow non-governor to change Strategist address @mock", async () => {
    const { vault, josh, matt } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(matt).setStrategistAddr(await josh.getAddress())
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should not allow non-Governor and non-Strategist to call reallocate @mock", async () => {
    const { vault, dai, josh } = await loadFixture(defaultFixture);

    await expect(
      vault.connect(josh).reallocate(
        vault.address, // Args don't matter because it doesn't reach checks
        vault.address,
        [dai.address],
        [daiUnits("200")]
      )
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should allow Governor and Strategist to set vaultBuffer @mock", async () => {
    const { vault, governor, strategist } = await loadFixture(defaultFixture);
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("5", 17));
    await vault.connect(strategist).setVaultBuffer(utils.parseUnits("5", 17));
  });

  it("Should not allow other to set vaultBuffer @mock", async () => {
    const { vault, josh } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(josh).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should not allow setting a vaultBuffer > 1e18 @mock", async () => {
    const { vault, governor } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(governor).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Invalid value");
  });

  it("Should remove strategy from all points @removeStrategy  @fork", async () => {
    const { vault, governor, cMeshSwapStrategyUSDC } = await loadFixture(defaultFixture);

    await expect(
      vault.connect(governor).approveStrategy(cMeshSwapStrategyUSDC.address)
    ).to.be.revertedWith("Strategy already approved");
    // console.log("Setting the Quick Deposit Strategies...")
    // await vault.connect(governor).setQuickDepositStrategies([cMeshSwapStrategyUSDC.address]);
    console.log("Setting the Strategies Weights...")
    await vault.connect(governor).setStrategyWithWeights([
      {
        "strategy": cMeshSwapStrategyUSDC.address,
        "minWeight": 0,
        "targetWeight": 100 * 1000,
        "maxWeight": 100 * 1000,
        "enabled": true,
        "enabledReward": true
      }
    ]);

    console.log("Remove Strategy...")
    await vault.connect(governor).removeStrategy(cMeshSwapStrategyUSDC.address);

    console.log("Pulling new strategy data...")
    let allStrategies = await vault.getAllStrategies();
    let allWeights = await vault.getAllStrategyWithWeights();
    let allWeightStrats = [];
    let totalWeights = 0;

    for (let index = 0; index < allWeights.length; index++) {
      const element = allWeights[index];
      allWeightStrats[index] = element.strategy;
      totalWeights += element.targetWeight;
    }
    console.log("Total Weights: ", totalWeights);
    let allQuickDeposit = await vault.getQuickDepositStrategies();
    expect(totalWeights).to.equal(0);
    expect(allStrategies.includes(cMeshSwapStrategyUSDC.address)).to.be.false;
    expect(allWeightStrats.includes(cMeshSwapStrategyUSDC.address)).to.be.false;
    expect(allQuickDeposit.includes(cMeshSwapStrategyUSDC.address)).to.be.false;

    // TODO: Need better way to test this, mapping deletion
    // await expect(vault.strategyWithWeightPositions(cMeshSwapStrategyUSDC.address)).to.equal(0); 

  });

  it("Should remove strategy from all points when two strategies are present @removeStrategy @fork", async () => {
    const { vault, governor, cMeshSwapStrategyUSDC, cSynapseStrategy } = await loadFixture(defaultFixture);

    await expect(
      vault.connect(governor).approveStrategy(cMeshSwapStrategyUSDC.address)
    ).to.be.revertedWith("Strategy already approved");
    // console.log("Setting the Quick Deposit Strategies...")
    // await vault.connect(governor).setQuickDepositStrategies([cMeshSwapStrategyUSDC.address]);
    console.log("Setting the Strategies Weights...")
    await vault.connect(governor).setStrategyWithWeights([
      {
        "strategy": cSynapseStrategy.address,
        "minWeight": 0,
        "targetWeight": 70 * 1000,
        "maxWeight": 100 * 1000,
        "enabled": true,
        "enabledReward": true
      },
      {
        "strategy": cMeshSwapStrategyUSDC.address,
        "minWeight": 0,
        "targetWeight": 30 * 1000,
        "maxWeight": 100 * 1000,
        "enabled": true,
        "enabledReward": true
      }
    ]);

    console.log("Remove Strategy...")
    await vault.connect(governor).removeStrategy(cMeshSwapStrategyUSDC.address);

    console.log("Pulling new strategy data...")
    let allStrategies = await vault.getAllStrategies();
    let allWeights = await vault.getAllStrategyWithWeights();
    let allWeightStrats = [];
    let totalWeights = 0;
    for (let index = 0; index < allWeights.length; index++) {
      const element = allWeights[index];
      allWeightStrats[index] = element.strategy;
      totalWeights += parseInt(element.targetWeight);
    }
    console.log("Total Weights: ", totalWeights);
    // Expect total weight to be 100k
    expect(totalWeights).to.equal(100 * 1000);
    let allQuickDeposit = await vault.getQuickDepositStrategies();

    expect(allStrategies.includes(cMeshSwapStrategyUSDC.address)).to.be.false;
    expect(allWeightStrats.includes(cMeshSwapStrategyUSDC.address)).to.be.false;
    expect(allQuickDeposit.includes(cMeshSwapStrategyUSDC.address)).to.be.false;

    // TODO: Need better way to test this, mapping deletion
    // await expect(vault.strategyWithWeightPositions(cMeshSwapStrategyUSDC.address)).to.equal(0); 

  });

  it("Should allow negative changeSupply of CASH", async () => {
    const { vault, governor, matt, josh, cash } = await loadFixture(defaultFixture);
    // Output CASH total supply
    console.log("CASH total supply: ", cashUnitsFormat(await cash.totalSupply()));
    // Output CASH balance of Josh and MATT
    console.log("Josh CASH balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));
    console.log("Matt CASH balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));

    console.log("Changing CASH supply to 100 CASH...");
    await vault.connect(governor).changeCASHSupply(cashUnits("100"));

    // Output CASH total supply
    console.log("CASH total supply: ", cashUnitsFormat(await cash.totalSupply()));
    // Output CASH balance of Josh and MATT
    console.log("Josh CASH balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));
    console.log("Matt CASH balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
  });

  // it("Should only allow Governor and Strategist to call withdrawAllFromStrategies @fork", async () => {
  //   const { vault, governor, matt, strategist } = await loadFixture(
  //     defaultFixture
  //   );
  //   await vault.connect(governor).withdrawAllFromStrategies();
  //   await vault.connect(strategist).withdrawAllFromStrategies();
  //   await expect(
  //     vault.connect(matt).withdrawAllFromStrategies()
  //   ).to.be.revertedWith("Caller is not the Strategist or Governor");
  // });

  // it("Should only allow Governor and Strategist to call withdrawAllFromStrategy @fork", async () => {
  //   const { vault, governor, strategist, cMeshSwapStrategyUSDC, matt, josh, dai } =
  //     await loadFixture(defaultFixture);
  //   await vault.connect(governor).approveStrategy(cMeshSwapStrategyUSDC.address);

  //   // Get the vault's initial DAI balance.
  //   const vaultDaiBalance = await dai.balanceOf(vault.address);

  //   // Mint and allocate DAI to Compound.
  //   await vault
  //     .connect(governor)
  //     .setAssetDefaultStrategy(dai.address, cMeshSwapStrategyUSDC.address);
  //   await dai.connect(josh).approve(vault.address, daiUnits("200"));
  //   await vault.connect(josh).mint(dai.address, daiUnits("200"), 0);
  //   await vault.connect(governor).allocate();

  //   // Call to withdrawAll by the governor should go thru.
  //   await vault
  //     .connect(governor)
  //     .withdrawAllFromStrategy(cMeshSwapStrategyUSDC.address);

  //   // All the DAI should have been moved back to the vault.
  //   const expectedVaultDaiBalance = vaultDaiBalance.add(daiUnits("200"));
  //   await expect(await dai.balanceOf(vault.address)).to.equal(
  //     expectedVaultDaiBalance
  //   );

  //   // Call to withdrawAll by the strategist should go thru.
  //   await vault
  //     .connect(strategist)
  //     .withdrawAllFromStrategy(cMeshSwapStrategyUSDC.address);

  //   // Call to withdrawAll from random dude matt should get rejected.
  //   await expect(
  //     vault.connect(matt).withdrawAllFromStrategy(cMeshSwapStrategyUSDC.address)
  //   ).to.be.revertedWith("Caller is not the Strategist or Governor");
  // });
  // it("Should allow the Governor to call reallocate @fork", async () => {
  //   const { vault, governor, dai, josh, cMeshSwapStrategyUSDC, aaveStrategy } =
  //     await loadFixture(defaultFixture);

  //   // await vault.connect(governor).approveStrategy(cMeshSwapStrategyUSDC.address);
  //   // Send all DAI to Compound
  //   await vault
  //     .connect(governor)
  //     .setAssetDefaultStrategy(dai.address, cMeshSwapStrategyUSDC.address);
  //   await dai.connect(josh).approve(vault.address, daiUnits("200"));
  //   await vault.connect(josh).mint(dai.address, daiUnits("200"), 0);
  //   await vault.connect(governor).allocate();
  //   await vault.connect(governor).approveStrategy(aaveStrategy.address);

  //   await vault
  //     .connect(governor)
  //     .reallocate(
  //       cMeshSwapStrategyUSDC.address,
  //       aaveStrategy.address,
  //       [dai.address],
  //       [daiUnits("200")]
  //     );
  // });

  // it("Should allow the Strategist to call reallocate @fork ", async () => {
  //   const { vault, governor, dai, josh, cMeshSwapStrategyUSDC, aaveStrategy } =
  //     await loadFixture(defaultFixture);

  //   await vault.connect(governor).setStrategistAddr(await josh.getAddress());
  //   // await vault.connect(governor).approveStrategy(cMeshSwapStrategyUSDC.address);
  //   // Send all DAI to Compound
  //   await vault
  //     .connect(governor)
  //     .setAssetDefaultStrategy(dai.address, cMeshSwapStrategyUSDC.address);
  //   await dai.connect(josh).approve(vault.address, daiUnits("200"));
  //   await vault.connect(josh).mint(dai.address, daiUnits("200"), 0);
  //   await vault.connect(governor).allocate();
  //   await vault.connect(governor).approveStrategy(aaveStrategy.address);

  //   await vault
  //     .connect(josh)
  //     .reallocate(
  //       cMeshSwapStrategyUSDC.address,
  //       aaveStrategy.address,
  //       [dai.address],
  //       [daiUnits("200")]
  //     );
  // });
});