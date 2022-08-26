const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "066_deploy_am3curve", forceDeploy: isFork , tags: ["test", "main", "mainnet"] ,  dependencies: ["001_core"]},
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
    const dAm3CurveStrategyProxy = await deployWithConfirmation(
      "Am3CurveStrategyProxy"
    );
    const cAm3CurveStrategyProxy = await ethers.getContractAt(
      "Am3CurveStrategyProxy",
      dAm3CurveStrategyProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dAm3CurveStrategyImpl = await deployWithConfirmation("Am3CurveStrategy");
    const cAm3CurveStrategy = await ethers.getContractAt(
      "Am3CurveStrategy",
      dAm3CurveStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cAm3CurveStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dAm3CurveStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new Am3CurveStrategy strategy
    console.log("4. Init and configure new Am3CurveStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address,address)";
    await withConfirmation(
      cAm3CurveStrategy.connect(sDeployer)[initFunction](
        assetAddresses.am3crvSwap,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [assetAddresses.am3crv, assetAddresses.am3crv, assetAddresses.am3crv],
        assetAddresses.USDC,
        assetAddresses.CRV,
        assetAddresses.am3crvGauge,
        assetAddresses.am3crvMinter,
        await getTxOpts()
      )
    );
    // 4.1 Setting the Stables
    console.log("4.1. Setting the AmStable")
    const setStableAssets =
      "_setAmAssets(address[])";
    await withConfirmation(
      cAm3CurveStrategy.connect(sDeployer)[setStableAssets](
        [assetAddresses.amDAI, assetAddresses.amUSDC, assetAddresses.amUSDT],
        await getTxOpts()
      )
    );
    // 4.2 Setting the _setRouter
    console.log("4.2. Setting the _setRouter")
    const _setRouter = "_setRouter(address)";
    await withConfirmation(
      cAm3CurveStrategy.connect(sDeployer)[_setRouter](
        assetAddresses.quickSwapRouter02,
        await getTxOpts()
      )
    );
    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cAm3CurveStrategy
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
      name: "Switch to new Am3CurveStrategy strategy",
      actions: [
        // 1. Accept governance of new Am3CurveStrategy
        {
            contract: cAm3CurveStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new Am3CurveStrategy strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cAm3CurveStrategy.address],
        },
        // 10. Set harvester address
        {
            contract: cAm3CurveStrategy,
            signature: "setHarvesterAddress(address)",
            args: [dHarvesterProxy.address],
        },
        {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cAm3CurveStrategyProxy.address, true],
        },
      ],
    };
  }
);
