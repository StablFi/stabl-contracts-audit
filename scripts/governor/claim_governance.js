const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
    const { withConfirmation } = require("../../utils/deploy");
    const fs = require("fs");
    const path = require("path");
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    console.log(await getNamedAccounts());
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    // Print ether balance of govenor
    const balance = await sDeployer.getBalance();
    console.log("sDeployer balance:", hre.ethers.utils.formatEther(balance));

    const contracts = require(path.join(__dirname, "rgovernable.json"));
    for (let i = 0; i < contracts.length; i++) {
        const c = contracts[i];
        console.log("Loading contract: " + c.name);
        const contract = await ethers.getContractAt(c.name, c.address);
        let governor = await  contract.governor();
        
        console.log("Claim governance to: " + governorAddr);
        console.log("Governor:",governor);
        if (governor.toLowerCase() == deployerAddr.toLowerCase()) {
            console.log("Already claimed");
            continue;
        }
        try {

            await withConfirmation(
                contract.connect(sDeployer).claimGovernance()
            );
        } catch (e) {
            console.log("Failed to claim governance for " + c.name + " : " + e);
        }
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
