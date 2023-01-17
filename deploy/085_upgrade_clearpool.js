const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "085_upgrade_clearpool", forceDeploy: isPolygonStaging || isMainnet, tags: ["test", "main", "upgrade_clearpool"], dependencies: [] },
  async ({ ethers }) => {
    const contract = "ClearpoolStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cProxy = await ethers.getContract("ClearpoolWintermuteStrategyProxy");
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
        {
          contract: cContractAtProxy,
          signature: "setOracleRouterSwappingPool()",
          args: [],
        }
      ],
    };
  }
);
