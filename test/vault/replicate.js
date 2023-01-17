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
  cashUnitsFormat,
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
const { ethers } = require("hardhat");

describe("Replication @slow" , function () {
  
    let  anna,
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

    describe("Replicate @fork", function () {
        it("Replication testing @slow @fork" , async () => {
            const mainnetContracts = [
                {
                  address: '0xAf41EC72bb9A913429506161089d4FF87d33C45b',
                  contract: 'Am3CurveStrategyProxy',
                  proxyOf: 'Am3CurveStrategy'
                },
                {
                  address: '0x80487b4f8f70e793A81a42367c225ee0B94315DF',
                  contract: 'CASHProxy',
                  proxyOf: 'CASH'
                },
                {
                  address: '0x514D98ec0ca42FCB3cc2C140B38fe76cF3d11751',
                  contract: 'ClearpoolWintermuteStrategyProxy',
                  proxyOf: 'ClearpoolStrategy'
                },
                {
                  address: '0x84eF43F0B0721a4535d796c865a2eaf1Fee721d3',
                  contract: 'DodoStrategyProxy',
                  proxyOf: 'DodoStrategy'
                },
                {
                  address: '0x4b2b1dC2ecc46551D88389f7F06ef2BEde77b4E1',
                  contract: 'DripperProxy',
                  proxyOf: 'Dripper'
                },
                {
                  address: '0xeFba08d4B24cF71be88EBa96a4da42dD6de785F0',
                  contract: 'DystopiaStrategyDaiUsdtProxy',
                  proxyOf: 'DystopiaStrategy'
                },
                {
                  address: '0x098ec4e038a3B258C2EeAA95D0b8f29781dac5b4',
                  contract: 'DystopiaStrategyUsdcDaiProxy',
                  proxyOf: 'DystopiaStrategy'
                },
                {
                  address: '0xD80d60619095501C075045DE147dBE29b991c221',
                  contract: 'DystopiaStrategyUsdcUsdtProxy',
                  proxyOf: 'DystopiaStrategy'
                },
                {
                  address: '0xbC69EB87c3C7772B1Fbc1c174f57669Fbb673858',
                  contract: 'GainsDAIStrategyProxy',
                  proxyOf: 'GainsStrategy'
                },
                {
                  address: '0xDbb57B33583fa86D4B31E88CF951CAF6FD561fFE',
                  contract: 'HarvesterProxy',
                  proxyOf: 'Harvester'
                },
                {
                  address: '0x6B635942E2f800aA8E7478cf0EAe1eD64366492A',
                  contract: 'MeshSwapStrategyDAIProxy',
                  proxyOf: 'MeshSwapStrategy'
                },
                {
                  address: '0xBeBA4F5C44Bb36DEBeAD3d2f6aFd51782162229e',
                  contract: 'MeshSwapStrategyUSDCDAIProxy',
                  proxyOf: 'MeshSwapStrategyDual'
                },
                {
                  address: '0xcF8350ccf2A1bF3b0293721Be991176177410216',
                  contract: 'MeshSwapStrategyUSDCProxy',
                  proxyOf: 'MeshSwapStrategy'
                },
                {
                  address: '0x6DE4da5Ad6447a1D32AccADD6AE1c415516d5CB8',
                  contract: 'MeshSwapStrategyUSDCUSDTProxy',
                  proxyOf: 'MeshSwapStrategyDual'
                },
                {
                  address: '0x146d55185ea607BA591EC7A60e481ba2C8892453',
                  contract: 'MeshSwapStrategyUSDTDAIProxy',
                  proxyOf: 'MeshSwapStrategyDual'
                },
                {
                  address: '0x58ac28Ae7989eb24Ff7AAcEBD3CA6119B099F07e',
                  contract: 'MeshSwapStrategyUSDTProxy',
                  proxyOf: 'MeshSwapStrategy'
                },
                {
                  address: '0xD80412eDDC13B1054f41b7DC73140Fd342467064',
                  contract: 'QuickSwapStrategyUSDCDAIProxy',
                  proxyOf: 'QuickSwapStrategy'
                },
                {
                  address: '0xAF53C6C082Fd80f8a4493D034bd386E86f917c45',
                  contract: 'QuickSwapStrategyUSDCUSDTProxy',
                  proxyOf: 'QuickSwapStrategy'
                },
                {
                  address: '0x60ce9B4FBdbeAabc85f7A4652bAb117B8F8bB768',
                  contract: 'SynapseStrategyProxy',
                  proxyOf: 'SynapseStrategy'
                },
                {
                  address: '0xd1bb7d35db39954d43e16f65F09DD0766A772cFF',
                  contract: 'VaultProxy',
                  proxyOf: 'Vault'
                },
                {
                  address: '0x953Ad46adE32E1c2E76D725544811E4DD410cb50',
                  contract: 'WrappedCASHProxy',
                  proxyOf: 'WrappedCASH'
                }
            ];
          
            let cash = await hre.ethers.getContractAt( "CASH", "0x80487b4f8f70e793A81a42367c225ee0B94315DF");
            let vault = await hre.ethers.getContractAt( "VaultCore", "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF");
            // NEED TO THE STOP THE FUNDING IN FIXTURE TO MAKE IT WORK
            console.log("Strategy count: ", (await vault.getStrategyCount()).toString())
            let allStrategies = await vault.getAllStrategies();
            for (let index = 0; index < allStrategies.length; index++) {
                const element = allStrategies[index];
                // find element in mainnetContracts
                let found = mainnetContracts.find(x => x.address.toLowerCase() == element.toLowerCase());
                if (found) {
                    let localStrategy = await ethers.getContractAt( "IStrategy", (await ethers.getContract(found.contract)).address);
                    let strat = await hre.ethers.getContractAt( "IStrategy", element);
                    let balance = (await strat.checkBalance()).toString();
                    if (await localStrategy.checkBalance() == 0) {
                        await usdc.connect(governor).transfer(localStrategy.address, balance);
                    }

                }
            }
            console.log("Invoking Deposits")
            /*
                function invokeDeposits() external onlyGovernor {
                    StrategyWithWeight[] memory stratsWithWeights = getAllStrategyWithWeights();
                    for (uint8 i; i < stratsWithWeights.length; i++) {
                        uint256 totalAssetInStrat = IStrategy(stratsWithWeights[i].strategy).checkBalance();
                        if (totalAssetInStrat > 0) {
                            console.log("Depositing %s from %s", totalAssetInStrat, stratsWithWeights[i].strategy);
                            IStrategy(stratsWithWeights[i].strategy).deposit(primaryStableAddress, totalAssetInStrat);
                        }
                    }
                }
            */
            let localVaultAdmin = await ethers.getContractAt( "VaultAdmin", (await ethers.getContract("VaultProxy")).address);

            await localVaultAdmin.invokeDeposits();
            
            let total = 0;
            let totalLocal = 0;
            for (let index = 0; index < allStrategies.length; index++) {
                const element = allStrategies[index];
                // find element in mainnetContracts
                let found = mainnetContracts.find(x => x.address.toLowerCase() == element.toLowerCase());
                if (found) {
                    console.log();
                    let localStrategy = await ethers.getContractAt( "IStrategy", (await ethers.getContract(found.contract)).address);
                    let strat = await hre.ethers.getContractAt( "IStrategy", element);
                    let balance = (await strat.checkBalance()).toString();
                    let localBalance = (await localStrategy.checkBalance()).toString();
                    total += parseInt(balance)
                    totalLocal += parseInt(localBalance)
                    console.log("Balance of", found.contract ,":", usdcUnitsFormat(await strat.checkBalance()))
                    console.log("Local Balance of", found.contract ,":", usdcUnitsFormat(await localStrategy.checkBalance()))
                }
            }
            console.log("Total Balance in Strategies: ", usdcUnitsFormat(total.toString()));
            console.log("Total Balance in Local Strategies: ", usdcUnitsFormat(totalLocal.toString()));

            let vaultBalance = await usdc.balanceOf(vault.address);
            let localVault = await ethers.getContractAt( "VaultCore", (await ethers.getContract("VaultProxy")).address);
            await usdc.connect(governor).transfer(localVault.address, vaultBalance);
            console.log("Stray USDC in Vault: ", usdcUnitsFormat(vaultBalance.toString()));
            let localVaultBalance = await usdc.balanceOf(localVault.address);

            console.log("Stray USDC in Local Vault: ", usdcUnitsFormat(localVaultBalance.toString()));
            console.log("USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(vaultBalance) + total).toString()));
            console.log("Local USDC Vault + Each Strategy: ", usdcUnitsFormat((parseInt(localVaultBalance) + totalLocal).toString()));

            console.log("Invoking Balance")
            await localVaultAdmin.balance();
        });
    });
});
