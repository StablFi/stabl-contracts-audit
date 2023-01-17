const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "073_upgrade_dodo" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_dodo"],  dependencies: ["051_deploy_dodo_v1"] },
  async ({ ethers }) => {
    const contract = "DodoStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cProxy = await ethers.getContract(contract + "Proxy");
    const cContract = await ethers.getContract(contract);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
            contract: cProxy,
            signature: "upgradeTo(address)",
            args: [cContract.address],
        }
      ],
    };
  }
);
