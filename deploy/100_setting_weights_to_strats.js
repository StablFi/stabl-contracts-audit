const {
  isFork,
  isMainnetOrFork,
  isMainnet,
  isPolygonStaging,
} = require("../test/helpers");
const {
  deploymentWithProposal,
  withConfirmation,
  deployWithConfirmation,
} = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  {
    deployName: "100_setting_weights_to_strats",
    forceDeploy: isMainnet || isFork,
    tags: ["test", "main", "mainnet", "update_weights"],
    dependencies: ["001_core"],
  },
  async ({ ethers, assetAddresses, getTxOpts }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

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
    console.log(
      "cDystopiaStrategyUsdcDaiProxy.address",
      cDystopiaStrategyUsdcDaiProxy.address
    );

    const cDystopiaStrategyUsdcUsdtProxy = await ethers.getContract(
      "DystopiaStrategyUsdcUsdtProxy"
    );
    const cDystopiaStrategyUsdcUsdt = await ethers.getContractAt(
      "DystopiaStrategy",
      cDystopiaStrategyUsdcUsdtProxy.address
    );
    console.log(
      "cDystopiaStrategyUsdcUsdtProxy.address",
      cDystopiaStrategyUsdcUsdtProxy.address
    );

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
    console.log(
      "cAm3CurveStrategyProxy.address",
      cAm3CurveStrategyProxy.address
    );

    // const cAm3CurveStrategyUSDTProxy = await ethers.getContract(
    //   "Am3CurveStrategyUSDTProxy"
    // );
    // const cAm3CurveStrategyUSDT = await ethers.getContractAt(
    //   "Am3CurveStrategy",
    //   cAm3CurveStrategyUSDTProxy.address
    // );
    // console.log("cAm3CurveStrategyUSDTProxy.address", cAm3CurveStrategyUSDTProxy.address);

    const cSynapseStrategyProxy = await ethers.getContract(
      "SynapseStrategyProxy"
    );
    const cSynapseStrategy = await ethers.getContractAt(
      "SynapseStrategy",
      cSynapseStrategyProxy.address
    );
    console.log("cSynapseStrategyProxy.address", cSynapseStrategyProxy.address);

    // const cSynapseStrategyUSDTProxy = await ethers.getContract(
    //   "SynapseStrategyUSDTProxy"
    // );
    // const cSynapseStrategyUSDT = await ethers.getContractAt(
    //   "SynapseStrategy",
    //   cSynapseStrategyUSDTProxy.address
    // );
    // console.log("cSynapseStrategyUSDTProxy.address", cSynapseStrategyUSDTProxy.address);

    const cDodoStrategyProxy = await ethers.getContract("DodoStrategyProxy");
    const cDodoStrategy = await ethers.getContractAt(
      "DodoStrategy",
      cDodoStrategyProxy.address
    );
    console.log("cDodoStrategyProxy.address", cDodoStrategyProxy.address);

    // tetu-usdc
    const cTetuUsdcStrategyProxy = await ethers.getContract(
      "TetuStrategyUSDCProxy"
    );
    const cTetuStrategyUsdc = await ethers.getContractAt(
      "TetuStrategy",
      cTetuUsdcStrategyProxy.address
    );
    console.log(
      "cTetuUsdcStrategyProxy.address",
      cTetuUsdcStrategyProxy.address
    );

    // tetu-usdt
    const cTetuUsdtStrategyProxy = await ethers.getContract(
      "TetuStrategyUSDTProxy"
    );
    const cTetuStrategyUsdt = await ethers.getContractAt(
      "TetuStrategy",
      cTetuUsdtStrategyProxy.address
    );
    console.log(
      "cTetuUsdtStrategyProxy.address",
      cTetuUsdtStrategyProxy.address
    );

    // tetu-dai
    const cTetuDaiStrategyProxy = await ethers.getContract(
      "TetuStrategyDAIProxy"
    );
    const cTetuStrategyDai = await ethers.getContractAt(
      "TetuStrategy",
      cTetuDaiStrategyProxy.address
    );
    console.log("cTetuDaiStrategyProxy.address", cTetuDaiStrategyProxy.address);

    const cClearpoolWintermuteStrategyProxy = await ethers.getContract(
      "ClearpoolWintermuteStrategyProxy"
    );
    const cClearpoolWintermuteStrategy = await ethers.getContractAt(
      "ClearpoolStrategy",
      cClearpoolWintermuteStrategyProxy.address
    );
    console.log(
      "cClearpoolWintermuteStrategyProxy.address",
      cClearpoolWintermuteStrategy.address
    );

    const cGainsDAIStrategyProxy = await ethers.getContract(
      "GainsDAIStrategyProxy"
    );
    const cGainsDAIStrategy = await ethers.getContractAt(
      "GainsStrategy",
      cGainsDAIStrategyProxy.address
    );
    console.log(
      "cGainsDAIStrategyProxy.address",
      cGainsDAIStrategyProxy.address
    );


    // BALANCER STRATEGY:
    // balancer-usdc
    // const cBalancerUsdcStrategyProxy = await ethers.getContract(
    //   "BalancerStrategyUSDCProxy"
    // );
    // const cBalancerStrategyUsdc = await ethers.getContractAt(
    //   "BalancerStrategy",
    //   cBalancerUsdcStrategyProxy.address
    // );
    // console.log(
    //   "cBalancerUsdcStrategyProxy.address",
    //   cBalancerUsdcStrategyProxy.address
    // );

    // // balancer-usdt
    // const cBalancerUsdtStrategyProxy = await ethers.getContract(
    //   "BalancerStrategyUSDTProxy"
    // );
    // const cBalancerStrategyUsdt = await ethers.getContractAt(
    //   "BalancerStrategy",
    //   cBalancerUsdtStrategyProxy.address
    // );
    // console.log(
    //   "cBalancerUsdtStrategyProxy.address",
    //   cBalancerUsdtStrategyProxy.address
    // );

    // // balancer-dai
    // const cBalancerDaiStrategyProxy = await ethers.getContract(
    //   "BalancerStrategyDAIProxy"
    // );
    // const cBalancerStrategyDai = await ethers.getContractAt(
    //   "BalancerStrategy",
    //   cBalancerDaiStrategyProxy.address
    // );
    // console.log(
    //   "cBalancerDaiStrategyProxy.address",
    //   cBalancerDaiStrategyProxy.address
    // );

    // // stargate-usdc
    // const cStargateUsdcStrategyProxy = await ethers.getContract(
    //   "StargateStrategyUSDCProxy"
    // );
    // const cStargateStrategyUsdc = await ethers.getContractAt(
    //   "StargateStrategy",
    //   cStargateUsdcStrategyProxy.address
    // );
    // console.log(
    //   "cStargateUsdcStrategyProxy.address",
    //   cStargateUsdcStrategyProxy.address
    // );

    // // aave-usdt
    // const cAaveSupplyUsdtStrategyProxy = await ethers.getContract(
    //   "AaveSupplyStrategyUSDTProxy"
    // );
    // const cAaveSupplyStrategyUsdt = await ethers.getContractAt(
    //   "AaveSupplyStrategy",
    //   cAaveSupplyUsdtStrategyProxy.address
    // );
    // console.log(
    //   "cAaveSupplyUsdtStrategyProxy.address",
    //   cAaveSupplyUsdtStrategyProxy.address
    // );

    // const cAaveSupplyUsdcStrategyProxy = await ethers.getContract(
    //   "AaveSupplyStrategyUSDCProxy"
    // );
    // const cAaveSupplyStrategyUsdc = await ethers.getContractAt(
    //   "AaveSupplyStrategy",
    //   cAaveSupplyUsdcStrategyProxy.address
    // );
    // console.log(
    //   "cAaveSupplyUsdcStrategyProxy.address",
    //   cAaveSupplyUsdcStrategyProxy.address
    // );


    // const cAaveSupplyDaiStrategyProxy = await ethers.getContract(
    //   "AaveSupplyStrategyDAIProxy"
    // );
    // const cAaveSupplyStrategyDai = await ethers.getContractAt(
    //   "AaveSupplyStrategy",
    //   cAaveSupplyDaiStrategyProxy.address
    // );
    // console.log(
    //   "cAaveSupplyDaiStrategyProxy.address",
    //   cAaveSupplyDaiStrategyProxy.address
    // );


    let weights = [
      // {
      //     "strategy": cDystopiaStrategyUsdcDaiProxy.address,
      //     "contract": "DystopiaStrategy",
      //     "name": "Dystopia USDC - DAI",
      //     "minWeight": 0,
      //     "targetWeight": 0,
      //     "maxWeight": 100,
      //     "enabled": true,
      //     "enabledReward": true
      // },
      // {
      //   strategy: cDystopiaStrategyUsdcUsdtProxy.address,
      //   contract: "DystopiaStrategy",
      //   name: "Dystopia USDC - USDT",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
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
      // {
      //   strategy: cMeshSwapStrategyUSDTProxy.address,
      //   contract: "MeshSwapStrategy",
      //   name: "MeshSwap USDT",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cMeshSwapStrategyUSDCProxy.address,
      //   contract: "MeshSwapStrategy",
      //   name: "MeshSwap USDC",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cMeshSwapStrategyUSDCUSDTProxy.address,
      //   contract: "MeshSwapStrategyDual",
      //   name: "MeshSwap USDC - USDT",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cMeshSwapStrategyUSDCDAIProxy.address,
      //   contract: "MeshSwapStrategyDual",
      //   name: "MeshSwap USDC - DAI",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cMeshSwapStrategyUSDTDAIProxy.address,
      //   contract: "MeshSwapStrategyDual",
      //   name: "MeshSwap USDT - DAI",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cQuickSwapStrategyUSDCDAIProxy.address,
      //   contract: "QuickSwapStrategy",
      //   name: "QuickSwap USDC - DAI",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cQuickSwapStrategyUSDCUSDTProxy.address,
      //   contract: "QuickSwapStrategy",
      //   name: "QuickSwap USDC - USDT",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },

      // {
      //   strategy: cAm3CurveStrategyProxy.address,
      //   contract: "Am3CurveStrategy",
      //   name: "Am3Curve - USDC",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cSynapseStrategyProxy.address,
      //   contract: "SynapseStrategy",
      //   name: "Synapse - USDC",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cDodoStrategyProxy.address,
      //   contract: "DodoStrategy",
      //   name: "Dodo",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cClearpoolWintermuteStrategyProxy.address,
      //   contract: "ClearpoolStrategy",
      //   name: "Clearpool - Wintermute",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cGainsDAIStrategy.address,
      //   contract: "GainsStrategy",
      //   name: "Gains - DAI",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      {
        strategy: cTetuStrategyDai.address,
        contract: "TetuStrategy",
        name: "TetuStrategy - DAI",
        minWeight: 0,
        targetWeight: 30,
        maxWeight: 100,
        enabled: true,
        enabledReward: true,
      },
      {
        strategy: cTetuStrategyUsdt.address,
        contract: "TetuStrategy",
        name: "TetuStrategy - USDT",
        minWeight: 0,
        targetWeight: 25,
        maxWeight: 100,
        enabled: true,
        enabledReward: true,
      },
      {
        strategy: cTetuStrategyUsdc.address,
        contract: "TetuStrategy",
        name: "TetuStrategy - USDC",
        minWeight: 0,
        targetWeight: 45,
        maxWeight: 100,
        enabled: true,
        enabledReward: true,
      },
      // {
      //   strategy: cBalancerStrategyUsdc.address,
      //   contract: "BalancerStrategy",
      //   name: "BalancerStrategy - USDC",
      //   minWeight: 0,
      //   targetWeight: 10,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cBalancerStrategyUsdt.address,
      //   contract: "BalancerStrategy",
      //   name: "BalancerStrategy - USDT",
      //   minWeight: 0,
      //   targetWeight: 10,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cBalancerStrategyDai.address,
      //   contract: "BalancerStrategy",
      //   name: "BalancerStrategy - DAI",
      //   minWeight: 0,
      //   targetWeight: 50,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cStargateStrategyUsdc.address,
      //   contract: "StargateStrategy",
      //   name: "Stargate - USDC",
      //   minWeight: 0,
      //   targetWeight: 0,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cAaveSupplyStrategyUsdt.address,
      //   contract: "AaveSupplyStrategy",
      //   name: "AaveSupplyStrategy - USDT",
      //   minWeight: 0,
      //   targetWeight: 30,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cAaveSupplyStrategyDai.address,
      //   contract: "AaveSupplyStrategy",
      //   name: "AaveSupplyStrategy - DAI",
      //   minWeight: 0,
      //   targetWeight: 30,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      // {
      //   strategy: cAaveSupplyStrategyUsdc.address,
      //   contract: "AaveSupplyStrategy",
      //   name: "AaveSupplyStrategy - USDC",
      //   minWeight: 0,
      //   targetWeight: 40,
      //   maxWeight: 100,
      //   enabled: true,
      //   enabledReward: true,
      // },
      
    ];

    let allStrategies = await cVaultCore.getAllStrategies();
    // console.log("allStrategies", allStrategies)

    weights.sort(
      (a, b) => parseFloat(b.targetWeight) - parseFloat(a.targetWeight)
    );
    let totalWeight = 0;
    for (const weight of weights) {
      if (!allStrategies.includes(weight.strategy)) {
        console.error("Strategy not found", weight.name);
        await withConfirmation(
          cVaultAdmin
            .connect(sDeployer)
            .approveStrategy(weight.strategy, await getTxOpts())
        );
      } else {
        console.log("Strategy approved", weight.name);
      }
      totalWeight += weight.targetWeight * 1000;
    }
    console.log(`totalWeight: ${totalWeight}`);

    if (totalWeight !== 100000) {
      console.log(`Total weight not 100000`);
      return;
    }

    weights = weights.map((value) => {
      delete value.name;
      value.targetWeight = value.targetWeight * 1000;
      value.maxWeight = value.maxWeight * 1000;

      return value;
    });
    console.log(weights);

    // Governance proposal
    return {
      name: "Setting Strategy Weights",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setStrategyWithWeights",
          args: [weights],
        },
      ],
    };
  }
);
