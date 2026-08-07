.PHONY: build deploy generate-abis get-address account chain compile flatten fork fork-base fund-usdc format lint test verify

DEPLOY_SCRIPT ?= script/Deploy.s.sol

# Local Base fork settings
BASE_RPC_URL ?= https://mainnet.base.org
BASE_USDC ?= 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
LOCALHOST_RPC ?= http://127.0.0.1:8545
AMOUNT ?= 1000

# setup wallet for anvil
setup-anvil-wallet:
	shx rm ~/.foundry/keystores/scaffold-eth-default 2>/dev/null; 	shx rm -rf broadcast/Deploy.s.sol/31337
	cast wallet import --private-key 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 --unsafe-password 'localhost' scaffold-eth-default

# Start local chain
chain: setup-anvil-wallet
	anvil

# Start a fork
fork: setup-anvil-wallet
	anvil --fork-url ${FORK_URL} --chain-id 31337

# Start a local fork of Base mainnet (real Base state, exposed as chain id 31337)
fork-base: setup-anvil-wallet
	anvil --fork-url $(BASE_RPC_URL) --chain-id 31337

# Fund a test identity with USDC on the running local Base fork.
# Mints the balance directly into USDC storage on the fork (no real money, no whale
# needed). The tip itself then moves this real USDC via a real transferFrom.
# Usage: make fund-usdc RECIPIENT=0x... [AMOUNT=1000]   # AMOUNT is whole USDC
fund-usdc:
	@if [ -z "$(RECIPIENT)" ]; then \
		echo "Usage: make fund-usdc RECIPIENT=0x... [AMOUNT=1000]"; \
		exit 1; \
	fi
	@UNITS=$$(( $(AMOUNT) * 1000000 )); \
	SLOT=$$(cast index address $(RECIPIENT) 9); \
	cast rpc anvil_setStorageAt $(BASE_USDC) $$SLOT $$(cast to-uint256 $$UNITS) --rpc-url $(LOCALHOST_RPC) > /dev/null; \
	echo "Funded $(RECIPIENT) with $(AMOUNT) USDC (base units: $$UNITS)"; \
	printf "New USDC balance (units): "; \
	cast call $(BASE_USDC) "balanceOf(address)(uint256)" $(RECIPIENT) --rpc-url $(LOCALHOST_RPC)

# Deploy the contracts
deploy:
	@if [ ! -f "$(DEPLOY_SCRIPT)" ]; then 		echo "Error: Deploy script '$(DEPLOY_SCRIPT)' not found"; 		exit 1; 	fi
	@if [ "$(RPC_URL)" = "localhost" ]; then 		if [ "$(ETH_KEYSTORE_ACCOUNT)" = "scaffold-eth-default" ]; then 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --password localhost --broadcast --ffi; 		else 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --broadcast --ffi; 		fi 	else 		forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --broadcast --ffi; 	fi

# Deploy and generate ABIs
deploy-and-generate-abis: deploy generate-abis 

# Generate TypeScript ABIs
generate-abis:
	node scripts-js/generateTsAbis.js

# List account
account:
	@node scripts-js/checkAccountBalance.js

# Get address of a keystore
get-address:
	@cast wallet address --account $(ACCOUNT_NAME)

# Compile contracts
compile:
	forge compile

# Flatten contracts
flatten:
	forge flatten

# Format code
format:
	forge fmt && prettier --write ./scripts-js/**/*.js

# Lint code
lint:
	forge fmt --check && prettier --check ./scripts-js/**/*.js

# Run tests
test:
	forge test

# Verify contracts
verify:
	forge script script/VerifyAll.s.sol --ffi --rpc-url $(RPC_URL)

