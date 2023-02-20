const hre = require("hardhat");
const chai = require("chai");
const { parseUnits, formatUnits } = require("ethers").utils;
const BigNumber = require("ethers").BigNumber;
const { createFixtureLoader } = require("ethereum-waffle");
const IController = require("./abi/IController.json");

const addresses = require("../utils/addresses");
const { utils } = require("ethers");

chai.Assertion.addMethod("approxEqual", function (expected, message) {
  const actual = this._obj;
  chai.expect(actual, message).gte(expected.mul("99999").div("100000"));
  chai.expect(actual, message).lte(expected.mul("100001").div("100000"));
});

chai.Assertion.addMethod(
  "approxBalanceOf",
  async function (expected, contract, message) {
    var user = this._obj;
    var address = user.address || user.getAddress(); // supports contracts too
    const actual = await contract.balanceOf(address);
    expected = parseUnits(expected, await decimalsFor(contract));
    chai.expect(actual).to.approxEqual(expected, message);
  }
);

chai.Assertion.addMethod(
  "balanceOf",
  async function (expected, contract, message) {
    var user = this._obj;
    var address = user.address || user.getAddress(); // supports contracts too
    const actual = await contract.balanceOf(address);
    expected = parseUnits(expected, await decimalsFor(contract));
    chai.expect(actual).to.equal(expected, message);
  }
);

const DECIMAL_CACHE = {};
async function decimalsFor(contract) {
  if (DECIMAL_CACHE[contract.address] != undefined) {
    return DECIMAL_CACHE[contract.address];
  }
  let decimals = await contract.decimals();
  if (decimals.toNumber) {
    decimals = decimals.toNumber();
  }
  DECIMAL_CACHE[contract.address] = decimals;
  return decimals;
}

async function units(amount, contract) {
  return parseUnits(amount, await decimalsFor(contract));
}

function ognUnits(amount) {
  return parseUnits(amount, 18);
}

function cashUnits(amount) {
  return parseUnits(amount, 18);
}
function dystPairUnits(amount) {
  return parseUnits(amount, 12);
}
function penroseUnits(amount) {
  return parseUnits(amount, 18);
}
function cashUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function usdtUnits(amount) {
  return parseUnits(amount, 6);
}

function usdtUnitsFormat(amount) {
  return formatUnits(amount, 6);
}

function usdcUnits(amount) {
  return parseUnits(amount, 6);
}

function meshUnits(amount) {
  return parseUnits(amount, 6);
}
function quickUnits(amount) {
  return parseUnits(amount, 18);
}
function usdcUnitsFormat(amount) {
  return formatUnits(amount, 6);
}

function tusdUnits(amount) {
  return parseUnits(amount, 18);
}

function daiUnits(amount) {
  return parseUnits(amount, 18);
}

function daiUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function ethUnits(amount) {
  return parseUnits(amount, 18);
}

function oracleUnits(amount) {
  return parseUnits(amount, 6);
}

function add(a, b) {
  return (parseFloat(a) + parseFloat(b)).toString();
}
function subtract(a, b) {
  return (parseFloat(a) - parseFloat(b)).toString();
}

function addBig(a, b) {
  a = BigNumber.from(a)
  b = BigNumber.from(b);
  return a.add(b).toString();
}
function subtractBig(a, b) {
  a = BigNumber.from(a)
  b = BigNumber.from(b);
  return a.sub(b).toString();
}

async function expectApproxSupply(contract, expected, message) {
  const balance = await contract.totalSupply();
  // shortcuts the 0 case, since that's neither gt or lt
  if (balance.eq(expected)) {
    return;
  }
  chai.expect(balance, message).gt(expected.mul("999").div("1000"));
  chai.expect(balance, message).lt(expected.mul("1001").div("1000"));
}

async function humanBalance(user, contract) {
  let address = user.address || user.getAddress(); // supports contracts too
  const balance = await contract.balanceOf(address);
  const decimals = await decimalsFor(contract);
  const divisor = BigNumber.from("10").pow(decimals);
  return parseFloat(balance.div(divisor).toString()).toFixed(2);
}

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isRinkeby = hre.network.name === "rinkeby";
const isMainnet = hre.network.name === "mainnet";
const isPolygonStaging = hre.network.name === "polygon_staging";
const isTest = process.env.IS_TEST === "true";
const isSmokeTest = process.env.SMOKE_TEST === "true";
const isMainnetOrFork = isMainnet || isFork;
const isMainnetButNotFork = isMainnet && !isFork;
const isMainnetOrRinkebyOrFork = isMainnetOrFork || isRinkeby;
const isVerificationRequired =  process.env.VERIFY_ON_EXPLORER;
const forceStorageLayoutCheck = process.env.FORCE_STORAGE_LAYOUT_CHECK;

// Fixture loader that is compatible with Ganache
const loadFixture = createFixtureLoader(
  [
    hre.ethers.provider.getSigner(0),
    hre.ethers.provider.getSigner(1),
    hre.ethers.provider.getSigner(2),
    hre.ethers.provider.getSigner(3),
    hre.ethers.provider.getSigner(4),
    hre.ethers.provider.getSigner(5),
    hre.ethers.provider.getSigner(6),
    hre.ethers.provider.getSigner(7),
    hre.ethers.provider.getSigner(8),
    hre.ethers.provider.getSigner(9),
  ],
  hre.ethers.provider
);

const advanceTime = async (seconds) => {
  await hre.ethers.provider.send("evm_increaseTime", [seconds]);
  await hre.ethers.provider.send("evm_mine");
};

const getBlockTimestamp = async () => {
  return (await hre.ethers.provider.getBlock("latest")).timestamp;
};

const advanceBlocks = async (numBlocks) => {
  for (let i = 0; i < numBlocks; i++) {
    await hre.ethers.provider.send("evm_mine");
  }
};

const getOracleAddress = async (deployments) => {
  return (await deployments.get("OracleRouter")).address;
};

/**
 * Sets the price in USD the mix oracle will return for a specific token.
 * This first sets the ETH price in USD, then token price in ETH
 *
 * @param {string} tokenSymbol: "DAI", USDC", etc...
 * @param {number} usdPrice: price of the token in USD.
 * @returns {Promise<void>}
 */
const setOracleTokenPriceUsd = async (tokenSymbol, usdPrice) => {
  // if (isMainnetOrFork) {
  //   throw new Error(
  //     `setOracleTokenPriceUsd not supported on network ${hre.network.name}`
  //   );
  // }
  // Set the chainlink token price in USD, with 8 decimals.
  const tokenFeed = await ethers.getContract(
    "MockChainlinkOracleFeed" + tokenSymbol
  );
  await tokenFeed.setDecimals(8);
  await tokenFeed.setPrice(parseUnits(usdPrice, 8));
};

const getOracleAddresses = async (deployments) => {

  if (isMainnetOrFork) {
    // On mainnet or fork, return mainnet addresses.
    return {
      chainlink: {
        ETH_USD: addresses.polygon.chainlinkETH_USD,
        DAI_USD: addresses.polygon.chainlinkDAI_USD,
        PRIMARYSTABLE_USD: addresses.polygon.chainlinkUSDC_USD,
        USDC_USD: addresses.polygon.chainlinkUSDC_USD,
        USDT_USD: addresses.polygon.chainlinkUSDT_USD,
        COMP_USD: addresses.polygon.chainlinkCOMP_USD,
        AAVE_USD: addresses.polygon.chainlinkAAVE_USD,
        CRV_USD: addresses.polygon.chainlinkCRV_USD,
        CVX_USD: addresses.polygon.chainlinkCVX_USD,
        OGN_ETH: addresses.polygon.chainlinkOGN_ETH,
      },
      openOracle: addresses.mainnet.openOracle, // Deprecated
    };
  } else {
    // On other environments, return mock feeds.
    return {
      chainlink: {
        ETH_USD: (await deployments.get("MockChainlinkOracleFeedETH")).address,
        DAI_USD: (await deployments.get("MockChainlinkOracleFeedDAI")).address,
        USDC_USD: (await deployments.get("MockChainlinkOracleFeedUSDC"))
          .address,
        USDT_USD: (await deployments.get("MockChainlinkOracleFeedUSDT"))
          .address,
        TUSD_USD: (await deployments.get("MockChainlinkOracleFeedTUSD"))
          .address,
        COMP_USD: (await deployments.get("MockChainlinkOracleFeedCOMP"))
          .address,
        AAVE_USD: (await deployments.get("MockChainlinkOracleFeedAAVE"))
          .address,
        CRV_USD: (await deployments.get("MockChainlinkOracleFeedCRV")).address,
        CVX_USD: (await deployments.get("MockChainlinkOracleFeedCVX")).address,
        NonStandardToken_USD: (
          await deployments.get("MockChainlinkOracleFeedNonStandardToken")
        ).address,
      },
    };
  }
};

const getAssetAddresses = async (deployments) => {
  
  if (isMainnetOrFork) {
    return {
      USDT: addresses.polygon.USDT,
      USDC: addresses.polygon.USDC,
      TUSD: addresses.polygon.TUSD,
      USDP: addresses.polygon.USDP,
      DODO: addresses.polygon.DODO,
      TETU: addresses.polygon.TETU,
      STG: addresses.polygon.STG,
      primaryStable: addresses.polygon.primaryStable,

      DAI: addresses.polygon.DAI,
      cDAI: addresses.polygon.cDAI,
      cUSDC: addresses.polygon.cUSDC,
      cUSDT: addresses.polygon.cUSDT,

      WETH: addresses.polygon.WETH,
      wMATIC: addresses.polygon.wMATIC,
      COMP: addresses.polygon.COMP,
      ThreePool: addresses.polygon.ThreePool,
      ThreePoolToken: addresses.polygon.ThreePoolToken,
      ThreePoolGauge: addresses.polygon.ThreePoolGauge,
      CRV: addresses.polygon.CRV,
      CVX: addresses.polygon.CVX,
      CRVMinter: addresses.polygon.CRVMinter,
      aDAI: addresses.polygon.aDAI,
      aDAI_v2: addresses.polygon.aDAI_v2,
      aUSDC: addresses.polygon.aUSDC,
      aUSDT: addresses.polygon.aUSDT,
      AAVE: addresses.polygon.Aave,
      AAVE_TOKEN: addresses.polygon.Aave,
      AAVE_ADDRESS_PROVIDER: addresses.polygon.AAVE_ADDRESS_PROVIDER,
      AAVE_INCENTIVES_CONTROLLER: addresses.polygon.AAVE_INCENTIVES_CONTROLLER,
      STKAAVE: addresses.polygon.STKAAVE,
      OGN: addresses.polygon.OGN,
      uniswapRouter: addresses.polygon.uniswapRouter,
      sushiswapRouter: addresses.polygon.sushiswapRouter,

      dystopiaDystToken: addresses.polygon.dystToken,
      dystopiaDystPairUsdcDai : addresses.polygon.dystPairUsdcDai,
      dystopiaDystPairUsdcUsdt : addresses.polygon.dystPairUsdcUsdt,
      dystopiaDystPairDaiUsdt : addresses.polygon.dystPairDaiUsdt,

      dystopiaGuageUsdcDai: addresses.polygon.dystGuageUsdcDai,
      dystopiaGuageUsdcUsdt: addresses.polygon.dystGuageUsdcUsdt,
      dystopiaGuageDaiUsdt: addresses.polygon.dystGuageDaiUsdt,
      dystopiaDystRouter: addresses.polygon.dystRouter,

      dystopiaPenroseToken: addresses.polygon.penroseToken,
      dystopiaPenroseProxy: addresses.polygon.penroseProxy,
      dystopiaPenroseLens: addresses.polygon.penroseLens,
      dystopiaSwapper: addresses.polygon.dystSwapper,

      meshToken: addresses.polygon.meshToken,
      meshSwapRouter: addresses.polygon.meshSwapRouter,

      meshSwapUsdcUsdtPair: addresses.polygon.meshSwapUsdcUsdtPair,
      meshSwapUsdcDaiPair: addresses.polygon.meshSwapUsdcDaiPair,
      meshSwapUsdtDaiPair: addresses.polygon.meshSwapUsdtDaiPair,
      meshSwapUsdc: addresses.polygon.meshSwapUsdc,
      meshSwapDai: addresses.polygon.meshSwapDai,
      meshSwapUsdt: addresses.polygon.meshSwapUsdt,

      quickTokenNew: addresses.polygon.quickTokenNew,
      quickToken: addresses.polygon.quickToken,
      quickSwapRouter02: addresses.polygon.quickSwapRouter02,
      quickSwapUSDCDAIPair: addresses.polygon.quickSwapUSDCDAIPair,
      quickSwapUSDCUSDTPair: addresses.polygon.quickSwapUSDCUSDTPair,
      quickSwapDragonQuick: addresses.polygon.quickSwapDragonQuick,
      quickSwapStakingReward: addresses.polygon.quickSwapStakingReward,
      quickSwapStakingRewardUSDCUSDT: addresses.polygon.quickSwapStakingRewardUSDCUSDT,

      aave: addresses.polygon.AAVE,
      aavePoolProvider: addresses.polygon.aavePoolProvider,
      aaveDataProvider: addresses.polygon.aaveDataProvider,
      aaveIncentivesController: addresses.polygon.aaveIncentivesController,
      amDAI: addresses.polygon.amDAI,
      amUSDC: addresses.polygon.amUSDC,
      amUSDT: addresses.polygon.amUSDT,
      aaveVDebtDAI: addresses.polygon.aaveVDebtDAI,
      aaveVDebtUSDC: addresses.polygon.aaveVDebtUSDC,
      aaveVDebtUSDT: addresses.polygon.aaveVDebtUSDT,

      aaveLendingPool: addresses.polygon.aaveLendingPool,

      am3crv: addresses.polygon.am3crv,
      am3crvGauge: addresses.polygon.am3crvGauge,
      am3crvSwap: addresses.polygon.am3crvSwap,
      am3crvMinter: addresses.polygon.am3crvMinter,

      synapseStableSwapPool: addresses.polygon.synapseStableSwapPool,
      synapseStakePool: addresses.polygon.synapseStakePool,
      synapseStakePoolId: addresses.polygon.synapseStakePoolId,
      nUSD: addresses.polygon.nUSD,
      SYN: addresses.polygon.SYN,
      idexExchange: addresses.polygon.idexExchange,

      dodoUsdcLPToken: addresses.polygon.dodoUsdcLPToken,
      dodoV1UsdcUsdtPool: addresses.polygon.dodoV1UsdcUsdtPool,
      dodoV2DodoUsdtPool: addresses.polygon.dodoV2DodoUsdtPool,
      dodoMineUsdc: addresses.polygon.dodoMineUsdc,
      dodoV1Helper: addresses.polygon.dodoV1Helper,
      dodoProxy: addresses.polygon.dodoProxy,
      dodoApprove: addresses.polygon.dodoApprove,

      tetuUsdcSmartVault: addresses.polygon.tetuUsdcSmartVault,
      tetuUsdtSmartVault: addresses.polygon.tetuUsdtSmartVault,
      tetuDaiSmartVault: addresses.polygon.tetuDaiSmartVault,
      tetuSmartVault: addresses.polygon.tetuSmartVault,
      tetuUsdcLPToken: addresses.polygon.TetuLPToken,
      tetuUsdcSwapRouter: addresses.polygon.tetuUsdcSwapRouter,

      sUSDC: addresses.polygon.sUSDC,
      sUSDT: addresses.polygon.sUSDT,
      stargateChef: addresses.polygon.stargateChef,
      stargateRouter: addresses.polygon.stargateRouter,
      stgUsdcSwapRouter: addresses.polygon.stgUsdcSwapRouter,

      CPOOL: addresses.polygon.CPOOL,
      clearpoolAmberPoolBase: addresses.polygon.clearpoolAmberPoolBase,
      clearpoolWinterMutePoolBase: addresses.polygon.clearpoolWinterMutePoolBase,
      clearpoolAurosPoolBase: addresses.polygon.clearpoolAurosPoolBase,
      clearpoolRewardProvider: addresses.polygon.clearpoolRewardProvider,

      gainsVaultDai: addresses.polygon.gainsVaultDai,
      atricrypto3Pool: addresses.polygon.atricrypto3Pool,

      balancerVault: addresses.polygon.balancerVault,
      balancerPoolIdUsdcTusdDaiUsdt: addresses.polygon.balancerPoolIdUsdcTusdDaiUsdt,
      balancerPoolIdWmaticUsdcWethBal: addresses.polygon.balancerPoolIdWmaticUsdcWethBal,
      balancerPoolIdWmaticMtaWeth: addresses.polygon.balancerPoolIdWmaticMtaWeth,

      redeemFeeBps: addresses.polygon.redeemFeeBps,
      mintFeeBps: addresses.polygon.mintFeeBps,
      Labs: addresses.polygon.Labs,
      LabsFeeBps: addresses.polygon.LabsFeeBps,
      Team: addresses.polygon.Team,
      TeamFeeBps: addresses.polygon.TeamFeeBps,
      Treasury: addresses.polygon.Treasury,

    };
  } else {
    return {
      USDT: (await deployments.get("MockUSDT")).address,
      USDC: (await deployments.get("MockUSDC")).address,
      TUSD: (await deployments.get("MockTUSD")).address,
      DAI: (await deployments.get("MockDAI")).address,
      NonStandardToken: (await deployments.get("MockNonStandardToken")).address,
      WETH: (await deployments.get("MockWETH")).address,
      ThreePool: (await deployments.get("MockCurvePool")).address,
      ThreePoolToken: (await deployments.get("Mock3CRV")).address,
      ThreePoolGauge: (await deployments.get("MockCurveGauge")).address,
      CRV: (await deployments.get("MockCRV")).address,
      CVX: (await deployments.get("MockCVX")).address,
      CRVMinter: (await deployments.get("MockCRVMinter")).address,
      aDAI: (await deployments.get("MockADAI")).address,
      aUSDC: (await deployments.get("MockAUSDC")).address,
      aUSDT: (await deployments.get("MockAUSDT")).address,
      AAVE: (await deployments.get("MockAave")).address,
      AAVE_TOKEN: (await deployments.get("MockAAVEToken")).address,
      AAVE_ADDRESS_PROVIDER: (await deployments.get("MockAave")).address,
      STKAAVE: (await deployments.get("MockStkAave")).address,
      uniswapRouter: (await deployments.get("MockUniswapRouter")).address,
      sushiswapRouter: (await deployments.get("MockUniswapRouter")).address,
      balancerVault: (await deployments.get("MockBalancer")).address,
      balancerPoolIdUsdcTusdDaiUsdt: addresses.polygon.balancerPoolIdUsdcTusdDaiUsdt,
      balancerPoolIdWmaticUsdcWethBal: addresses.polygon.balancerPoolIdWmaticUsdcWethBal,
      balancerPoolIdWmaticMtaWeth: addresses.polygon.balancerPoolIdWmaticMtaWeth,
      primaryStable: (await deployments.get("MockUSDC")).address,
      redeemFeeBps: addresses.polygon.redeemFeeBps,
      mintFeeBps: addresses.polygon.mintFeeBps,
      Labs: addresses.polygon.Labs,
      LabsFeeBps: addresses.polygon.LabsFeeBps,
      Team: addresses.polygon.Team,
      TeamFeeBps: addresses.polygon.TeamFeeBps,
      Treasury: addresses.polygon.Treasury,

      meshSwapRouter: (await deployments.get("MockMeshSwapRouter")).address,
      meshSwapUsdc: (await deployments.get("MockMeshSwapUniPoolLP")).address,
      meshToken: (await deployments.get("MockMeshToken")).address,

    };
  }
};

async function changeInBalance(
  functionChangingBalance,
  balanceChangeContract,
  balanceChangeAccount
) {
  const balanceBefore = await balanceChangeContract.balanceOf(
    balanceChangeAccount
  );
  await functionChangingBalance();
  const balanceAfter = await balanceChangeContract.balanceOf(
    balanceChangeAccount
  );
  return balanceAfter - balanceBefore;
}

/**
 * Is first parameter's BigNumber value inside expected tolerance
 * @param {BigNumber} bigNumber: The BigNumber whose value is being inspected
 * @param {BigNumber} bigNumberExpected: Expected value of the first BigNumber
 * @param {Float} tolerance: Tolerance expressed in percentages. E.g. 0.05 equals 5%
 *
 * @returns {boolean}
 */
function isWithinTolerance(bigNumber, bigNumberExpected, tolerance) {
  const bgTolerance = bigNumberExpected
    .mul(tolerance * 1000)
    .div(BigNumber.from(1000));
  const lowestAllowed = bigNumberExpected.sub(bgTolerance);
  const highestAllowed = bigNumberExpected.add(bgTolerance);

  return bigNumber.gte(lowestAllowed) && bigNumber.lte(highestAllowed);
}

async function governorArgs({ contract, signature, args = [] }) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10);
  return [tx.to, signature, data];
}

async function proposeArgs(governorArgsArray) {
  const targets = [],
    sigs = [],
    datas = [];
  for (const g of governorArgsArray) {
    const [t, s, d] = await governorArgs(g);
    targets.push(t);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, sigs, datas];
}

async function propose(fixture, governorArgsArray, description) {
  const { governorContract, governor } = fixture;
  const lastProposalId = await governorContract.proposalCount();
  await governorContract
    .connect(governor)
    .propose(...(await proposeArgs(governorArgsArray)), description);
  const proposalId = await governorContract.proposalCount();
  chai.expect(proposalId).not.to.be.equal(lastProposalId);
  return proposalId;
}

async function runStrategyLogic(governor, strategyName, strategyAddress) {
  if (strategyName == 'Tetu Supply Strategy') {

    let governanceAddress = "0xcc16d636dD05b52FF1D8B9CE09B09BC62b11412B"; // governance addr
    // Send some MATIC to governance
    await governor.sendTransaction({
      to: governanceAddress,
      value: utils.parseEther("100"),
    });
    
    console.log("whitelisting Aave Supply Strategy");
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [governanceAddress],
    });
    const governance = await ethers.getSigner(governanceAddress);
    let controller = await ethers.getContractAt(IController, "0x6678814c273d5088114B6E40cC49C8DB04F9bC29"); // controller addr
    await controller.connect(governance).changeWhiteListStatus([strategyAddress], true);
    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [governanceAddress],
    });
  }
}

async function proposeAndExecute(fixture, governorArgsArray, description) {
  const { governorContract, governor } = fixture;
  const proposalId = await propose(fixture, governorArgsArray, description);
  await governorContract.connect(governor).queue(proposalId);
  // go forward 3 days
  await advanceTime(3 * 24 * 60 * 60);
  await governorContract.connect(governor).execute(proposalId);
}

module.exports = {
  add,
  addBig,
  subtract,
  subtractBig,
  cashUnits,
  usdtUnits,
  usdcUnits,
  tusdUnits,
  daiUnits,
  ognUnits,
  ethUnits,
  oracleUnits,
  dystPairUnits,
  penroseUnits,
  quickUnits,
  meshUnits,
  units,
  daiUnitsFormat,
  cashUnitsFormat,
  usdcUnitsFormat,
  usdtUnitsFormat,
  humanBalance,
  expectApproxSupply,
  advanceTime,
  getBlockTimestamp,
  isMainnet,
  isRinkeby,
  isFork,
  isTest,
  isSmokeTest,
  isLocalhost,
  isMainnetOrFork,
  isMainnetOrRinkebyOrFork,
  loadFixture,
  getOracleAddress,
  setOracleTokenPriceUsd,
  getOracleAddresses,
  getAssetAddresses,
  governorArgs,
  proposeArgs,
  propose,
  proposeAndExecute,
  runStrategyLogic,
  advanceBlocks,
  isWithinTolerance,
  changeInBalance,
  isMainnetButNotFork,
  isVerificationRequired,
  forceStorageLayoutCheck,
  isPolygonStaging
};
