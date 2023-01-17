const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "065_deploy_quickswap_usdc_usdt", forceDeploy: isFork , tags: ["test", "main", "mainnet"] ,  dependencies: ["001_core"]},
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
    const dQuickSwapStrategyUSDCUSDTProxy = await deployWithConfirmation(
      "QuickSwapStrategyUSDCUSDTProxy"
    );
    const cQuickSwapStrategyUSDCUSDTProxy = await ethers.getContractAt(
      "QuickSwapStrategyUSDCUSDTProxy",
      dQuickSwapStrategyUSDCUSDTProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dQuickSwapStrategyImpl = await deployWithConfirmation("QuickSwapStrategy");
    const cQuickSwapStrategy = await ethers.getContractAt(
      "QuickSwapStrategy",
      dQuickSwapStrategyUSDCUSDTProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cQuickSwapStrategyUSDCUSDTProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dQuickSwapStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new QuickSwapStrategy strategy
    console.log("4. Init and configure new QuickSwapStrategy strategy for USDC/USDT")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address,address)";
    await withConfirmation(
      cQuickSwapStrategy.connect(sDeployer)[initFunction](
        assetAddresses.quickTokenNew,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [ assetAddresses.USDC, assetAddresses.USDT],
        [assetAddresses.quickSwapUSDCUSDTPair,assetAddresses.quickSwapUSDCUSDTPair ],
        assetAddresses.USDC,
        assetAddresses.quickSwapRouter02,
        assetAddresses.quickSwapStakingRewardUSDCUSDT,
        assetAddresses.quickSwapDragonQuick,
        await getTxOpts()
      )
    );

    // 5. Setting setOracleRouterPriceProvider
    console.log("5. Setting setOracleRouterPriceProvider")
    const setOracleRouterPriceProvider = "setOracleRouterPriceProvider()";
    await withConfirmation(
      cQuickSwapStrategy.connect(sDeployer)[setOracleRouterPriceProvider](await getTxOpts())
    );

    console.log("5.1. Set the thresholds");
    await withConfirmation(
      cQuickSwapStrategy
        .connect(sDeployer)
        .setThresholds(
          [
            "1000", // token0 - 6 decimals = (1/1000) USDC
            "1000", // token1 - 6 decimals  = (1/1000) USDT
            "1000", // PS - 6 decimals  = (1/1000) USDT
            "0", // QuickPair - 0 LP seems to working fine with QuickSwap
            "1000", // QUICKDRAGON TOKEN - 18 decimals  = (1/100000000000000) QUICKDRAGON
          ],
          await getTxOpts())
    );
    
    // 6. Transfer governance
    console.log("6. Transfer governance")
    await withConfirmation(
      cQuickSwapStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

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
        // 1. Accept governance of new MeshSwapStrategy
        {
            contract: cQuickSwapStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new MeshSwap strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cQuickSwapStrategy.address],
        },
        // 10. Set harvester address
        {
            contract: cQuickSwapStrategy,
            signature: "setHarvesterAddress(address)",
            args: [dHarvesterProxy.address],
        },
        {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cQuickSwapStrategyUSDCUSDTProxy.address, true],
        },
      ],
    };
  }
);
