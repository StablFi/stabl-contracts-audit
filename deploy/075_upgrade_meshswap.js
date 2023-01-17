const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "075_upgrade_meshswap", forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_meshswap"], dependencies: [] },
  async ({ ethers }) => {
    const contract = "MeshSwapStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cDAIProxy = await ethers.getContract(contract + "DAIProxy");
    const cUSDTProxy = await ethers.getContract(contract + "USDTProxy");
    const cUSDCProxy = await ethers.getContract(contract + "USDCProxy");
    const cContract = await ethers.getContract(contract);

    const cDAI = await ethers.getContractAt(contract, cDAIProxy.address);
    const cUSDT = await ethers.getContractAt(contract, cUSDTProxy.address);
    const cUSDC = await ethers.getContractAt(contract, cUSDCProxy.address);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
          contract: cDAIProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDTProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDCProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },

        {
          contract: cDAI,
          signature: "setOracleRouterSwappingPool()",
          args: [],
        },

        {
          contract: cUSDT,
          signature: "setOracleRouterSwappingPool()",
          args: [],
        },

        {
          contract: cUSDC,
          signature: "setOracleRouterSwappingPool()",
          args: [],
        },

      ],
    };
  }
);
