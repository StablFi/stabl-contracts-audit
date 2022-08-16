const { deploymentWithProposal } = require("../utils/deploy");
const { isFork } = require("../test/helpers");

module.exports = deploymentWithProposal(
  { deployName: "062_deploy_meshswap_usdc_usdt", forceDeploy: isFork , tags: ["test", "main"] ,  dependencies: ["001_core"]},
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
    const dMeshSwapStrategyUSDCUSDTProxy = await deployWithConfirmation(
      "MeshSwapStrategyUSDCUSDTProxy"
    );
    const cMeshSwapStrategyUSDCUSDTProxy = await ethers.getContractAt(
      "MeshSwapStrategyUSDCUSDTProxy",
      dMeshSwapStrategyUSDCUSDTProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dMeshSwapStrategyDual = await deployWithConfirmation("MeshSwapStrategyDual");
    const cMeshSwapStrategyDual = await ethers.getContractAt(
      "MeshSwapStrategyDual",
      dMeshSwapStrategyUSDCUSDTProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cMeshSwapStrategyUSDCUSDTProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dMeshSwapStrategyDual.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new MeshSwapStrategyDual strategy
    console.log("4. Init and configure new MeshSwapStrategyDual strategy for USDC/USDT")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address[])";
    await withConfirmation(
      cMeshSwapStrategyDual.connect(sDeployer)[initFunction](
        assetAddresses.meshToken,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [ assetAddresses.USDC, assetAddresses.USDT],
        [assetAddresses.meshSwapUsdcUsdtPair,assetAddresses.meshSwapUsdcUsdtPair ],
        assetAddresses.meshSwapRouter,
        assetAddresses.USDC,
        [
          oracleAddresses.chainlink.PRIMARYSTABLE_USD,
          oracleAddresses.chainlink.USDC_USD,
          oracleAddresses.chainlink.USDT_USD,
        ],
        await getTxOpts()
      )
    );

    // 4.1 Setting the _setRouter
    console.log("4.2. Setting the setBalancer")
    const setBalancer = "setBalancer(address,bytes32)";
    await withConfirmation(
      cMeshSwapStrategyDual.connect(sDeployer)[setBalancer](
        assetAddresses.balancerVault,
        assetAddresses.balancerPoolIdUsdcTusdDaiUsdt,
        await getTxOpts()
      )
    );
    
    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cMeshSwapStrategyDual
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
      name: "Switch to new MeshSwapStrategyUSDCUSDT strategy",
      actions: [
        // 1. Accept governance of new MeshSwapStrategyUSDC
        {
            contract: cMeshSwapStrategyDual,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new MeshSwapStrategyUSDCUSDT strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cMeshSwapStrategyDual.address],
        },
        {
            // Set
            contract: cVaultAdmin,
            signature: "setTrusteeFeeBps(uint256)",
            args: [1000], // 1000 BPS = 10%
        },
        // 10. Set harvester address
        {
            contract: cMeshSwapStrategyDual,
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
            args: [cMeshSwapStrategyUSDCUSDTProxy.address, true],
        },
      ],
    };
  }
);
