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
    const { vault, governor, rebaseToNonEoaHandler } = await loadFixture(
      defaultFixture
    );
    const samplePoolId =
      "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";
    await rebaseToNonEoaHandler
      .connect(governor)
      .addContract(vault.address, samplePoolId, false);

      const contractsCount = await rebaseToNonEoaHandler.contractsCount();
      expect(contractsCount).to.be.equal(1);
      const contractAdded = await rebaseToNonEoaHandler.allContracts(0);
      expect(contractAdded).to.be.equal(vault.address);
  });
  it("Should remove strategy from all points @removeStrategy  @fork", async () => {
    const { vault, governor, rebaseToNonEoaHandler } = await loadFixture(
      defaultFixture
    );
    const sample =
      "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";
    await rebaseToNonEoaHandler
      .connect(governor)
      .addContract(vault.address, sample, false);

    console.log("Remove contract...");
    await rebaseToNonEoaHandler.connect(governor).removeContract(vault.address);
    const contractsCount = await rebaseToNonEoaHandler.contractsCount();
    expect(contractsCount).to.be.equal(0);

    await expect( rebaseToNonEoaHandler.allContracts(0)).to.be.reverted;

  });
  it("Simulate the non-rebase to rebase transfer  @mock", async () => {
    const { vault, usdc, governor, rebaseToNonEoaHandler, uniswapV2PairCASHUSDC, matt, cash, josh, anna } = await loadFixture(
      defaultFixture
    );

    await rebaseToNonEoaHandler.setMultiRewardPool(vault.address)
    const samplePoolId =
      "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";
    await rebaseToNonEoaHandler
      .connect(governor)
      .addContract(uniswapV2PairCASHUSDC.address, samplePoolId, true);

    console.log("CASH in MRP:", cashUnitsFormat(await cash.balanceOf(vault.address)));
    await expect(vault).has.a.balanceOf("0", cash);
    console.log("Matt Balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
    console.log("Josh Balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));
    await expect(matt).has.a.balanceOf("100.00", cash);
    await expect(josh).has.a.balanceOf("100.00", cash);
    
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    await cash.connect(matt).transfer(uniswapV2PairCASHUSDC.address, cashUnits("100.00"));
    await usdc.connect(matt).transfer(uniswapV2PairCASHUSDC.address, usdcUnits("100.00"));
    await uniswapV2PairCASHUSDC.mint(matt.address);
    
    console.log("Matt LP Balance: ", cashUnitsFormat(await uniswapV2PairCASHUSDC.balanceOf(matt.address)));
    
    await usdc.connect(anna).transfer(vault.address, usdcUnits("100"));
    
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));

    await vault.rebase();
    console.log("Matt Balance: ", cashUnitsFormat(await cash.balanceOf(matt.address)));
    console.log("Josh Balance: ", cashUnitsFormat(await cash.balanceOf(josh.address)));

    console.log("Matt LP Balance: ", cashUnitsFormat(await uniswapV2PairCASHUSDC.balanceOf(matt.address)));
    console.log("LP CASH Stray Balance: ", cashUnitsFormat(await cash.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("LP USDC Stray Balance: ", usdcUnitsFormat(await usdc.balanceOf(uniswapV2PairCASHUSDC.address)));
    console.log("CASH in MRP:", cashUnitsFormat(await cash.balanceOf(vault.address)));

    await expect(await cash.balanceOf(vault.address)).to.be.closeTo(cashUnits("50"), "10000");

  });
});
