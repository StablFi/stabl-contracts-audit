const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "072_upgrade_synapse", forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_synapse"], dependencies: ["050_deploy_synapse"] },
  async ({ ethers }) => {
    const contract = "SynapseStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cProxy = await ethers.getContract(contract + "Proxy");
    const cContract = await ethers.getContract(contract);
    const cContractAtProxy = await ethers.getContractAt(contract, cProxy.address);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
          contract: cProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
       
      ],
    };
  }
);
