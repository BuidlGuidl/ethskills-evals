RPC_URL ?= http://localhost:8545

.PHONY: build test coverage deploy anvil

build:
	forge build

test:
	forge test -vvv

coverage:
	forge coverage

deploy:
	forge script script/Deploy.s.sol --rpc-url $(RPC_URL) --broadcast

anvil:
	anvil
