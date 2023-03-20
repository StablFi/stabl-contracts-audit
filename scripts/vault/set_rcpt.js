// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { utils } = require("ethers");
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
} = require("../../test/helpers");
const { deployWithConfirmation } = require('../../utils/deploy');
async function upgradeCASH(signer) {
    const dCASH = await deployWithConfirmation("CASH");
    console.log("Deployed CASH");

    const cCASHProxy = await ethers.getContractAt(
        "CASHProxy",
        "0x80487b4f8f70e793A81a42367c225ee0B94315DF"
    );
    const cCASH = await ethers.getContract("CASH");
    console.log('Trying to upgrade')
    await cCASHProxy.connect(signer).upgradeTo(cCASH.address);
    console.log('Upgraded')
}
async function main() {
    const staging = false;

    let usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
    let cash = await hre.ethers.getContractAt("CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
    let vault = await hre.ethers.getContractAt("VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
    let dripper = await hre.ethers.getContractAt("Dripper", "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1");
    let harvester = await hre.ethers.getContractAt("Harvester", "0xdbb57b33583fa86d4b31e88cf951caf6fd561ffe");

    if (staging) {
        cash = await hre.ethers.getContractAt("CASH", "0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809");
        vault = await hre.ethers.getContractAt("VaultCore", "0xa6c6E539167e8efa5BE0525E1F16c51e57dF896E");
        dripper = await hre.ethers.getContractAt("Dripper", "0xe5FDf6f6EC63271d8ed1056891BE0998d9ad8fa9");
        harvester = await hre.ethers.getContractAt("Harvester", "0xb659Cbde75D7aaB10490c86170b50fb0364Bd573");
    }
    
    const rctp = "943987283049715099";

    const governor = await vault.governor();
    // await hre.network.provider.request({
    //     method: "hardhat_impersonateAccount",
    //     params: [governor],
    // });
    const governorSigner = await ethers.provider.getSigner(governor);

    // await upgradeCASH(governorSigner);

    // print cash total supply
    let cashTotalSupply = await cash.totalSupply();
    console.log("cash total supply: ", cashTotalSupply.toString());

    lv = await vault.checkBalance({blockTag: 40206097});
    console.log("vault balance: ", lv.toString());

    // let t = await cash.connect(governorSigner).changeSupplyWithRebasingCreditsPerToken(rctp);
    // console.log(t)
    // await t.wait()
    
    rebasingPerToken = await cash.rebasingCreditsPerTokenHighres();
    console.log("rebasingPerToken: ", rebasingPerToken.toString());
    cashTotalSupply = await cash.totalSupply();
    console.log("cash total supply: ", cashTotalSupply.toString());

    t = await vault.connect(governorSigner).rebase();
    console.log(t)
    await t.wait()

    rebasingPerToken = await cash.rebasingCreditsPerTokenHighres();
    console.log("rebasingPerToken: ", rebasingPerToken.toString());
    cashTotalSupply = await cash.totalSupply();
    console.log("cash total supply: ", cashTotalSupply.toString());
   
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
