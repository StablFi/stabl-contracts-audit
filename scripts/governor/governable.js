const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  
    const fs = require("fs");
    const path = require("path");
    const folder = path.join(__dirname, "../../deployments/" + hre.network.name);
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
    let contracts = await getSortedFiles(folder);
    let governables  = [];
    // loop through contracts
    for (let i = 0; i < contracts.length; i++) {
      const contractName = contracts[i];
      if (contractName == null || contractName == "") {
        continue;
      }
      const contract = await ethers.getContractAt(contractName, (await ethers.getContract(contractName)).address);
      try {
        let governor = await  contract.governor();
        console.log(contractName,":",governor);
 
        governables.push({
            "name": contractName,
            "governor": governor,
            "address": contract.address,
        });
      } catch (e) {
      }
    }
    // console.log(governables);
    // save governable to file
    const filenameWithDate = "rgovernable.json";

    fs.writeFileSync(path.join(__dirname, filenameWithDate), JSON.stringify(governables, null, 2));
    console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
