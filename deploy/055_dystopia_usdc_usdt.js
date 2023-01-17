const { deploymentWithProposal } = require("../utils/deploy");
const { isFork } = require("../test/helpers");

module.exports = deploymentWithProposal(
  { deployName: "055_dystopia_usdc_usdt", forceDeploy: isFork, tags: ["test", "main", "mainnet"], dependencies: ["001_core"] },
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
    const dDystopiaStrategyUsdcUsdtProxy = await deployWithConfirmation(
      "DystopiaStrategyUsdcUsdtProxy"
    );
    const cDystopiaStrategyUsdcUsdtProxy = await ethers.getContractAt(
      "DystopiaStrategyUsdcUsdtProxy",
      dDystopiaStrategyUsdcUsdtProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dDystopiaStrategyImpl = await deployWithConfirmation("DystopiaStrategy");
    const cDystopiaStrategy = await ethers.getContractAt(
      "DystopiaStrategy",
      dDystopiaStrategyUsdcUsdtProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cDystopiaStrategyUsdcUsdtProxy
        .connect(sDeployer)
      ["initialize(address,address,bytes)"](
        dDystopiaStrategyImpl.address,
        deployerAddr,
        [],
        await getTxOpts()
      )
    );
    // 4. Init and configure new Dystopia strategy
    console.log("4. Init and configure new Dystopia strategy")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address)";
    await withConfirmation(
      cDystopiaStrategy.connect(sDeployer)[initFunction](
        assetAddresses.dystopiaDystToken,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.dystopiaDystPairUsdcUsdt,
          assetAddresses.dystopiaDystPairUsdcUsdt,
        ],
        assetAddresses.USDC,
        assetAddresses.wMATIC,
        await getTxOpts()
      )
    );

    // 5. Setting params
    console.log("5. Setting params")
    await withConfirmation(
      cDystopiaStrategy
        .connect(sDeployer)
        .setParams(
          assetAddresses.dystopiaGuageUsdcUsdt,
          assetAddresses.dystopiaDystPairUsdcUsdt,
          assetAddresses.dystopiaDystRouter,
          assetAddresses.balancerVault,
          assetAddresses.balancerPoolIdUsdcTusdDaiUsdt,
          assetAddresses.dystopiaPenroseProxy,
          assetAddresses.dystopiaPenroseLens,
          assetAddresses.dystopiaPenroseToken,

          await getTxOpts())
    );
    // 5. Setting setOracleRouterPriceProvider
    console.log("5. Setting setOracleRouterPriceProvider")
    const setOracleRouterPriceProvider = "setOracleRouterPriceProvider()";
    await withConfirmation(
      cDystopiaStrategy.connect(sDeployer)[setOracleRouterPriceProvider](await getTxOpts())
    );
    console.log("6. Set the thresholds");
    await withConfirmation(
      cDystopiaStrategy
        .connect(sDeployer)
        .setThresholds(
          [
            "1000", // token0 - 6 decimals
            "1000", // token1 - 6 decimals
            "1000", // PS - 6 decimals
            "1000000"], // DystPair - 18 decimals = (1/1000000000000) DystPair
          await getTxOpts())
    );

    // 5. Transfer governance
    await withConfirmation(
      cDystopiaStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    const harvesterProxy = await ethers.getContract("HarvesterProxy");
    console.log(`Harvester proxy deployed at: ${harvesterProxy.address}`);
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      harvesterProxy.address
    );
    console.log("Initialized HarvesterProxy...");
    // Governance Actions
    // ----------------
    return {
      name: "Switch to new Dystopia strategy",
      actions: [
        // 1. Accept governance of new DystopiaStrategy
        {
          contract: cDystopiaStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new Dystopia strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cDystopiaStrategy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [dDystopiaStrategyUsdcUsdtProxy.address, true],
        },
        {
          contract: cDystopiaStrategy,
          signature: "setHarvesterAddress(address)",
          args: [harvesterProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [dDystopiaStrategyUsdcUsdtProxy.address, true],
        },
      ],
    };
  }
);
