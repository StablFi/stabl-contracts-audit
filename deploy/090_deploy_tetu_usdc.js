const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "090_deploy_tetu_usdc", forceDeploy: isFork, tags: ["test", "main", "tetu"], dependencies: ["001_core"] },
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
    const dTetuStrategyProxy = await deployWithConfirmation(
      "TetuStrategyUSDCProxy"
    );
    console.log("TetuStrategyUSDCProxy getting contract");
    const cTetuStrategyProxy = await ethers.getContractAt(
      "TetuStrategyUSDCProxy",
      dTetuStrategyProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dTetuStrategyImpl = await deployWithConfirmation("TetuStrategy");
    const cTetuStrategy = await ethers.getContractAt(
      "TetuStrategy",
      dTetuStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cTetuStrategyProxy
        .connect(sDeployer)
      ["initialize(address,address,bytes)"](
        dTetuStrategyImpl.address,
        deployerAddr,
        [],
        await getTxOpts()
      )
    );
    // 4. Init and configure new TetuStrategy strategy
    console.log("4. Init and configure new TetuStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address)";
    await withConfirmation(
      cTetuStrategy.connect(sDeployer)[initFunction](
        assetAddresses.TETU, // platform address(tetu token address)
        cVaultProxy.address, // vault address
        [assetAddresses.USDC], // reward token (USDC)
        [assetAddresses.USDC], // assets (USDC)
        [assetAddresses.TETU], // pToken address (Tetu)
        assetAddresses.USDC, // primary token
        assetAddresses.tetuUsdcSmartVault, // USDC smart vault
        assetAddresses.tetuSmartVault, // Tetu smart vault
        await getTxOpts()
      )
    );

    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the _setRouter")
    const _setRouter = "_setRouter(address)";
    await withConfirmation(
      cTetuStrategy.connect(sDeployer)[_setRouter](
        assetAddresses.tetuUsdcSwapRouter,
        await getTxOpts()
      )
    );

    // 4.2 Setting the setOracleRouter
    console.log("4.2. Setting the setOracleRouter")
    const setOracleRouter = "setOracleRouter()";
    await withConfirmation(
      cTetuStrategy.connect(sDeployer)[setOracleRouter](
        await getTxOpts()
      )
    );

    // 4.2 Setting the setCurvePool
    console.log("4.2. Setting the Curve")
    const setCurvePool = "setCurvePool(address,address[])";
    await withConfirmation(
      cTetuStrategy.connect(sDeployer)[setCurvePool](
        assetAddresses.am3crvSwap,
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cTetuStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // 6. Harvester to accept the USDC (Redundant)
    // Deploy new Harvester proxy
    const dHarvesterProxy = await ethers.getContract("HarvesterProxy");
    console.log(`Harvester proxy deployed at: ${dHarvesterProxy.address}`);

    const cHarvester = await ethers.getContractAt(
      "Harvester",
      dHarvesterProxy.address
    );

    console.log("Initialized HarvesterProxy...");

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new TetuStrategy strategy",
      actions: [
        // 1. Accept governance of new TetuStrategy
        {
          contract: cTetuStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new TetuStrategy strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cTetuStrategy.address],
        },

        // 10. Set harvester address
        {
          contract: cTetuStrategy,
          signature: "setHarvesterAddress(address)",
          args: [dHarvesterProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cTetuStrategyProxy.address, true],
        },
      ],
    };
  }
);
