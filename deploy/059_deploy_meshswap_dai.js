const { deploymentWithProposal } = require("../utils/deploy");
const { isFork } = require("../test/helpers");

module.exports = deploymentWithProposal(
  { deployName: "059_deploy_meshswap_dai", forceDeploy: isFork , tags: ["test", "main"] ,  dependencies: ["001_core"]},
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
    const dMeshSwapStrategyDAIProxy = await deployWithConfirmation(
      "MeshSwapStrategyDAIProxy"
    );
    const cMeshSwapStrategyDAIProxy = await ethers.getContractAt(
      "MeshSwapStrategyDAIProxy",
      dMeshSwapStrategyDAIProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dMeshSwapStrategyDAIImpl = await deployWithConfirmation("MeshSwapStrategy");
    const cMeshSwapStrategyDAI = await ethers.getContractAt(
      "MeshSwapStrategy",
      dMeshSwapStrategyDAIProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cMeshSwapStrategyDAIProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dMeshSwapStrategyDAIImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new MeshSwapDAI strategy
    console.log("4. Init and configure new MeshSwapDAI strategy")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address)";
    await withConfirmation(
      cMeshSwapStrategyDAI.connect(sDeployer)[initFunction](
        assetAddresses.meshToken,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [ assetAddresses.DAI],
        [assetAddresses.meshSwapDai],
        assetAddresses.meshSwapRouter,
        assetAddresses.USDC,
        await getTxOpts()
      )
    );
    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the setBalancer")
    const setBalancer = "setBalancer(address,bytes32)";
    await withConfirmation(
      cMeshSwapStrategyDAI.connect(sDeployer)[setBalancer](
        assetAddresses.balancerVault,
        assetAddresses.balancerPoolIdUsdcTusdDaiUsdt,
        await getTxOpts()
      )
    );
    
    // 5. Transfer governance
    await withConfirmation(
      cMeshSwapStrategyDAI
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
      name: "Switch to new MeshSwapDAI strategy",
      actions: [
        // 1. Accept governance of new MeshSwapStrategy
        {
            contract: cMeshSwapStrategyDAI,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new MeshSwapDAI strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cMeshSwapStrategyDAI.address],
        },
        {
            // Set
            contract: cVaultAdmin,
            signature: "setTrusteeFeeBps(uint256)",
            args: [1000], // 1000 BPS = 10%
        },
        // 10. Set harvester address
        {
            contract: cMeshSwapStrategyDAI,
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
            args: [cMeshSwapStrategyDAIProxy.address, true],
        },
      ],
    };
  }
);
