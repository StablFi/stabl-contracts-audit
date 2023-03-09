const { BigNumber } = require("ethers");

const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
    cashUnits,
    daiUnits,
    usdcUnits,
    usdcUnitsFormat,
    daiUnitsFormat,
    cashUnitsFormat,
    usdtUnits,
    loadFixture,
    setOracleTokenPriceUsd,
    isFork,
    expectApproxSupply,
    runStrategyLogic,
} = require("../helpers");

describe("Vault Redeem", function () {

    it("Should be able to add weights properly", async () => {
        const { cash, vault, dai, matt, Labs, Team, usdc, governor, cTetuUsdcStrategyProxy, cTetuDaiStrategyProxy, cTetuUsdtStrategyProxy } = await loadFixture(defaultFixture);
        const quickDepositStrategies = await vault.getQuickDepositStrategies();
        console.log("quickDepositStrategies: ", quickDepositStrategies);
        await runStrategyLogic(governor, "Tetu Strategy", cTetuUsdcStrategyProxy.address);
        await runStrategyLogic(governor, "Tetu Strategy", cTetuDaiStrategyProxy.address);
        await runStrategyLogic(governor, "Tetu Strategy", cTetuUsdtStrategyProxy.address);


        const strategiesInQuestions = [];
        let strategyWithWeights = await vault.getAllStrategyWithWeights();
        console.log("Strategy with Weights: ",);
        for (let i = 0; i < strategyWithWeights.length; i++) {
            console.log("--------------------------------------------------")
            console.log("- Strategy: ", strategyWithWeights[i].strategy);
            console.log("- Min Weight: ", strategyWithWeights[i].minWeight.toString());
            console.log("- Target Weight: ", strategyWithWeights[i].targetWeight.toString());
            console.log("- Max Weight: ", strategyWithWeights[i].maxWeight.toString());
            console.log("- Enabled: ", strategyWithWeights[i].enabled.toString());
            console.log("- Enabled Reward: ", strategyWithWeights[i].enabledReward.toString());
            console.log("- Position: ", (await vault.strategyWithWeightPositions(strategyWithWeights[i].strategy)).toString());
            strategiesInQuestions.push(strategyWithWeights[i].strategy);
            console.log("--------------------------------------------------")
        }

        // Set strategy weight
        console.log("Set strategy weight");
        await vault.setStrategyWithWeights([[strategiesInQuestions[0], 0, 100000, 100000, true, true]]);

        strategyWithWeights = await vault.getAllStrategyWithWeights();
        console.log("Strategy with Weights: ",);
        for (let i = 0; i < strategyWithWeights.length; i++) {
            console.log("--------------------------------------------------")
            console.log("- Strategy: ", strategyWithWeights[i].strategy);
            console.log("- Min Weight: ", strategyWithWeights[i].minWeight.toString());
            console.log("- Target Weight: ", strategyWithWeights[i].targetWeight.toString());
            console.log("- Max Weight: ", strategyWithWeights[i].maxWeight.toString());
            console.log("- Enabled: ", strategyWithWeights[i].enabled.toString());
            console.log("- Enabled Reward: ", strategyWithWeights[i].enabledReward.toString());
            console.log("- Position: ", (await vault.strategyWithWeightPositions(strategyWithWeights[i].strategy)).toString());
            // strategiesInQuestions.push(strategyWithWeights[i].strategy);
            console.log("--------------------------------------------------")
        }
        console.log("Print position of initial strategies")
        for (let i = 0; i < strategiesInQuestions.length; i++) {
            console.log("--------------------------------------------------")
            console.log("- Strategy: ", strategiesInQuestions[i]);
            console.log("- Position: ", (await vault.strategyWithWeightPositions(strategiesInQuestions[i])).toString());
            console.log("- Supported: ", (await vault.isStrategySupported(strategiesInQuestions[i])).toString());
            console.log("--------------------------------------------------")
            if (i != 0) {
                expect(await vault.isStrategySupported(strategiesInQuestions[i])).to.be.equal(false);
            }
        }

        // Set strategy weight
        console.log("Approving to be set strategies");
        await vault.approveStrategy(strategiesInQuestions[1]);
        await vault.approveStrategy(strategiesInQuestions[2]);
        console.log("Set strategy weight");
        await vault.setStrategyWithWeights([[strategiesInQuestions[1], 0, 50000, 100000, true, true], [strategiesInQuestions[2], 0, 50000, 100000, true, true]]);
        strategyWithWeights = await vault.getAllStrategyWithWeights();
        console.log("Strategy with Weights: ",);
        for (let i = 0; i < strategyWithWeights.length; i++) {
            console.log("--------------------------------------------------")
            console.log("- Strategy: ", strategyWithWeights[i].strategy);
            console.log("- Min Weight: ", strategyWithWeights[i].minWeight.toString());
            console.log("- Target Weight: ", strategyWithWeights[i].targetWeight.toString());
            console.log("- Max Weight: ", strategyWithWeights[i].maxWeight.toString());
            console.log("- Enabled: ", strategyWithWeights[i].enabled.toString());
            console.log("- Enabled Reward: ", strategyWithWeights[i].enabledReward.toString());
            console.log("- Position: ", (await vault.strategyWithWeightPositions(strategyWithWeights[i].strategy)).toString());
            // strategiesInQuestions.push(strategyWithWeights[i].strategy);
            console.log("--------------------------------------------------")
        }

        // Add this in VaultAdmin
        // function isStrategySupported(address _addr) external view returns (bool) {
        //     return strategies[_addr].isSupported;
        // }
        console.log("Print position of initial strategies")
        for (let i = 0; i < strategiesInQuestions.length; i++) {
            console.log("--------------------------------------------------")
            console.log("- Strategy: ", strategiesInQuestions[i]);
            console.log("- Position: ", (await vault.strategyWithWeightPositions(strategiesInQuestions[i])).toString());
            console.log("- Supported: ", (await vault.isStrategySupported(strategiesInQuestions[i])).toString());
            console.log("--------------------------------------------------")
            if (i == 1 || i == 2) {
                expect(await vault.isStrategySupported(strategiesInQuestions[i])).to.be.equal(true);
            } else {
                expect(await vault.isStrategySupported(strategiesInQuestions[i])).to.be.equal(false);
            }
        }





    });


});
