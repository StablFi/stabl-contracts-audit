const { isMainnet, isMainnetOrFork } = require("../test/helpers");
const { deploymentWithProposal, deployWithConfirmation, withConfirmation, log } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "079_transfer_governance" , forceDeploy: false, tags: ["test", "main", "transfer_governance"],  dependencies: [] },
  async ({ ethers }) => {
    const contracts = {
      "Am3CurveStrategy": "Am3CurveStrategy",
      "Am3CurveStrategyProxy": "Am3CurveStrategy",

      "CASH" : "CASH",
      "CASHProxy" : "CASH",

      "Dripper": "Dripper",
      "DripperProxy": "Dripper",

      "DodoStrategy": "DodoStrategy",
      "DodoStrategyProxy": "DodoStrategy",
      
      "DystopiaStrategy": "DystopiaStrategy",
      "DystopiaStrategyDaiUsdtProxy": "DystopiaStrategy",
      "DystopiaStrategyUsdcDaiProxy": "DystopiaStrategy",
      "DystopiaStrategyUsdcUsdtProxy": "DystopiaStrategy",

      "Harvester": "Harvester",
      "HarvesterProxy": "Harvester",

      "MeshSwapStrategy": "MeshSwapStrategy",
      "MeshSwapStrategyDAIProxy": "MeshSwapStrategy",
      "MeshSwapStrategyUSDCProxy": "MeshSwapStrategy",
      "MeshSwapStrategyUSDTProxy": "MeshSwapStrategy",

      "MeshSwapStrategyDual": "MeshSwapStrategyDual",
      "MeshSwapStrategyUSDCDAIProxy": "MeshSwapStrategyDual",
      "MeshSwapStrategyUSDCUSDTProxy": "MeshSwapStrategyDual",
      "MeshSwapStrategyUSDTDAIProxy": "MeshSwapStrategyDual",

      // "OracleRouter": "OracleRouter", // -- Not Governable
      
      "QuickSwapStrategy": "QuickSwapStrategy",
      "QuickSwapStrategyUSDCDAIProxy": "QuickSwapStrategy",
      "QuickSwapStrategyUSDCUSDTProxy": "QuickSwapStrategy",

      "SynapseStrategy": "SynapseStrategy",
      "SynapseStrategyProxy": "SynapseStrategy",

      "Vault": "Vault",
      "VaultAdmin": "VaultAdmin",
      "VaultCore": "VaultCore",

      "VaultProxy": "Vault",
      // "VaultProxy": "VaultAdmin", // -- Redundant
      // "VaultProxy": "VaultCore",  // -- Redundant
      
      // "VaultValueChecker": "VaultValueChecker", // -- Not Governable

      "WrappedCASH": "WrappedCASH",
      "WrappedCASHProxy": "WrappedCASH",
    };

    const { governorAddr } = await getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const newGovernor = "0x6b03b042CbDa485A14398FE8787f90d7C93BEfF0"
    
    // Loop through the contracts JSON
    for (const [proxyName, contractName] of Object.entries(contracts)) {
      const cProxy = await ethers.getContract(proxyName);
      const cContract = await ethers.getContractAt(
        contractName,
        cProxy.address
      );

      await withConfirmation(
        cContract.connect(sGovernor).transferGovernance(newGovernor)
      );
      log(`${contractName} transferGovernance(${newGovernor}) called on ${proxyName} - ${cProxy.address}`);
    }

    // Governance proposal 
    return {
      name: "Governance Transfer",
      actions: [],
    };
  }
);
