const { isFork } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "070_setting_payout_timings" , forceDeploy: isFork, tags: ["test", "main", "mainnet"],  dependencies: ["001_core"] },
  async ({ ethers, assetAddresses }) => {
      const cVaultProxy = await ethers.getContract("VaultProxy");
      const cVaultAdmin = await ethers.getContractAt(
        "VaultAdmin",
        cVaultProxy.address
      );
      const cVaultCore = await ethers.getContractAt(
        "VaultCore",
        cVaultProxy.address
      );

    // Governance proposal
    return {
      name: "Setting Payout Timings",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setNextPayoutTime(uint256)",
          args: [Math.floor((new Date()).getTime() / 1000)],
        },
        {
            contract: cVaultAdmin,
            signature: "setPayoutIntervals(uint256,uint256)",
            args: [ 24*60*60, 15*60 ]
        }
      ],
    };
  }
);
