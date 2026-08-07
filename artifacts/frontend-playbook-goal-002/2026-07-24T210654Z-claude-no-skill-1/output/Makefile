# Convenience wrapper around the local dev workflow. See README.md for the
# manual, step-by-step version and MetaMask setup.

# Anvil's first prefunded account (deployer). Local test key only — never use
# this on a real network.
DEPLOYER_PK ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL     ?= http://127.0.0.1:8545

.PHONY: install chain deploy test frontend clean

install: ## Install contract libs and frontend deps
	cd contracts && forge install
	cd frontend && npm install

chain: ## Start a local anvil chain (leave running in its own terminal)
	anvil

test: ## Run the contract tests
	cd contracts && forge test -vv

deploy: ## Deploy MockUSDC + TipJar to the running chain and write frontend config
	cd contracts && forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(RPC_URL) --broadcast --private-key $(DEPLOYER_PK)

frontend: ## Start the Next.js dev server on http://localhost:3000
	cd frontend && npm run dev

clean: ## Remove build artifacts
	cd contracts && forge clean
	rm -rf frontend/.next
