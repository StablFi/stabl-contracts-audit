//
// Deployment utilities
//

const hre = require("hardhat");
const { utils } = require("ethers");

async function main() { 
    const Cryptr = require('cryptr');
    const prompt = require("prompt-sync")({ sigint: true });
    const key = prompt("Enter the key:");
    const message = prompt("What to encrypt:");
    const cryptr = new Cryptr(key);
    
    const encryptedString = cryptr.encrypt(message);
    console.log(encryptedString); 

    // const decryptr = new Cryptr(key);
    // const decryptedString = decryptr.decrypt(encryptedString);
    // console.log(decryptedString); 
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
