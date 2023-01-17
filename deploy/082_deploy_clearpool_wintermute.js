const { isFork, isPolygonStaging, isMainnet } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "082_deploy_clearpool_wintermute", forceDeploy: isFork || isPolygonStaging || isMainnet , tags: ["test", "main", "mainnet", "deploy_clearpool_wintermute"] ,  dependencies: ["001_core"]},
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
    const dClearpoolWintermuteStrategyProxy = await deployWithConfirmation(
      "ClearpoolWintermuteStrategyProxy"
    );
    const cClearpoolWintermuteStrategyProxy = await ethers.getContractAt(
      "ClearpoolWintermuteStrategyProxy",
      dClearpoolWintermuteStrategyProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dClearpoolStrategyImpl = await deployWithConfirmation("ClearpoolStrategy");
    const cClearpoolStrategy = await ethers.getContractAt(
      "ClearpoolStrategy",
      dClearpoolWintermuteStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cClearpoolWintermuteStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dClearpoolStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new ClearpoolStrategy strategy
    console.log("4. Init and configure new ClearpoolStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address)";
    await withConfirmation(
      cClearpoolStrategy.connect(sDeployer)[initFunction](
        assetAddresses.CPOOL,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.USDC],
        [assetAddresses.clearpoolWinterMutePoolBase],
        assetAddresses.clearpoolRewardProvider,
        assetAddresses.primaryStable,
        await getTxOpts()
      )
    );
  
    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the setOracleRouterSwappingPool")
    const setOracleRouterSwappingPool = "setOracleRouterSwappingPool()";
    await withConfirmation(
      cClearpoolStrategy.connect(sDeployer)[setOracleRouterSwappingPool](
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cClearpoolStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // 6. Harvester to accept the USDC (Redundant)
    // Deploy new Harvester proxy
    const dHarvesterProxy =  await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      dHarvesterProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new ClearpoolStrategy strategy",
      actions: [
        // 1. Accept governance of new ClearpoolStrategy
        {
            contract: cClearpoolStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new ClearpoolStrategy strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cClearpoolStrategy.address],
        },
        // 10. Set harvester address
        {
            contract: cClearpoolStrategy,
            signature: "setHarvesterAddress(address)",
            args: [dHarvesterProxy.address],
        },
        {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cClearpoolWintermuteStrategyProxy.address, true],
        },
      ],
    };
  }
);
