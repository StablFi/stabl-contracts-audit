## Stabl - Contracts


Deploy on Polygon Fork
```
npx --no-install hardhat node --export '../dapp/network.json' --fork https://polygon-rpc.com --fork-block-number 31657239
```
Debug
```
npx --no-install hardhat debug --network localhost
```
Add funds
```
FORK=true npx hardhat fund --amount 100000 --network localhost --accountsfromenv true 
```

Kill the node
```
npx kill-port 8545
```


## Tests

### Testing on Fork

 1. Change environment variable "FORK" to "true" as follows: 
 2. Deploy contracts on Polygon Fork
 3. Run the following command in the project directory:

    npx hardhat test --network localhost --grep fork

### Testing on in-memory node using Mocks

 1. Change environment variable "FORK" to "false" as follows:
 2. Run the following command in the project directory:

    npx hardhat test --grep mock

## Export JSON for Production
```
 npx --no-install hardhat export --export-all '../dapp/prod.network.json' --network mainnet
```
