const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "089_upgrade_gains_dai" , forceDeploy: isPolygonStaging || isMainnet, tags: ["test", "main", "upgrade_gains_dai"],  dependencies: [] },
  async ({ ethers, assetAddresses }) => {
    const contract = "GainsStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cProxy = await ethers.getContract("GainsDAIStrategyProxy");
    const cContract = await ethers.getContract(contract);
    const cGains = await ethers.getContractAt(contract, cProxy.address)

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
