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
    deployName: "204_set_swapper_to_tetu",
    forceDeploy: true,
    tags: ["test_polygon", "set_swapper_to_tetu"],
    dependencies: [],
  },
  async ({ ethers, assetAddresses }) => {
    const subject = "TetuStrategy";
    const toSetOn = [
      "TetuStrategyUSDCProxy",
      "TetuStrategyDAIProxy",
      "TetuStrategyUSDTProxy",
    ];
    
    let upgradeJson = [];
    for (let i = 0; i < toSetOn.length; i++) {
      const proxyName = toSetOn[i];
      upgradeJson.push({
        contract: await ethers.getContractAt(subject, (await ethers.getContract(proxyName)).address ),
        signature: "setSwapper(address)",
        args: [(await ethers.getContract("SwapperProxy")).address],
      });
    }

    // Governance proposal
    return {
      name: "Set " + subject,
      actions: upgradeJson,
    };
  }
);
