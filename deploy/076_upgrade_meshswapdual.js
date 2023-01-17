const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "076_upgrade_meshswapdual", forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_meshswapdual"], dependencies: [] },
  async ({ ethers }) => {
    const contract = "MeshSwapStrategyDual";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cUSDCUSDTProxy = await ethers.getContract(contract.replace("Dual", "") + "USDCUSDT" + "Proxy");
    const cUSDCDAIProxy = await ethers.getContract(contract.replace("Dual", "") + "USDCDAI" + "Proxy");
    const cUSDTDAIProxy = await ethers.getContract(contract.replace("Dual", "") + "USDTDAI" + "Proxy");

    const cContract = await ethers.getContract(contract);

    const cUSDCUSDT = await ethers.getContractAt(contract, cUSDCUSDTProxy.address);
    const cUSDCDAI = await ethers.getContractAt(contract, cUSDCDAIProxy.address);
    const cUSDTDAI = await ethers.getContractAt(contract, cUSDTDAIProxy.address);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
          contract: cUSDCUSDTProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDCDAIProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDTDAIProxy,
          signature: "upgradeTo(address)",
          args: [cContract.address],
        },
        {
          contract: cUSDCUSDT,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },
        {
          contract: cUSDCDAI,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },
        {
          contract: cUSDTDAI,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },
      ],
    };
  }
);
