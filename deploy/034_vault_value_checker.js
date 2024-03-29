const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "034_vault_value_checker",forceDeploy: true, tags: ["test", "main", "mainnet"], dependencies: ["001_core"] },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const vaultValueChecker = await ethers.getContract("VaultValueChecker");

    // Governance Actions
    // ----------------
    return {
      name: "VaultValueChecker test",
      actions: [
        // 1. Just to give the governance section something to do
        {
          contract: vaultValueChecker,
          signature: "takeSnapshot()",
          args: [],
        },
      ],
    };
  }
);
