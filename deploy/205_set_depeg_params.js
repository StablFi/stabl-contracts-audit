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
        deployName: "205_set_depeg_params",
        forceDeploy: true,
        tags: ["test", "test_polygon", "set_depeg_params"],
        dependencies: [],
    },
    async ({ ethers, assetAddresses }) => {

        const vaultProxy = await ethers.getContract("VaultProxy");
        const vaultAdminAtProxy = await ethers.getContractAt("VaultAdmin", vaultProxy.address);

        // Governance proposal
        return {
            name: "Set depeg params",
            actions: [
                {
                    contract: vaultAdminAtProxy,
                    signature: "setDepegParams(bool,uint256)",
                    args: [
                        true,
                        25
                    ],
                },
            ],
        };
    }
);
