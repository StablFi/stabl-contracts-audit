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
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;

describe("Vault", function () {
  
  it("Should support an asset  @mock" , async () => {
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
    // We limit to paying to $1 OUSD for for one stable coin,
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
    // fails silently, so Anna's OUSD balance should be zero.
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
    // Matt sends his OUSD directly to Vault
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
    // Pretend OUSD is a strategy and add its address
    await vault.connect(governor).approveStrategy(cash.address);
  });

  it("Should revert when removing a Strategy that has not been added @mock", async () => {
    const { vault, governor, cash } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and remove its address
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
    // Matt sends his OUSD directly to Vault
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