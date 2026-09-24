# Why the local integration calls fail

`yarn chain` in the Foundry flavor starts a fresh local Anvil chain. That chain has Anvil's development accounts, their local ETH balances, and whatever contracts you deploy with `yarn deploy`. It is not Base, and it does not contain Base's historical state.

So after:

```bash
yarn chain
yarn deploy
```

the local RPC at `http://localhost:8545` contains your locally deployed vault and any mocks your deploy script created. It does not contain Circle's Base USDC contract, the Aave V3 Base pool, the Aave address provider, aTokens, debt tokens, oracle contracts, or Base account balances unless you explicitly deployed or forked them.

That is why this probe fails:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is native USDC on Base. On the plain local Anvil chain, that same address is just an empty account with no bytecode. A `balanceOf` call to an address with no contract code returns no ABI-encoded `uint256`, so `cast` cannot decode the result. The probe is failing because the address is real on Base but empty on your local devnet.

The passing mock-based Forge tests only prove that your vault works against the mock contracts used in those tests. They do not prove that the local app chain has real USDC or real Aave deployed at the Base addresses.

# Local setup that hits real Base USDC and real Aave

Run Anvil as a Base fork instead of a blank dev chain:

```bash
export BASE_RPC_URL="https://mainnet.base.org"

# From the repo root if your Scaffold-ETH package exposes this:
yarn fork "$BASE_RPC_URL"

# Or directly:
anvil --fork-url "$BASE_RPC_URL" --chain-id 31337 --host 127.0.0.1
```

Then deploy your local vault into that fork:

```bash
yarn deploy --network localhost
```

Keep the frontend pointed at the local Foundry/localhost network, usually chain id `31337`. The RPC is local, but reads for existing Base addresses are served from the forked Base state. Your vault is local; USDC and Aave are the real Base contracts as of the fork block.

Useful Base addresses:

```text
Base USDC:                    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Aave V3 Base Pool Provider:   0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
Aave V3 Base Pool:            0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
```

In contract code, prefer taking the Aave `PoolAddressesProvider` and asking it for the pool, rather than hard-coding the pool directly. The Aave address book lists those Base addresses here: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol

After the fork is running, this should now return a normal `uint256`:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

# What stays local

Everything you do after the fork starts is local to Anvil:

- Your vault deployment is local.
- Approvals, deposits, withdrawals, and test transfers are local.
- ETH used for gas is local Anvil ETH.
- Any USDC you move while impersonating accounts is moved only inside the fork overlay.
- Restarting Anvil resets that local overlay unless you persist/load state.

No transaction is sent to Base mainnet unless you point a wallet or script at a real Base RPC and sign there. The fork reads real Base state, but writes are local.

# Giving a test account six figures of USDC

Use Anvil impersonation on the fork. Pick any current Base USDC holder with more than `100_000 USDC` from the BaseScan holder list, impersonate that address locally, transfer USDC to your dev account, then stop impersonating.

Example:

```bash
export RPC_URL="http://localhost:8545"
export USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export DEV="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
export USDC_WHALE="<base-usdc-holder-with-at-least-100000-usdc>"

# Give the impersonated account local ETH for gas on the fork.
cast rpc anvil_setBalance "$USDC_WHALE" 0x8ac7230489e80000 --rpc-url "$RPC_URL"

cast rpc anvil_impersonateAccount "$USDC_WHALE" --rpc-url "$RPC_URL"

# USDC has 6 decimals, so 100,000 USDC is 100000000000 base units.
cast send "$USDC" \
  "transfer(address,uint256)" \
  "$DEV" \
  100000000000 \
  --from "$USDC_WHALE" \
  --unlocked \
  --rpc-url "$RPC_URL"

cast rpc anvil_stopImpersonatingAccount "$USDC_WHALE" --rpc-url "$RPC_URL"
```

Now the local dev account has `100,000 USDC` on the fork. From the app or scripts, that account can approve your vault, deposit into it, and let the vault call real Aave V3 Base contracts. The whale did not lose real funds; the transfer happened only in the local fork state.
