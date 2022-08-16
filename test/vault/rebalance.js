const { expect, assert } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
    sleep
  } = require("../../utils/deploy");

const { defaultFixture } = require("../_fixture");
const {
  daiUnits,
  usdcUnits,
  cashUnits,
  usdcUnitsFormat,
  daiUnitsFormat,
  usdtUnitsFormat,
  quickUnits,
  meshUnits,
  dystPairUnits,
  units,
  loadFixture,
  expectApproxSupply,
  getBlockTimestamp,
  isFork,
  usdtUnits,
} = require("../helpers");
const { min } = require("lodash");

describe("Rebalancing @slow" , function () {
  
  let   anna,
        matt,
        josh,
        cash,
        vault,
        harvester,
        governor,
        usdt,
        usdc,
        dai,
        crv,
        wmatic,
        syn,
        nusd,
        DODO,
        usdcLPToken,
        strategyName  = "NA",
        strategy
        ;
  beforeEach(async function () {
    const fixture = await loadFixture(defaultFixture);
    anna = fixture.anna;
    matt = fixture.matt;
    josh = fixture.josh;
    vault = fixture.vault;
    harvester = fixture.harvester;
    cash = fixture.cash;
    governor = fixture.governor;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    wmatic = fixture.wmatic;
    dai = fixture.dai;
    DODO = fixture.DODO;
    primaryStable = usdc;
    primaryStableName = "USDC";
    primaryStableUnitsFormat = usdcUnitsFormat;
    primaryStableUnits = usdcUnits;
    
    dodoStrategy = fixture.cDodoStrategy;
    synapseStrategy = fixture.cSynapseStrategy;
    am3CurveStrategy = fixture.cAm3CurveStrategy;

    quickSwapStrategyUSDCDAI = fixture.cQuickSwapStrategyUSDCDAI
    quickSwapStrategyUSDCUSDT = fixture.cQuickSwapStrategyUSDCUSDT

    meshSwapStrategyUSDCUSDT = fixture.cMeshSwapStrategyUSDCUSDT
    meshSwapStrategyUSDCDAI = fixture.cMeshSwapStrategyUSDCDAI
    meshSwapStrategyUSDTDAI = fixture.cMeshSwapStrategyUSDTDAI

    meshSwapStrategyUSDC = fixture.cMeshSwapStrategyUSDC
    meshSwapStrategyUSDT = fixture.cMeshSwapStrategyUSDT
    meshSwapStrategyDAI = fixture.cMeshSwapStrategyDAI

    dystopiaStrategyUSDCDAI = fixture.cDystopiaStrategyUsdcDai
    dystopiaStrategyUSDCUSDT = fixture.cDystopiaStrategyUsdcUsdt
    dystopiaStrategyDAIUSDT = fixture.cDystopiaStrategyDaiUsdt

    usdcLPToken = fixture.usdcLPToken;

    erc20Abi = fixture.erc20Abi;
    harvester = fixture.harvester;
    dripper = fixture.dripper;

});

  function rebalance_from(i){
    describe("Balancing @fork", function () {
      it("Mass Rebalance @slow @fork" , async () => {
        let weights = [
            {
                "strategy": dystopiaStrategyUSDCDAI.address,
                "contract": "DystopiaStrategy",
                "name": "Dystopia USDC - DAI",
                "minWeight": 0,
                "targetWeight": 10,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": dystopiaStrategyUSDCUSDT.address,
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
                "strategy": meshSwapStrategyUSDT.address,
                "contract": "MeshSwapStrategy",
                "name": "MeshSwap USDT",
                "minWeight": 0,
                "targetWeight": 5,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": meshSwapStrategyUSDC.address,
                "contract": "MeshSwapStrategy",
                "name": "MeshSwap USDC",
                "minWeight": 0,
                "targetWeight": 10,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": meshSwapStrategyUSDCUSDT.address,
                "contract": "MeshSwapStrategyDual",
                "name": "MeshSwap USDC - USDT",
                "minWeight": 0,
                "targetWeight": 8,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": meshSwapStrategyUSDCDAI.address,
                "contract": "MeshSwapStrategyDual",
                "name": "MeshSwap USDC - DAI",
                "minWeight": 0,
                "targetWeight": 8,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": meshSwapStrategyUSDTDAI.address,
                "contract": "MeshSwapStrategyDual",
                "name": "MeshSwap USDT - DAI",
                "minWeight": 0,
                "targetWeight": 8,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": quickSwapStrategyUSDCDAI.address,
                "contract": "QuickSwapStrategy",
                "name": "QuickSwap USDC - DAI",
                "minWeight": 0,
                "targetWeight": 5,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": quickSwapStrategyUSDCUSDT.address,
                "contract": "QuickSwapStrategy",
                "name": "QuickSwap USDC - USDT",
                "minWeight": 0,
                "targetWeight": 5,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": am3CurveStrategy.address,
                "contract": "Am3CurveStrategy",
                "name": "Am3Curve - USDC",
                "minWeight": 0,
                "targetWeight": 5,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": synapseStrategy.address,
                "contract": "SynapseStrategy",
                "name": "Synapse - USDC",
                "minWeight": 0,
                "targetWeight": 20,
                "maxWeight": 100,
                "enabled": true,
                "enabledReward": true
            },
            {
                "strategy": dodoStrategy.address,
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
        console.log("---------------------------------------------------------------------------")
        console.log("                    Mass Rebalance from", weights[i].name )
        console.log("---------------------------------------------------------------------------")

        console.log("Setting the", weights[i].name ,"as default strategy for USDC");
        await vault.connect(governor).setAssetDefaultStrategy(primaryStable.address, weights[i].strategy);

        let totalWeight = 0;
        for (const weight of weights) {
          totalWeight += weight.targetWeight * 1000;
        }
        console.log(`totalWeight: ${totalWeight}`)
        expect(totalWeight).to.be.equal(100000);

        weights = weights.map(value => {
          value.targetWeight = value.targetWeight * 1000;
          value.maxWeight = value.maxWeight * 1000;

          return value;
        })
        console.log("Setting new weights");
        await vault.setStrategyWithWeights(weights);

        console.log("Matt",primaryStableName,"Balance: ", primaryStableUnitsFormat(await primaryStable.balanceOf(matt.address)));
        console.log("Vault",primaryStableName,"Balance: ", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)));

        console.log("Adding" , primaryStableName)
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits("100.0"));
        await vault.connect(matt).justMint(primaryStable.address, primaryStableUnits("100.0"), 0);

        expect(await primaryStable.balanceOf(vault.address)).to.be.within(primaryStableUnits("299.0"), primaryStableUnits("301.0"));;
      
        let prefix = "Before Allocation";
        console.log(prefix, "- USDC in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        console.log("Auto allocating funds from vault")
        let tx = await vault.allocate();
        tx.wait();
        console.log("After Allocation -", primaryStableName, "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        for (const weight of weights) {
          strategy = await ethers.getContractAt(
            weight.contract,
            weight.strategy
          );
          console.log("After Allocation -", primaryStableName, "in" , weight.name, ":", primaryStableUnitsFormat(await strategy.checkBalance()).toString());
        }
  
        console.log("Engaging rebalance | Started at:", new Date().toLocaleString());
        tx = await vault.balance();
        console.log("After Balance -", primaryStableName, "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        for (const weight of weights) {
          strategy = await ethers.getContractAt(
            weight.contract,
            weight.strategy
          );
          console.log("After Balance -", primaryStableName, "in" , weight.name, ":", primaryStableUnitsFormat(await strategy.checkBalance()).toString());
        }

        for (const weight of weights) {
          strategy = await ethers.getContractAt(
            weight.contract,
            weight.strategy
          );
          expect(await  strategy.checkBalance()  ).to.be.closeTo(primaryStableUnits(  (3*weight.targetWeight/1000).toString()).toString(), primaryStableUnits("1.0"));;
        }
        console.log("Engaging rebalance | Finished at:", new Date().toLocaleString());
          
      });
  
    });
  }
  for(var i = 0; i<1; i++){
    rebalance_from(i);
  } 

});
