const { isFork } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "069_setting_weights_to_strats" , forceDeploy: isFork, tags: ["test", "main"],  dependencies: ["001_core"] },
  async ({ ethers, assetAddresses }) => {
      const cVaultProxy = await ethers.getContract("VaultProxy");
      const cVaultAdmin = await ethers.getContractAt(
        "VaultAdmin",
        cVaultProxy.address
      );
      const cVaultCore = await ethers.getContractAt(
        "VaultCore",
        cVaultProxy.address
      );

      const cDystopiaStrategyUsdcDaiProxy = await ethers.getContract(
        "DystopiaStrategyUsdcDaiProxy"
      );
      const cDystopiaStrategyUsdcDai = await ethers.getContractAt(
        "DystopiaStrategy",
        cDystopiaStrategyUsdcDaiProxy.address
      );
      console.log("cDystopiaStrategyUsdcDaiProxy.address",cDystopiaStrategyUsdcDaiProxy.address);
    
      const cDystopiaStrategyUsdcUsdtProxy = await ethers.getContract(
        "DystopiaStrategyUsdcUsdtProxy"
      );
      const cDystopiaStrategyUsdcUsdt = await ethers.getContractAt(
        "DystopiaStrategy",
        cDystopiaStrategyUsdcUsdtProxy.address
      );
      console.log("cDystopiaStrategyUsdcUsdtProxy.address",cDystopiaStrategyUsdcUsdtProxy.address);
    
      // const cDystopiaStrategyDaiUsdtProxy = await ethers.getContract(
      //   "DystopiaStrategyDaiUsdtProxy"
      // );
      // const cDystopiaStrategyDaiUsdt = await ethers.getContractAt(
      //   "DystopiaStrategy",
      //   cDystopiaStrategyDaiUsdtProxy.address
      // );
      // console.log("cDystopiaStrategyDaiUsdtProxy.address",cDystopiaStrategyDaiUsdtProxy.address);
    
      const cMeshSwapStrategyUSDCProxy = await ethers.getContract(
        "MeshSwapStrategyUSDCProxy"
      );
      const cMeshSwapStrategyUSDC = await ethers.getContractAt(
        "MeshSwapStrategy",
        cMeshSwapStrategyUSDCProxy.address
      );
      console.log(
        "cMeshSwapStrategyUSDCProxy.address",
        cMeshSwapStrategyUSDCProxy.address
      );
    
      // const cMeshSwapStrategyDAIProxy = await ethers.getContract(
      //   "MeshSwapStrategyDAIProxy"
      // );
      // const cMeshSwapStrategyDAI = await ethers.getContractAt(
      //   "MeshSwapStrategy",
      //   cMeshSwapStrategyDAIProxy.address
      // );
      // console.log(
      //   "cMeshSwapStrategyDAIProxy.address",
      //   cMeshSwapStrategyDAIProxy.address
      // );
    
      const cMeshSwapStrategyUSDTProxy = await ethers.getContract(
        "MeshSwapStrategyUSDTProxy"
      );
      const cMeshSwapStrategyUSDT = await ethers.getContractAt(
        "MeshSwapStrategy",
        cMeshSwapStrategyUSDTProxy.address
      );
      console.log(
        "cMeshSwapStrategyUSDTProxy.address",
        cMeshSwapStrategyUSDTProxy.address
      );
    
      const cMeshSwapStrategyUSDCUSDTProxy = await ethers.getContract(
        "MeshSwapStrategyUSDCUSDTProxy"
      );
      const cMeshSwapStrategyUSDCUSDT = await ethers.getContractAt(
        "MeshSwapStrategyDual",
        cMeshSwapStrategyUSDCUSDTProxy.address
      );
      console.log(
        "cMeshSwapStrategyUSDCUSDTProxy.address",
        cMeshSwapStrategyUSDCUSDTProxy.address
      );
    
      const cMeshSwapStrategyUSDCDAIProxy = await ethers.getContract(
        "MeshSwapStrategyUSDCDAIProxy"
      );
      const cMeshSwapStrategyUSDCDAI = await ethers.getContractAt(
        "MeshSwapStrategyDual",
        cMeshSwapStrategyUSDCDAIProxy.address
      );
      console.log(
        "cMeshSwapStrategyUSDCDAIProxy.address",
        cMeshSwapStrategyUSDCDAIProxy.address
      );
    
      const cMeshSwapStrategyUSDTDAIProxy = await ethers.getContract(
        "MeshSwapStrategyUSDTDAIProxy"
      );
      const cMeshSwapStrategyUSDTDAI = await ethers.getContractAt(
        "MeshSwapStrategyDual",
        cMeshSwapStrategyUSDTDAIProxy.address
      );
      console.log(
        "cMeshSwapStrategyUSDTDAIProxy.address",
        cMeshSwapStrategyUSDTDAIProxy.address
      );
    
      const cQuickSwapStrategyUSDCDAIProxy = await ethers.getContract(
        "QuickSwapStrategyUSDCDAIProxy"
      );
      const cQuickSwapStrategyUSDCDAI = await ethers.getContractAt(
        "QuickSwapStrategy",
        cQuickSwapStrategyUSDCDAIProxy.address
      );
      console.log(
        "cQuickSwapStrategyUSDCDAIProxy.address",
        cQuickSwapStrategyUSDCDAIProxy.address
      );
    
      const cQuickSwapStrategyUSDCUSDTProxy = await ethers.getContract(
        "QuickSwapStrategyUSDCUSDTProxy"
      );
      const cQuickSwapStrategyUSDCUSDT = await ethers.getContractAt(
        "QuickSwapStrategy",
        cQuickSwapStrategyUSDCUSDTProxy.address
      );
      console.log(
        "cQuickSwapStrategyUSDCUSDTProxy.address",
        cQuickSwapStrategyUSDCUSDTProxy.address
      );
    
      // const cAaveStrategyUSDCProxy = await ethers.getContract(
      //   "AaveStrategyUSDCProxy"
      // );
      // const cAaveStrategyUSDC = await ethers.getContractAt(
      //   "AaveStrategy",
      //   cAaveStrategyUSDCProxy.address
      // );
      // console.log("cAaveStrategyUSDCProxy.address", cAaveStrategyUSDCProxy.address);
    
      const cAm3CurveStrategyProxy = await ethers.getContract(
        "Am3CurveStrategyProxy"
      );
      const cAm3CurveStrategy = await ethers.getContractAt(
        "Am3CurveStrategy",
        cAm3CurveStrategyProxy.address
      );
      console.log("cAm3CurveStrategyProxy.address", cAm3CurveStrategyProxy.address);
    
      const cAm3CurveStrategyUSDTProxy = await ethers.getContract(
        "Am3CurveStrategyUSDTProxy"
      );
      const cAm3CurveStrategyUSDT = await ethers.getContractAt(
        "Am3CurveStrategy",
        cAm3CurveStrategyUSDTProxy.address
      );
      console.log("cAm3CurveStrategyUSDTProxy.address", cAm3CurveStrategyUSDTProxy.address);
    
      const cSynapseStrategyProxy = await ethers.getContract(
        "SynapseStrategyProxy"
      );
      const cSynapseStrategy = await ethers.getContractAt(
        "SynapseStrategy",
        cSynapseStrategyProxy.address
      );
      console.log("cSynapseStrategyProxy.address", cSynapseStrategyProxy.address);
    
      const cSynapseStrategyUSDTProxy = await ethers.getContract(
        "SynapseStrategyUSDTProxy"
      );
      const cSynapseStrategyUSDT = await ethers.getContractAt(
        "SynapseStrategy",
        cSynapseStrategyUSDTProxy.address
      );
      console.log("cSynapseStrategyUSDTProxy.address", cSynapseStrategyUSDTProxy.address);
    
      const cDodoStrategyProxy = await ethers.getContract(
        "DodoStrategyProxy"
      );
      const cDodoStrategy = await ethers.getContractAt(
        "DodoStrategy",
        cDodoStrategyProxy.address
      );
      console.log("cDodoStrategyProxy.address", cDodoStrategyProxy.address);
  
      let weights = [
        {
            "strategy": cDystopiaStrategyUsdcDaiProxy.address,
            "contract": "DystopiaStrategy",
            "name": "Dystopia USDC - DAI",
            "minWeight": 0,
            "targetWeight": 10,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cDystopiaStrategyUsdcUsdtProxy.address,
            "contract": "DystopiaStrategy",
            "name": "Dystopia USDC - USDT",
            "minWeight": 0,
            "targetWeight": 11,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        // {
        //     "strategy": cDystopiaStrategyDaiUsdtProxy.address,
        //     "contract": "DystopiaStrategy",
        //     "name": "Dystopia DAI-USDT",
        //     "minWeight": 0,
        //     "targetWeight": 1,
        //     "maxWeight": 100,
        //     "enabled": true,
        //     "enabledReward": true
        // },
        // {
        //     "strategy": cMeshSwapStrategyDAIProxy.address,
        //     "contract": "MeshSwapStrategy",
        //     "name": "MeshSwap DAI",
        //     "minWeight": 0,
        //     "targetWeight": 5,
        //     "maxWeight": 100,
        //     "enabled": true,
        //     "enabledReward": true
        // },
        {
            "strategy": cMeshSwapStrategyUSDTProxy.address,
            "contract": "MeshSwapStrategy",
            "name": "MeshSwap USDT",
            "minWeight": 0,
            "targetWeight": 5,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cMeshSwapStrategyUSDCProxy.address,
            "contract": "MeshSwapStrategy",
            "name": "MeshSwap USDC",
            "minWeight": 0,
            "targetWeight": 10,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cMeshSwapStrategyUSDCUSDTProxy.address,
            "contract": "MeshSwapStrategyDual",
            "name": "MeshSwap USDC - USDT",
            "minWeight": 0,
            "targetWeight": 8,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cMeshSwapStrategyUSDCDAIProxy.address,
            "contract": "MeshSwapStrategyDual",
            "name": "MeshSwap USDC - DAI",
            "minWeight": 0,
            "targetWeight": 8,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cMeshSwapStrategyUSDTDAIProxy.address,
            "contract": "MeshSwapStrategyDual",
            "name": "MeshSwap USDT - DAI",
            "minWeight": 0,
            "targetWeight": 8,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cQuickSwapStrategyUSDCDAIProxy.address,
            "contract": "QuickSwapStrategy",
            "name": "QuickSwap USDC - DAI",
            "minWeight": 0,
            "targetWeight": 5,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cQuickSwapStrategyUSDCUSDTProxy.address,
            "contract": "QuickSwapStrategy",
            "name": "QuickSwap USDC - USDT",
            "minWeight": 0,
            "targetWeight": 5,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cAm3CurveStrategyProxy.address,
            "contract": "Am3CurveStrategy",
            "name": "Am3Curve - USDC",
            "minWeight": 0,
            "targetWeight": 5,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cSynapseStrategyProxy.address,
            "contract": "SynapseStrategy",
            "name": "Synapse - USDC",
            "minWeight": 0,
            "targetWeight": 20,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        {
            "strategy": cDodoStrategyProxy.address,
            "contract": "DodoStrategy",
            "name": "Dodo - USDC",
            "minWeight": 0,
            "targetWeight": 5,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
        // {
        //     "strategy": cAaveStrategyUSDC.address,
        //     "contract": "AaveStrategy",
        //     "name": "Aave - USDC",
        //     "minWeight": 0,
        //     "targetWeight": 0,
        //     "maxWeight": 0,
        //     "enabled": false,
        //     "enabledReward": false
        // }
    ];
    // weights.sort((a, b) => parseFloat(b.targetWeight) - parseFloat(a.targetWeight));
    let totalWeight = 0;
    for (const weight of weights) {
        totalWeight += weight.targetWeight * 1000;
    }
    console.log(`totalWeight: ${totalWeight}`)

    if (totalWeight !== 100000) {
        console.log(`Total weight not 100000`)
        return
    }

    weights = weights.map(value => {

        delete value.name
        value.targetWeight = value.targetWeight * 1000;
        value.maxWeight = value.maxWeight * 1000;

        return value;
    })

    // Governance proposal
    return {
      name: "Setting Strategy Weights",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setStrategyWithWeights",
          args: [weights],
        }
      ],
    };
  }
);
