-include .env
export

.PHONY: help build test fmt snapshot coverage anvil deploy-local deploy verify report settle withdraw backend-check monitor clean

help: ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

build: ## Compile the contracts
	forge build

test: ## Run unit, fuzz and invariant tests
	forge test -vv

fmt: ## Format Solidity
	forge fmt

coverage: ## Line coverage for src/
	forge coverage --no-match-coverage "(script|test)"

anvil: ## Start a local node
	anvil

deploy-local: ## Deploy mock USDC + billing to a local anvil
	forge script script/DeployLocal.s.sol:DeployLocal \
		--rpc-url http://127.0.0.1:8545 --broadcast \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

deploy: ## Deploy to $NETWORK (requires OWNER, and a key via --ledger/--account)
	forge script script/Deploy.s.sol:Deploy --rpc-url $(NETWORK) --broadcast --verify -vvv

report: ## Read-only health check. SUBSCRIBERS=0xa,0xb make report
	forge script script/Ops.s.sol:Report --rpc-url $(NETWORK)

settle: ## Sweep accrued revenue. SUBSCRIBERS=0xa,0xb make settle
	forge script script/Ops.s.sol:Settle --rpc-url $(NETWORK) --broadcast

withdraw: ## Move settled revenue to TO=0x...
	forge script script/Ops.s.sol:WithdrawEarnings --rpc-url $(NETWORK) --broadcast

backend-check: ## Typecheck the backend
	cd backend && npm run typecheck

monitor: ## Run the ops monitor against $NETWORK
	cd backend && npm run monitor

clean: ## Remove build output
	forge clean
