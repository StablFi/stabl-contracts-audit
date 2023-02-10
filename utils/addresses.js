/* IMPORTANT these are duplicated in `dapp/src/constants/contractAddresses` changes here should
 * also be done there.
 */

const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";

addresses.mainnet = {};

addresses.mainnet.Binance = "0xf977814e90da44bfa03b6295a0616a897441acec";
/* All the Binance addresses. There is not 1 address that has enough of all of the stablecoins and ether.
 * But all together do. In case new ones are added update them from here:
 * https://etherscan.io/accounts/label/binance?subcatid=3-0&size=100&start=0&col=2&order=desc
 */
addresses.mainnet.BinanceAll =
  "0x564286362092d8e7936f0549571a803b203aaced,0xbe0eb53f46cd790cd13851d5eff43d12404d33e8,0xf977814e90da44bfa03b6295a0616a897441acec,0x28c6c06298d514db089934071355e5743bf21d60,0xdfd5293d8e347dfe59e90efd55b2956a1343963d,0x56eddb7aa87536c09ccc2793473599fd21a8b17f,0x21a31ee1afc51d94c2efccaa2092ad1028285549,0x9696f59e4d72e237be84ffd425dcad154bf96976,0x001866ae5b3de6caa5a51543fd9fb64f524f5478,0xab83d182f3485cf1d6ccdd34c7cfef95b4c08da4,0x8b99f3660622e21f2910ecca7fbe51d654a1517d,0x4d9ff50ef4da947364bb9650892b2554e7be5e2b,0xb8c77482e45f1f44de1745f52c74426c631bdd52,0x61189da79177950a7272c88c6058b96d4bcd6be2,0x0681d8db095565fe8a346fa0277bffde9c0edbbf,0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67,0x85b931a32a0725be14285b66f1a22178c672d69b,0x8f22f2063d253846b53609231ed80fa571bc0c8f,0xe0f0cfde7ee664943906f17f7f14342e76a5cec7,0x708396f17127c42383e3b9014072679b2f60b82f,0xd551234ae421e3bcba99a0da6d736074f22192ff,0xfe9e8709d3215310075d67e3ed32a380ccf451c8,0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be";

// Native stablecoins
addresses.mainnet.DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
addresses.mainnet.USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
addresses.mainnet.USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
addresses.mainnet.TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";
// AAVE
addresses.mainnet.AAVE_ADDRESS_PROVIDER =  "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5"; // v2
addresses.mainnet.Aave = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"; // v1-v2
addresses.mainnet.aTUSD = "--"; // Todo: use v2
addresses.mainnet.aUSDT = "--"; // Todo: use v2
addresses.mainnet.aDAI = "0x028171bca77440897b824ca71d1c56cac55b68a3"; // v2
addresses.mainnet.aUSDC = "--"; // Todo: use v2
addresses.mainnet.STKAAVE = "0x4da27a545c0c5b758a6ba100e3a049001de870f5"; // v1-v2
addresses.mainnet.AAVE_INCENTIVES_CONTROLLER =  "0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5"; // v2

// Compound
addresses.mainnet.COMP = "0xc00e94Cb662C3520282E6f5717214004A7f26888";
addresses.mainnet.cDAI = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
addresses.mainnet.cUSDC = "0x39aa39c021dfbae8fac545936693ac917d5e7563";
addresses.mainnet.cUSDT = "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9";
// Curve
addresses.mainnet.CRV = "0xd533a949740bb3306d119cc777fa900ba034cd52";
addresses.mainnet.CRVMinter = "0xd061D61a4d941c39E5453435B6345Dc261C2fcE0";
addresses.mainnet.ThreePool = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
addresses.mainnet.ThreePoolToken = "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490";
addresses.mainnet.ThreePoolGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
// CVX
addresses.mainnet.CVX = "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b";
addresses.mainnet.CRVRewardsPool = "0x689440f2ff927e1f24c72f1087e1faf471ece1c8";
addresses.mainnet.CVXBooster = "0xF403C135812408BFbE8713b5A23a04b3D48AAE31";
// Open Oracle
addresses.mainnet.openOracle = "0x922018674c12a7f0d394ebeef9b58f186cde13c1";
// OGN
addresses.mainnet.OGN = "0x8207c1ffc5b6804f6024322ccf34f29c3541ae26";

// Uniswap router
addresses.mainnet.uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
addresses.mainnet.uniswapV3Router =
  "0xe592427a0aece92de3edee1f18e0157c05861564";
addresses.mainnet.sushiswapRouter =
  "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.mainnet.chainlinkETH_USD =
  "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
addresses.mainnet.chainlinkDAI_USD =
  "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9";
addresses.mainnet.chainlinkUSDC_USD =
  "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6";
addresses.mainnet.chainlinkUSDT_USD =
  "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D";
addresses.mainnet.chainlinkCOMP_USD =
  "0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5";
addresses.mainnet.chainlinkAAVE_USD =
  "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9";
addresses.mainnet.chainlinkCRV_USD =
  "0xcd627aa160a6fa45eb793d19ef54f5062f20f33f";
addresses.mainnet.chainlinkCVX_USD =
  "0xd962fC30A72A84cE50161031391756Bf2876Af5D";
addresses.mainnet.chainlinkOGN_ETH =
  "0x2c881B6f3f6B5ff6C975813F87A4dad0b241C15b";
// DEPRECATED Chainlink
addresses.mainnet.chainlinkDAI_ETH =
  "0x773616E4d11A78F511299002da57A0a94577F1f4";
addresses.mainnet.chainlinkUSDC_ETH =
  "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
addresses.mainnet.chainlinkUSDT_ETH =
  "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";

// WETH Token
addresses.mainnet.WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// Deployed CASH contracts
addresses.mainnet.Guardian = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899"; // ERC 20 owner multisig.
addresses.mainnet.VaultProxy = "0x277e80f3E14E7fB3fc40A9d6184088e0241034bD";
addresses.mainnet.Vault = "0xf251Cb9129fdb7e9Ca5cad097dE3eA70caB9d8F9";
addresses.mainnet.CASHProxy = "";
addresses.mainnet.CASH = "";
addresses.mainnet.CompoundStrategyProxy=
  "0x12115A32a19e4994C2BA4A5437C22CEf5ABb59C3";
addresses.mainnet.CompoundStrategy =
  "0xFaf23Bd848126521064184282e8AD344490BA6f0";
addresses.mainnet.CurveUSDCStrategyProxy =
  "0x67023c56548BA15aD3542E65493311F19aDFdd6d";
addresses.mainnet.CurveUSDCStrategy =
  "0x96E89b021E4D72b680BB0400fF504eB5f4A24327";
addresses.mainnet.CurveUSDTStrategyProxy =
  "0xe40e09cD6725E542001FcB900d9dfeA447B529C0";
addresses.mainnet.CurveUSDTStrategy =
  "0x75Bc09f72db1663Ed35925B89De2b5212b9b6Cb3";

addresses.mainnet.MixOracle = "0x4d4f5e7a1FE57F5cEB38BfcE8653EFFa5e584458";
addresses.mainnet.UniswapOracle = "0xc15169Bad17e676b3BaDb699DEe327423cE6178e";
addresses.mainnet.CompensationClaims =
  "0x9C94df9d594BA1eb94430C006c269C314B1A8281";
addresses.mainnet.Flipper = "0xcecaD69d7D4Ed6D52eFcFA028aF8732F27e08F70";

/* --- RINKEBY --- */
addresses.rinkeby = {};

addresses.rinkeby.OGN = "0xA115e16ef6e217f7a327a57031F75cE0487AaDb8";

// Compound
addresses.rinkeby.cDAI = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
addresses.rinkeby.cUSDC = "0x5b281a6dda0b271e91ae35de655ad301c976edb1";
addresses.rinkeby.cUSDT = "0x2fb298bdbef468638ad6653ff8376575ea41e768";

/* --- POLYGON -- */
addresses.polygon = {};

// Native stablecoins
addresses.polygon.DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
addresses.polygon.USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
addresses.polygon.USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
addresses.polygon.TUSD = "0x2e1ad108ff1d8c782fcbbb89aad783ac49586756";
addresses.polygon.USDP = "0x236eeC6359fb44CCe8f97E99387aa7F8cd5cdE1f";
addresses.polygon.wMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
addresses.polygon.stMATIC = "0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4";

addresses.polygon.primaryStable = addresses.polygon.USDC;

addresses.polygon.chainlinkETH_USD =  "0xF9680D99D6C9589e2a93a78A04A279e509205945";
addresses.polygon.chainlinkDAI_USD =  "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
addresses.polygon.chainlinkUSDC_USD =  "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
addresses.polygon.chainlinkUSDT_USD =  "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
addresses.polygon.chainlinkCOMP_USD =  "0x2A8758b7257102461BC958279054e372C2b1bDE6";
addresses.polygon.chainlinkAAVE_USD =  "0x72484B12719E23115761D5DA1646945632979bB6";
addresses.polygon.chainlinkCRV_USD =  "0x336584C8E6Dc19637A5b36206B1c79923111b405";
addresses.polygon.chainlinkCVX_USD =  "0x5ec151834040B4D453A1eA46aA634C1773b36084";
addresses.polygon.chainlinkOGN_ETH = addresses.dead; // OGN_ETH not present on Polygon

addresses.polygon.uniswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" // SushiSwapRouter
addresses.polygon.sushiswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" // SushiSwapRouter
addresses.polygon.uniswapV3Router =  "0xe592427a0aece92de3edee1f18e0157c05861564";

addresses.polygon.OGN = "0xa63Beffd33AB3a2EfD92a39A7D2361CEE14cEbA8";

addresses.polygon.WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
addresses.polygon.AAVE_ADDRESS_PROVIDER =  "0xd05e3E715d945B59290df0ae8eF85c1BdB684744"; // v2
addresses.polygon.AAVE_INCENTIVES_CONTROLLER =  "0x357D51124f59836DeD84c8a1730D72B749d8BC23"; // v2
addresses.polygon.STKAAVE = "0x4da27a545c0c5b758a6ba100e3a049001de870f5"; // v1-v2

// Curve
addresses.polygon.CRV = "0x172370d5Cd63279eFa6d502DAB29171933a610AF";
addresses.polygon.CRVMinter = "0x445FE580eF8d70FF569aB36e80c647af338db351";

//aave is used as 3pool is not present on polygon
addresses.polygon.ThreePool = "0x445FE580eF8d70FF569aB36e80c647af338db351"; 
addresses.polygon.ThreePoolToken = "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171"; //lp_token
addresses.polygon.ThreePoolGauge = "0x19793B454D3AfC7b454F206Ffe95aDE26cA6912c";

// Dystopia
addresses.polygon.dystToken = "0x39aB6574c289c3Ae4d88500eEc792AB5B947A5Eb";
addresses.polygon.dystPairUsdcDai = "0xFec23508fE4b5d10A3eb0D83b9947CAa56F39463"; //sAMM-USDC/DAI
addresses.polygon.dystPairUsdcUsdt = '0x4570da74232c1A784E77c2a260F85cdDA8e7d47B'; //sAMM-USDC/USDT
addresses.polygon.dystPairDaiUsdt = '0xd8a63f6424165A1dF0152eA3215440D7823a8eb0'; //sAMM-DAI/USDT

addresses.polygon.dystRouter = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e";//DystRouter01
addresses.polygon.dystGuageUsdcDai = "0x9c3Afbc9D0540168C6D4f3dA0F48FeBA6a3A7d2a"; //aka MasterChef USDC/DAI
addresses.polygon.dystGuageUsdcUsdt = "0x7c9716266795a04ae1fbbd017dc2585fbf78076d"; //aka MasterChef USDC/USDT
addresses.polygon.dystGuageDaiUsdt = "0xE712E44EED6B2Eb7C78Ef85c9b3b4C4039450241"; //aka MasterChef DAI/USDT

addresses.polygon.penroseToken = "0x9008D70A5282a936552593f410AbcBcE2F891A97";
addresses.polygon.penroseProxy = "0xc9Ae7Dac956f82074437C6D40f67D6a5ABf3E34b";
addresses.polygon.penroseLens = "0x1432c3553FDf7FBD593a84B3A4d380c643cbf7a2";
addresses.polygon.dystSwapper = "0xf69f73Cac304A0433Ba414819E3e024Fd1Ce4fC8";

// MeshSwap
addresses.polygon.meshToken = '0x82362Ec182Db3Cf7829014Bc61E9BE8a2E82868a';
addresses.polygon.meshSwapRouter = '0x10f4A785F458Bc144e3706575924889954946639';
addresses.polygon.meshSwapUsdcUsdtPair = '0x274EBd0A589445d2759E379277984c19dbF83cFD';
addresses.polygon.meshSwapUsdcDaiPair = '0x051304433837f0655e2a24c38548e85d602c3dc9';
addresses.polygon.meshSwapUsdtDaiPair = '0x67fA408a4CD3F23D1F14414e6292A01bb451c117';

addresses.polygon.meshSwapUsdc = '0x590Cd248e16466F747e74D4cfa6C48f597059704';
addresses.polygon.meshSwapDai = '0xbE068B517e869f59778B3a8303DF2B8c13E05d06';
addresses.polygon.meshSwapUsdt = '0x782D7eC740d997445D62e4463ce64C67c7484497';

// QuickSwap
addresses.polygon.quickTokenNew = '0xB5C064F955D8e7F38fE0460C556a72987494eE17'; // QUICK(NEW)
addresses.polygon.quickToken = '0x831753DD7087CaC61aB5644b308642cc1c33Dc13'; // Possibly an Old Quick Token
addresses.polygon.quickSwapRouter02 = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'; // Router02
addresses.polygon.quickSwapUSDCDAIPair = '0xf04adbf75cdfc5ed26eea4bbbb991db002036bdd'; // LP Token
addresses.polygon.quickSwapUSDCUSDTPair = '0x2cF7252e74036d1Da831d11089D326296e64a728'; // LP Token
addresses.polygon.quickSwapDragonQuick = '0xf28164a485b0b2c90639e47b0f377b4a438a16b1'; // Reward Token
addresses.polygon.quickSwapStakingReward = '0xACb9EB5B52F495F09bA98aC96D8e61257F3daE14'; // getReward() for quickSwapUSDCDAIPair
addresses.polygon.quickSwapStakingRewardUSDCUSDT = '0xAFB76771C98351Aa7fCA13B130c9972181612b54'; // getReward() for quickSwapUSDCUSDTPair

// AAVE V2
addresses.polygon.AAVE =  "0x1d2a0E5EC8E5bBDCA5CB219e649B565d8e5c3360";
addresses.polygon.aavePoolProvider =  "0xd05e3E715d945B59290df0ae8eF85c1BdB684744";
addresses.polygon.aaveDataProvider =  "0x7551b5D2763519d4e37e8B81929D336De671d46d";
addresses.polygon.aaveIncentivesController =  "0x357D51124f59836DeD84c8a1730D72B749d8BC23";
addresses.polygon.amDAI = "0x27F8D03b3a2196956ED754baDc28D73be8830A6e";
addresses.polygon.amUSDC = "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F";
addresses.polygon.amUSDT = "0x60D55F02A771d515e077c9C2403a1ef324885CeC";
addresses.polygon.aaveVDebtDAI =  "0x75c4d1Fb84429023170086f06E682DcbBF537b7d"; // DAI Variable Debt Token
addresses.polygon.aaveVDebtUSDC =  "0x248960A9d75EdFa3de94F7193eae3161Eb349a12"; // USDC Variable Debt Token
addresses.polygon.aaveVDebtUSDT =  "0x8038857FD47108A07d1f6Bf652ef1cBeC279A2f3"; // USDT Variable Debt Token

// Balancer
addresses.polygon.balancerVault =  "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
addresses.polygon.balToken = "0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3",
addresses.polygon.balancerPoolIdUsdcTusdDaiUsdt = "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068",
addresses.polygon.balancerPoolIdWmaticUsdcWethBal =  "0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002",
addresses.polygon.balancerPoolIdWmaticMtaWeth = "0x614b5038611729ed49e0ded154d8a5d3af9d1d9e00010000000000000000001d",
addresses.polygon.balancerPoolIdBoostedAaveUSD = "0x48e6b98ef6329f8f0a30ebb8c7c960330d64808500000000000000000000075b",
addresses.polygon.balancerPoolIdUsdcAmUsdc = "0xf93579002dbe8046c43fefe86ec78b1112247bb8000000000000000000000759",
addresses.polygon.balancerPoolIdDaiAmDai = "0x178e029173417b1f9c8bc16dcec6f697bc323746000000000000000000000758",
addresses.polygon.balancerPoolIdUsdtAmUsdt = "0xff4ce5aaab5a627bf82f4a571ab1ce94aa365ea600000000000000000000075a",  
addresses.polygon.balancerAmUsdToken = "0x48e6B98ef6329f8f0A30eBB8c7C960330d648085", // lp
addresses.polygon.balancerAmUsdcToken = "0xF93579002DBE8046c43FEfE86ec78b1112247BB8",
addresses.polygon.balancerAmDaiToken = "0x178E029173417b1F9C8bC16DCeC6f697bC323746",
addresses.polygon.balancerAmUsdtToken = "0xFf4ce5AAAb5a627bf82f4A571AB1cE94Aa365eA6",
addresses.polygon.balancerAmUsdGauge = "0x1c514fec643add86aef0ef14f4add28cc3425306",
addresses.polygon.balancerRewardHelper = "0xaEb406b0E430BF5Ea2Dc0B9Fe62E4E53f74B3a33";

// a3crv
addresses.polygon.am3crv =  "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171"; // aaveCurve Token
addresses.polygon.am3crvGauge =  "0x20759F567BB3EcDB55c817c9a1d13076aB215EdC"; // Gauge used in polygon.curve.fi/aave 
addresses.polygon.am3crvMinter = "0xabC000d88f23Bb45525E447528DBF656A9D55bf5";
addresses.polygon.am3crvSwap =  "0x445FE580eF8d70FF569aB36e80c647af338db351"; // Curve aPool 

// Synapse
addresses.polygon.synapseStableSwapPool = "0x85fcd7dd0a1e1a9fcd5fd886ed522de8221c3ee5";
addresses.polygon.synapseStakePool = "0x7875af1a6878bda1c129a4e2356a3fd040418be5";
addresses.polygon.synapseStakePoolId = 1;
addresses.polygon.nUSD = '0x7479e1bc2f2473f9e78c89b4210eb6d55d33b645';
addresses.polygon.SYN = '0xf8f9efc0db77d8881500bb06ff5d6abc3070e695';
addresses.polygon.idexExchange = '0x3253A7e75539EdaEb1Db608ce6Ef9AA1ac9126B6'; // May be uniswap compatible, may be the wrong contract

// Tetu
addresses.polygon.TETU = "0x255707B70BF90aa112006E1b07B9AeA6De021424"; // reward token
addresses.polygon.TetuLPToken = "0x80fF4e4153883d770204607eb4aF9994739C72DC"; // LP token (not sure)
addresses.polygon.tetuUsdcSmartVault = "0xeE3B4Ce32A6229ae15903CDa0A5Da92E739685f7"; // Tetu USDC smart vault
addresses.polygon.tetuSmartVault = "0x225084D30cc297F3b177d9f93f5C3Ab8fb6a1454"; // Tetu Smart vault
addresses.polygon.tetuUsdcSwapRouter = "0xBCA055F25c3670fE0b1463e8d470585Fe15Ca819"; // tetu-usdc swap router

addresses.polygon.tetuUsdtSmartVault = "0xE680e0317402ad3CB37D5ed9fc642702658Ef57F"; // tetu-usdc smart vault
addresses.polygon.tetuDaiSmartVault = "0xb4607d4b8ecfafd063b3a3563c02801c4c7366b2"; // tetu-dai smart vault

// Dodo
addresses.polygon.DODO = "0xe4Bf2864ebeC7B7fDf6Eeca9BaCAe7cDfDAffe78";
addresses.polygon.dodoUsdcLPToken = "0x2C5CA709d9593F6Fd694D84971c55fB3032B87AB";
addresses.polygon.dodoV1UsdcUsdtPool = "0x813FddecCD0401c4Fa73B092b074802440544E52";
addresses.polygon.dodoV2DodoUsdtPool = "0x581c7DB44F2616781C86C331d31c1F09db87A746";
addresses.polygon.dodoMineUsdc = "0xCd288Dd48d26a9f671a1a06bcc48c2A3ee800A13";
addresses.polygon.dodoV1Helper = "0xDfaf9584F5d229A9DBE5978523317820A8897C5A";
addresses.polygon.dodoProxy = "0xa222e6a71D1A1Dd5F279805fbe38d5329C1d0e70";
addresses.polygon.dodoApprove = "0x6D310348d5c12009854DFCf72e0DF9027e8cb4f4";

// ClearPool
addresses.polygon.CPOOL = "0xb08b3603C5F2629eF83510E6049eDEeFdc3A2D91"; 
addresses.polygon.clearpoolAmberPoolBase = "0x24b2d3746e39626d4352891ff909d4f3176be245"; // Same contract will be the token
addresses.polygon.clearpoolWinterMutePoolBase = "0x9F8e69786dE448e6805c0f75eadbC9323502b194"; // Same contract will be the token
addresses.polygon.clearpoolAurosPoolBase = "0xb254554636a3ff52e8b2d0f06203921c137e10d5"; // Same contract will be the token
addresses.polygon.clearpoolRewardProvider = "0x215CCa938dF02c9814BE2D39A285B941FbdA79bA"; 

// Gains
addresses.polygon.gainsVaultDai = "0xd7052EC0Fe1fe25b20B7D65F6f3d490fCE58804f";
addresses.polygon.atricrypto3Pool = "0x1d8b86e3d88cdb2d34688e87e72f388cb541b7c8";

// WHALE
addresses.polygon.Binance = "0xf04adbf75cdfc5ed26eea4bbbb991db002036bdd";
addresses.polygon.MaticWhale = "0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245";
/* All the Binance addresses. There is not 1 address that has enough of all of the stablecoins and ether.
 * But all together do. In case new ones are added update them from here:
 * https://etherscan.io/accounts/label/binance?subcatid=3-0&size=100&start=0&col=2&order=desc
 */
addresses.polygon.BinanceAll =
  "0x06959153B974D0D5fDfd87D561db6d8d4FA0bb0B,0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503,0x742d35Cc6634C0532925a3b844Bc454e4438f44e,0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245,0x916ed5586bb328e0ec1a428af060dc3d10919d84,0xda07f1603a1c514b2f4362f3eae7224a9cdefaf9,0x746f4ec5f4e35fea69714d1170629626b1a35afa,0x803b74766d8f79195d4daecf6f2aac31dba78f25,0x7ba7f4773fa7890bad57879f0a1faa0edffb3520,0xc06320d9028f851c6ce46e43f04aff0a426f446c,0x075e72a5edf65f0a5f44699c7654c1a76941ddc8,0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296,0x027193354D9aC0Fda7B14B89100657B4B46D7096,0x8bF1e44B8a6B9cc9F5C12FAEA227a7d98d5f3B61";

// Harvest Treasury & Team
addresses.polygon.mintFeeBps = 25; // 0.25%
addresses.polygon.redeemFeeBps = 25; // 0.25%
addresses.polygon.Labs = "0x569A03632dBDE3b9f108b0552Ea80De00e5A810a"; 
addresses.polygon.LabsFeeBps = 750;
addresses.polygon.Team = "0x0c6A2055da7D001a49bA07AA5303e5c0FF27881B"; 
addresses.polygon.TeamFeeBps = 250;
addresses.polygon.Treasury = "0x9c4927530B1719e063D7E181C6c2e56353204e64"; 
module.exports = addresses;
