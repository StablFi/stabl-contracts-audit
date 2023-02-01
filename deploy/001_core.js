const hre = require("hardhat");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  getOracleAddresses,
  // isMainnet,
  isFork,
  isMainnetOrFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async (harvesterProxy) => {

  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await ethers.getContractAt(
    "VaultInitializer",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (
      await ethers.getContract("VaultProxy")
    ).address
  );
  log("Set the CurvePool to the vault");
  await withConfirmation(
    cVault.connect(sGovernor).setSwapper(assetAddresses.am3crvSwap, assetAddresses.balancerPoolIdUsdcTusdDaiUsdt)
  );

  log("Adding  DAI asset " +assetAddresses.DAI +" to Vault");
  // Set up supported assets for Vault
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.DAI)
  );
  log("Added DAI asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDT)
  );
  log("Added USDT asset to Vault");
  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.USDC)
  );
  log("Added USDC asset to Vault");

  log("Set the primaryStable to the vault " + assetAddresses.primaryStable );
  await withConfirmation(
    cVault.connect(sGovernor).setPrimaryStable(assetAddresses.primaryStable)
  );
  log("PrimaryStable: " + (await cVault.primaryStableAddress()))

  log(
    "Set Harvester" );
  await withConfirmation(
    cVault.connect(sGovernor).setHarvester(harvesterProxy.address)
  );
  
  log(
    "Set the Redeem Fees to the vault " );
  await withConfirmation(
    cVault.connect(sGovernor).setRedeemFeeBps(assetAddresses.redeemFeeBps)
  );

  log(
    "Set the Mint Fees to the vault " );
  await withConfirmation(
    cVault.connect(sGovernor).setMintFeeBps(assetAddresses.mintFeeBps)
  );

  log(
    "Set the Fees to the vault " );
  await withConfirmation(
    cVault.connect(sGovernor).setFeeParams(assetAddresses.Labs, assetAddresses.Team, assetAddresses.Treasury)
  );

  log(
    "Set the Harvester Fees " );
  await withConfirmation(
    cVault.connect(sGovernor).setHarvesterFeeParams(assetAddresses.LabsFeeBps, assetAddresses.TeamFeeBps)
  );
  
  
  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on Vault");


  
};

/**
 * Deploy Harvester
 */
const deployHarvester = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dHarvesterProxy = await deployWithConfirmation(
    "HarvesterProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
  const dHarvester = await deployWithConfirmation("Harvester");

  const cHarvester = await ethers.getContractAt(
    "Harvester",
    dHarvesterProxy.address
  );
  await withConfirmation(
    cHarvesterProxy["initialize(address,address,bytes)"](
      dHarvester.address,
      deployerAddr,
      []
    )
  );
  await withConfirmation(
    cHarvester.connect(sDeployer).initialize(
      cVaultProxy.address,
      assetAddresses.USDC,
    )
  );

  log("Initialized HarvesterProxy");

  await withConfirmation(
    cHarvester.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`Harvester transferGovernance(${governorAddr} called`);

  await withConfirmation(
    cHarvester
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance()
  );
  log("Claimed governance for Harvester");

  await withConfirmation(
    cHarvester
      .connect(sGovernor)
      .setRewardsProceedsAddress(cVaultProxy.address) // Changed to dripper in later migrations
  );
  console.log("Harvester Team: ",(await cHarvester.getTeam())[0])
  console.log("Harvester Labs: ",(await cHarvester.getLabs())[0])
  return dHarvesterProxy;
};
/**
 * Deploy the OracleRouter and initialise it with Chainlink sources.
 */
const deployOracles = async () => {
  const { deployerAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // TODO: Change this to intelligently decide which router contract to deploy?

  const oracleContract = isMainnetOrFork ? "OracleRouter" : "OracleRouterDev";
    await deployWithConfirmation("OracleRouter", [], oracleContract);
 
  if (!isMainnetOrFork) {
    const oracleRouter = await ethers.getContract("OracleRouter");
    console.log("Setting up the feeds..")
    const oracleAddresses = await getOracleAddresses(deployments);
    const assetAddresses = await getAssetAddresses(deployments);
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.DAI, oracleAddresses.chainlink.DAI_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.USDC, oracleAddresses.chainlink.USDC_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.USDT, oracleAddresses.chainlink.USDT_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.TUSD, oracleAddresses.chainlink.TUSD_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.AAVE, oracleAddresses.chainlink.AAVE_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.CRV, oracleAddresses.chainlink.CRV_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(assetAddresses.CVX, oracleAddresses.chainlink.CVX_USD)
    );
    await withConfirmation(
      oracleRouter
        .connect(sDeployer)
        .setFeed(
          assetAddresses.NonStandardToken,
          oracleAddresses.chainlink.NonStandardToken_USD
        )
    );
  }

};

/**
 * Deploy the core contracts (Vault and CASH).
 *
 */
const deployCore = async () => {
  const { governorAddr } = await hre.getNamedAccounts();
  console.log("Governor Address: ",governorAddr);
  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  
  // Proxies
  await deployWithConfirmation("VaultProxy");
  await deployWithConfirmation("CASHProxy");

  // Main contracts
  const dCASH = await deployWithConfirmation("CASH");
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  await deployWithConfirmation("Governor", [governorAddr, 60]);

  // Get contract instances
  const cCASHProxy = await ethers.getContract("CASHProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cCASH = await ethers.getContractAt("CASH", cCASHProxy.address);
  const cOracleRouter = await ethers.getContract("OracleRouter");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  await withConfirmation(
    cCASHProxy["initialize(address,address,bytes)"](
      dCASH.address,
      governorAddr,
      []
    )
  );
  log("Initialized CASHProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized VaultProxy");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .initialize(cOracleRouter.address, cCASHProxy.address)
  );
  log("Initialized Vault");

  await withConfirmation(
    cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  log("Initialized VaultAdmin implementation");

  // Initialize CASH
  await withConfirmation(
    cCASH
      .connect(sGovernor)
      .initialize("CASH", "CASH", cVaultProxy.address)
  );

  log("Initialized CASH");
};

const deployVaultVaultChecker = async () => {
  const vault = await ethers.getContract("VaultProxy");
  await deployWithConfirmation("VaultValueChecker", [vault.address]);
};

const main = async () => {
  const {governorAddr, deployerAddr} = await hre.getNamedAccounts();
  console.log("Governor Address: ",governorAddr);
  console.log("Deployer Address: ",deployerAddr);
  console.log("IS FORK: ", isFork)
  console.log("isMainnetOrRinkebyOrFork: ", isMainnetOrRinkebyOrFork)
  console.log("Running 001_core deployment...");
  console.log("deploy oracles");
  await deployOracles();
  console.log("deploy core");
  await deployCore();
  console.log("deploy harvester");
  const harvesterProxy = await deployHarvester();
  console.log("deploy configureVault");
  await configureVault(harvesterProxy);
  console.log("deploy deployVaultVaultChecker");
  await deployVaultVaultChecker();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = [];
main.tags = ["core", "test", "main", "mainnet"];
main.skip = () => false;// isFork;

module.exports = main;
 