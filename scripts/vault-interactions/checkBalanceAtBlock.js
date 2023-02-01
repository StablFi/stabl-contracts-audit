const { ethers } = require('ethers')
const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com')
const ERC20_ABI = require("../../test/abi/erc20.json");
const VAULT_ABI = require("../../test/abi/vault.json");
const TETU_ABI = require("../../test/abi/strategy.json");
const TETU_SMART_VAULT_ABI = require("../../test/abi/tetuVault.json");
const { usdcUnitsFormat } = require('../../test/helpers');

/**
 * Gets balance at a given block
 * @param {*} token object with address, name and symbol
 * @param {*} wallet address to query
 * @param {*} block  block number
 * @returns
 */
const getSingleTokenBalanceByBlock = async (token, wallet, block) => {
  const contract = new ethers.Contract(token, ERC20_ABI, provider)
  // adds the blockTag flag to query past balances
  const res = await contract.balanceOf(wallet, {
    blockTag: +block,
  })
  return res
}

async function main() {
    let vault = new ethers.Contract("0xd1bb7d35db39954d43e16f65F09DD0766A772cFF", VAULT_ABI, provider);
    let tetuStrategy = new ethers.Contract("0x9D7416C2Ce07CB7a71335fbcdE2f89A30B262064", TETU_ABI, provider);
    let tetuSmartVault = new ethers.Contract("0xeE3B4Ce32A6229ae15903CDa0A5Da92E739685f7", TETU_SMART_VAULT_ABI, provider);

    const token = "0xeE3B4Ce32A6229ae15903CDa0A5Da92E739685f7"; // TETU_IRON_LOAN_USDC 
    const address = "0x9D7416C2Ce07CB7a71335fbcdE2f89A30B262064"; // Tetu-USDC Strategy
    const blocks = [38277669, 38277670, 38277671,38292141,38292142, 38387531]
    // Loop through blocks and getBalance
    for (let i = 0; i < blocks.length; i++) {
        console.log("------------------------------------------")
        let balance = 0;
        let checkBalance = 0;
        let b1 = 0;
        let b2 = 0;

  

        checkBalance = await tetuStrategy.functions.checkBalance({
            blockTag: blocks[i],
        });
        console.log(`Liquidation value of Tetu USDC at block ${blocks[i]}: ${usdcUnitsFormat(checkBalance.toString())}`);

        balance = await tetuStrategy.functions.lpBalance({
            blockTag: blocks[i],
        });
        console.log(`TetuUSDC.lpBalance() at block ${blocks[i]}: ${usdcUnitsFormat(balance.toString())}`);

        b1 = await tetuSmartVault.functions.balanceOf(address,{
            blockTag: blocks[i],
        });
        console.log(`TetuSmartVault.balanceOf() at block ${blocks[i]}: ${usdcUnitsFormat(b1.toString())}`);

        b2 = await tetuSmartVault.functions.underlyingBalanceWithInvestmentForHolder (address,{
            blockTag: blocks[i],
        });
        console.log(`TetuSmartVault.underlyingBalanceWithInvestmentForHolder() at block ${blocks[i]}: ${usdcUnitsFormat(b1.toString())}`);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
