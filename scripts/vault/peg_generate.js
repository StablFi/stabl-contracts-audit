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
const fetch = require("node-fetch");
const BigNumber = require("ethers").BigNumber;

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
    await cCASHProxy.connect(signer).upgradeTo(cCASH.address);
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

    let governor = await vault.governor();
    console.log("Governor:", governor)
    // await hre.network.provider.request({
    //     method: "hardhat_impersonateAccount",
    //     params: [governor],
    // });
    // await hre.network.provider.request({
    //     method: "hardhat_reset",
    //     params: [
    //         {
    //             forking: {
    //                 jsonRpcUrl: "https://polygon-rpc.com",
    //                 blockNumber: 40254497,
    //             },
    //         },
    //     ],
    // });
    // const governorSigner = await ethers.getSigner(governor);
    // await upgradeCASH(governorSigner);
    // await cash.connect(governorSigner).changeSupplyWithRebasingCreditsPerToken("943987283049715000")

    // cashTotalSupply = await cash.totalSupply();
    // console.log("cashTotalSupply:", cashUnitsFormat(cashTotalSupply));

    // vaultCheckBalance = await vault.checkBalance();
    // console.log("vaultCheckBalance:", cashUnitsFormat(vaultCheckBalance));

    // bal = await cash.balanceOf("0x547b324b3f9e1f9f436fede6e88ae1ca816db6f3");
    // console.log("BAL:", bal.toString());
    // await vault.connect(governorSigner).rebase();

    // cashTotalSupply = await cash.totalSupply();
    // console.log("cashTotalSupply:", cashUnitsFormat(cashTotalSupply));

    // vaultCheckBalance = await vault.checkBalance();
    // console.log("vaultCheckBalance:", cashUnitsFormat(vaultCheckBalance));

    // bal = await cash.balanceOf("0x547b324b3f9e1f9f436fede6e88ae1ca816db6f3");
    // console.log("BAL:", bal.toString());

    // Read accounts.csv file using fs
    let csv = [];
    const fs = require('fs');
    const accounts = fs.readFileSync('./scripts/vault/accounts.csv', 'utf8').split('\n')
    const latest =  await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(latest);
    console.log("Latest block:", latest)
    csv.push(['Account', 'Latest Balance'])
    const reqs = [];

    // ABI
    let abi = [
        'function balanceOf(address) returns (uint256)'
    ];

    // Create function call data -- eth_call
    let iface = new ethers.utils.Interface(abi)
    const cashAddress = cash.address;
    const balances = [];
    let done = false;
    for (let i = 0; i < accounts.length; i++) {
  
        let edata = iface.encodeFunctionData("balanceOf", [accounts[i].trim()]);

        reqs.push({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
                {
                    to: cashAddress,
                    data: edata
                },
                {"blockHash": block.hash}

            ],
            "id": i
        })
    }

    // Split req into chunks of 200 and make requests
    for (let j = 0; j < Math.ceil(reqs.length / 200); j++) {
        let chunk = reqs.slice(j * 200, j * 200 + 200);
        const res = await fetch('https://polygon-mainnet.g.alchemy.com/v2/KxQ2_2k2PP6MFe0EI2esaY3dNHWPtVwk', { method: 'POST', body: JSON.stringify(chunk), headers: { 'Content-Type': 'application/json' } })
        const data = await res.json()
        // Wait for 3 seconds
        await new Promise(r => setTimeout(r, 3000));
        for (let i = 0; i < data.length; i++) {
            console.log("Account:", i, "balance:", iface.decodeFunctionResult("balanceOf", data[i].result).toString())
            balances.push( iface.decodeFunctionResult("balanceOf", data[i].result).toString())
        }
    }
    
    for (let i = 0; i < balances.length; i++) {
        const account = accounts[i].trim();
        csv.push([
            account,
            BigNumber.from(balances[i]).toString()
        ])
    }

    let csvString = csv.map(e => e.join(",")).join("\n");
    require("fs").writeFileSync("scripts/vault/after_fix_mainnet_" + latest + ".csv", csvString);
    return;
    // // foreach accounts
    // for (let i = 0; i < accounts.length; i++) {
    //     const account = accounts[i].trim();
    //     console.log("Account:", account, cashUnitsFormat(await cash.balanceOf(account)));
    //     const beforeCASH = cashUnitsFormat(await cash.balanceOf(account, { blockTag: 40157497 }));
    //     const onCASH = cashUnitsFormat(await cash.balanceOf(account, { blockTag: 40227151 }));
    //     const latestCASH = cashUnitsFormat(await cash.balanceOf(account));

        const beforeCASHRCPT = (await vault.checkBalance({ blockTag: 40182859  }));
        const onCASHRCPT = (await vault.checkBalance({ blockTag: 40220549 }));
        const latestCASHRCPT = (await vault.checkBalance({ blockTag: 40270297  }));
        // Print
        console.log("beforeCASHRCPT:", beforeCASHRCPT.toString());
        console.log("onCASHRCPT:", onCASHRCPT.toString());
        console.log("latestCASHRCPT:", latestCASHRCPT.toString());

        // const beforeCASHbalanceOf = cashUnitsFormat((await cash.balanceOf(account, { blockTag: 40157497 }))[0]);
        // const onCASHbalanceOf = cashUnitsFormat((await cash.balanceOf(account, { blockTag: 40227151 }))[0]);
        // const latestCASHbalanceOf = cashUnitsFormat((await cash.balanceOf(account))[0]);

    //     csv.push([
    //         account,
    //         beforeCASH,
    //         onCASH,
    //         latestCASH,
    //         beforeCASHRCPT,
    //         onCASHRCPT,
    //         latestCASHRCPT,
    //         beforeCASHbalanceOf,
    //         onCASHbalanceOf,
    //         latestCASHbalanceOf
    //     ])

    // }
    // console.table(csv);
    // csvString = csv.map(e => e.join(",")).join("\n");
    // require("fs").writeFileSync("scripts/vault/account_comparison.csv", csvString);

    // return;
    // const start = 40157497;
    // const end = start; //await ethers.provider.getBlockNumber();
    // const step = 1;
    // // Loop from strat to end and fill CSV
    // // Create a CSV
    // csv = [];
    // csv.push(["block", "block_time", "cashTotalSupply", "vaultCheckBalance", "vaultNetAssetValue", "Diff", "RBT", "Balance"]);

    // for (let i = start; i < end; i += step) {
    //     block = await ethers.provider.getBlock(i);
    //     blockTime = block.blockTime;

    //     cashTotalSupply = await cash.totalSupply({
    //         blockTag: i
    //     });
    //     vaultCheckBalance = await vault.checkBalance({
    //         blockTag: i
    //     });
    //     cashRebasingCreditsPerToken = await cash.rebasingCreditsPerTokenHighres({
    //         blockTag: i
    //     });
    //     vaultNetAssetValue = 0;
    //     dif = parseInt(cashUnitsFormat(cashTotalSupply)) - parseInt(usdcUnitsFormat(vaultCheckBalance));
    //     console.log("Block:", i, "cashTotalSupply:", cashUnitsFormat(cashTotalSupply), "vaultCheckBalance:", usdcUnitsFormat(vaultCheckBalance), "Diff:", dif, "RBT:", cashRebasingCreditsPerToken.toString(), "BAL:", bal.toString());
    //     csv.push([i, blockTime, cashUnitsFormat(cashTotalSupply), usdcUnitsFormat(vaultCheckBalance), usdcUnitsFormat(vaultNetAssetValue), dif, cashRebasingCreditsPerToken.toString(), bal.toString()]);
    // }
    // // Save csv to file
    // csvString = csv.map(e => e.join(",")).join("\n");
    // require("fs").writeFileSync("peg.csv", csvString);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
