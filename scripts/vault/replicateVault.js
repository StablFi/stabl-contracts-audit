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

async function main() {
    const fs = require('fs');
    const path = require('path');
    let contracts = fs.readdirSync(path.join(__dirname, '../../deployments/mainnet')).map(file => {
        if (file.endsWith('Proxy.json')) {
            return file.split('.')[0]
        }
        return null
    });
    let contractsJson = [];
    // Loop through contracts
    for (let index = 0; index < contracts.length; index++) {
        const element = contracts[index];
        if (element != null) {
            // remove proxy from element 
            let contractName = element.split('Proxy')[0];
            contractsJson.push({
                address: (await ethers.getContract(element)).address,
                contract: element ,
                proxyOf: contractName

            })
            
        }
    }
    console.log(contractsJson)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
