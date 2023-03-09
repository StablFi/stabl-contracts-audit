const { isFork, isMainnet, isStaging } = require("../test/helpers");
const {
    deploymentWithProposal,
    withConfirmation,
    deployWithConfirmation,
} = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

/*
Command:
npx hardhat deploy --network polygon_staging_0 --tags upgrade_rebase_handler
*/
module.exports = deploymentWithProposal(
    {
        deployName: "202_set_default_strategies_staging",
        forceDeploy: true,
        tags: ["test", "test_polygon", "set_default_strategies_staging"],
        dependencies: [],
    },
    async ({ ethers, assetAddresses }) => {
        const assets = [
            assetAddresses.DAI,
            assetAddresses.USDC,
            assetAddresses.USDT,

        ];
        const strategies = [
            "AaveSupplyStrategyDAIProxy",
            "AaveSupplyStrategyUSDCProxy",
            "AaveSupplyStrategyUSDTProxy",
        ];

        let json = [];
        const vaultProxy = await ethers.getContract("VaultProxy");
        const vaultAdmin = await ethers.getContractAt("VaultAdmin", vaultProxy.address);
        for (let i = 0; i < strategies.length; i++) {
            json.push({
                contract: vaultAdmin,
                signature: "setAssetDefaultStrategy(address,address)",
                args: [assets[i], (await ethers.getContract(strategies[i])).address],
            });
        }

        // Governance proposal
        return {
            name: "Set Default Asset-Strategy",
            actions: json,
        };
    }
);
