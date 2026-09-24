-include .env

.PHONY: build test fmt gas deploy-testnet deploy-mainnet sweep anvil

build:
	forge build

test:
	forge test -vv

gas:
	forge test --gas-report

fmt:
	forge fmt

# Dry run first — drop --broadcast to simulate against real chain state.
deploy-testnet:
	forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify -vvv

deploy-mainnet:
	forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify -vvv

# Settle the listed subscribers and move revenue to the treasury.
sweep:
	forge script script/Ops.s.sol:Sweep --rpc-url base --broadcast -vvv

anvil:
	anvil
