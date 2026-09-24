-include .env
export

.PHONY: build test test-deep fmt deploy-testnet deploy collect status solvency add-plan close-plan

build:
	forge build

test:
	forge test -vv

# Invariants take ~50s; worth running before any deploy.
test-deep:
	forge test -vv && forge test --match-path 'test/*.invariant.t.sol' --fuzz-runs 2000

fmt:
	forge fmt

deploy-testnet:
	forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify -vvv

deploy:
	@echo "Deploying to Base mainnet. Plan prices are immutable once created."
	@read -p "Type 'yes' to continue: " ok && [ "$$ok" = "yes" ]
	forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify -vvv

# Settle the listed accounts and sweep revenue to PAYOUT. Safe to run any time.
collect:
	forge script script/Collect.s.sol:Collect --rpc-url base --broadcast -vvv

# Add a plan at a new price. PRICE is in USDC units: $7.50 is 7500000.
# Existing subscribers are not repriced; they keep the plan they signed up for.
add-plan:
	forge script script/AddPlan.s.sol:AddPlan --rpc-url base --broadcast -vvv

# Stop new signups on a plan. Existing subscribers on it are untouched.
close-plan:
	forge script script/ClosePlan.s.sol:ClosePlan --rpc-url base --broadcast -vvv

# What does the contract think about one address? No transaction, no gas.
status:
	cast call $(SUBSCRIPTIONS) "statusOf(address)(bool,uint32,uint64,uint256,uint256)" $(ADDRESS) --rpc-url base

# Solvency check: should never be less than deposits + earned.
solvency:
	@echo "held:     $$(cast call $(USDC) 'balanceOf(address)(uint256)' $(SUBSCRIPTIONS) --rpc-url base)"
	@echo "deposits: $$(cast call $(SUBSCRIPTIONS) 'totalDeposits()(uint256)' --rpc-url base)"
	@echo "earned:   $$(cast call $(SUBSCRIPTIONS) 'earned()(uint256)' --rpc-url base)"
