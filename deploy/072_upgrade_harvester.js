const { isFork, isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "072_upgrade_harvester" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_harvester"],  dependencies: ["001_core"] },
  async ({ ethers, assetAddresses }) => {

    // Deploy a new vault core contract.
    const dHarvester = await deployWithConfirmation("Harvester");
    console.log("Deployed Harvester");

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContract("Harvester");

    // Governance proposal
    return {
      name: "Upgrade Harvester",
      actions: [
        {
            contract: cHarvesterProxy,
            signature: "upgradeTo(address)",
            args: [cHarvester.address],
        }
      ],
    };
  }
);
