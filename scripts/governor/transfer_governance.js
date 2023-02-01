const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const { withConfirmation } = require("../../utils/deploy");
  const fs = require("fs");
  const path = require("path");
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  console.log(await getNamedAccounts());
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Print ether balance of govenor
  const balance = await sDeployer.getBalance();
  console.log("sDeployer balance:", hre.ethers.utils.formatEther(balance));


  TO_BE_GOVERNOR = "0xa8a5c709a37d37D6Bf1eC151d6547e7c7c23b50A";  
  const contracts = require(path.join(__dirname, "governables.json"));


  let multisig = [];
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    console.log("Loading contract: " + c.name);
    const contract = await ethers.getContractAt(c.name, c.address);
    console.log("Transferring governance to: " + TO_BE_GOVERNOR);
    const tx = await withConfirmation(
        contract.connect(sDeployer).transferGovernance(TO_BE_GOVERNOR)
    );
    console.log("Txn: ", tx.hash);
    await tx.wait();

    multisig.push({ "to": c.address, "value": "0", "data": null, "contractMethod": { "inputs": [{ "internalType": "address", "name": "_newGovernor", "type": "address" }], "name": "transferGovernance", "payable": false }, "contractInputsValues": { "_newGovernor": "0xE1E2a51292a094aaF6Dc0485e1D0C93b44f569Ba" } });
  }

  // Save 
  const filenameWithDate = "for_gnosis_" + hre.network.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".json";
  fs.writeFileSync(path.join(__dirname, filenameWithDate), JSON.stringify(multisig, null, 2));
  console.log("done");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
