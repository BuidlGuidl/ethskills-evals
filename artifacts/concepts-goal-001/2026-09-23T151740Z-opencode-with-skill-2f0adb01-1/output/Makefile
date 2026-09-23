RPC_URL ?= $(error set RPC_URL, e.g. `export RPC_URL=https://mainnet.base.org`)

.PHONY: build test deploy

build:
	forge build

test:
	forge test

# Loads .env if present, then deploys + seeds plans + verifies on the explorer.
# Requires the [etherscan] block in foundry.toml and ETHERSCAN_API_KEY for --verify.
deploy:
	@[ -f .env ] && . ./.env; \
	forge script script/Deploy.s.sol --rpc-url $(RPC_URL) --broadcast --verify
