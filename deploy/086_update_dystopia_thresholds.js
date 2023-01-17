const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "086_update_dystopia_thresholds" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "update_dystopia_thresholds"],  dependencies: [] },
  async ({ ethers }) => {
    const contract = "DystopiaStrategy";
    // Deploy a new vault core contract.
    await deployWithConfirmation(contract);
    console.log("Deployed", contract);

    const cUsdcDaiProxy = await ethers.getContract(contract + "UsdcDaiProxy");
    const cUsdcUsdtProxy = await ethers.getContract(contract + "UsdcUsdtProxy");
    const cDaiUsdtProxy = await ethers.getContract(contract + "DaiUsdtProxy");
    
    const cUsdcDai = await ethers.getContractAt(contract, cUsdcDaiProxy.address);
    const cUsdcUsdt = await ethers.getContractAt(contract, cUsdcUsdtProxy.address);
    const cDaiUsdt = await ethers.getContractAt(contract, cDaiUsdtProxy.address);

    // Governance proposal
    return {
      name: "Upgrade " + contract,
      actions: [
        {
            contract: cUsdcDai,
            signature: "setThresholds(uint256[])",
            args: [
              [
                "1000", // token0 - 6 decimals
                "100000000000000", // token1 - 18 decimals
                "1000", // PS - 6 decimals
                "1000000" // DystPair - 18 decimals = (1/1000000000000) DystPair
              ]
            ],
        },
        {
            contract: cUsdcUsdt,
            signature: "setThresholds(uint256[])",
            args: [
              [
                "1000", // token0 - 6 decimals
                "1000", // token1 - 6 decimals
                "1000", // PS - 6 decimals
                "1000000" // DystPair - 18 decimals = (1/1000000000000) DystPair
              ]
            ],
        },
        {
            contract: cDaiUsdt,
            signature: "setThresholds(uint256[])",
            args: [
              [
                "100000000000000", // token0 - 18 decimals = (1/1000) DAI
                "1000", // token1 - 6 decimals  = (1/1000) USDT
                "1000", // PS - 6 decimals  = (1/1000) USDT
                "1000000" // DystPair - 18 decimals = (1/1000000000000) DystPair
              ]
            ],
        }
      ],
    };
  }
);
