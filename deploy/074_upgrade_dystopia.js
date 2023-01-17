const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "074_upgrade_dystopia" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "upgrade_dystopia"],  dependencies: [] },
  async ({ ethers }) => {
    const contract = "DystopiaStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cUsdcDaiProxy = await ethers.getContract(contract + "UsdcDaiProxy");
    const cUsdcUsdtProxy = await ethers.getContract(contract + "UsdcUsdtProxy");
    const cDaiUsdtProxy = await ethers.getContract(contract + "DaiUsdtProxy");
    const cContract = await ethers.getContract(contract);

    const cContractAtUsdcDaiProxy = await ethers.getContractAt(contract, cUsdcDaiProxy.address);
    const cContractAtUsdcUsdtProxy = await ethers.getContractAt(contract, cUsdcUsdtProxy.address);
    const cContractAtDaiUsdtProxy = await ethers.getContractAt(contract, cDaiUsdtProxy.address);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
            contract: cUsdcDaiProxy,
            signature: "upgradeTo(address)",
            args: [cContract.address],
        },
        {
            contract: cUsdcUsdtProxy,
            signature: "upgradeTo(address)",
            args: [cContract.address],
        },
        {
            contract: cDaiUsdtProxy,
            signature: "upgradeTo(address)",
            args: [cContract.address],
        },
        {
          contract: cContractAtUsdcDaiProxy,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },
        {
          contract: cContractAtUsdcUsdtProxy,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        },
        {
          contract: cContractAtDaiUsdtProxy,
          signature: "setOracleRouterPriceProvider()",
          args: [],
        }
      ],
    };
  }
);
