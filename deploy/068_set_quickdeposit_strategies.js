const { isFork } = require("../test/helpers");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "068_set_quickdeposit_strategies", forceDeploy: true , tags: ["test", "main", "mainnet"] ,  dependencies: ["001_core"]},
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

    // Getting the strategy proxies
    const pMeshSwapStrategyUSDCProxy=  await ethers.getContract("MeshSwapStrategyUSDCProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Setting the quick deposit strategies",
      actions: [
        {
            contract: cVaultAdmin,
            signature: "setQuickDepositStrategies(address[])",
            args: [
                [pMeshSwapStrategyUSDCProxy.address]
            ],
        }
      ],
    };
  }
);
