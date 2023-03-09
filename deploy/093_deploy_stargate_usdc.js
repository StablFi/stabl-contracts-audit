const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "093_deploy_stargate_usdc", forceDeploy: true, tags: ["test", "main", "stargate_usdc"], dependencies: [] },
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
    const dStargateStrategyProxy = await deployWithConfirmation(
      "StargateStrategyUSDCProxy"
    );
    console.log("StargateStrategyUSDCProxy getting contract");
    const cStargateStrategyProxy = await ethers.getContract("StargateStrategyUSDCProxy");

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dStargateStrategyImpl = await deployWithConfirmation("StargateStrategy");
    const cStargateStrategy = await ethers.getContractAt(
      "StargateStrategy",
      cStargateStrategyProxy.address
    );

    // // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cStargateStrategyProxy
        .connect(sDeployer)
      ["initialize(address,address,bytes)"](
        dStargateStrategyImpl.address,
        deployerAddr,
        [],
        await getTxOpts()
      )
    );
    // 4. Init and configure new StargateStrategy strategy
    console.log("4. Init and configure new StargateStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,(address,address,address,uint256,uint256,uint256))";
    await withConfirmation(
      cStargateStrategy.connect(sDeployer)[initFunction](
        assetAddresses.STG, // platform address(stargate token address)
        cVaultProxy.address, // vault address
        [assetAddresses.USDC], // reward token (USDC)
        [assetAddresses.USDC], // assets (USDC)
        [assetAddresses.STG], // pToken address (Stargate)
        assetAddresses.USDC, // primary token
        [assetAddresses.sUSDC, // Stargate USDC LP token
        assetAddresses.stargateChef, // Stargate chef
        assetAddresses.stargateRouter, // Router for adding liquidity
        1, // router pool id for adding liquidity
        0, // pool id for staking LP
        125000000000], // min amount of STG to sell to USDC in 1e18
        await getTxOpts()
      )
    );

    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the _setRouter")
    const _setRouter = "_setRouter(address)";
    await withConfirmation(
      cStargateStrategy.connect(sDeployer)[_setRouter](
        assetAddresses.stgUsdcSwapRouter,
        await getTxOpts()
      )
    );

    // 4.2 Setting the setOracleRouter
    console.log("4.2. Setting the setOracleRouter")
    const setOracleRouter = "setOracleRouter()";
    await withConfirmation(
      cStargateStrategy.connect(sDeployer)[setOracleRouter](
        await getTxOpts()
      )
    );

    // 4.2 Setting the setCurvePool
    console.log("4.2. Setting the Curve")
    const setCurvePool = "setCurvePool(address,address[])";
    await withConfirmation(
      cStargateStrategy.connect(sDeployer)[setCurvePool](
        assetAddresses.am3crvSwap,
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cStargateStrategy
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
      name: "Switch to new StargateStrategy strategy",
      actions: [
        // 1. Accept governance of new StargateStrategy
        {
          contract: cStargateStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new StargateStrategy strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cStargateStrategy.address],
        },

        // 10. Set harvester address
        {
          contract: cStargateStrategy,
          signature: "setHarvesterAddress(address)",
          args: [dHarvesterProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cStargateStrategyProxy.address, true],
        },
      ],
    };
  }
);
