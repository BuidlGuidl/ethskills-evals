# Everything you need day to day. See NOTES.md for what each one is for.
-include .env
export

.PHONY: help build test fmt gas deploy-testnet deploy-mainnet status collectable collect lapsing abi backend

help:
	@grep -E '^[a-zA-Z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

build: ## Compile the contracts
	forge build

test: ## Run contract tests, fuzzing and invariants
	forge test -vv

gas: ## Gas report, to sanity-check what a signup costs your customers
	forge test --gas-report

fmt: ## Format Solidity
	forge fmt

abi: ## Regenerate backend/src/abi.ts from the compiled contract
	./script/export-abi.sh

deploy-testnet: ## Deploy to Base Sepolia
	forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify -vvv

deploy-mainnet: ## Deploy to Base mainnet. Read the checklist in NOTES.md first.
	@echo "Deploying to Base MAINNET as $(BILLING_OWNER). Ctrl-C to abort."
	@sleep 5
	forge script script/Deploy.s.sol --rpc-url base --broadcast --verify -vvv

status: ## Solvency and balance check. Safe to run from cron.
	forge script script/Ops.s.sol --sig "status()" --rpc-url base

collectable: ## Show who is worth settling and print the collect command
	cd backend && npm run cli -- collectable

collect: ## Settle SUBSCRIBERS=0x..,0x.. and sweep the revenue
	forge script script/Ops.s.sol --sig "collect()" --rpc-url base --broadcast -vvv

backend: ## Typecheck and test the API gate (spawns anvil)
	cd backend && npm install && npm test
lapsing: ## Who runs out of money in the next 7 days
	cd backend && npm run cli -- lapsing 7
