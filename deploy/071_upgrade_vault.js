const { isFork, isMainnet, isPolygonStaging } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "071_upgrade_vault" , forceDeploy: isMainnet || isPolygonStaging , tags: ["test", "main", "upgrade_vault"],  dependencies: ["001_core"] },
  async ({ ethers, assetAddresses }) => {

    // Deploy a new vault core contract.
    const dVaultCore = await deployWithConfirmation("VaultCore");
    console.log("Deployed VaultCore");
    // Deploy a new vault admin contract.
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    console.log("Deployed VaultAdmin");

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCoreProxy = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
    );
    const cVaultAdminProxy = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
      );
    const cVaultCore = await ethers.getContract("VaultCore");
    const cVaultAdmin = await ethers.getContract("VaultAdmin");

    // Governance proposal
    return {
      name: "Upgrade Vault",
      actions: [
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [cVaultCore.address],
        },
        {
          contract: cVaultCoreProxy,
          signature: "setAdminImpl(address)",
          args: [cVaultAdmin.address],
        },
        {
          contract: cVaultAdminProxy,
          signature: "setSwapper(address,bytes32)",
          args: [assetAddresses.am3crvSwap, assetAddresses.balancerPoolIdUsdcTusdDaiUsdt],
        }
      ],
    };
  }
);
