.PHONY: build deploy deploy-fork generate-abis get-address account chain compile flatten fork fork-base fund format lint test verify

BASE_RPC_URL ?= https://mainnet.base.org

DEPLOY_SCRIPT ?= script/Deploy.s.sol

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

# Start a Base mainnet fork (real Base state, local chain id 31337, no real money at risk)
fork-base: setup-anvil-wallet
	anvil --fork-url $(BASE_RPC_URL) --chain-id 31337

# Mint real USDC to test identities on the running Base fork
fund:
	./scripts-js/fund-usdc.sh $(ADDRESSES)

# Deploy to the local Base fork and regenerate the frontend ABIs.
# Passes an explicit --sender because on a fork the default account already has a
# nonce history on Base; without it forge derives the wrong nonce ("nonce too low").
deploy-fork:
	forge script $(DEPLOY_SCRIPT) --rpc-url localhost --account scaffold-eth-default \
		--sender $$(cast wallet address --account scaffold-eth-default --password localhost) \
		--password localhost --broadcast --ffi --slow
	$(MAKE) generate-abis

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

