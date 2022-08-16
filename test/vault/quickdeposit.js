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

describe("QuickDeposit" , function () {
    if (isFork) {
        this.timeout(0);
    }
    let anna,
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

    describe("QuickDeposit", function () {
        it("QuickDeposit @slow @fork", async () => {
        console.log("---------------------------------------------------------------------------")
        console.log("                               Quick Deposit")
        console.log("---------------------------------------------------------------------------")
        let strats = [
            {
                "strategy": dystopiaStrategyUSDCDAI.address,
                "contract": "DystopiaStrategy",
                "name": "Dystopia USDC - DAI",
            },
            {
                "strategy": dystopiaStrategyUSDCUSDT.address,
                "contract": "DystopiaStrategy",
                "name": "Dystopia USDC - USDT",
            },
            {
                "strategy": dystopiaStrategyDAIUSDT.address,
                "contract": "DystopiaStrategy",
                "name": "Dystopia DAI-USDT",
            },
            {
                "strategy": meshSwapStrategyDAI.address,
                "contract": "MeshSwapStrategy",
                "name": "MeshSwap DAI",
            },
            {
                "strategy": meshSwapStrategyUSDT.address,
                "contract": "MeshSwapStrategy",
                "name": "MeshSwap USDT",
            },
            {
                "strategy": meshSwapStrategyUSDC.address,
                "contract": "MeshSwapStrategy",
                "name": "MeshSwap USDC",
            },
            {
                "strategy": meshSwapStrategyUSDCUSDT.address,
                "contract": "MeshSwapStrategyDual",
                "name": "MeshSwap USDC - USDT",
            },
            {
                "strategy": meshSwapStrategyUSDCDAI.address,
                "contract": "MeshSwapStrategyDual",
                "name": "MeshSwap USDC - DAI",
            },
            {
                "strategy": meshSwapStrategyUSDTDAI.address,
                "contract": "MeshSwapStrategyDual",
                "name": "MeshSwap USDT - DAI",
            },
            {
                "strategy": quickSwapStrategyUSDCDAI.address,
                "contract": "QuickSwapStrategy",
                "name": "QuickSwap USDC - DAI",
            },
            {
                "strategy": quickSwapStrategyUSDCUSDT.address,
                "contract": "QuickSwapStrategy",
                "name": "QuickSwap USDC - USDT",
            },
            {
                "strategy": am3CurveStrategy.address,
                "contract": "Am3CurveStrategy",
                "name": "Am3Curve - USDC",
            },
            {
                "strategy": synapseStrategy.address,
                "contract": "SynapseStrategy",
                "name": "Synapse - USDC",
            },
            {
                "strategy": dodoStrategy.address,
                "contract": "DodoStrategy",
                "name": "Dodo - USDC",
            }
        ];

        console.log("Matt USDC Balance: ", usdcUnitsFormat(await usdc.balanceOf(matt.address)));

        amount = "100.0";
        console.log("Adding" , amount , "USDC")
        await primaryStable.connect(matt).approve(vault.address, primaryStableUnits(amount));
        await vault.connect(matt).justMint(primaryStable.address, primaryStableUnits(amount), 0);

        // Inside _fixture.js
        // Matt and Josh minted 100 USDC each, remember?
        expect(await primaryStable.balanceOf(vault.address)).to.be.closeTo(primaryStableUnits("300.0"),primaryStableUnits("1"));;

        let prefix = "Before Allocation";
        console.log(prefix, "-", primaryStableName, "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        for (const strat of strats) {
            strategy = await ethers.getContractAt(strat.contract,strat.strategy);
            console.log(prefix, " -", primaryStableName, "in" , strat.name, ":", primaryStableUnitsFormat(await strategy.checkBalance()).toString());
        }
        console.log("Quick Allocating - Started at:", new Date().toLocaleTimeString());
        await vault.quickAllocate();
        console.log("Quick Allocating - Finished at:", new Date().toLocaleTimeString());

        prefix = "After Quick Allocation";
        console.log(prefix, "-", primaryStableName, "in Vault:", primaryStableUnitsFormat(await primaryStable.balanceOf(vault.address)).toString());
        let totalBal = 0;
        for (const strat of strats) {
            strategy = await ethers.getContractAt(strat.contract,strat.strategy);
            let stratBalance = await strategy.checkBalance() 
            totalBal += parseInt(stratBalance);
            console.log(prefix, " -", primaryStableName, "in" , strat.name, ":", primaryStableUnitsFormat(stratBalance).toString());
        }
        console.log("Total", primaryStableName, "in all strategies: ", primaryStableUnitsFormat(totalBal.toString()).toString());
        expect(totalBal.toString()).to.be.closeTo(primaryStableUnits("300.0"),primaryStableUnits("1"));;

    });
});
});
