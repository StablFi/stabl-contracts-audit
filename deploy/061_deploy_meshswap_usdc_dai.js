const { deploymentWithProposal } = require("../utils/deploy");
const { isFork } = require("../test/helpers");

module.exports = deploymentWithProposal(
  { deployName: "061_deploy_meshswap_usdc_dai", forceDeploy: isFork , tags: ["test", "main", "mainnet"],  dependencies: ["001_core"] },
  async ({
    oracleAddresses,
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    const cVaultCore = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );

    // Deployer Actions
    // ----------------

    console.log("1. Deploy new proxy")
    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dMeshSwapStrategyUSDCDAIProxy = await deployWithConfirmation(
      "MeshSwapStrategyUSDCDAIProxy"
    );
    const cMeshSwapStrategyUSDCDAIProxy = await ethers.getContractAt(
      "MeshSwapStrategyUSDCDAIProxy",
      dMeshSwapStrategyUSDCDAIProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dMeshSwapStrategyDualImpl = await deployWithConfirmation("MeshSwapStrategyDual");
    const cMeshSwapStrategyDual = await ethers.getContractAt(
      "MeshSwapStrategyDual",
      dMeshSwapStrategyUSDCDAIProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cMeshSwapStrategyUSDCDAIProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dMeshSwapStrategyDualImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
     // 4. Init and configure new MeshSwapStrategyDual strategy
     console.log("4. Init and configure new MeshSwapStrategyDual strategy for USDC/DAI")
     const initFunction =
       "initialize(address,address,address[],address[],address[],address,address,address[])";
     await withConfirmation(
       cMeshSwapStrategyDual.connect(sDeployer)[initFunction](
         assetAddresses.meshToken,
         cVaultProxy.address,
         [assetAddresses.USDC],
         [ assetAddresses.USDC, assetAddresses.DAI],
         [assetAddresses.meshSwapUsdcDaiPair,assetAddresses.meshSwapUsdcDaiPair ],
         assetAddresses.meshSwapRouter,
         assetAddresses.USDC,
         [
           oracleAddresses.chainlink.PRIMARYSTABLE_USD,
           oracleAddresses.chainlink.USDC_USD,
           oracleAddresses.chainlink.DAI_USD,
         ],
         await getTxOpts()
       )
     );
 
    // 5. Setting setOracleRouterPriceProvider
    console.log("5. Setting setOracleRouterPriceProvider")
    const setOracleRouterPriceProvider = "setOracleRouterPriceProvider()";
    await withConfirmation(
      cMeshSwapStrategyDual.connect(sDeployer)[setOracleRouterPriceProvider](await getTxOpts())
    );

    console.log("4.3. Set the thresholds");
    await withConfirmation(
      cMeshSwapStrategyDual
        .connect(sDeployer)
        .setThresholds(
          [
            "1000", // token0 - 18 decimals = (1/1000) USDC
            "100000000000000", // token1 - 6 decimals  = (1/1000) DAI
            "1000", // PS - 6 decimals  = (1/1000) USDT
            "0", // MeshPair - 6 decimals  = (1/1000) MeshPair
            "10000000000000", // MeshToken - 18 decimals  = (1/10000) Mesh
          ], 
          await getTxOpts())
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cMeshSwapStrategyDual
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // 6. Harvester to accept the USDC (Redundant)
    // Deploy new Harvester proxy
    const dHarvesterProxy =  await ethers.getContract("HarvesterProxy");
    console.log(`Harvester proxy deployed at: ${dHarvesterProxy.address}`);

    const cHarvester = await ethers.getContractAt(
      "Harvester",
      dHarvesterProxy.address
    );

    console.log("Initialized HarvesterProxy...");

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new MeshSwapUSDC strategy",
      actions: [
        // 1. Accept governance of new MeshSwapStrategyUSDC
        {
            contract: cMeshSwapStrategyDual,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new MeshSwapUSDC strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cMeshSwapStrategyDual.address],
        },
        
        // 10. Set harvester address
        {
            contract: cMeshSwapStrategyDual,
            signature: "setHarvesterAddress(address)",
            args: [dHarvesterProxy.address],
        },
        {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cMeshSwapStrategyUSDCDAIProxy.address, true],
        },
      ],
    };
  }
);
