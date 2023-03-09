const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider("https://internal-rpc.stabl.fi");
const ERC20_ABI = require("../../test/abi/erc20.json");
const VAULT_ABI = require("../../test/abi/vault.json");
const TETU_ABI = require("../../test/abi/strategy.json");
const TETU_SMART_VAULT_ABI = require("../../test/abi/tetuVault.json");
const { usdcUnitsFormat, cashUnitsFormat } = require("../../test/helpers");

/**
 * Gets balance at a given block
 * @param {*} token object with address, name and symbol
 * @param {*} wallet address to query
 * @param {*} block  block number
 * @returns
 */
const getSingleTokenBalanceByBlock = async (token, wallet, block) => {
  const contract = new ethers.Contract(token, ERC20_ABI, provider);
  // adds the blockTag flag to query past balances
  const res = await contract.balanceOf(wallet, {
    blockTag: +block,
  });
  return res;
};

async function main() {
  let vault = new ethers.Contract("0xa6c6e539167e8efa5be0525e1f16c51e57df896e", VAULT_ABI, provider);
  let cash = new ethers.Contract("0xACFDeCB377e7A8b26ce033BDb01cb7630Ef07809", ERC20_ABI, provider);
  // Get latest block number
  const latestBlock = (await provider.getBlockNumber()).toString();

  const blocks = { };
  blocks[latestBlock] = "Latest";
  // Loop through blocks and getBalance
  for (let i = 0; i < Object.keys(blocks).length; i++) {
    console.log("------------------------------------------");
    let block = Object.keys(blocks)[i];
    console.log(`Block ${block} - ${blocks[block]}`);
    console.log(`Total Supply : ${cashUnitsFormat((await cash.totalSupply({ blockTag: parseInt(block) })).toString())}`);
    console.log(`LV : ${usdcUnitsFormat((await vault.checkBalance({ blockTag: parseInt(block) })).toString())}`);
    console.log(`NAV : ${usdcUnitsFormat((await vault.nav({ blockTag: parseInt(block) })).toString())}`);
    console.log(`Total supply - NAV: ${parseFloat(cashUnitsFormat((await cash.totalSupply({ blockTag: parseInt(block) })).toString())) - parseFloat(usdcUnitsFormat((await vault.nav({ blockTag: parseInt(block) })).toString()))}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
