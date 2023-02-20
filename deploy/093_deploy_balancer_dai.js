const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  {
    deployName: "093_deploy_balancer_dai",
    forceDeploy: isFork,
    tags: ["test", "main", "balancer"],
    dependencies: ["001_core"],
  },
  async ({ oracleAddresses, assetAddresses, deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt("VaultAdmin", cVaultProxy.address);

    const cVaultCore = await ethers.getContractAt("VaultCore", cVaultProxy.address);

    // Deployer Actions
    // ----------------

    console.log("1. Deploy new proxy");
    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dBalancerStrategyProxy = await deployWithConfirmation("BalancerStrategyDAIProxy");
    console.log("BalancerStrategyDAIProxy getting contract");
    const cBalancerStrategyProxy = await ethers.getContractAt("BalancerStrategyDAIProxy", dBalancerStrategyProxy.address);

    // 2. Deploy new implementation
    console.log("2. Deploy new implementation");
    const dBalancerStrategyImpl = await deployWithConfirmation("BalancerStrategy");
    const cBalancerStrategy = await ethers.getContractAt("BalancerStrategy", dBalancerStrategyProxy.address);

    // 3. Init the proxy to point at the implementation
    console.log("3. Init the proxy to point at the implementation");
    await withConfirmation(cBalancerStrategyProxy.connect(sDeployer)["initialize(address,address,bytes)"](dBalancerStrategyImpl.address, deployerAddr, [], await getTxOpts()));
    // 4. Init and configure new BalancerStrategy strategy
    console.log("4. Init and configure new BalancerStrategy for DAI");
    const initFunction = "initialize(address,address,address[],address[],address[],address,address,address,address)";

    await withConfirmation(
      cBalancerStrategy.connect(sDeployer)[initFunction](
        assetAddresses.balancerVault, // platform address (balancer Vault)
        cVaultProxy.address, // vault address
        [assetAddresses.USDC], // reward token (USDC)
        [assetAddresses.DAI], // token0: assets (DAI)
        [assetAddresses.balToken], // pToken address (Bal)
        assetAddresses.USDC, // primary stable (USDC)
        assetAddresses.balancerAmUsdToken, // lp token
        assetAddresses.balancerAmUsdGauge, // am-usd gauge
        assetAddresses.balancerRewardHelper, // reward helper
        await getTxOpts()
      )
    );

    // 4.1 Setting the setOracleRouterSwappingPool
    console.log("4.2. Setting the Swapping");
    await withConfirmation(cBalancerStrategy.connect(sDeployer).setOracleRouterSwappingPool());

    // 4.2 Setting the setOracleRouterSwappingPool
    console.log("4.2. Setting the Balancer Requisites");
    const balancerRequisitesFunction = "setBalancerEssentials(address,address,bytes32,bytes32,bytes32,bytes32,address)";
    await withConfirmation(
      cBalancerStrategy
        .connect(sDeployer)
        [balancerRequisitesFunction](
          assetAddresses.balancerVault,
          assetAddresses.balancerAmUsdcToken,
          assetAddresses.balancerPoolIdBoostedAaveUSD,
          assetAddresses.balancerPoolIdWmaticUsdcWethBal,
          assetAddresses.balancerPoolIdUsdcAmUsdc,
          assetAddresses.balancerPoolIdDaiAmDai,
          assetAddresses.balancerAmDaiToken
        )
    );

    // 5. Transfer governance
    console.log("5. Transfer governance");
    await withConfirmation(cBalancerStrategy.connect(sDeployer).transferGovernance(governorAddr, await getTxOpts()));

    // 6. Harvester to accept the DAI (Redundant)
    // Deploy new Harvester proxy
    const dHarvesterProxy = await ethers.getContract("HarvesterProxy");
    console.log(`Harvester proxy deployed at: ${dHarvesterProxy.address}`);

    const cHarvester = await ethers.getContractAt("Harvester", dHarvesterProxy.address);

    console.log("Initialized HarvesterProxy...");

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new BalancerStrategy strategy",
      actions: [
        // 1. Accept governance of new BalancerStrategy
        {
          contract: cBalancerStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new BalancerStrategy strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cBalancerStrategy.address],
        },

        // 10. Set harvester address
        {
          contract: cBalancerStrategy,
          signature: "setHarvesterAddress(address)",
          args: [dHarvesterProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cBalancerStrategyProxy.address, true],
        },
      ],
    };
  }
);
