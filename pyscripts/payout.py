# 1. Import the gas strategy
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3 import Web3

# 2. Add the Web3 provider logic here:
rpc_url = 'http://localhost:8545'
web3 = Web3(Web3.HTTPProvider(rpc_url))

#  Verify if the connection is successful
if web3.isConnected():
    print("-" * 50)
    print("Connection Successful")
    print("-" * 50)
else:
    print("Connection Failed")

# 3. Create address variables
account_from = {
    "private_key": "",
    "address": "",
}
contract_address = "0xd1bb7d35db39954d43e16f65F09DD0766A772cFF"  # Mainnet Vault

print(
    f'Attempting to send transaction from { account_from["address"] } to { contract_address }'
)

# 4. Set the gas price strategy
web3.eth.set_gas_price_strategy(rpc_gas_price_strategy)
nonce = web3.eth.getTransactionCount(account_from["address"])

abi = '[{"inputs": [],"name": "payout","outputs": [],"stateMutability": "nonpayable","type": "function"}]'

# 5. Sign tx with PK
contract = web3.eth.contract(address=contract_address, abi=abi)
Chain_id = web3.eth.chain_id

gas_estimate = contract.functions.payout().estimateGas()

# Get latest gas price
gas_price = web3.eth.generate_gas_price()
print(f"Gas price: {gas_price}")

gas_multiplier = 1
gas_price_multiplier = 1.4

# Only Tetu - https://polygonscan.com/tx/0x1657172daddf2373ea061115b5f25291a20d4ddb1ee263748c201c4c66303013 - Gas Limit: 8,670,896
gas_estimate = 8670896

print(f"Gas estimate to transact with contract: {gas_estimate}")

# Call your function
call_function = contract.functions.payout().buildTransaction({"chainId": Chain_id, "from": account_from["address"], "nonce": nonce, "gas": int(
    gas_estimate * gas_multiplier), 'gasPrice':  int(gas_price * gas_price_multiplier)})


# Sign transaction
signed_tx = web3.eth.account.sign_transaction(
    call_function, private_key=account_from["private_key"])


# Send transaction
send_tx = web3.eth.send_raw_transaction(signed_tx.rawTransaction)

# Wait for transaction receipt
tx_receipt = web3.eth.wait_for_transaction_receipt(send_tx)


print(
    f"Transaction successful with hash: { tx_receipt.transactionHash.hex() }")
# Print gas used
print(f"Gas used: { tx_receipt.gasUsed }")
# Print other infot
print(f"Block number: { tx_receipt.blockNumber }")
print(f"Block hash: { tx_receipt.blockHash.hex() }")
