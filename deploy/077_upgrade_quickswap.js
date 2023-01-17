const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "077_upgrade_quickswap", forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_quickswap"], dependencies: [] },
  async ({ ethers }) => {
    const contract = "QuickSwapStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cUSDCDAIProxy = await ethers.getContract(contract + "USDCDAI" + "Proxy");
    const cUSDCUSDTProxy = await ethers.getContract(contract + "USDCUSDT" + "Proxy");

    const cContract = await ethers.getContract(contract);

    const cUSDCDAI = await ethers.getContractAt(contract, cUSDCDAIProxy.address);
    const cUSDCUSDT = await ethers.getContractAt(contract, cUSDCUSDTProxy.address);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
          contract: cUSDCDAIProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDCUSDTProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDCDAI,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },
        {
          contract: cUSDCUSDT,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },

      ],
    };
  }
);
