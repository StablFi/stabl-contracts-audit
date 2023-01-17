// JUST FOR MIGRATION PURPOSES

var polygon = {};
// Native stablecoins
polygon.DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
polygon.USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
polygon.USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
polygon.TUSD = "0x2e1ad108ff1d8c782fcbbb89aad783ac49586756";
polygon.USDP = "0x236eeC6359fb44CCe8f97E99387aa7F8cd5cdE1f";
polygon.MATIC = "0x0000000000000000000000000000000000001010";
polygon.MATICX = "0xfa68FB4628DFF1028CFEc22b4162FCcd0d45efb6";
polygon.MAI = "0xa3fa99a148fa48d14ed51d610c367c61876997f1";
polygon.wMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
polygon.wETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
polygon.stMATIC = "0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4";

polygon.primaryStable = polygon.USDC;

polygon.chainlinkETH_USD = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
polygon.chainlinkMATIC_USD = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
polygon.chainlinkDAI_USD = "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
polygon.chainlinkUSDC_USD = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
polygon.chainlinkUSDT_USD = "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
polygon.chainlinkCOMP_USD = "0x2A8758b7257102461BC958279054e372C2b1bDE6";
polygon.chainlinkAAVE_USD = "0x72484B12719E23115761D5DA1646945632979bB6";
polygon.chainlinkCRV_USD = "0x336584C8E6Dc19637A5b36206B1c79923111b405";
polygon.chainlinkCVX_USD = "0x5ec151834040B4D453A1eA46aA634C1773b36084";
polygon.chainlinkSTMATIC_USD = "0x97371dF4492605486e23Da797fA68e55Fc38a13f"; // Calculated stMATIC / USD
polygon.chainlinkMATICX_USD = "0x5d37E4b374E6907de8Fc7fb33EE3b0af403C7403"; // Calculated MATICX / USD
polygon.chainlinkMAI_USD = "0xd8d483d813547CfB624b8Dc33a00F2fcbCd2D428"; // Calculated MIMATIC / USD / USD

polygon.uniswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"; // SushiSwapRouter
polygon.sushiswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"; // SushiSwapRouter
polygon.uniswapV3Router = "0xe592427a0aece92de3edee1f18e0157c05861564";

polygon.OGN = "0xa63Beffd33AB3a2EfD92a39A7D2361CEE14cEbA8";

polygon.WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
polygon.AAVE_ADDRESS_PROVIDER = "0xd05e3E715d945B59290df0ae8eF85c1BdB684744"; // v2
polygon.AAVE_INCENTIVES_CONTROLLER =
  "0x357D51124f59836DeD84c8a1730D72B749d8BC23"; // v2
polygon.STKAAVE = "0x4da27a545c0c5b758a6ba100e3a049001de870f5"; // v1-v2

// Curve
polygon.CRV = "0x172370d5Cd63279eFa6d502DAB29171933a610AF";
polygon.CRVMinter = "0x445FE580eF8d70FF569aB36e80c647af338db351";
polygon.crvLPToken = "0xe7CEA2F6d7b120174BF3A9Bc98efaF1fF72C997d"; // (LP token)
polygon.crvRouter =  "0xFb6FE7802bA9290ef8b00CA16Af4Bc26eb663a28"; // pool / router
polygon.crvGauge =  "0x9633E0749faa6eC6d992265368B88698d6a93Ac0"; // Gauge used in polygon.curve.fi/aave 
polygon.crvLidoToken = "0xc3c7d422809852031b44ab29eec9f1eff2a58756"; // Lido DAO Token (PoS)

//aave is used as 3pool is not present on polygon
polygon.ThreePool = "0x445FE580eF8d70FF569aB36e80c647af338db351";
polygon.ThreePoolToken = "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171"; //lp_token
polygon.ThreePoolGauge = "0x19793B454D3AfC7b454F206Ffe95aDE26cA6912c";

// Dystopia
polygon.dystToken = "0x39aB6574c289c3Ae4d88500eEc792AB5B947A5Eb";
polygon.dystPairUsdcDai = "0xFec23508fE4b5d10A3eb0D83b9947CAa56F39463"; //sAMM-USDC/DAI
polygon.dystPairUsdcUsdt = "0x4570da74232c1A784E77c2a260F85cdDA8e7d47B"; //sAMM-USDC/USDT
polygon.dystPairDaiUsdt = "0xd8a63f6424165A1dF0152eA3215440D7823a8eb0"; //sAMM-DAI/USDT
polygon.dystPairWmaticUsdc = "0x380615F37993B5A96adF3D443b6E0Ac50a211998"; //sAMM-WMATIC/USDC
polygon.dystPairWmaticUsdcVolatile = "0x60c088234180b36edcec7aa8aa23912bb6bed114"; //vAMM-WMATIC/USDC
polygon.dystPairWmaticStMatic = "0x1237fea0b26f68191d50900bffd85e142697c423";
polygon.dystPairUsdMai = "0x5a31f830225936ca28547ec3018188af44f21467";
polygon.dystPairWmaticMaticx = "0xadb2395fec4d096b5086d3daf8b33f9f7568ba25"; // WMATIC/MATICX
polygon.dystGaugeUsdMai = "0x9d4D5885Ae53CA9420d40A3daE3d2b826Ec75128";
polygon.dystGaugeWmaticMaticx = "0xfE63fE0b8E21FF1Ab82C1CE1167004ff65a5Eb56";
polygon.dystPairUsdcWethVolatile = "0xCE1923D2242BBA540f1d56c8E23b1FBEAe2596dc"; //vAMM-USDC/WETH

polygon.dystRouter = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"; //DystRouter01

polygon.dystGuageUsdcDai = "0x9c3Afbc9D0540168C6D4f3dA0F48FeBA6a3A7d2a"; //aka MasterChef USDC/DAI
polygon.dystGuageUsdcUsdt = "0x7c9716266795a04ae1fbbd017dc2585fbf78076d"; //aka MasterChef USDC/USDT
polygon.dystGuageDaiUsdt = "0xE712E44EED6B2Eb7C78Ef85c9b3b4C4039450241"; //aka MasterChef DAI/USDT
polygon.dystGuageWmaticUsdc = "0x74E240a8E9faa4793f7cee04f9ba3dAD299E4985"; // Stable
polygon.dystGuageWmaticUsdcVolatile = "0x8831E6aC8f05d1Fe61f6eA03828f5357283Dd785"; // Volatile
polygon.dystGuageUsdcWethVolatile =
  "0x56D1f8989b3106824B0ACdb39390A96CfacCfa5f";
polygon.dystGuageWmaticStMatic = "0x927cbd8e773844112a1a7d6c371195a11dadd812"; // Accepts Stable DystPair. Not sure about Volatile

polygon.penroseToken = "0x9008D70A5282a936552593f410AbcBcE2F891A97";
polygon.penroseProxy = "0xc9Ae7Dac956f82074437C6D40f67D6a5ABf3E34b"; // Penrose Router
polygon.penroseLens = "0x1432c3553FDf7FBD593a84B3A4d380c643cbf7a2";
polygon.dystSwapper = "0xf69f73Cac304A0433Ba414819E3e024Fd1Ce4fC8";

// MeshSwap
polygon.meshToken = "0x82362Ec182Db3Cf7829014Bc61E9BE8a2E82868a";
polygon.meshSwapRouter = "0x10f4A785F458Bc144e3706575924889954946639";
polygon.meshSwapHelper = "0x8Fed083364938080dc126e32290907296E57af49";
polygon.meshSwapUsdcUsdtPair = "0x274EBd0A589445d2759E379277984c19dbF83cFD";
polygon.meshSwapUsdcDaiPair = "0x051304433837f0655e2a24c38548e85d602c3dc9";
polygon.meshSwapUsdtDaiPair = "0x67fA408a4CD3F23D1F14414e6292A01bb451c117";
polygon.meshSwapMaticUsdcPair = "0x6Ffe747579eD4E807Dec9B40dBA18D15226c32dC";
polygon.meshSwapMaticUsdtPair = "0x24af68fF6e3501EAf8b52a9F7935225E524FE617";
polygon.meshSwapMAIUSDPair = "0x493a4b908674c0638291bdae82b6147df52431cc";

polygon.meshSwapUsdc = "0x590Cd248e16466F747e74D4cfa6C48f597059704";
polygon.meshSwapDai = "0xbE068B517e869f59778B3a8303DF2B8c13E05d06";
polygon.meshSwapUsdt = "0x782D7eC740d997445D62e4463ce64C67c7484497";
polygon.meshSwapWeth = "0x865824c7ddf5a7486fe048bbba2425d9c1f4903d";

// QuickSwap
polygon.quickTokenNew = "0xB5C064F955D8e7F38fE0460C556a72987494eE17"; // QUICK(NEW)
polygon.quickToken = "0x831753DD7087CaC61aB5644b308642cc1c33Dc13"; // Possibly an Old Quick Token
polygon.quickSwapRouter02 = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // Router02
polygon.quickSwapUSDCDAIPair = "0xf04adbf75cdfc5ed26eea4bbbb991db002036bdd"; // LP Token
polygon.quickSwapUSDCUSDTPair = "0x2cF7252e74036d1Da831d11089D326296e64a728"; // LP Token
polygon.quickSwapWMATICUSDCPair = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // LP Token -- INVALID

polygon.quickSwapUSDCWETHPair = "0x2cF7252e74036d1Da831d11089D326296e64a728"; // LP Token

polygon.quickSwapDragonQuick = "0xf28164a485b0b2c90639e47b0f377b4a438a16b1"; // Reward Token
polygon.quickSwapStakingReward = "0xACb9EB5B52F495F09bA98aC96D8e61257F3daE14"; // getReward() for quickSwapUSDCDAIPair
polygon.quickSwapStakingRewardUSDCUSDT =
  "0xAFB76771C98351Aa7fCA13B130c9972181612b54"; // getReward() for quickSwapUSDCUSDTPair

polygon.quickSwapMAIUSDTPair = "0xE89faE1B4AdA2c869f05a0C96C87022DaDC7709a";
polygon.quickSwapStakingRewardMAIUSDT = "0x06e49078b1900a8489462cd2355ed8c09f507499";

polygon.quickswapV3WMATICUSDCPool = "0xAE81FAc689A1b4b1e06e7ef4a2ab4CD8aC0A087D";
polygon.quickswapV3NftPositionManager = "0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6";

// AAVE V2
polygon.AAVE = "0x1d2a0E5EC8E5bBDCA5CB219e649B565d8e5c3360";
polygon.aavePoolProvider = "0xd05e3E715d945B59290df0ae8eF85c1BdB684744";
polygon.aaveDataProvider = "0x7551b5D2763519d4e37e8B81929D336De671d46d";
polygon.aaveIncentivesController = "0x357D51124f59836DeD84c8a1730D72B749d8BC23";
polygon.amDAI = "0x27F8D03b3a2196956ED754baDc28D73be8830A6e";
polygon.amUSDC = "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F";
polygon.amUSDT = "0x60D55F02A771d515e077c9C2403a1ef324885CeC";
polygon.aaveVDebtDAI = "0x75c4d1Fb84429023170086f06E682DcbBF537b7d"; // DAI Variable Debt Token
polygon.aaveVDebtUSDC = "0x248960A9d75EdFa3de94F7193eae3161Eb349a12"; // USDC Variable Debt Token
polygon.aaveVDebtUSDT = "0x8038857FD47108A07d1f6Bf652ef1cBeC279A2f3"; // USDT Variable Debt Token

// AAVE v3
polygon.aaveV3Pool = "0x794a61358d6845594f94dc1db02a252b5b4814ad";
polygon.aPoolV3WETH = "0xe50fa9b3c56ffb159cb0fca61f5c9d750e8128c8";

// Balancer
polygon.balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
polygon.balancerPoolIdUsdcTusdDaiUsdt = "0x0d34e5dd4d8f043557145598e4e2dc286b35fd4f000000000000000000000068";
polygon.balancerPoolIdWmaticUsdcWethBal = "0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002";
polygon.balancerPoolIdWmaticMtaWeth = "0x614b5038611729ed49e0ded154d8a5d3af9d1d9e00010000000000000000001d";
polygon.balancerPoolIdWmaticStMaticBmatic = "0x8159462d255c1d24915cb51ec361f700174cd99400000000000000000000075d";
polygon.balancerToken = "0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3";
polygon.balancerLpTokenWmaticStmatic = "0x8159462d255C1D24915CB51ec361F700174cD994";
polygon.balancerGaugeWmaticStmatic = "0x2aa6fb79efe19a3fce71c46ae48efc16372ed6dd";
polygon.markleOrchid = "0x0f3e0c4218b7b0108a3643cfe9d3ec0d4f57c54e";
polygon.balancerHelpers = "0x239e55F427D44C3cc793f49bFB507ebe76638a2b";

  // a3crv
polygon.am3crv = "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171"; // aaveCurve Token
polygon.am3crvGauge = "0x20759F567BB3EcDB55c817c9a1d13076aB215EdC"; // Gauge used in polygon.curve.fi/aave
polygon.am3crvMinter = "0xabC000d88f23Bb45525E447528DBF656A9D55bf5";
polygon.am3crvSwap = "0x445FE580eF8d70FF569aB36e80c647af338db351"; // Curve aPool
polygon.amUSDC = "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F"; 

// MAI + Am3Cuve
polygon.mai3pool = "0x447646e84498552e62ecf097cc305eabfff09308";
polygon.mai3poolGuage = "0x93db264ee9c42092dc963517885be167b5bf62db";

// Synapse
polygon.synapseStableSwapPool = "0x85fcd7dd0a1e1a9fcd5fd886ed522de8221c3ee5";
polygon.synapseStakePool = "0x7875af1a6878bda1c129a4e2356a3fd040418be5";
polygon.synapseStakePoolId = 1;
polygon.nUSD = "0x7479e1bc2f2473f9e78c89b4210eb6d55d33b645";
polygon.SYN = "0xf8f9efc0db77d8881500bb06ff5d6abc3070e695";
polygon.idexExchange = "0x3253A7e75539EdaEb1Db608ce6Ef9AA1ac9126B6"; // May be uniswap compatible, may be the wrong contract

// Dodo
polygon.DODO = "0xe4Bf2864ebeC7B7fDf6Eeca9BaCAe7cDfDAffe78";
polygon.dodoUsdcLPToken = "0x2C5CA709d9593F6Fd694D84971c55fB3032B87AB";
polygon.dodoV1UsdcUsdtPool = "0x813FddecCD0401c4Fa73B092b074802440544E52";
polygon.dodoV2DodoUsdtPool = "0x581c7DB44F2616781C86C331d31c1F09db87A746";
polygon.dodoMineUsdc = "0xCd288Dd48d26a9f671a1a06bcc48c2A3ee800A13";
polygon.dodoV1Helper = "0xDfaf9584F5d229A9DBE5978523317820A8897C5A";
polygon.dodoProxy = "0xa222e6a71D1A1Dd5F279805fbe38d5329C1d0e70";
polygon.dodoApprove = "0x6D310348d5c12009854DFCf72e0DF9027e8cb4f4";

// WHALE
polygon.Binance = "0xf04adbf75cdfc5ed26eea4bbbb991db002036bdd";
polygon.MaticWhale = "0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245";
/* All the Binance addresses. There is not 1 address that has enough of all of the stablecoins and ether.
 * But all together do. In case new ones are added update them from here:
 * https://etherscan.io/accounts/label/binance?subcatid=3-0&size=100&start=0&col=2&order=desc
 */
polygon.BinanceAll =

  "0xfa0b641678f5115ad8a8de5752016bd1359681b9,0xd9952dc091e7cf5ec199c431c69cec8573710333,0xdeD8C5159CA3673f543D0F72043E4c655b35b96A,0xba12222222228d8ba445958a75a0704d566bf2c8,0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503,0x742d35Cc6634C0532925a3b844Bc454e4438f44e,0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245,0x916ed5586bb328e0ec1a428af060dc3d10919d84,0xda07f1603a1c514b2f4362f3eae7224a9cdefaf9,0x746f4ec5f4e35fea69714d1170629626b1a35afa,0x803b74766d8f79195d4daecf6f2aac31dba78f25,0x7ba7f4773fa7890bad57879f0a1faa0edffb3520,0xc06320d9028f851c6ce46e43f04aff0a426f446c,0x075e72a5edf65f0a5f44699c7654c1a76941ddc8,0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296,0x027193354D9aC0Fda7B14B89100657B4B46D7096,0x8bF1e44B8a6B9cc9F5C12FAEA227a7d98d5f3B61";

// Harvest Treasury & Team
polygon.Treasury = "0xdcb6C74A2E67fdeA27eB04637E7E87663F65e62a";

// Apeswap
polygon.bananaToken = "0x5d47bAbA0d66083C52009271faF3F50DCc01023C";
polygon.apeswapRouterV2 = "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607";
polygon.apeswapPairWMATICUSDT = "0x65D43B64E3B31965Cd5EA367D4c2b94c03084797";
polygon.apeswapPairWMATICUSDTPoolId = 3;
polygon.apeswapPairWMATICDAI = "0xd32f3139A214034A0f9777c87eE0a064c1FF6AE2";
polygon.apeswapPairWMATICDAIPoolId = 2;
polygon.apeswapPairStake = "0x54aff400858dcac39797a81894d9920f16972d1d";

// Sushi
polygon.sushiRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
polygon.sushiPairWMATICUSDT = "0x55FF76BFFC3Cdd9D5FdbBC2ece4528ECcE45047e";
polygon.sushiPairWMATICUSDC = "0xcd353F79d9FADe311fC3119B841e1f456b54e858";
polygon.sushiPairWMATICDAI  = "0x8929D3FEa77398F64448c85015633c2d6472fB29";

// Kyber
polygon.KNC = "0x1C954E8fe737F99f68Fa1CCda3e51ebDB291948C";
polygon.kyberNFTPositionManager = "0x2B1c7b41f6A8F2b2bc45C3233a5d5FB3cD6dC9A8";
polygon.kyberPoolWMATICUSDC = "0x50FEEdF7fB2F511112287091819F21eb0F3Ce498"; // 1% fee
polygon.kyberPoolWMATICUSDCStakePoolId = 50;
polygon.kyberElasticLiquidityMining = "0xbdec4a045446f583dc564c0a227ffd475b329bf0";
polygon.kyberClassicRouter = "0x546C79662E028B661dFB4767664d0273184E4dD1";
polygon.kyberClassisWMATICUSDCPool = "0x37e6449B0e99BeFD2A708eA048d970F4FF4dC65d"; // Used in swapper for KNC->WMATIC

polygon.kyberPoolUSDCMAI = "0x547139695C0a5F0FFb0eD2BEA9507257E0fD2a2a"; // 0.04% fee
polygon.kyberPoolUSDCMAIStakePoolId = 	44;

// HOP
polygon.HOP = "0xc5102fe9359fd9a28f877a67e36b0f050d81a3cc";
polygon.HopETHLP = "0x971039bf0a49c8d8a675f839739ee7a42511ec91";
polygon.HopETHRewards = "0xaa7b3a4a084e6461d486e53a03cf45004f0963b7";
polygon.HopETHRouter = "0x266e2dc3c4c59e42aa07afee5b09e964cffe6778";

module.exports = polygon;
