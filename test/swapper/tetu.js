const { polygonFixture, defaultFixture } = require("../_fixture");
const chai = require("chai");
const hre = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { utils } = require("ethers");
const Web3 = require("web3");
const web3 = new Web3();
const erc20Abi = require("../abi/erc20.json");

const {
  eighteenUnits,
  eighteenUnitsFormat,
  daiUnits,
  usdcUnits,
  wmaticUnits,
  xPoolUnits,
  xPoolUnitsFormat,
  usdtUnits,
  wmaticUnitsFormat,
  loadFixture,
  getOracleAddresses,
  usdcUnitsFormat,
  daiUnitsFormat,
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;

const whale = "0x8D7E07b1A346ac29e922ac01Fa34cb2029f536B9" // Make sure address have USDT & MATIC  both
const mintTetu = async (recipiet, amount) => {
    const { tetu } = await loadFixture(defaultFixture);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whale],
    });
    const whaleSigner = await ethers.provider.getSigner(whale);
    await tetu
        .connect(whaleSigner)
        .transfer(recipiet, amount);
}
describe("TETU router", function () {
  
  it("Swapping TETU to USDC @fork" , async () => {
    const {  xVaultMATICUSD, usdc, usdt, dai, tetu, matt,wmatic, swapper} = await loadFixture(defaultFixture);
    await mintTetu(matt.address, daiUnits("1800"))

    console.log("Matt's TETU balance:", daiUnitsFormat(await tetu.balanceOf(matt.address)));
    console.log("Matt's USDC balance:", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

    await tetu.connect(matt).approve(swapper.address, daiUnits("10000000"));
    await swapper.connect(matt).swapCommon(tetu.address, usdc.address, await tetu.balanceOf(matt.address));
    
    console.log("Matt's TETU balance:", daiUnitsFormat(await tetu.balanceOf(matt.address)));
    console.log("Matt's USDC balance:", usdcUnitsFormat(await usdc.balanceOf(matt.address)));
    expect(await tetu.balanceOf(matt.address)).to.equal("0");

  });

});
