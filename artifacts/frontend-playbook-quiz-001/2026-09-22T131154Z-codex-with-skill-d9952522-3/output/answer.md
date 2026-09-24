`yarn chain` is a fresh local Anvil chain, not Base.

It has chain id `31337`, the default funded Anvil accounts, and only the contracts
you deploy into it with `yarn deploy`. It does not contain Base mainnet state. That
means Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, the Aave V3 Pool,
the PoolAddressesProvider, aTokens, reserves, balances, approvals, and all related
storage are absent unless your deploy script created mocks at those addresses.

So this probe fails:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

On the plain local chain, that address is just an empty account with no ERC20 bytecode.
The call returns no valid `uint256` ABI data, so `cast` cannot decode it. The same
thing happens inside the vault integration paths: calls that expect real Aave/USDC
contracts are pointed at addresses with no corresponding code or state, so the
integration reverts even though mock-based Forge tests pass.

The local setup for testing against real Aave and real USDC is to run Anvil as a
fork of Base:

```bash
yarn fork --network base
```

or equivalently, with raw Anvil:

```bash
anvil --fork-url <BASE_RPC_URL>
```

Then run the deploy against that local fork:

```bash
yarn deploy
```

The frontend should still connect to the local Foundry/Anvil network at
`http://localhost:8545`, usually chain id `31337`. Do not switch the app to real
Base for this workflow. The important difference is that the local chain now starts
from a copied Base state, so calls to Base USDC and Aave V3 addresses hit the real
deployed bytecode and real storage from the forked block.

What stays local:

- Your vault deployment is local.
- Transactions are mined by your local Anvil node.
- Test approvals, deposits, borrows, supplies, and reverts are local simulation.
- No transaction is broadcast to Base.
- No real wallet funds are at risk.
- Impersonation only works inside the local fork.

To give a test account a large USDC balance, impersonate an existing Base USDC holder
on the fork and transfer local-fork USDC to your dev account:

```bash
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export DEV_ACCOUNT=<your local test account>
export USDC_WHALE=<base account with enough USDC>

cast rpc anvil_impersonateAccount $USDC_WHALE --rpc-url http://localhost:8545

cast send $USDC "transfer(address,uint256)" \
  $DEV_ACCOUNT \
  100000000000 \
  --from $USDC_WHALE \
  --unlocked \
  --rpc-url http://localhost:8545

cast rpc anvil_stopImpersonatingAccount $USDC_WHALE --rpc-url http://localhost:8545
```

USDC has 6 decimals, so `100000000000` is `100,000 USDC`. After that, the same
`balanceOf` probe should decode normally on localhost, and the vault can approve,
supply, withdraw, and otherwise integrate against the real Aave/USDC contracts on
the local fork.
