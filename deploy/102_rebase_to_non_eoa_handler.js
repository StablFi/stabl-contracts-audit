const { deploymentWithProposal, log } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "102_rebase_to_non_eoa_handler", forceDeploy: true, tags: ["test", "main", "mainnet", "rebase_handler"],  dependencies: ["001_core"]},
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cCASHProxy = await ethers.getContract("CASHProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy RebaseToNonEoaHandler
    await deployWithConfirmation("RebaseToNonEoaHandler");
    const cRebaseToNonEoaHandlerImpl = await ethers.getContract("RebaseToNonEoaHandler");

    // 2. Deploy Proxy
    await deployWithConfirmation("RebaseToNonEoaHandlerProxy",[],"InitializeGovernedUpgradeabilityProxy");
    const cRebaseToNonEoaHandlerProxy = await ethers.getContract("RebaseToNonEoaHandlerProxy");
    const cRebaseToNonEoaHandler = await ethers.getContractAt(
      "RebaseToNonEoaHandler",
      cRebaseToNonEoaHandlerProxy.address
    );

    // 3. Configure Proxy
    await withConfirmation(
      cRebaseToNonEoaHandlerProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          cRebaseToNonEoaHandlerImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 3.1 Initialize
    await withConfirmation(
      cRebaseToNonEoaHandler.connect(sDeployer).initialize(
        cVaultProxy.address,
        assetAddresses.USDC,
        cCASHProxy.address,
      )
    );

    // 4. Transfer governance
    await withConfirmation(
      cRebaseToNonEoaHandler
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------

    return {
      name: "Add RebaseToNonEoaHandler",
      actions: [
        // 1. Accept governance
        {
          contract: cRebaseToNonEoaHandler,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cVaultAdmin,
          signature: "setRebaseHandler(address)",
          args: [cRebaseToNonEoaHandler.address],
        }
      ],
    };
  }
);
