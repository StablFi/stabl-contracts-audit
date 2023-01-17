const hre = require("hardhat");
const { utils } = require("ethers");
const { getAssetAddresses } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
const { polygon } = require("../../utils/addresses");

async function main() { 
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    const from = "0x6b03b042CbDa485A14398FE8787f90d7C93BEfF0"; // await sDeployer.getAddress();

    const publicTokens = addresses.polygon;
    const polygonTokens = polygon;
    // Merge polygonTokens into publicTokens
    for (let i = 0; i < Object.keys(polygonTokens).length; i++) {
        const tokenName =  Object.keys(polygonTokens)[i];
        const token =  Object.values(polygonTokens)[i];
        publicTokens[tokenName] = token;
    }

    const fs = require("fs");
    const path = require("path");
    const folder1 = path.join(__dirname, "../../deployments/" + hre.network.name);
    const getSortedFiles = async (dir) => {
      const files = await fs.promises.readdir(dir);

      return files
        .map((fileName) => ({
          name: fileName,
          time: fs.statSync(`${dir}/${fileName}`).mtime.getTime(),
        }))
        .sort((a, b) => a.time - b.time)
        .map((file) => {
          // Sort by date modified
          if (file.name.endsWith(".json")) {
            return file.name.split(".")[0];
          }
          return null;
        });
    };
    let contracts = await getSortedFiles(folder1);

    let balancable  = [];
    // loop through contracts
    for (let i = 0; i < contracts.length; i++) {
      const contractName = contracts[i];
      if (contractName == null || contractName == "") {
        continue;
      }
      const contract = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", (await ethers.getContract(contractName)).address);
      try {
        let balance = await  contract.balanceOf(from);
        console.log(contractName,":",balance.toString());
        if (balance.toString() == "0") {
            continue;
        }
        balancable.push({
            "name": contractName,
            "balance": balance.toString(),
            "address": contract.address,
        });
      } catch (e) {
        console.log("Failed to fetch balance of ", contractName)
      }
    }

    for(let i = 0; i < Object.keys(publicTokens).length; i++) {
        const tokenName =  Object.keys(publicTokens)[i];
        const token =  Object.values(publicTokens)[i];
        const contract = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", token);
        try {
            let balance = await  contract.balanceOf(from);
            console.log(tokenName,":",balance.toString());
            if (balance.toString() == "0") {
                continue;
            }
            balancable.push({
                "name": tokenName,
                "balance": balance.toString(),
                "address": contract.address,
            });
        } catch (e) {
          console.log("Failed to fetch balance of ", tokenName)

        }
    }

    // Save 
    const filenameWithDate = "balance_migrator_" + new Date().toISOString().replace(/:/g, "-") + ".json";
    fs.writeFileSync(path.join(__dirname, filenameWithDate), JSON.stringify(balancable, null, 2));
    console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
