const hre = require("hardhat");
const { utils } = require("ethers");

const addresses = require("./addresses");
const daiAbi = require("../test/abi/dai.json").abi;
const usdtAbi = require("../test/abi/usdt.json").abi;
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");
const ognAbi = require("../test/abi/erc20.json");

const {
  usdtUnits,
  daiUnits,
  usdcUnits,
  tusdUnits,
  ognUnits,
} = require("../test/helpers");
const isFork = true;
/* Used for funding accounts in forked mode. Find the holder that has the most ETH or ERC20 token amounts.
 * param contract: address of ERC20 token. If null the account with the most ETH shall be returned
 *
 * returns signer object of the most appropriate token/ETH holder
 */
const findBestMainnetTokenHolder = async (contract, hre) => {
  const binanceAddresses = addresses.polygon.BinanceAll.split(",");
  // const { isFork } = require("../test/helpers");

  const binanceSigners = await Promise.all(
    binanceAddresses.map((binanceAddress) => {
      return hre.ethers.provider.getSigner(binanceAddress);
    })
  );

  if (isFork) {
    await Promise.all(
      binanceAddresses.map(async (binanceAddress) => {
        return hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [binanceAddress],
        });
      })
    );
  }

  let balances = await Promise.all(
    binanceSigners.map(async (binanceSigner) => {
      if (!contract) {
        return await hre.ethers.provider.getBalance(binanceSigner._address);
      }

      return await contract
        .connect(binanceSigner)
        .balanceOf(binanceSigner._address);
    })
  );

  let largestBalance = balances[0];
  let largestBalanceIndex = 0;
  for (let i = 0; i < balances.length; i++) {
    if (balances[i].gte(largestBalance)) {
      largestBalance = balances[i];
      largestBalanceIndex = i;
    }
  }
  // console.log("Largest Balance holder of " , contract.address , "  is ", binanceSigners[largestBalanceIndex]._address, " with ", largestBalance.toString());
  return binanceSigners[largestBalanceIndex];
};

const fundAccounts = async () => {
  console.log("Funding accounts...")
  const signers = await hre.ethers.getSigners();
  let usdt, dai, tusd, usdc, nonStandardToken;
  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.polygon.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.polygon.DAI);
    tusd = await ethers.getContractAt(tusdAbi, addresses.polygon.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.polygon.USDC);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    ogn = await ethers.getContract("MockSTABL");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
  }

  if ( parseInt((await usdc.balanceOf(await signers[4].getAddress())).toString()) > 1000000000 ) {
    console.log("Account ", 4, " already have", (await usdc.balanceOf(await signers[4].getAddress())).toString() ,"usdc. Skipping");
    return;
  }

  let binanceSigner;
  let MaticWhaleSigner;
  const { governorAddr } = await getNamedAccounts();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.polygon.Binance],
    });
    binanceSigner = await ethers.provider.getSigner(addresses.polygon.Binance);
    // await binanceSigner.sendTransaction({
      //   to: governorAddr,
      //   value: utils.parseEther("100"),
      // });
      
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.polygon.MaticWhale],
      });
      MaticWhaleSigner = await ethers.provider.getSigner(addresses.polygon.MaticWhale);
    // Send some MATIC to Governor
    await MaticWhaleSigner.sendTransaction({
      to: governorAddr,
      value: utils.parseEther("100"),
    });
    console.log("Adding 100 Matic to Governor");

  }

  for (let i = 0; i < 7; i++) {
    if (isFork) {
      console.log("Adding 100 MATIC to", await signers[i].getAddress())
      // Send some MATIC 
      await MaticWhaleSigner.sendTransaction({
        to: await signers[i].getAddress(),
        value: utils.parseEther("100"),
      });

      let usdcWhale = await findBestMainnetTokenHolder(usdc, hre);
      console.log("Adding USDC to ", await signers[i].getAddress(), " from ", usdcWhale._address);
      await usdc
        .connect(await findBestMainnetTokenHolder(usdc, hre))
        .transfer(await signers[i].getAddress(), usdcUnits("10000"));

      let daiWhale = await findBestMainnetTokenHolder(dai, hre);
      console.log("Adding DAI to ", await signers[i].getAddress(), " from ", daiWhale._address);
      await dai
        .connect(daiWhale)
        .transfer(await signers[i].getAddress(), daiUnits("1000"));

      let usdtWhale = await findBestMainnetTokenHolder(usdt, hre);
      console.log("Adding USDT to ", await signers[i].getAddress(), " from ", usdtWhale._address);
      await usdt
        .connect(await findBestMainnetTokenHolder(usdt, hre))
        .transfer(await signers[i].getAddress(), usdtUnits("1000"));
      // // console.log("Adding TUSD to ", await signers[i].getAddress())
      // await tusd
      //   .connect(await findBestMainnetTokenHolder(tusd, hre))
      //   .transfer(await signers[i].getAddress(), tusdUnits("1000"));
      // console.log("Adding STABL to ", await signers[i].getAddress())

    } else {
      await dai.connect(signers[i]).mint(daiUnits("1000"));
      await usdc.connect(signers[i]).mint(usdcUnits("1000"));
      await usdt.connect(signers[i]).mint(usdtUnits("1000"));
      await tusd.connect(signers[i]).mint(tusdUnits("1000"));
      await ogn.connect(signers[i]).mint(ognUnits("1000"));
      await nonStandardToken.connect(signers[i]).mint(usdtUnits("1000"));
    }
  }

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [addresses.polygon.Binance],
    });
  }
  console.log("Funded")
};

module.exports = {
  fundAccounts,
  findBestMainnetTokenHolder,
};
