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
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;



describe("RebaseToNonEoaHandler", function () {
  it("Should be able to add contracts @fork", async () => {
    const { vault, governor, rebaseToNonEoaHandler, rio, anna, john } = await loadFixture(
      defaultFixture
    );
      const samplePoolId =
        "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";

      await rebaseToNonEoaHandler
        .connect(governor)
        .addContract(vault.address, samplePoolId, rio.address, anna.address, 800000, 150000, 50000, false, false);
      await rebaseToNonEoaHandler.setTreasury(john.address);
      
      const contractsCount = await rebaseToNonEoaHandler.contractsCount();
      expect(contractsCount).to.be.equal(1);
      const contractAdded = await rebaseToNonEoaHandler.allContracts(0);
      expect(contractAdded).to.be.equal(vault.address);
  });
  it("Should remove strategy from all points @removeStrategy  @fork", async () => {
    const { vault, governor, rebaseToNonEoaHandler, rio, anna, john } = await loadFixture(
      defaultFixture
    );
    const samplePoolId =
      "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";

    await rebaseToNonEoaHandler
      .connect(governor)
      .addContract(vault.address, samplePoolId, rio.address, anna.address, 800000, 150000, 50000, false, false);
    await rebaseToNonEoaHandler.setTreasury(john.address);

    console.log("Remove contract...");
    await rebaseToNonEoaHandler.connect(governor).removeContract(vault.address);
    const contractsCount = await rebaseToNonEoaHandler.contractsCount();
    expect(contractsCount).to.be.equal(0);

    await expect( rebaseToNonEoaHandler.allContracts(0)).to.be.reverted;

  });
  it("Simulate the non-rebase to rebase transfer  @mock", async () => {
    const { vault, usdc, governor, rebaseToNonEoaHandler, uniswapV2PairCASHUSDC, matt, cash, josh, cDystopiaStrategyUsdcDai, john, cMeshSwapStrategyUSDCUSDT, cDystopiaStrategyDaiUsdt,anna } = await loadFixture(
      defaultFixture
    );

    const samplePoolId =
      "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";
    await rebaseToNonEoaHandler
      .connect(governor)
      .addContract(uniswapV2PairCASHUSDC.address, samplePoolId, cDystopiaStrategyDaiUsdt.address, cDystopiaStrategyUsdcDai.address, 800000, 150000, 50000, true, false);
    await rebaseToNonEoaHandler.setTreasury(cMeshSwapStrategyUSDCUSDT.address);

    const gauge = cDystopiaStrategyDaiUsdt.address;
    const bribe = cDystopiaStrategyUsdcDai.address;
    const treasury = await rebaseToNonEoaHandler.treasury();
    console.log("Treasury: ", treasury);
    console.log("CASH in Treasury:", cashUnitsFormat(await cash.balanceOf(treasury)));


    console.log("Matt Balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
    console.log("Josh Balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));
    
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    await cash.connect(matt).transfer(uniswapV2PairCASHUSDC.address, await cash.balanceOf(matt.address));
    await usdc.connect(matt).transfer(uniswapV2PairCASHUSDC.address, usdcUnits("100.00"));
    await uniswapV2PairCASHUSDC.mint(matt.address);
    
    console.log("Matt LP Balance: ", cashUnitsFormat(await uniswapV2PairCASHUSDC.balanceOf(matt.address)));
    
    await usdc.connect(anna).transfer(vault.address, usdcUnits("100"));
    
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    console.log("CASH in Treasury:", cashUnitsFormat(await cash.balanceOf(treasury)));
    console.log("CASH allowed to Bribe:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, bribe)));
    console.log("CASH allowed to Guage:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, gauge)));

    await vault.rebase();
    console.log("Matt Balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
    console.log("Josh Balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));

    console.log("Matt LP Balance: ", cashUnitsFormat(await uniswapV2PairCASHUSDC.balanceOf(matt.address)));
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    console.log("CASH in Treasury:", cashUnitsFormat(await cash.balanceOf(treasury)));
    console.log("CASH allowed to Bribe:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, bribe)));
    console.log("CASH allowed to Guage:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, gauge)));

    await expect(await cash.balanceOf(treasury)).to.be.closeTo(cashUnits("2.5"), "10000");
    await expect(await cash.allowance(rebaseToNonEoaHandler.address, bribe)).to.be.closeTo(cashUnits("7.5"), "10000");
    await expect(await cash.allowance(rebaseToNonEoaHandler.address, gauge)).to.be.closeTo(cashUnits("40"), "10000");

  });
  it("Simulate the non-rebase to rebase transfer - 4pool  @mock", async () => {
    const { vault, usdc, governor, rebaseToNonEoaHandler, uniswapV2PairCASHUSDC, matt, cash, josh, cDystopiaStrategyUsdcDai, john, cMeshSwapStrategyUSDCUSDT, cDystopiaStrategyDaiUsdt,anna } = await loadFixture(
      defaultFixture
    );

    const samplePoolId =
      "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";
    await rebaseToNonEoaHandler
      .connect(governor)
      .addContract(uniswapV2PairCASHUSDC.address, samplePoolId, cDystopiaStrategyDaiUsdt.address, cDystopiaStrategyUsdcDai.address, 800000, 150000, 50000, true, true);
    await rebaseToNonEoaHandler.setTreasury(cMeshSwapStrategyUSDCUSDT.address);

    const gauge = cDystopiaStrategyDaiUsdt.address;
    const bribe = cDystopiaStrategyUsdcDai.address;
    const treasury = await rebaseToNonEoaHandler.treasury();
    console.log("Treasury: ", treasury);
    console.log("CASH in Treasury:", cashUnitsFormat(await cash.balanceOf(treasury)));


    console.log("Matt Balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
    console.log("Josh Balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));
    
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    await cash.connect(matt).transfer(uniswapV2PairCASHUSDC.address, await cash.balanceOf(matt.address));
    await usdc.connect(matt).transfer(uniswapV2PairCASHUSDC.address, usdcUnits("100.00"));
    await uniswapV2PairCASHUSDC.mint(matt.address);
    
    console.log("Matt LP Balance: ", cashUnitsFormat(await uniswapV2PairCASHUSDC.balanceOf(matt.address)));
    
    await usdc.connect(anna).transfer(vault.address, usdcUnits("100"));
    
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    console.log("CASH in Treasury:", cashUnitsFormat(await cash.balanceOf(treasury)));
    console.log("CASH allowed to Bribe:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, bribe)));
    console.log("CASH allowed to Guage:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, gauge)));

    await vault.rebase();
    console.log("Matt Balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
    console.log("Josh Balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));

    console.log("Matt LP Balance: ", cashUnitsFormat(await uniswapV2PairCASHUSDC.balanceOf(matt.address)));
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    console.log("CASH in Treasury:", cashUnitsFormat(await cash.balanceOf(treasury)));
    console.log("CASH allowed to Bribe:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, bribe)));
    console.log("CASH allowed to Guage:", cashUnitsFormat(await cash.allowance(rebaseToNonEoaHandler.address, gauge)));

    await expect(await cash.balanceOf(treasury)).to.be.closeTo(cashUnits("2.5"), "10000");
    await expect(await cash.allowance(rebaseToNonEoaHandler.address, bribe)).to.be.closeTo(cashUnits("7.5"), "10000");
    await expect(await cash.allowance(rebaseToNonEoaHandler.address, gauge)).to.be.closeTo(cashUnits("40"), "10000");

  });

  it("Should not be able to double add contracts @fork", async () => {
    const { vault, governor, rebaseToNonEoaHandler, rio, anna, john } = await loadFixture(
      defaultFixture
    );
      const samplePoolId =
        "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";

      await rebaseToNonEoaHandler
        .connect(governor)
        .addContract(vault.address, samplePoolId, rio.address, anna.address, 800000, 150000, 50000, false, false);

      await expect(  rebaseToNonEoaHandler
        .connect(governor)
        .addContract(vault.address, samplePoolId, rio.address, anna.address, 800000, 150000, 50000, false, false)).to.be.revertedWith('ALREADY_ADDED');
      await rebaseToNonEoaHandler.setTreasury(john.address);
      
      const contractsCount = await rebaseToNonEoaHandler.contractsCount();
      expect(contractsCount).to.be.equal(1);
      const contractAdded = await rebaseToNonEoaHandler.allContracts(0);
      expect(contractAdded).to.be.equal(vault.address);
  });

  it("Should be able to add contracts after the contract is once removed  @fork", async () => {
    const { vault, governor, rebaseToNonEoaHandler, rio, anna, john } = await loadFixture(
      defaultFixture
    );
      const samplePoolId =
        "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";

      await rebaseToNonEoaHandler
        .connect(governor)
        .addContract(vault.address, samplePoolId, rio.address, anna.address, 800000, 150000, 50000, false, false);

      await rebaseToNonEoaHandler
        .connect(governor)
        .removeContract(vault.address);
        
      await rebaseToNonEoaHandler
        .connect(governor)
        .addContract(vault.address, samplePoolId, rio.address, anna.address, 800000, 150000, 50000, false, false);

      
      const contractsCount = await rebaseToNonEoaHandler.contractsCount();
      expect(contractsCount).to.be.equal(1);
      const contractAdded = await rebaseToNonEoaHandler.allContracts(0);
      expect(contractAdded).to.be.equal(vault.address);
  });
});
