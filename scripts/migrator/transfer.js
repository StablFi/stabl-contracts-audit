const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
    const { withConfirmation } = require("../../utils/deploy");
    const fs = require("fs");
    const path = require("path");
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer =  new ethers.Wallet("e25fa73e7501fa695e4cd55913b47408ed7a057dd579c8a47dc4387f03f7edce", ethers.provider); //await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const to = await sGovernor.getAddress();
    const balance = await sDeployer.getBalance();
    console.log("sDeployer balance:", hre.ethers.utils.formatEther(balance)); 
    const contracts = require(path.join(__dirname,"balance_migrator_secondary"));
    let multisig = [];
    for (let i = 0; i < contracts.length; i++) {
        const c = contracts[i];
        const contract = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", c.address);
        console.log("Transferring " + c.name + ' of amount:', c.balance);
        try {
            const tx = await withConfirmation(
                contract.connect(sDeployer).transfer(to, c.balance)
            );
            console.log(tx);
            tx.wait();
        }
        catch (e) {
            console.log("Failed to transfer " + c.name + " : " + e);
        }

    }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
