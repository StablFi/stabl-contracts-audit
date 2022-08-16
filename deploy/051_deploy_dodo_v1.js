const { deploymentWithProposal } = require("../utils/deploy");
const { isFork } = require("../test/helpers");

module.exports = deploymentWithProposal(
  { deployName: "051_deploy_dodo_v1", forceDeploy: isFork , tags: ["test", "main"] ,  dependencies: ["001_core"]},
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
    const dDodoStrategyProxy = await deployWithConfirmation(
      "DodoStrategyProxy"
    );
    const cDodoStrategyProxy = await ethers.getContractAt(
      "DodoStrategyProxy",
      dDodoStrategyProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dDodoStrategyImpl = await deployWithConfirmation("DodoStrategy");
    const cDodoStrategy = await ethers.getContractAt(
      "DodoStrategy",
      dDodoStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cDodoStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dDodoStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    console.log("cDodoStrategyProxy", cDodoStrategyProxy.address)
    console.log("dDodoStrategyImpl", dDodoStrategyImpl.address)
    // 4. Init and configure new DodoStrategy strategy
    console.log("4. Init and configure new DodoStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address[])";
    await withConfirmation(
      cDodoStrategy.connect(sDeployer)[initFunction](
        assetAddresses.DODO,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.USDC],
        [assetAddresses.dodoUsdcLPToken],
        assetAddresses.USDT,
        assetAddresses.wMATIC,
        [assetAddresses.dodoV1UsdcUsdtPool,assetAddresses.dodoV2DodoUsdtPool,assetAddresses.dodoMineUsdc,assetAddresses.dodoV1Helper,assetAddresses.dodoProxy,assetAddresses.dodoApprove],
        await getTxOpts()
      )
    );
    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the setBalancer")
    const setBalancer = "setBalancerAndPrimaryStable(address,address,bytes32,bytes32)";
    await withConfirmation(
      cDodoStrategy.connect(sDeployer)[setBalancer](
        assetAddresses.USDC,
        assetAddresses.balancerVault,
        assetAddresses.balancerPoolIdUsdcTusdDaiUsdt,
        assetAddresses.balancerPoolIdWmaticUsdcWethBal,
        await getTxOpts()
      )
    );
    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cDodoStrategy
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
      name: "Switch to new DodoStrategy strategy",
      actions: [
        // 1. Accept governance of new DodoStrategy
        {
            contract: cDodoStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new DodoStrategy strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cDodoStrategy.address],
        },
        {
            // Set
            contract: cVaultAdmin,
            signature: "setTrusteeFeeBps(uint256)",
            args: [1000], // 1000 BPS = 10%
        },
        // 10. Set harvester address
        {
            contract: cDodoStrategy,
            signature: "setHarvesterAddress(address)",
            args: [dHarvesterProxy.address],
        },
        {
            // Allocate USDC
            contract: cVaultCore,
            signature: "allocate()",
            args: []
        },
        {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cDodoStrategyProxy.address, true],
        },
      ],
    };
  }
);
