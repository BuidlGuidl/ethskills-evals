-include .env

.PHONY: build test deploy local keeper check clean

build:
	forge build

test:
	forge test -vv

deploy:
	forge script script/Deploy.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

local:
	forge script script/Local.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

keeper:
	bash scripts/keeper.sh

check:
	bash scripts/check.sh $(ADDRESS)

clean:
	forge clean
