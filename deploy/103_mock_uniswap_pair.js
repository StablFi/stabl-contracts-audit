const { isMainnetOrRinkebyOrFork } = require("../test/helpers");
const { deploymentWithProposal, log } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "103_mock_uniswap_pair", forceDeploy: !isMainnetOrRinkebyOrFork, tags: ["test", "main"],  dependencies: ["001_core"]},
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deploy } = deployments;
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cCASHProxy = await ethers.getContract("CASHProxy");

    await deploy("UniswapV2PairCASHUSDC", {
        from: deployerAddr,
        contract: "XPoolPair",
    });
    console.log("Deployed UniswapV2PairCASHUSDC");

    const cUniswapV2PairCASHUSDC = await ethers.getContract("UniswapV2PairCASHUSDC");
    await withConfirmation(
        cUniswapV2PairCASHUSDC
            .connect(sDeployer)
            .initialize(
                cCASHProxy.address,
                assetAddresses.USDC,
            )
    );

    // Governance Actions
    // ----------------

    return {
      name: "",
      actions: [
      
      ],
    };
  }
);
