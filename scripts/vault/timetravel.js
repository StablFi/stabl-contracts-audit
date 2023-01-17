// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { utils } = require("ethers");
const { ethers } = require("hardhat");
const erc20Abi = require("../../test/abi/erc20.json");
const addresses = require("../../utils/addresses");
const {
  deploymentWithProposal,
  withConfirmation,
  deployWithConfirmation,
} = require("../../utils/deploy");

const {
  cashUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  getOracleAddresses,
  isFork,
  usdcUnitsFormat,
  cashUnitsFormat,
  advanceBlocks,
} = require("../../test/helpers");
const { fundAccounts } = require("../../utils/funding");

async function main() {
  async function tabulate(subjects) {
    let values = [];
    let index = 1;
    for (const holder of subjects) {
      let creditBalanceOf = await cash.creditsBalanceOf(holder);
      // Add data to values
      values[index] = {
        holder: holder,
        balanceOf: cashUnitsFormat(await cash.balanceOf(holder)),
        credits: creditBalanceOf[0].toString(),
        creditsPerToken: creditBalanceOf[1].toString(),
        rebasingCreditsPerToken: (
          await cash.rebasingCreditsPerToken()
        ).toString(),
      };
      index++;
    }
    console.log(
      "CASH.totalSupply() : ",
      cashUnitsFormat(await cash.totalSupply())
    );
    console.log(
      "VaultCore.checkBalance() : ",
      usdcUnitsFormat(await vault.checkBalance())
    );
    console.table(values);
  }
  async function upgradeCASH(signer) {
    const dCASH = await deployWithConfirmation("CASH");
    console.log("Deployed CASH");

    const cCASHProxy = await ethers.getContractAt(
      "CASHProxy",
      "0x80487b4f8f70e793A81a42367c225ee0B94315DF"
    );
    const cCASH = await ethers.getContract("CASH");
    await cCASHProxy.connect(signer).upgradeTo(cCASH.address);
  }
  const erc20Abi = require("../../test/abi/erc20.json");
  const cashAbi = require("../../test/abi/CASH.json");
  const ivaultAbi = require("../../test/abi/vault.json");
  const signers = await hre.ethers.getSigners();
  const governor = signers[0];
  const usdt = await ethers.getContractAt(erc20Abi, addresses.polygon.USDT);
  const usdc = await ethers.getContractAt(erc20Abi, addresses.polygon.USDC);
  const vault = await hre.ethers.getContractAt(
    "contracts/interfaces/IVault.sol:IVault",
    "0xd1bb7d35db39954d43e16f65f09dd0766a772cff"
  );
  const prodGovernor = await vault.governor();
  const holder1 = "0x0b07cfdf4772cc7d6110621e9114ce527f41bb66";
  const holder3 = "0x1AB3087e181A5CFD09684F38d3412597d8DF4f1F";
  console.log(
    "Holder1 USDT Balance: ",
    usdcUnitsFormat(await usdt.balanceOf(holder1))
  );
  console.log(
    "Holder3 USDC Balance: ",
    usdcUnitsFormat(await usdc.balanceOf(holder3))
  );
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [holder1],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [holder3],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [prodGovernor],
  });
  const holder1Signer = await ethers.provider.getSigner(holder1);
  const holder3Signer = await ethers.provider.getSigner(holder3);
  const prodGovernorSigner = await ethers.provider.getSigner(prodGovernor);

  const subjects = [
    "0x826b8d2d523e7af40888754e3de64348c00b99f4",
    "0x0b07cfdf4772cc7d6110621e9114ce527f41bb66",
    "0x1a2ce410a034424b784d4b228f167a061b94cff4",
    "0x953ad46ade32e1c2e76d725544811e4dd410cb50",
    "0x1ab3087e181a5cfd09684f38d3412597d8df4f1f",
    "0xa8ec46a09a56da39011c82220eed0cf22a257f89",
    "0x53c8ede52dc28de5f48c10696cbc36c1d0282c61",
    "0xa46df52e5349a87141cf48d5806a97a774be4d74",
    "0x84e8ee329e2f868496de8f73e0cdc77e0d7b9f88",
    "0x0319000133d3ada02600f0875d2cf03d442c3367",
    "0x62d51fa08b15411d9429133ae5f224abf3867729",
    "0x54727a65cc4f71418a29a6f18e5be808efe89856",
    "0x1a114203392b3237a59950125eb861a7ba32c3e6",
    "0x32269695c15291f6dec6aee9489af817da964999",
    "0x8c2c050bbcb855aebbc4dd537c27073d82f8758e",
    "0x2de85299198a1502f20c8efb52c1b46e158039a6",
    "0xf4b67f83a65500d2692e2637acfe382ce09fc90b",
    "0x9f21fa3d141d5af5930a95bef9394bfa8c743eb7",
    "0xccc3ea48407e9a58c70b2e99c08ae3f47ec324c7",
    "0x092471cffe4b941c896bfec001fe8bcc73a991d9",
    "0x5bc0aa095632c76da0be9838d960da9a66fca30e",
    "0x6648b5554632ed5d6ec27ec6737e98a0a3dbbc94",
    "0xb7fda9fab3215b27978fbc701844df331216fd8a",
    "0xf17ed06ebb4713c8cfc84586b7060391f8696e72",
  ];
  const amounts = {
    "0x0b07cfdf4772cc7d6110621e9114ce527f41bb66": "13009",
    "0x1a2ce410a034424b784d4b228f167a061b94cff4": "13433.20259",
    "0x953Ad46adE32E1c2E76D725544811E4DD410cb50": "5227.192159",
    "0x1ab3087e181a5cfd09684f38d3412597d8df4f1f": "2000",
    "0xa8ec46a09a56da39011c82220eed0cf22a257f89": "1971",
    "0x53c8ede52dc28de5f48c10696cbc36c1d0282c61": "994.873379",
    "0xa46df52e5349a87141cf48d5806a97a774be4d74": "210.006566",
    "0x84e8ee329e2f868496de8f73e0cdc77e0d7b9f88": "79.01935499",
    "0x0319000133d3ada02600f0875d2cf03d442c3367": "50.30763196",
    "0x62d51fa08b15411d9429133ae5f224abf3867729": "9.9991747",
    "0x54727a65cc4f71418a29a6f18e5be808efe89856": "7.501781281",
    "0x1a114203392b3237a59950125eb861a7ba32c3e6": "3",
  };
  const args = [
    Object.keys(amounts),
    Object.values(amounts).map((x) => cashUnits(x)),
  ];

  let cash = await hre.ethers.getContractAt(
    cashAbi,
    "0x80487b4f8f70e793A81a42367c225ee0B94315DF"
  );
  // Get current block number
  const blockNumber = await ethers.provider.getBlockNumber();
  // 32843500: Buggy upgrade where the rebase is being done twice
  // 32870132: 10K USD mint which resulted in 20K CASH supply
  // 32915724: 280 USD mint
  // 32937744: Invoked changeCASHSupply

  console.log("Current block number: " + blockNumber);
  // loop
  await tabulate(subjects);
  return;

  // await upgradeCASH(prodGovernorSigner);
  // cash = await hre.ethers.getContractAt(
  //   "CASH",
  //   "0x80487b4f8f70e793A81a42367c225ee0B94315DF"
  // );
  // console.log("Reset...");
  // await cash.connect(prodGovernorSigner).resetMint(args[0], args[1]);
  // await tabulate(subjects);
  let amount = "10";
  console.log("Transferring", amount, "USDC");
  await usdc.connect(holder3Signer).transfer(vault.address, usdcUnits(amount));

  await tabulate(subjects);
  console.log("Invoking Dripper.collectAndRebase()");
  const dDripper = await ethers.getContractAt(
    "Dripper",
    "0x4b2b1dc2ecc46551d88389f7f06ef2bede77b4e1"
  );
  await dDripper.collectAndRebase();
  await tabulate(subjects);

  console.log("Minting from H1...");
  amount = "10";
  console.log("Adding", amount, "USDT");
  await usdt.connect(holder1Signer).approve(vault.address, usdtUnits(amount));
  await vault.connect(holder1Signer).mint(usdt.address, usdtUnits(amount), 0);
  await tabulate(subjects);

  console.log("Minting from H3...");
  amount = "10";
  console.log("Adding", amount, "USDC");
  await usdc.connect(holder3Signer).approve(vault.address, usdcUnits(amount));
  await vault.connect(holder3Signer).mint(usdc.address, usdcUnits(amount), 0);
  await tabulate(subjects);

  console.log("Redeeming...");
  amount = "10";
  console.log("Redeeming", amount, "CASH");
  await vault.connect(holder1Signer).redeem(cashUnits(amount),0);
  await tabulate(subjects);

  amount = "10"
  console.log("Wrapping", amount, "CASH");
  const wcash = await ethers.getContractAt(
    "WrappedCASH",
    "0x953Ad46adE32E1c2E76D725544811E4DD410cb50"
  );
  console.log("Deposting.. ",cashUnits(amount),await holder1Signer.getAddress())
  await wcash.connect(holder1Signer).deposit(cashUnits(amount),await holder1Signer.getAddress());
  await tabulate(subjects);

  amount = "10"
  console.log("Un-wrapping", amount, "wCASH");
  await wcash.connect(holder1Signer).redeem(cashUnits(amount),await holder1Signer.getAddress(), await holder1Signer.getAddress());
  await tabulate(subjects);

  console.log("Redeeming from H3...");
  amount = "10";
  console.log("Redeeming", amount, "CASH");
  await vault.connect(holder3Signer).redeem(cashUnits(amount),0);
  await tabulate(subjects);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
