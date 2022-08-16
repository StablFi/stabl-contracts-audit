const { deploymentWithProposal } = require("../utils/deploy");
const { isFork } = require("../test/helpers");

module.exports = deploymentWithProposal(
  { deployName: "050_deploy_synapse", forceDeploy: isFork , tags: ["test", "main"] ,  dependencies: ["001_core"]},
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
    const dSynapseStrategyProxy = await deployWithConfirmation(
      "SynapseStrategyProxy"
    );
    const cSynapseStrategyProxy = await ethers.getContractAt(
      "SynapseStrategyProxy",
      dSynapseStrategyProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dSynapseStrategyImpl = await deployWithConfirmation("SynapseStrategy");
    const cSynapseStrategy = await ethers.getContractAt(
      "SynapseStrategy",
      dSynapseStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cSynapseStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dSynapseStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new SynapseStrategy strategy
    console.log("4. Init and configure new SynapseStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address,uint256)";
    await withConfirmation(
      cSynapseStrategy.connect(sDeployer)[initFunction](
        assetAddresses.nUSD,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.USDC],
        [assetAddresses.nUSD],
        assetAddresses.SYN,
        assetAddresses.synapseStableSwapPool,
        assetAddresses.synapseStakePool,
        assetAddresses.synapseStakePoolId,

        await getTxOpts()
      )
    );
    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the _setRouter")
    const _setRouter = "_setRouterAndPrimaryStable(address,address,address)";
    await withConfirmation(
      cSynapseStrategy.connect(sDeployer)[_setRouter](
        assetAddresses.dystopiaDystRouter,
        assetAddresses.USDP,
        assetAddresses.USDC,
        await getTxOpts()
      )
    );
    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cSynapseStrategy
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
      name: "Switch to new SynapseStrategy strategy",
      actions: [
        // 1. Accept governance of new SynapseStrategy
        {
            contract: cSynapseStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new SynapseStrategy strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cSynapseStrategy.address],
        },
        {
            // Set
            contract: cVaultAdmin,
            signature: "setTrusteeFeeBps(uint256)",
            args: [1000], // 1000 BPS = 10%
        },
        // 10. Set harvester address
        {
            contract: cSynapseStrategy,
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
            args: [cSynapseStrategyProxy.address, true],
        },
      ],
    };
  }
);
