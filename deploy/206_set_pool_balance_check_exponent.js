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
        deployName: "206_set_pool_balance_check_exponent",
        forceDeploy: true,
        tags: ["test", "test_polygon", "set_pool_balance_check_exponent"],
        dependencies: [],
    },
    async ({ ethers, assetAddresses }) => {

        const vaultProxy = await ethers.getContract("VaultProxy");
        const vaultAdminAtProxy = await ethers.getContractAt("VaultAdmin", vaultProxy.address);

        // Governance proposal
        return {
            name: "Set pool_balance_check_exponent",
            actions: [
                {
                    contract: vaultAdminAtProxy,
                    signature: "setPoolBalanceCheckExponent(uint256)",
                    args: [
                        5
                    ],
                },
            ],
        };
    }
);
