const { isFork } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "071_upgrade_dripper" , forceDeploy: isFork, tags: ["test", "main", "upgrade_dripper"],  dependencies: ["001_core"] },
  async ({ ethers, assetAddresses }) => {

    // Deploy a new vault core contract.
    const dDripper = await deployWithConfirmation("Dripper");
    console.log("Deployed Dripper");

    const cDripperProxy = await ethers.getContract("DripperProxy");
    const cDripper = await ethers.getContract("Dripper");

    // Governance proposal
    return {
      name: "Upgrade Dripper",
      actions: [
        {
            contract: cDripperProxy,
            signature: "upgradeTo(address)",
            args: [cDripper.address],
        }
      ],
    };
  }
);
