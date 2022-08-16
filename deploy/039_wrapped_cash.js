const { deploymentWithProposal, withConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "039_wrapped_cash", forceDeploy: true , tags: ["test", "main"] ,  dependencies: ["001_core"]},
  async ({ deployWithConfirmation, getTxOpts, ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cCASHProxy = await ethers.getContract("CASHProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy the new implementation.
    const dWrappedCASHImpl = await deployWithConfirmation("WrappedCASH", [
      cCASHProxy.address,
      "Wrapped CASH",
      "WCASH",
    ]);

    // 2. Deploy the new proxy
    const dWrappedCASHProxy = await deployWithConfirmation("WrappedCASHProxy");
    const cWrappedCASHProxy = await ethers.getContract("WrappedCASHProxy");
    const cWrappedCASH = await ethers.getContractAt(
      "WrappedCASH",
      cWrappedCASHProxy.address
    );

    // 3. Configure Proxy
    await withConfirmation(
      cWrappedCASHProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dWrappedCASHImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 3. Initialize Wrapped CASH
    await withConfirmation(
      cWrappedCASH.connect(sDeployer)["initialize()"](await getTxOpts())
    );

    // 4. Assign ownership
    await withConfirmation(
      cWrappedCASH
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------

    return {
      name: "Claim WCASH Governance",
      actions: [
        // 1. Claim governance
        {
          contract: cWrappedCASH,
          signature: "claimGovernance()",
          args: []
        },
      ],
    };
  }
);
