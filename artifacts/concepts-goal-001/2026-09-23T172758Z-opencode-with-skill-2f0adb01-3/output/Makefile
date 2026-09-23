SHELL := /bin/bash
-include .env
export

ADDR ?=
FILE ?= customers.txt

.PHONY: help build test deploy settle check clean

help:
	@echo "make build                forge build"
	@echo "make test                forge test"
	@echo "make deploy              broadcast Deploy.s.sol to RPC_URL"
	@echo "make settle FILE=path    run keeper.sh against an address file"
	@echo "make check ADDR=0x..     isSubscribed(ADDR)"
	@echo "make clean                remove build artifacts"

build:
	forge build

test:
	forge test

deploy:
	forge script script/Deploy.s.sol --rpc-url $(RPC_URL) --broadcast

settle:
	./script/keeper.sh $(FILE)

check:
	cast call $(BILLING_ADDRESS) "isSubscribed(address)(bool)" $(ADDR)

clean:
	forge clean
