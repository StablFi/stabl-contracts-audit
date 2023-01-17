
# Create a blocks array from 0 to 10
blocks=(
    34588170 
    34588179 # Payout 
    34588182 
)
# loop from start to end with step 1000
for i in "${blocks[@]}"
do
    echo
    echo
    echo
    echo "Block $i"
    npx --no-install hardhat node --export '../dapp/network.json' --tags none  --fork https://polygon-rpc.com --fork-block-number $i > /dev/null 2>&1  &
    sleep 20s
    echo "Running gainslp.js"
    npx hardhat run scripts/vault/gainslp.js --network localhost
    npx kill-port 8545 
done