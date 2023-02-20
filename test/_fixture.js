const hre = require("hardhat");
const { deployContract, MockProvider } = require("ethereum-waffle");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

const addresses = require("../utils/addresses");
const { fundAccounts } = require("../utils/funding");
const { getAssetAddresses, daiUnits, usdcUnits, isFork, runStrategyLogic } = require("./helpers");

const { utils } = require("ethers");
const { loadFixture, getOracleAddresses } = require("./helpers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const erc20Abi = require("./abi/erc20.json");
const tusdAbi = require("./abi/erc20.json");
const usdcAbi = require("./abi/erc20.json");
const crvAbi = require("./abi/erc20.json");
const ognAbi = require("./abi/erc20.json");
const dystAbi = require("./abi/erc20.json");
const penroseTokenAbi = require("./abi/erc20.json");
const dystPairAbi = require("./abi/dystPair.json");
const penLensAbi = require("./abi/IPenLens.json");
const uniswapV2PairAbi = require("./abi/uniswapv2pair.json");
const quickSwapStakingRewardAbi = require("./abi/IStakingRewards.json");
const aaveLendingPoolAbi = require("./abi/aaveLendingPool.json");
const { ethers } = require("hardhat");

async function defaultFixture() {

  await deployments.fixture(['test']);

  const { governorAddr } = await getNamedAccounts();

  // const boxProxy = await ethers.getContract("BoxProxy");
  // const box = await ethers.getContractAt("Box", boxProxy.address);

  const cashProxy = await ethers.getContract("CASHProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");
  const harvesterProxy = await ethers.getContract("HarvesterProxy");
  const rebaseToNonEoaHandlerProxy = await ethers.getContract("RebaseToNonEoaHandlerProxy");

  const cash = await ethers.getContractAt("CASH", cashProxy.address);
  const vault = await ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    vaultProxy.address
  );
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const vaultCore = await ethers.getContractAt(
    "VaultCore",
    vaultProxy.address
  );

  // console.log("Vault address:", vault.address);
  const harvester = await ethers.getContractAt(
    "IHarvester",
    harvesterProxy.address
  );
  const rebaseToNonEoaHandler = await ethers.getContractAt(
    "RebaseToNonEoaHandler",
    rebaseToNonEoaHandlerProxy.address
  );

  const dripperProxy = await ethers.getContract("DripperProxy");
  const dripper = await ethers.getContractAt("Dripper", dripperProxy.address);
  const wcashProxy = await ethers.getContract("WrappedCASHProxy");
  // console.log("wcashProxy", wcashProxy.address);
  const wcash = await ethers.getContractAt("WrappedCASH", wcashProxy.address);
  const governorContract = await ethers.getContract("Governor");

  const oracleRouter = await ethers.getContract("OracleRouter");

  try {
    await fundAccounts();
  } catch(error) {
    console.log("Error funding accounts:", error.message);
  }

  const sGovernor = await ethers.provider.getSigner(governorAddr);
  
  // Add TUSD in fixture, it is disabled by default in deployment
  // const assetAddresses = await getAssetAddresses(deployments);
  // await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD);

  // Enable capital movement
  await vault.connect(sGovernor).unpauseCapital();

  const signers = await hre.ethers.getSigners();
  const governor = signers[0];
  const strategist = signers[0];
  const adjuster = signers[0];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const rio = signers[7];
  // console.log("governor:", governor.address);
  // console.log("strategist:", strategist.address);
  // console.log("adjuster:", adjuster.address);
  // console.log("matt:", matt.address);
  // console.log("josh:", josh.address);
  // console.log("anna:", anna.address);
  // console.log("rio:", rio.address);

  let usdt,
    dai,
    tusd,
    usdc,
    Labs,
    Team,
    aave,
    nonStandardToken,
    mockNonRebasing,
    mockNonRebasingTwo,
    quickTokenNew,
    quickToken,
    quickSwapRouter02,
    quickSwapUSDCDAIPair,
    quickSwapDragonQuick,
    quickSwapStakingReward,
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedETH,
    uniswapV2PairCASHUSDC,
    crv;

  if (isFork) {
      usdt = await ethers.getContractAt(usdtAbi, addresses.polygon.USDT);
      dai = await ethers.getContractAt(daiAbi, addresses.polygon.DAI);
      tusd = await ethers.getContractAt(tusdAbi, addresses.polygon.TUSD);
      usdc = await ethers.getContractAt(usdcAbi, addresses.polygon.USDC);
      STG = await ethers.getContractAt(usdcAbi, addresses.polygon.STG);
      sUSDC = await ethers.getContractAt(usdcAbi, addresses.polygon.sUSDC);
      sUSDT = await ethers.getContractAt(usdtAbi, addresses.polygon.sUSDT);
      tetu = await ethers.getContractAt(usdcAbi, addresses.polygon.TETU);
      TetuLPToken = await ethers.getContractAt(usdcAbi, addresses.polygon.TetuLPToken);
      primaryStable = await ethers.getContractAt(usdcAbi, addresses.polygon.primaryStable);
      crv = await ethers.getContractAt(crvAbi, addresses.polygon.CRV);
      ogn = await ethers.getContractAt(ognAbi, addresses.polygon.OGN);
      dystToken = await ethers.getContractAt(dystAbi, addresses.polygon.dystToken);
      dystPairUsdcDai = await ethers.getContractAt(dystPairAbi,addresses.polygon.dystPairUsdcDai);
      dystPairUsdcUsdt = await ethers.getContractAt(dystPairAbi,addresses.polygon.dystPairUsdcUsdt);
      dystPairDaiUsdt = await ethers.getContractAt(dystPairAbi,addresses.polygon.dystPairDaiUsdt);
      penroseToken = await ethers.getContractAt(penroseTokenAbi,addresses.polygon.penroseToken);
      penroseLens = await ethers.getContractAt(penLensAbi,addresses.polygon.penroseLens);
      meshToken = await ethers.getContractAt(dystAbi, addresses.polygon.meshToken);
      meshSwapUsdc = await ethers.getContractAt(dystAbi,addresses.polygon.meshSwapUsdc);
      meshSwapDai = await ethers.getContractAt(dystAbi,addresses.polygon.meshSwapDai);
      meshSwapUsdt = await ethers.getContractAt(dystAbi,addresses.polygon.meshSwapUsdt);
      meshSwapUsdcUsdtPair = await ethers.getContractAt(erc20Abi,addresses.polygon.meshSwapUsdcUsdtPair);
      meshSwapUsdcDaiPair = await ethers.getContractAt(erc20Abi,addresses.polygon.meshSwapUsdcDaiPair);
      meshSwapUsdtDaiPair = await ethers.getContractAt(erc20Abi,addresses.polygon.meshSwapUsdtDaiPair);
      quickTokenNew = await ethers.getContractAt(ognAbi,addresses.polygon.quickTokenNew);
      quickToken = await ethers.getContractAt(ognAbi, addresses.polygon.quickToken);
      quickSwapUSDCDAIPair = await ethers.getContractAt(uniswapV2PairAbi,addresses.polygon.quickSwapUSDCDAIPair);
      quickSwapUSDCUSDTPair = await ethers.getContractAt(uniswapV2PairAbi,addresses.polygon.quickSwapUSDCUSDTPair);
      quickSwapStakingReward = await ethers.getContractAt(quickSwapStakingRewardAbi,addresses.polygon.quickSwapStakingReward);
      quickSwapStakingRewardUSDCUSDT = await ethers.getContractAt(quickSwapStakingRewardAbi,addresses.polygon.quickSwapStakingRewardUSDCUSDT);
      CPOOL = await ethers.getContractAt(erc20Abi, addresses.polygon.CPOOL);
      aUSDT = await ethers.getContractAt(erc20Abi, addresses.polygon.aUSDT);
      aaveLendingPool = await ethers.getContractAt(aaveLendingPoolAbi, addresses.polygon.aaveLendingPool);
      amDAI = await ethers.getContractAt(erc20Abi, addresses.polygon.amDAI);
      amUSDC = await ethers.getContractAt(erc20Abi, addresses.polygon.amUSDC);
      amUSDT = await ethers.getContractAt(erc20Abi, addresses.polygon.amUSDT);
      aaveVDebtDAI = await ethers.getContractAt(erc20Abi,addresses.polygon.aaveVDebtDAI);
      aaveVDebtUSDC = await ethers.getContractAt(erc20Abi,addresses.polygon.aaveVDebtUSDC);
      aaveVDebtUSDT = await ethers.getContractAt(erc20Abi,addresses.polygon.aaveVDebtUSDT);
      wmatic = await ethers.getContractAt(erc20Abi, addresses.polygon.wMATIC);
      am3crv = await ethers.getContractAt(erc20Abi, addresses.polygon.am3crv);
      am3CurveGauge = await ethers.getContractAt(erc20Abi,addresses.polygon.am3crvGauge);
      nUSD = await ethers.getContractAt(erc20Abi, addresses.polygon.nUSD);
      SYN = await ethers.getContractAt(erc20Abi, addresses.polygon.SYN);
      usdcLPToken = await ethers.getContractAt(erc20Abi, addresses.polygon.dodoUsdcLPToken);
      DODO = await ethers.getContractAt(erc20Abi, addresses.polygon.DODO);
      Labs = await ethers.getContractAt(erc20Abi, addresses.polygon.Labs);
      Team = await ethers.getContractAt(erc20Abi, addresses.polygon.Team);
      Team = await ethers.getContractAt(erc20Abi, addresses.polygon.Team);

      clearpoolAmberPoolBase = await ethers.getContractAt(erc20Abi, addresses.polygon.clearpoolAmberPoolBase);
      clearpoolWinterMutePoolBase = await ethers.getContractAt(erc20Abi, addresses.polygon.clearpoolWinterMutePoolBase);
      clearpoolAurosPoolBase = await ethers.getContractAt(erc20Abi, addresses.polygon.clearpoolAurosPoolBase);
  } else {
      usdt = await ethers.getContract("MockUSDT");
      dai = await ethers.getContract("MockDAI");
      tusd = await ethers.getContract("MockTUSD");
      usdc = await ethers.getContract("MockUSDC");
      wmatic = await ethers.getContract("MockWMATIC");
      nonStandardToken = await ethers.getContract("MockNonStandardToken");
      crv = await ethers.getContract("MockCRV");
      cvx = await ethers.getContract("MockCVX");
      crvMinter = await ethers.getContract("MockCRVMinter");
      threePool = await ethers.getContract("MockCurvePool");
      threePoolToken = await ethers.getContract("Mock3CRV");
      threePoolGauge = await ethers.getContract("MockCurveGauge");
      cvxBooster = await ethers.getContract("MockBooster");
      cvxRewardPool = await ethers.getContract("MockRewardPool");
      adai = await ethers.getContract("MockADAI");
      aaveToken = await ethers.getContract("MockAAVEToken");
      aave = await ethers.getContract("MockAave");
      // currently in test the mockAave is itself the address provder
      aaveAddressProvider = await ethers.getContractAt("contracts/strategies/IAave.sol:ILendingPoolAddressesProvider",aave.address);
      chainlinkOracleFeedDAI = await ethers.getContract("MockChainlinkOracleFeedDAI");
      chainlinkOracleFeedUSDT = await ethers.getContract("MockChainlinkOracleFeedUSDT");
      chainlinkOracleFeedUSDC = await ethers.getContract("MockChainlinkOracleFeedUSDC");
      chainlinkOracleFeedETH = await ethers.getContract("MockChainlinkOracleFeedETH");

      // Mock contracts for testing rebase opt out
      mockNonRebasing = await ethers.getContract("MockNonRebasing");
      await mockNonRebasing.setCASH(cash.address);
      mockNonRebasingTwo = await ethers.getContract("MockNonRebasingTwo");
      await mockNonRebasingTwo.setCASH(cash.address);

      Labs = await ethers.getContractAt(erc20Abi, addresses.polygon.Labs);
      Team = await ethers.getContractAt(erc20Abi, addresses.polygon.Team);
      primaryStable = await ethers.getContract("MockUSDC");

      uniswapV2PairCASHUSDC = await ethers.getContract("UniswapV2PairCASHUSDC");

  }

  let stratesgiesWithDependencies = {};
  if (isFork) {
    const cDystopiaStrategyUsdcDaiProxy = await ethers.getContract(
      "DystopiaStrategyUsdcDaiProxy"
    );
    const cDystopiaStrategyUsdcDai = await ethers.getContractAt(
      "DystopiaStrategy",
      cDystopiaStrategyUsdcDaiProxy.address
    );

    // console.log("cDystopiaStrategyUsdcDaiProxy.address",cDystopiaStrategyUsdcDaiProxy.address);

    const cDystopiaStrategyUsdcUsdtProxy = await ethers.getContract(
      "DystopiaStrategyUsdcUsdtProxy"
    );
    const cDystopiaStrategyUsdcUsdt = await ethers.getContractAt(
      "DystopiaStrategy",
      cDystopiaStrategyUsdcUsdtProxy.address
    );
    // console.log("cDystopiaStrategyUsdcUsdtProxy.address",cDystopiaStrategyUsdcUsdtProxy.address);

    const cDystopiaStrategyDaiUsdtProxy = await ethers.getContract(
      "DystopiaStrategyDaiUsdtProxy"
    );
    const cDystopiaStrategyDaiUsdt = await ethers.getContractAt(
      "DystopiaStrategy",
      cDystopiaStrategyDaiUsdtProxy.address
    );
    // console.log("cDystopiaStrategyDaiUsdtProxy.address",cDystopiaStrategyDaiUsdtProxy.address);

    const cMeshSwapStrategyUSDCProxy = await ethers.getContract(
      "MeshSwapStrategyUSDCProxy"
    );
    const cMeshSwapStrategyUSDC = await ethers.getContractAt(
      "MeshSwapStrategy",
      cMeshSwapStrategyUSDCProxy.address
    );
    // console.log("cMeshSwapStrategyUSDCProxy.address",cMeshSwapStrategyUSDCProxy.address);

    const cMeshSwapStrategyDAIProxy = await ethers.getContract(
      "MeshSwapStrategyDAIProxy"
    );
    const cMeshSwapStrategyDAI = await ethers.getContractAt(
      "MeshSwapStrategy",
      cMeshSwapStrategyDAIProxy.address
    );
    // console.log("cMeshSwapStrategyDAIProxy.address",cMeshSwapStrategyDAIProxy.address);

    const cMeshSwapStrategyUSDTProxy = await ethers.getContract(
      "MeshSwapStrategyUSDTProxy"
    );
    const cMeshSwapStrategyUSDT = await ethers.getContractAt(
      "MeshSwapStrategy",
      cMeshSwapStrategyUSDTProxy.address
    );
    // console.log("cMeshSwapStrategyUSDTProxy.address",cMeshSwapStrategyUSDTProxy.address);

    const cMeshSwapStrategyUSDCUSDTProxy = await ethers.getContract(
      "MeshSwapStrategyUSDCUSDTProxy"
    );
    const cMeshSwapStrategyUSDCUSDT = await ethers.getContractAt(
      "MeshSwapStrategyDual",
      cMeshSwapStrategyUSDCUSDTProxy.address
    );
    // console.log("cMeshSwapStrategyUSDCUSDTProxy.address",cMeshSwapStrategyUSDCUSDTProxy.address);

    const cMeshSwapStrategyUSDCDAIProxy = await ethers.getContract(
      "MeshSwapStrategyUSDCDAIProxy"
    );
    const cMeshSwapStrategyUSDCDAI = await ethers.getContractAt(
      "MeshSwapStrategyDual",
      cMeshSwapStrategyUSDCDAIProxy.address
    );
    // console.log("cMeshSwapStrategyUSDCDAIProxy.address",cMeshSwapStrategyUSDCDAIProxy.address);

    const cMeshSwapStrategyUSDTDAIProxy = await ethers.getContract(
      "MeshSwapStrategyUSDTDAIProxy"
    );
    const cMeshSwapStrategyUSDTDAI = await ethers.getContractAt(
      "MeshSwapStrategyDual",
      cMeshSwapStrategyUSDTDAIProxy.address
    );
    // console.log("cMeshSwapStrategyUSDTDAIProxy.address",cMeshSwapStrategyUSDTDAIProxy.address);

    const cQuickSwapStrategyUSDCDAIProxy = await ethers.getContract(
      "QuickSwapStrategyUSDCDAIProxy"
    );
    const cQuickSwapStrategyUSDCDAI = await ethers.getContractAt(
      "QuickSwapStrategy",
      cQuickSwapStrategyUSDCDAIProxy.address
    );
    // console.log("cQuickSwapStrategyUSDCDAIProxy.address",cQuickSwapStrategyUSDCDAIProxy.address);

    const cQuickSwapStrategyUSDCUSDTProxy = await ethers.getContract(
      "QuickSwapStrategyUSDCUSDTProxy"
    );
    const cQuickSwapStrategyUSDCUSDT = await ethers.getContractAt(
      "QuickSwapStrategy",
      cQuickSwapStrategyUSDCUSDTProxy.address
    );
    // console.log("cQuickSwapStrategyUSDCUSDTProxy.address",cQuickSwapStrategyUSDCUSDTProxy.address);

    // const cAaveStrategyUSDCProxy = await ethers.getContract(
    //   "AaveStrategyUSDCProxy"
    // );
    // const cAaveStrategyUSDC = await ethers.getContractAt(
    //   "AaveStrategy",
    //   cAaveStrategyUSDCProxy.address
    // );
    // // console.log("cAaveStrategyUSDCProxy.address", cAaveStrategyUSDCProxy.address);

    const cAm3CurveStrategyProxy = await ethers.getContract(
      "Am3CurveStrategyProxy"
    );
    const cAm3CurveStrategy = await ethers.getContractAt(
      "Am3CurveStrategy",
      cAm3CurveStrategyProxy.address
    );
    // console.log("cAm3CurveStrategyProxy.address", cAm3CurveStrategyProxy.address);

    const cAm3CurveStrategyUSDTProxy = await ethers.getContract(
      "Am3CurveStrategyUSDTProxy"
    );
    const cAm3CurveStrategyUSDT = await ethers.getContractAt(
      "Am3CurveStrategy",
      cAm3CurveStrategyUSDTProxy.address
    );
    // console.log("cAm3CurveStrategyUSDTProxy.address", cAm3CurveStrategyUSDTProxy.address);

    const cSynapseStrategyProxy = await ethers.getContract(
      "SynapseStrategyProxy"
    );
    const cSynapseStrategy = await ethers.getContractAt(
      "SynapseStrategy",
      cSynapseStrategyProxy.address
    );
    // console.log("cSynapseStrategyProxy.address", cSynapseStrategyProxy.address);

    const cSynapseStrategyUSDTProxy = await ethers.getContract(
      "SynapseStrategyUSDTProxy"
    );
    const cSynapseStrategyUSDT = await ethers.getContractAt(
      "SynapseStrategy",
      cSynapseStrategyUSDTProxy.address
    );
    // console.log("cSynapseStrategyUSDTProxy.address", cSynapseStrategyUSDTProxy.address);

    const cDodoStrategyProxy = await ethers.getContract(
      "DodoStrategyProxy"
    );
    const cDodoStrategy = await ethers.getContractAt(
      "DodoStrategy",
      cDodoStrategyProxy.address
    );
    // console.log("cDodoStrategyProxy.address", cDodoStrategyProxy.address);

    const cClearpoolWintermuteStrategyProxy = await ethers.getContract(
      "ClearpoolWintermuteStrategyProxy"
    );
    const cClearpoolWintermuteStrategy= await ethers.getContractAt(
      "ClearpoolStrategy",
      cClearpoolWintermuteStrategyProxy.address
    );
    // console.log("cClearpoolStrategy.address", cClearpoolStrategy.address);

    const cGainsDAIStrategyProxy = await ethers.getContract(
      "GainsDAIStrategyProxy"
    );
    const cGainsDAIStrategy= await ethers.getContractAt(
      "GainsStrategy",
      cGainsDAIStrategyProxy.address
    );

    const cTetuUsdcStrategyProxy = await ethers.getContract(
      "TetuStrategyUSDCProxy"
    );
    const cTetuUsdcStrategy= await ethers.getContractAt(
      "TetuStrategy",
      cTetuUsdcStrategyProxy.address
    );

    const cTetuUsdtStrategyProxy = await ethers.getContract(
      "TetuStrategyUSDTProxy"
    );
    const cTetuUsdtStrategy= await ethers.getContractAt(
      "TetuStrategy",
      cTetuUsdtStrategyProxy.address
    );

    const cTetuDaiStrategyProxy = await ethers.getContract(
      "TetuStrategyDAIProxy"
    );
    const cTetuDaiStrategy= await ethers.getContractAt(
      "TetuStrategy",
      cTetuDaiStrategyProxy.address
    );

    const cStargateUsdcStrategyProxy = await ethers.getContract(
      "StargateStrategyUSDCProxy"
    );
    const cStargateUsdcStrategy= await ethers.getContractAt(
      "StargateStrategy",
      cStargateUsdcStrategyProxy.address
    );

    const cStargateUsdtStrategyProxy = await ethers.getContract(
      "StargateStrategyUSDTProxy"
    );
    const cStargateUsdtStrategy= await ethers.getContractAt(
      "StargateStrategy",
      cStargateUsdtStrategyProxy.address
    );

    const cAaveSupplyUsdtStrategyProxy = await ethers.getContract(
      "AaveSupplyStrategyUSDTProxy"
    );
    const cAaveSupplyUsdtStrategy= await ethers.getContractAt(
      "AaveSupplyStrategy",
      cAaveSupplyUsdtStrategyProxy.address
    );
    // console.log("cClearpoolStrategy.address", cClearpoolStrategy.address);

    await runStrategyLogic(governor, "Aave Supply Strategy", cTetuUsdtStrategy.address); 
    strategiesWithDependencies = {
      dystToken: dystToken,
      cDystopiaStrategyUsdcDai: cDystopiaStrategyUsdcDai,
      cDystopiaStrategyUsdcUsdt: cDystopiaStrategyUsdcUsdt,
      cDystopiaStrategyDaiUsdt: cDystopiaStrategyDaiUsdt,
      dystPairUsdcDai: dystPairUsdcDai,
      dystPairUsdcUsdt: dystPairUsdcUsdt,
      dystPairDaiUsdt: dystPairDaiUsdt,
      penroseToken: penroseToken,
      penroseLens: penroseLens,
      cMeshSwapStrategyUSDCUSDT: cMeshSwapStrategyUSDCUSDT,
      cMeshSwapStrategyUSDCDAI: cMeshSwapStrategyUSDCDAI,
      cMeshSwapStrategyUSDTDAI: cMeshSwapStrategyUSDTDAI,
      cMeshSwapStrategyUSDC: cMeshSwapStrategyUSDC,
      cMeshSwapStrategyUSDT: cMeshSwapStrategyUSDT,
      cMeshSwapStrategyDAI: cMeshSwapStrategyDAI,
      meshToken: meshToken,
      meshSwapUsdc: meshSwapUsdc,
      meshSwapDai: meshSwapDai,
      meshSwapUsdt: meshSwapUsdt,
      meshSwapUsdcUsdtPair: meshSwapUsdcUsdtPair,
      meshSwapUsdcDaiPair: meshSwapUsdcDaiPair,
      meshSwapUsdtDaiPair: meshSwapUsdtDaiPair,
      cQuickSwapStrategyUSDCDAI: cQuickSwapStrategyUSDCDAI,
      cQuickSwapStrategyUSDCUSDT: cQuickSwapStrategyUSDCUSDT,
      quickTokenNew: quickTokenNew,
      quickToken: quickToken,
      quickSwapRouter02: quickSwapRouter02,
      quickSwapUSDCDAIPair: quickSwapUSDCDAIPair,
      quickSwapUSDCUSDTPair: quickSwapUSDCUSDTPair,
      quickSwapDragonQuick: quickSwapDragonQuick,
      quickSwapStakingReward: quickSwapStakingReward,
      quickSwapStakingRewardUSDCUSDT: quickSwapStakingRewardUSDCUSDT,
      // cAaveStrategyUSDC: cAaveStrategyUSDC,
      aUSDT: aUSDT,
      aaveLendingPool: aaveLendingPool,
      cAaveSupplyUsdtStrategyProxy: cAaveSupplyUsdtStrategy,
      amDAI: amDAI,
      amUSDC: amUSDC,
      amUSDT: amUSDT,
      aaveVDebtDAI: aaveVDebtDAI,
      aaveVDebtUSDC: aaveVDebtUSDC,
      aaveVDebtUSDT: aaveVDebtUSDT,
      cAm3CurveStrategy: cAm3CurveStrategy,
      cAm3CurveStrategyUSDT: cAm3CurveStrategyUSDT,
      am3crv: am3crv,
      am3CurveGauge: am3CurveGauge,
      crv: crv,
      cSynapseStrategyUSDT: cSynapseStrategyUSDT,
      cSynapseStrategy: cSynapseStrategy,
      SYN: SYN,
      nUSD: nUSD,
      cDodoStrategy: cDodoStrategy,
      usdcLPToken: usdcLPToken,
      DODO: DODO,
      TETU: tetu,
      TetuLPToken: TetuLPToken,
      cTetuUsdcStrategyProxy: cTetuUsdcStrategy,
      cTetuUsdtStrategyProxy: cTetuUsdtStrategy,
      cTetuDaiStrategyProxy: cTetuDaiStrategy,
      STG: STG,
      sUSDC: sUSDC,
      cStargateUsdcStrategyProxy: cStargateUsdcStrategy,
      sUSDT: sUSDT,
      cStargateUsdtStrategyProxy: cStargateUsdtStrategy,
      CPOOL: CPOOL,
      clearpoolWintermuteStrategy: cClearpoolWintermuteStrategy,
      
      clearpoolWinterMutePoolBase: clearpoolWinterMutePoolBase,
      clearpoolAmberPoolBase: clearpoolAmberPoolBase,
      clearpoolAurosPoolBase: clearpoolAurosPoolBase,

      gainsDAIStrategy: cGainsDAIStrategy
      
    };
    
  } else {
    const cMeshSwapStrategyUSDCProxy = await ethers.getContract(
      "MeshSwapStrategyUSDCProxy"
    );
    const cMeshSwapStrategyUSDC = await ethers.getContractAt(
      "MeshSwapStrategy",
      cMeshSwapStrategyUSDCProxy.address
    );
    // // console.log("cMeshSwapStrategyUSDCProxy.address",cMeshSwapStrategyUSDCProxy.address);
    strategiesWithDependencies = {
      cMeshSwapStrategyUSDC: cMeshSwapStrategyUSDC,
    };

  }

  // Matt and Josh each have $100 CASH
  /*for (const user of [matt, josh]) {
    console.log("Depositing 100 USDC to", user.address);
    await usdc.connect(user).approve(vault.address, usdcUnits("100"));
    await vault.connect(user).mint(usdc.address, usdcUnits("100"), 0);
  }*/
  
  let contracts = { cash, vault, vaultAdmin, vaultCore, harvester, dripper, governorContract, wcash, oracleRouter, chainlinkOracleFeedDAI, chainlinkOracleFeedUSDT, chainlinkOracleFeedUSDC, 
                chainlinkOracleFeedETH, rebaseToNonEoaHandler, uniswapV2PairCASHUSDC};
  let assets = {usdt, dai, tusd, usdc, primaryStable, wmatic, nonStandardToken, mockNonRebasing, mockNonRebasingTwo};
  let abis = {erc20Abi};
  let accounts = { matt, josh, rio, anna, governor, strategist, adjuster};
  let feeCollectors = {Labs, Team};

  return {...contracts, ...assets, ...abis, ...accounts, ...feeCollectors, ...strategiesWithDependencies};
}

/**
 * Configure a hacked Vault
 */
 async function hackedVaultFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { vault, oracleRouter } = fixture;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const oracleAddresses = await getOracleAddresses(hre.deployments);

  await deploy("MockEvilDAI", {
    from: governorAddr,
    args: [vault.address, assetAddresses.DAI],
  });

  const evilDAI = await ethers.getContract("MockEvilDAI");

  await oracleRouter.setFeed(
    evilDAI.address,
    oracleAddresses.chainlink.DAI_USD
  );
  await fixture.vault.connect(sGovernor).supportAsset(evilDAI.address);

  fixture.evilDAI = evilDAI;

  return fixture;
}

/**
 * Configure a reborn hack attack
 */
 async function rebornFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const { vault } = fixture;

  await deploy("Sanctum", {
    from: governorAddr,
    args: [assetAddresses.DAI, vault.address],
  });

  const sanctum = await ethers.getContract("Sanctum");

  const encodedCallbackAddress = utils.defaultAbiCoder
    .encode(["address"], [sanctum.address])
    .slice(2);
  const initCode = (await ethers.getContractFactory("Reborner")).bytecode;
  const deployCode = `${initCode}${encodedCallbackAddress}`;

  await sanctum.deploy(12345, deployCode);
  const rebornAddress = await sanctum.computeAddress(12345, deployCode);
  const reborner = await ethers.getContractAt("Reborner", rebornAddress);

  const rebornAttack = async (shouldAttack = true, targetMethod = null) => {
    await sanctum.setShouldAttack(shouldAttack);
    if (targetMethod) await sanctum.setTargetMethod(targetMethod);
    await sanctum.setCASHAddress(fixture.cash.address);
    await sanctum.deploy(12345, deployCode);
  };

  fixture.reborner = reborner;
  fixture.rebornAttack = rebornAttack;

  return fixture;
}

module.exports = {
  defaultFixture,
  hackedVaultFixture,
  rebornFixture
};
