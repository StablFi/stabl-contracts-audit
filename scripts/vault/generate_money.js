// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { utils, BigNumber } = require("ethers");
const { ethers } = require('hardhat');
const erc20Abi = require("../../test/abi/erc20.json");
const addresses = require("../../utils/addresses");

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
    advanceTime,
} = require("../../test/helpers");

const provider = ethers.getDefaultProvider("https://internal-rpc.stabl.fi");
const whale = "0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245" // Make sure address have USDC & MATIC  both
const mintUSDC = async (recipiet, amount) => {
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whale],
    });
    const whaleSigner = await provider.getSigner(whale);
    usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    await usdc
        .connect(whaleSigner)
        .transfer(recipiet, amount);
}
const usdtWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
const mintUSDT = async (recipiet, amount) => {
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [usdtWhale],
    });
    const whaleSigner = await provider.getSigner(usdtWhale);
    usdt = await ethers.getContractAt(erc20Abi, addresses.polygon.USDT);
    await usdt
        .connect(whaleSigner)
        .transfer(recipiet, amount);
}
const daiWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

const mintDAI = async (recipiet, amount) => {
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [daiWhale],
    });
    const whaleSigner = await provider.getSigner(daiWhale);
    dai = await ethers.getContractAt(erc20Abi, addresses.polygon.DAI);
    await dai
        .connect(whaleSigner)
        .transfer(recipiet, amount);
}
const cashWhale = "0x9c4927530B1719e063D7E181C6c2e56353204e64";
const mintCASH = async (recipiet, amount) => {
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [cashWhale],
    });
    const whaleSigner = await provider.getSigner(cashWhale);
    cash = await ethers.getContractAt(erc20Abi, "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    await cash
        .connect(whaleSigner)
        .transfer(recipiet, amount);
}
async function main() {
    const minter = "0x0B619e369E6815e145dD248937B52F27bce57FEc";
    await network.provider.send("hardhat_setBalance", [minter, "0x90000000000000000"]);
    await mintUSDC(minter, usdcUnits("500000"));
    await mintUSDT(minter, usdcUnits("500000"));
    await mintDAI(minter, daiUnits("500000"));
    // await mintCASH(minter, cashUnits("500000"));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
