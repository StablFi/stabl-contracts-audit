const { isFork, isMainnet, isStaging } = require("../test/helpers");
const {
  deploymentWithProposal,
  withConfirmation,
  deployWithConfirmation,
} = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

/*
Command:
npx hardhat deploy --network polygon_staging_0 --tags upgrade_meshswap_strategy
*/
module.exports = deploymentWithProposal(
  {
    deployName: "105_upgrade_balancer",
    forceDeploy: true,
    tags: ["test_polygon", "upgrade_balancer"],
    dependencies: [],
  },
  async ({ ethers, assetAddresses }) => {
    const upgradable = "BalancerStrategy";
    const toUpgrade = [
      "BalancerStrategyUSDCProxy",
      "BalancerStrategyDAIProxy",
      "BalancerStrategyUSDTProxy",
    ];
    // await deployWithConfirmation(upgradable);

    let upgradeJson = [];
    const implementation = await ethers.getContract(upgradable);
    for (let i = 0; i < toUpgrade.length; i++) {
      const proxyName = toUpgrade[i];
      upgradeJson.push({
        contract: await ethers.getContract(proxyName),
        signature: "upgradeTo(address)",
        args: [implementation.address],
      });
    }

    // Governance proposal
    return {
      name: "Upgrade " + upgradable,
      actions: upgradeJson,
    };
  }
);
