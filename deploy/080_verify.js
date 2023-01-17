const hre = require("hardhat");
const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deployWithConfirmationWhenNotAlreadyDeployed, deployWithConfirmation, deploymentWithProposal } = require("../utils/deploy");
const axios = require('axios');
const { deployMockContract } = require("ethereum-waffle");

module.exports = deploymentWithProposal(
  { deployName: "080_verify" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "verify"],  dependencies: [] },
  async ({ ethers }) => {

    // Read JSON files from deployment folder
    const fs = require('fs');
    const path = require('path');
    let contracts = fs.readdirSync(path.join(__dirname, '../deployments/' + hre.network.name)).map(file => {
      if (file.endsWith('.json')) {
        return file.split('.')[0]
      }
      return null
    });
    // console.log(contracts)
    // contracts =[
    //                   "Am3CurveStrategy", "Am3CurveStrategyProxy", "Am3CurveStrategyUSDTProxy",
    //                   "ClearpoolStrategy", "ClearpoolWintermuteStrategyProxy",
    //                   "DodoStrategy", "DodoStrategyProxy",
    //                   "DystopiaStrategy", "DystopiaStrategyDaiUsdtProxy", "DystopiaStrategyUsdcDaiProxy", "DystopiaStrategyUsdcUsdtProxy",
    //                   "DystopiaStrategy", "DystopiaStrategyDaiUsdtProxy", "DystopiaStrategyUsdcDaiProxy", "DystopiaStrategyUsdcUsdtProxy",
    //                   "MeshSwapStrategy", "MeshSwapStrategyDual", "QuickSwapStrategy", "SynapseStrategy", 
    //                   "Vault", "VaultAdmin", "VaultCore", "Dripper", "Harvester",
    //                 ];
    for (let index = 0; index < contracts.length; index++) {
        const contract = contracts[index];
        if (contract == null || contract == '') {
          continue
        }
        console.log("Verifying " + contract);
        const ABIUrl = "https://api.polygonscan.com/api?module=contract&action=getsourcecode&address=" + (await ethers.getContract(contract)).address + "&apikey=" + process.env.POLYGON_API_KEY;
        // send GET request to ABIUrl using https
        let result = await axios.get(ABIUrl)
        .then(res => {
          if (res.data.result[0].ABI != "Contract source code not verified") {
            return true;
          } else {
            return false;
          }
        })
        .catch(err => {
          console.log('Error: ', err.message);
        });
        if (result) {
          console.log("Verified " + contract, result);
          continue;
        }
        await deployWithConfirmationWhenNotAlreadyDeployed(contract)
        console.log("Deployed", contract, " (If not already deployed)");
        // aa;
        
    }
    return {
      name: "Verify",
      actions: [
        
      ],
    };
  }
);
