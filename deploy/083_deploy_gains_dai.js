const { isFork, isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "083_deploy_gains_dai", forceDeploy: isMainnet || isPolygonStaging || isFork , tags: ["test", "main", "mainnet", "deploy_gains_dai"] ,  dependencies: ["001_core"]},
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
    const dGainsDAIStrategyProxy = await deployWithConfirmation(
      "GainsDAIStrategyProxy"
    );
    const cGainsDAIStrategyProxy = await ethers.getContractAt(
      "GainsDAIStrategyProxy",
      dGainsDAIStrategyProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dGainsStrategyImpl = await deployWithConfirmation("GainsStrategy");
    const cGainsStrategy = await ethers.getContractAt(
      "GainsStrategy",
      dGainsDAIStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cGainsDAIStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dGainsStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new GainsStrategy strategy
    console.log("4. Init and configure new GainsStrategy for USDC")

    const initFunction =
      "initialize(address,address,address[],address[],address[],address[],address,address)";
    await withConfirmation(
      cGainsStrategy.connect(sDeployer)[initFunction](
        assetAddresses.DAI,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.DAI],
        [assetAddresses.DAI],
        [oracleAddresses.chainlink.DAI_USD, oracleAddresses.chainlink.PRIMARYSTABLE_USD],
        assetAddresses.gainsVaultDai,
        assetAddresses.primaryStable,
        await getTxOpts()
      )
    );
  
    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the Swapper")
    const setOracleRouterSwappingPool = "setOracleRouterSwappingPool()";
    await withConfirmation(
      cGainsStrategy.connect(sDeployer)[setOracleRouterSwappingPool](
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cGainsStrategy
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
      name: "Switch to new GainsStrategy strategy",
      actions: [
        // 1. Accept governance of new GainsStrategy
        {
            contract: cGainsStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new GainsStrategy strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cGainsStrategy.address],
        },
        // 10. Set harvester address
        {
            contract: cGainsStrategy,
            signature: "setHarvesterAddress(address)",
            args: [dHarvesterProxy.address],
        },
        {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cGainsDAIStrategyProxy.address, true],
        },
      ],
    };
  }
);
