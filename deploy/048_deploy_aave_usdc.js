const { isMainnet, isMainnetButNotFork, isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports =  deploymentWithProposal(
  { deployName: "048_deploy_aave_usdc", forceDeploy: false , tags: ["test", "main", "this"] ,  dependencies: ["001_core"]},
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
    const dAaveStrategyUSDCProxy = await deployWithConfirmation(
      "AaveStrategyUSDCProxy"
    );
    const cAaveStrategyUSDCProxy = await ethers.getContractAt(
      "AaveStrategyUSDCProxy",
      dAaveStrategyUSDCProxy.address
    );

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation")
    const dAaveStrategyImpl = await deployWithConfirmation("AaveStrategy");
    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      dAaveStrategyUSDCProxy.address
    );

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation")
    await withConfirmation(
      cAaveStrategyUSDCProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dAaveStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new AaveStrategy strategy
    console.log("4. Init and configure new AaveStrategy for USDC")
    const initFunction =
      "initialize(address,address,address[],address[],address[],address[])";
    await withConfirmation(
      cAaveStrategy.connect(sDeployer)[initFunction](
        assetAddresses.aave,
        cVaultProxy.address,
        [assetAddresses.USDC],
        [assetAddresses.USDC],
        [assetAddresses.amUSDC ],
        [ assetAddresses.aavePoolProvider, assetAddresses.aaveDataProvider , assetAddresses.aaveIncentivesController, assetAddresses.aaveVDebtUSDC],
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance")
    await withConfirmation(
      cAaveStrategy
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
      name: "Switch to new MeshSwapUSDC strategy",
      actions: [
        // 1. Accept governance of new MeshSwapStrategyUSDC
        {
            contract: cAaveStrategy,
            signature: "claimGovernance()",
            args: [],
        },
        // 2. Add new MeshSwapUSDC strategy to vault
        {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cAaveStrategy.address],
        },
        {
            // Set
            contract: cVaultAdmin,
            signature: "setTrusteeFeeBps(uint256)",
            args: [1000], // 1000 BPS = 10%
        },
        // 10. Set harvester address
        {
            contract: cAaveStrategy,
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
            args: [cAaveStrategyUSDCProxy.address, true],
        },
      ],
    };
  }
);
