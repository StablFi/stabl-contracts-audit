const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "094_deploy_aave_usdc", forceDeploy: true, tags: ["test", "main", "aave_usdc"], dependencies: [] },
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
    const dAaveSupplyStrategyProxy = await deployWithConfirmation(
      "AaveSupplyStrategyUSDCProxy"
    );
    console.log("AaveSupplyStrategyUSDCProxy getting contract");
    const cAaveSupplyStrategyProxy = await ethers.getContract(
      "AaveSupplyStrategyUSDCProxy"
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    // const dAaveSupplyStrategyImpl = await deployWithConfirmation("AaveSupplyStrategy");
    const cAaveSupplyStrategyImpl = await ethers.getContract("AaveSupplyStrategy");
    const cAaveSupplyStrategy = await ethers.getContractAt(
      "AaveSupplyStrategy",
      cAaveSupplyStrategyProxy.address
    );

    // // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cAaveSupplyStrategyProxy
        .connect(sDeployer)
      ["initialize(address,address,bytes)"](
        cAaveSupplyStrategyImpl.address,
        deployerAddr,
        [],
        await getTxOpts()
      )
    );
    // 4. Init and configure new AaveSupplyStrategy strategy
    console.log("4. Init and configure new AaveSupplyStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address[])";
    await withConfirmation(
      cAaveSupplyStrategy.connect(sDeployer)[initFunction](
        assetAddresses.aUSDC, // platform address(aave aToken address)
        cVaultProxy.address, // vault address
        [assetAddresses.USDC], // reward token (USDC)
        [assetAddresses.USDC], // assets (USDC)
        [assetAddresses.aUSDC], // pToken address (aToken)
        assetAddresses.USDC, // primary token
        [assetAddresses.aaveLendingPool, // Lending pool
        assetAddresses.aUSDC], // aToken
        await getTxOpts()
      )
    );


    // 4.2 Setting the setOracleRouter
    console.log("4.2. Setting the setOracleRouter")
    const setOracleRouter = "setOracleRouter()";
    await withConfirmation(
      cAaveSupplyStrategy.connect(sDeployer)[setOracleRouter](
        await getTxOpts()
      )
    );

    // 4.2 Setting the setCurvePool
    console.log("4.2. Setting the Curve")
    const setCurvePool = "setCurvePool(address,address[])";
    await withConfirmation(
      cAaveSupplyStrategy.connect(sDeployer)[setCurvePool](
        assetAddresses.am3crvSwap,
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cAaveSupplyStrategy
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
      name: "Switch to new AaveSupplyStrategy strategy",
      actions: [
        // 1. Accept governance of new AaveSupplyStrategy
        {
          contract: cAaveSupplyStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new AaveSupplyStrategy strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cAaveSupplyStrategy.address],
        },

        // 10. Set harvester address
        {
          contract: cAaveSupplyStrategy,
          signature: "setHarvesterAddress(address)",
          args: [dHarvesterProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cAaveSupplyStrategyProxy.address, true],
        },
      ],
    };
  }
);
