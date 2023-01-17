const { isFork, isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "087_upgrade_cash" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_cash"],  dependencies: [] },
  async ({ ethers, assetAddresses }) => {

    const dCASH = await deployWithConfirmation("CASH");
    console.log("Deployed CASH");

    const cCASHProxy = await ethers.getContract("CASHProxy");
    const cCASH = await ethers.getContract("CASH");

    // Governance proposal
    return {
      name: "Upgrade CASH",
      actions: [
        {
          contract: cCASHProxy,
          signature: "upgradeTo(address)",
          args: [cCASH.address],
        }
      ],
    };
  }
);
