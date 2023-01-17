const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "078_upgrade_am3curve" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_am3curve"],  dependencies: [] },
  async ({ ethers }) => {
    const contract = "Am3CurveStrategy";
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
