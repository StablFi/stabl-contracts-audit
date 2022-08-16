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

 1.  Change environment variable "FORK" to "true" as follows: 

![image](https://user-images.githubusercontent.com/24974673/184888459-77f0026e-7e11-407a-a4b3-dfe5f83148f3.png)



 
 2. Deploy contracts on Polygon Fork
 3. Run the following command in the project directory:

    npx hardhat test --network localhost --grep fork

### Testing on in-memory node using Mocks

 1. Change environment variable "FORK" to "false" as follows:

![image](https://user-images.githubusercontent.com/24974673/184888413-853d262a-14cf-4a07-9d8e-ce938ea70496.png)

 2. Run the following command in the project directory:

    npx hardhat test --grep mock
