const { utils } = require("ethers");
const { formatUnits } = utils;

const erc20Abi = require("../test/abi/erc20.json");
const addresses = require("../utils/addresses");

/**
 * Prints information about deployed contracts and their config.
 */
async function debug(taskArguments, hre) {
  //
  // Get all contracts to operate on.
  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const cashProxy = await hre.ethers.getContract("CASHProxy");
  const vault = await hre.ethers.getContractAt("contracts/interfaces/IVault.sol:IVault", vaultProxy.address);
  const cVault = await hre.ethers.getContract("Vault");
  const vaultAdmin = await hre.ethers.getContract("VaultAdmin");
  const vaultCore = await hre.ethers.getContract("VaultCore");
  const cash = await hre.ethers.getContractAt("CASH", cashProxy.address);
  const cCASH = await hre.ethers.getContract("CASH");

  const cDystopiaStrategyUsdcDaiProxy = await ethers.getContract(
    "DystopiaStrategyUsdcDaiProxy"
  );
  const cDystopiaStrategyUsdcDai = await ethers.getContractAt(
    "DystopiaStrategy",
    cDystopiaStrategyUsdcDaiProxy.address
  );

  const cDystopiaStrategyUsdcUsdtProxy = await ethers.getContract(
    "DystopiaStrategyUsdcUsdtProxy"
  );
  const cDystopiaStrategyUsdcUsdt = await ethers.getContractAt(
    "DystopiaStrategy",
    cDystopiaStrategyUsdcUsdtProxy.address
  );

  const cDystopiaStrategyDaiUsdtProxy = await ethers.getContract(
    "DystopiaStrategyDaiUsdtProxy"
  );
  const cDystopiaStrategyDaiUsdt = await ethers.getContractAt(
    "DystopiaStrategy",
    cDystopiaStrategyDaiUsdtProxy.address
  );

  const cMeshSwapStrategyUSDCProxy = await ethers.getContract(
    "MeshSwapStrategyUSDCProxy"
  );
  const cMeshSwapStrategyUSDC = await ethers.getContractAt(
    "MeshSwapStrategy",
    cMeshSwapStrategyUSDCProxy.address
  );

  const cMeshSwapStrategyDAIProxy = await ethers.getContract(
    "MeshSwapStrategyDAIProxy"
  );
  const cMeshSwapStrategyDAI = await ethers.getContractAt(
    "MeshSwapStrategy",
    cMeshSwapStrategyDAIProxy.address
  );

  const cMeshSwapStrategyUSDTProxy = await ethers.getContract(
    "MeshSwapStrategyUSDTProxy"
  );
  const cMeshSwapStrategyUSDT = await ethers.getContractAt(
    "MeshSwapStrategy",
    cMeshSwapStrategyUSDTProxy.address
  );

  const cMeshSwapStrategyUSDCUSDTProxy = await ethers.getContract(
    "MeshSwapStrategyUSDCUSDTProxy"
  );
  const cMeshSwapStrategyUSDCUSDT = await ethers.getContractAt(
    "MeshSwapStrategyDual",
    cMeshSwapStrategyUSDCUSDTProxy.address
  );

  const cMeshSwapStrategyUSDCDAIProxy = await ethers.getContract(
    "MeshSwapStrategyUSDCDAIProxy"
  );
  const cMeshSwapStrategyUSDCDAI = await ethers.getContractAt(
    "MeshSwapStrategyDual",
    cMeshSwapStrategyUSDCDAIProxy.address
  );

  const cMeshSwapStrategyUSDTDAIProxy = await ethers.getContract(
    "MeshSwapStrategyUSDTDAIProxy"
  );
  const cMeshSwapStrategyUSDTDAI = await ethers.getContractAt(
    "MeshSwapStrategyDual",
    cMeshSwapStrategyUSDTDAIProxy.address
  );

  const cQuickSwapStrategyUSDCDAIProxy = await ethers.getContract(
    "QuickSwapStrategyUSDCDAIProxy"
  );
  const cQuickSwapStrategyUSDCDAI = await ethers.getContractAt(
    "QuickSwapStrategy",
    cQuickSwapStrategyUSDCDAIProxy.address
  );

  const cQuickSwapStrategyUSDCUSDTProxy = await ethers.getContract(
    "QuickSwapStrategyUSDCUSDTProxy"
  );
  const cQuickSwapStrategyUSDCUSDT = await ethers.getContractAt(
    "QuickSwapStrategy",
    cQuickSwapStrategyUSDCUSDTProxy.address
  );

  // const cAaveStrategyUSDCProxy = await ethers.getContract(
  //   "AaveStrategyUSDCProxy"
  // );
  // const cAaveStrategyUSDC = await ethers.getContractAt(
  //   "AaveStrategy",
  //   cAaveStrategyUSDCProxy.address
  // );

  const cAm3CurveStrategyProxy = await ethers.getContract(
    "Am3CurveStrategyProxy"
  );
  const cAm3CurveStrategy = await ethers.getContractAt(
    "Am3CurveStrategy",
    cAm3CurveStrategyProxy.address
  );

  const cAm3CurveStrategyUSDTProxy = await ethers.getContract(
    "Am3CurveStrategyUSDTProxy"
  );
  const cAm3CurveStrategyUSDT = await ethers.getContractAt(
    "Am3CurveStrategy",
    cAm3CurveStrategyUSDTProxy.address
  );

  const cSynapseStrategyProxy = await ethers.getContract(
    "SynapseStrategyProxy"
  );
  const cSynapseStrategy = await ethers.getContractAt(
    "SynapseStrategy",
    cSynapseStrategyProxy.address
  );

  const cSynapseStrategyUSDTProxy = await ethers.getContract(
    "SynapseStrategyUSDTProxy"
  );
  const cSynapseStrategyUSDT = await ethers.getContractAt(
    "SynapseStrategy",
    cSynapseStrategyUSDTProxy.address
  );

  const cDodoStrategyProxy = await ethers.getContract(
    "DodoStrategyProxy"
  );
  const cDodoStrategy = await ethers.getContractAt(
    "DodoStrategy",
    cDodoStrategyProxy.address
  );

  let strategies = [
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
        "targetWeight": 10,
        "maxWeight": 100,
        "enabled": true,
        "enabledReward": true
    },
    {
        "strategy": cDystopiaStrategyDaiUsdtProxy.address,
        "contract": "DystopiaStrategy",
        "name": "Dystopia DAI-USDT",
        "minWeight": 0,
        "targetWeight": 1,
        "maxWeight": 100,
        "enabled": true,
        "enabledReward": true
    },
    {
        "strategy": cMeshSwapStrategyDAIProxy.address,
        "contract": "MeshSwapStrategy",
        "name": "MeshSwap DAI",
        "minWeight": 0,
        "targetWeight": 5,
        "maxWeight": 100,
        "enabled": true,
        "enabledReward": true
    },
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
        "targetWeight": 5,
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
  
  const oracleRouter = await hre.ethers.getContract("OracleRouter");
  const governor = await hre.ethers.getContract("Governor");
  
  const harvester = await hre.ethers.getContractAt(
    "Harvester",
    (await hre.ethers.getContract(
      "HarvesterProxy"
    )).address
  );
  const dripper = await hre.ethers.getContractAt(
    "Dripper",
    (await hre.ethers.getContract(
      "DripperProxy"
    )).address
  );

  //
  // Addresses
  //
  console.log("\nContract addresses");
  console.log("====================");
  console.log(`CASH proxy:              ${cashProxy.address}`);
  console.log(`CASH impl:               ${await cashProxy.implementation()}`);
  console.log(`CASH:                    ${cCASH.address}`);
  console.log(`Vault proxy:             ${vaultProxy.address}`);
  console.log(`Vault impl:              ${await vaultProxy.implementation()}`);
  console.log(`Vault:                   ${cVault.address}`);
  console.log(`VaultCore:               ${vaultCore.address}`);
  console.log(`VaultAdmin:              ${vaultAdmin.address}`);
  console.log(`OracleRouter:            ${oracleRouter.address}`);

  for (const strategy of strategies) {
    console.log(strategy.name, "\t\t", strategy.strategy)
  }

  // Signers
  console.log("\Signers");
  console.log("====================");
  const signers = await hre.ethers.getSigners();
  const governorSigner = signers[0];
  const strategist = signers[0];
  const adjuster = signers[0];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const rio = signers[7];
  console.log("governor:", governorSigner.address);
  console.log("strategist:", strategist.address);
  console.log("adjuster:", adjuster.address);

  console.log("matt (Account 4):", matt.address);
  console.log("josh (Account 5):", josh.address);
  console.log("anna (Account 5):", anna.address);
  console.log("rio  (Account 6):", rio.address);

  let count = 0;
  for(const signer of signers) {
    console.log("Account", count, ":", signer.address);
    console.log("-- USDC: ", formatUnits((await (
      await hre.ethers.getContractAt(erc20Abi, addresses.polygon.USDC)
    ).balanceOf(signer.address)),6));
    console.log("-- DAI :", formatUnits((await (
      await hre.ethers.getContractAt(erc20Abi, addresses.polygon.DAI)
    ).balanceOf(signer.address)),18));
    console.log("-- USDT: ", formatUnits((await (
      await hre.ethers.getContractAt(erc20Abi, addresses.polygon.USDT)
    ).balanceOf(signer.address)),6));
    count++;
  }

  //
  // Governor
  //
  const govAdmin = await governor.admin();
  const govPendingAdmin = await governor.pendingAdmin();
  const govDelay = await governor.delay();
  const govPropCount = await governor.proposalCount();
  console.log("\nGovernor");
  console.log("====================");
  console.log("Admin:           ", govAdmin);
  console.log("PendingAdmin:    ", govPendingAdmin);
  console.log("Delay (seconds): ", govDelay.toString());
  console.log("ProposalCount:   ", govPropCount.toString());
 
  //
  // Governance
  //

  // Read the current governor address on all the contracts.
  const cashGovernorAddr = await cash.governor();
  const vaultGovernorAddr = await vault.governor();

  console.log("\nGovernor addresses");
  console.log("====================");
  console.log("CASH:              ", cashGovernorAddr);
  console.log("Vault:             ", vaultGovernorAddr);
  for (const strategy of strategies) {
    const strat = await ethers.getContractAt(
      strategy.contract,
      strategy.strategy
    );
    console.log(strategy.name, ":\t\t", await strat.governor())
  }

  //
  // CASH
  //
  const name = await cash.name();
  const decimals = await cash.decimals();
  const symbol = await cash.symbol();
  const totalSupply = await cash.totalSupply();
  const vaultAddress = await cash.vaultAddress();
  const nonRebasingSupply = await cash.nonRebasingSupply();
  const rebasingSupply = totalSupply.sub(nonRebasingSupply);
  const rebasingCreditsPerToken = await cash.rebasingCreditsPerToken();
  const rebasingCredits = await cash.rebasingCredits();

  console.log("\nCASH");
  console.log("=======");
  console.log(`name:                    ${name}`);
  console.log(`symbol:                  ${symbol}`);
  console.log(`decimals:                ${decimals}`);
  console.log(`totalSupply:             ${formatUnits(totalSupply, 18)}`);
  console.log(`vaultAddress:            ${vaultAddress}`);
  console.log(`nonRebasingSupply:       ${formatUnits(nonRebasingSupply, 18)}`);
  console.log(`rebasingSupply:          ${formatUnits(rebasingSupply, 18)}`);
  console.log(`rebasingCreditsPerToken: ${rebasingCreditsPerToken}`);
  console.log(`rebasingCredits:         ${rebasingCredits}`);

  //
  // Oracle
  //
  console.log("\nOracle");
  console.log("========");
  const priceDAI = await oracleRouter.price(addresses.polygon.DAI);
  const priceUSDC = await oracleRouter.price(addresses.polygon.USDC);
  const priceUSDT = await oracleRouter.price(addresses.polygon.USDT);
  console.log(`DAI price :  ${formatUnits(priceDAI, 8)} USD`);
  console.log(`USDC price:  ${formatUnits(priceUSDC, 8)} USD`);
  console.log(`USDT price:  ${formatUnits(priceUSDT, 8)} USD`);

  //
  // Vault
  //
  const rebasePaused = await vault.rebasePaused();
  const capitalPaused = await vault.capitalPaused();
  const feeParams = await vaultAdmin.getFeeParams();
  const trusteeFeeBps = Number(await vault.trusteeFeeBps());
  const vaultBuffer = Number(
    formatUnits((await vault.vaultBuffer()).toString(), 18)
  );
  const autoAllocateThreshold = await vault.autoAllocateThreshold();
  const rebaseThreshold = await vault.rebaseThreshold();
  const maxSupplyDiff = await vault.maxSupplyDiff();
  const strategyCount = await vault.getStrategyCount();
  const assetCount = await vault.getAssetCount();
  const strategistAddress = await vault.strategistAddr();
  const trusteeAddress = await vault.trusteeAddress();
  const priceProvider = await vault.priceProvider();

  console.log("\nVault Settings");
  console.log("================");
  console.log("rebasePaused:\t\t\t", rebasePaused);
  console.log("capitalPaused:\t\t\t", capitalPaused);
  console.log(`Labs:\t\t\t ${feeParams[0]} (${feeParams[1] / 100}%)`);
  console.log(`Team:\t\t\t ${feeParams[2]} (${feeParams[3] / 100}%)`);
  console.log(
    `trusteeFeeBps:\t\t\t ${trusteeFeeBps} (${trusteeFeeBps / 100}%)`
  );
  console.log(`vaultBuffer:\t\t\t ${vaultBuffer} (${vaultBuffer * 100}%)`);
  console.log(
    "autoAllocateThreshold (USD):\t",
    formatUnits(autoAllocateThreshold.toString(), 18)
  );
  console.log(
    "rebaseThreshold (USD):\t\t",
    formatUnits(rebaseThreshold.toString(), 18)
  );

  console.log(
    `maxSupplyDiff:\t\t\t ${formatUnits(maxSupplyDiff.toString(), 16)}%`
  );

  console.log("Price provider address:\t\t", priceProvider);
  console.log("Strategy count:\t\t\t", Number(strategyCount));
  console.log("Asset count:\t\t\t", Number(assetCount));
  console.log("Strategist address:\t\t", strategistAddress);
  console.log("Trustee address:\t\t", trusteeAddress);

  const assets = [
    {
      symbol: "DAI",
      address: addresses.polygon.DAI,
      decimals: 18,
    },
    {
      symbol: "USDC",
      address: addresses.polygon.USDC,
      decimals: 6,
    },
    {
      symbol: "USDT",
      address: addresses.polygon.USDT,
      decimals: 6,
    },
  ];

  const totalValue = await vault.totalValue();
  const balances = {};
  const balance = await vault["checkBalance()"]();
  balances[assets[1].symbol] = formatUnits(balance.toString(), assets[1].decimals);

  console.log("\nVault balances");
  console.log("================");
  console.log(
    `totalValue (USD):\t $${Number(
      formatUnits(totalValue.toString(), 18)
    ).toFixed(2)}`
  );
  for (const [symbol, balance] of Object.entries(balances)) {
    console.log(`  ${symbol}:\t\t\t ${Number(balance).toFixed(2)}`);
  }

  console.log("\nVault buffer balances");
  console.log("================");

  const vaultBufferBalances = {};
  for (const asset of assets) {
    vaultBufferBalances[asset.symbol] =
      (await (
        await hre.ethers.getContractAt(erc20Abi, asset.address)
      ).balanceOf(vault.address)) /
      (1 * 10 ** asset.decimals);
  }
  for (const [symbol, balance] of Object.entries(vaultBufferBalances)) {
    console.log(`${symbol}:\t\t\t ${balance}`);
  }

  console.log("\nStrategies balances");
  console.log("=====================");
  for (const strategy of strategies) {
    const strat = await ethers.getContractAt(
      strategy.contract,
      strategy.strategy
    );
    console.log("("+ strategy.strategy + ")",strategy.name, " (USDC) :\t\t", formatUnits(await strat.checkBalance(),6))
  }

  //
  // Strategies settings
  //

  console.log("\nDefault strategies");
  console.log("============================");
  for (const asset of assets) {
    console.log(
      asset.symbol,
      `\t${await vault.assetDefaultStrategies(asset.address)}`
    );
  }

  console.log("\nHarvester");
  console.log("============================");
  console.log("Harvester & Dripper")
  console.log("Harvester (USDC): ", formatUnits((await (
                                await hre.ethers.getContractAt(erc20Abi, addresses.polygon.primaryStable)
                              ).balanceOf(harvester.address)),6))
  console.log("Harvester Team: ", (await harvester.getTeam())[0], (await harvester.getTeam())[1].toString(), "bps");
  console.log("Harvester Labs: ", (await harvester.getLabs())[0], (await harvester.getLabs())[1].toString(), "bps");
  console.log("Dripper  (USDC): ", formatUnits((await (
                              await hre.ethers.getContractAt(erc20Abi, addresses.polygon.primaryStable)
                            ).balanceOf(dripper.address)),6))
 
}

module.exports = {
  debug,
};
