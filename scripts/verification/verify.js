//
// Deployment utilities
//

const hre = require("hardhat");
const { utils } = require("ethers");

const {
  advanceTime,
  isMainnet,
  isFork,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
  getOracleAddresses,
  getAssetAddresses,
  isSmokeTest,
} = require("../../test/helpers.js");

const {
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
} = require("../../tasks/storageSlots");

const {
    getFilesInFolder
  } = require("../../utils/fileSystem");

const verifyContract = async(result, args, _contract) => {
  if (!args) args = [];
  try {
    await hre.run('verify:verify', {
      address: result.address,
      constructorArguments: args,
    })
  } catch (error) {
    console.warn("Warning: verification of deployed contract failed." , error.message);
  }
};

async function main() { 
    await getFilesInFolder(`${__dirname}/../deployments/mainnet`).then(files => {
        console.log(files);
    }).catch(error => {
        console.log(error);
    });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
