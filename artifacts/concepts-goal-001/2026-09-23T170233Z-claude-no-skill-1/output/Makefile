.PHONY: build test test-ci fmt lint gas coverage chain deploy-local deploy-testnet deploy-mainnet health backend-check clean

build:    ; forge build
test:     ; forge test
test-ci:  ; FOUNDRY_PROFILE=ci forge test
fmt:      ; forge fmt
lint:     ; forge fmt --check && forge build
gas:      ; forge test --gas-report
coverage: ; forge coverage --no-match-coverage "^(script|test)/"

chain:    ; anvil

# Deploy against a local dev chain using its first prefunded account.
deploy-local:
	BILLING_OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
	forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
	  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

deploy-testnet:
	forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify --slow

# Mainnet goes through a hardware wallet; no key ever touches the shell.
deploy-mainnet:
	forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --slow --ledger

health:
	forge script script/Ops.s.sol:Health --rpc-url base --sig "run(address[])" "[]"

backend-check:
	cd backend && npm install && npm run typecheck

clean:
	forge clean && rm -rf backend/node_modules
