const { isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "081_set_thresholds" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "set_thresholds"],  dependencies: [] },
  async ({ ethers }) => {

    const cDystopiaStrategyUsdcDaiProxy = await ethers.getContract("DystopiaStrategyUsdcDaiProxy");
    const cDystopiaStrategyUsdcUsdtProxy = await ethers.getContract("DystopiaStrategyUsdcUsdtProxy");
    const cDystopiaStrategyDaiUsdtProxy = await ethers.getContract("DystopiaStrategyDaiUsdtProxy");
    const cDystopiaStrategyUsdcDai = await ethers.getContractAt("DystopiaStrategy", cDystopiaStrategyUsdcDaiProxy.address);
    const cDystopiaStrategyUsdcUsdt = await ethers.getContractAt("DystopiaStrategy", cDystopiaStrategyUsdcUsdtProxy.address);
    const cDystopiaStrategyDaiUsdt = await ethers.getContractAt("DystopiaStrategy", cDystopiaStrategyDaiUsdtProxy.address);

    const cMeshSwapStrategyUSDCUSDTProxy = await ethers.getContract("MeshSwapStrategyUSDCUSDTProxy");
    const cMeshSwapStrategyUSDCDAIProxy = await ethers.getContract("MeshSwapStrategyUSDCDAIProxy");
    const cMeshSwapStrategyUSDTDAIProxy = await ethers.getContract("MeshSwapStrategyUSDTDAIProxy");
    const cMeshSwapStrategyUSDCUSDT = await ethers.getContractAt("MeshSwapStrategyDual", cMeshSwapStrategyUSDCUSDTProxy.address);
    const cMeshSwapStrategyUSDCDAI = await ethers.getContractAt("MeshSwapStrategyDual", cMeshSwapStrategyUSDCDAIProxy.address);
    const cMeshSwapStrategyUSDTDAI = await ethers.getContractAt("MeshSwapStrategyDual", cMeshSwapStrategyUSDTDAIProxy.address);

    const cQuickSwapStrategyUSDCDAIProxy = await ethers.getContract("QuickSwapStrategyUSDCDAIProxy");
    const cQuickSwapStrategyUSDCUSDTProxy = await ethers.getContract("QuickSwapStrategyUSDCUSDTProxy");
    const cQuickSwapStrategyUSDCDAI = await ethers.getContractAt("QuickSwapStrategy", cQuickSwapStrategyUSDCDAIProxy.address);
    const cQuickSwapStrategyUSDCUSDT = await ethers.getContractAt("QuickSwapStrategy", cQuickSwapStrategyUSDCUSDTProxy.address);

    // Governance proposal
    return {
      name: "Setting Threshold",
      actions: [
        {
            contract: cDystopiaStrategyUsdcDai,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 6 decimals
                    "100000000000000", // token1 - 18 decimals
                    "1000", // PS - 6 decimals
                    "1000000000000"  // DystPair - 18 decimals  = (1/100000) DystPair
                ] 
            ],
        },
        {
            contract: cDystopiaStrategyUsdcUsdt,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 6 decimals
                    "1000", // token1 - 6 decimals
                    "1000", // PS - 6 decimals
                    "1000000000000"  // DystPair - 18 decimals = (1/100000) DystPair
                ]
            ],
        },
        {
            contract: cDystopiaStrategyDaiUsdt,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "100000000000000", // token0 - 18 decimals = (1/1000) DAI
                    "1000", // token1 - 6 decimals  = (1/1000) USDT
                    "1000", // PS - 6 decimals  = (1/1000) USDT
                    "1000000000000" // DystPair - 18 decimals  = (1/100000) DystPair
                ] 
            ],
        },
        {
            contract: cMeshSwapStrategyUSDCDAI,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 18 decimals = (1/1000) USDC
                    "100000000000000", // token1 - 6 decimals  = (1/1000) DAI
                    "1000", // PS - 6 decimals  = (1/1000) USDT
                    "0", // MeshPair - 6 decimals  = (1/1000) MeshPair
                    "10000000000000", // MeshToken - 18 decimals  = (1/10000) Mesh
                ]
            ],
        },
        {
            contract: cMeshSwapStrategyUSDCUSDT,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 18 decimals = (1/1000) USDC
                    "1000", // token1 - 6 decimals  = (1/1000) DAI
                    "1000", // PS - 6 decimals  = (1/1000) USDT
                    "0", // MeshPair - 6 decimals  = (1/1000) MeshPair
                    "10000000000000", // MeshToken - 18 decimals  = (1/10000) Mesh
                  ], 
            ],
        },
        {
            contract: cMeshSwapStrategyUSDTDAI,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 6 decimals = (1/1000) USDT
                    "100000000000000", // token1 - 6 decimals  = (1/1000) DAI
                    "1000", // PS - 6 decimals  = (1/1000) USDT
                    "0", // MeshPair - 6 decimals  = (1/1000) MeshPair
                    "10000000000000", // MeshToken - 18 decimals  = (1/10000) Mesh
                ]
            ],
        },
        {
            contract: cQuickSwapStrategyUSDCDAI,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 6 decimals = (1/1000) USDC
                    "100000000000000", // token1 - 18 decimals  = (1/1000) DAI
                    "1000", // PS - 6 decimals  = (1/1000) USDT
                    "0", // QuickPair - 0 LP seems to working fine with QuickSwap
                    "1000", // QUICKDRAGON TOKEN - 18 decimals  = (1/100000000000000) QUICKDRAGON
                ]
            ],
        },
        {
            contract: cQuickSwapStrategyUSDCUSDT,
            signature: "setThresholds(uint256[])",
            args: [
                [
                    "1000", // token0 - 6 decimals = (1/1000) USDC
                    "1000", // token1 - 6 decimals  = (1/1000) USDT
                    "1000", // PS - 6 decimals  = (1/1000) USDT
                    "0", // QuickPair - 0 LP seems to working fine with QuickSwap
                    "1000", // QUICKDRAGON TOKEN - 18 decimals  = (1/100000000000000) QUICKDRAGON
                ]
            ],
        }
      ],
    };
  }
);
