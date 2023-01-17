const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');

async function main() {
    const hex = "0x00000000000000000000000000000000000000000000000000000008f87f35d8"
    const value = BigNumber.from(hex).toString()
    console.log(value)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
