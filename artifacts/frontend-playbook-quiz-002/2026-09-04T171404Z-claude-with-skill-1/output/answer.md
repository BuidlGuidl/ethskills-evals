# Fork mode: the frontend is pointed at the wrong chain

## What is talking to what

| | Chain | Chain ID | RPC |
|---|---|---|---|
| Where the vault actually lives | local Anvil fork of Base | **31337** | `http://127.0.0.1:8545` |
| Where the frontend is looking | Base mainnet | **8453** | public Base RPC |

`yarn fork --network base` does not deploy anything to Base. It starts a
local Anvil node that *lazily copies* Base state as it is read, and it keeps
Anvil's own identity: chain ID **31337**, RPC `localhost:8545`. `yarn deploy`
then broadcast the vault to that local node, so the deployment succeeded —
just at 31337, and the address was written into
`packages/nextjs/contracts/deployedContracts.ts` under the `31337` key.

Meanwhile `targetNetworks: [chains.base]` tells the frontend that the app's
chain is 8453. Every symptom follows from that single mismatch:

- **"Contract not deployed"** — `useScaffoldContract` / `useDeployedContractInfo`
  look up the vault under key `8453` in `deployedContracts.ts`. There is no
  entry there; only `31337` exists.
- **Reads return nothing** — with no address resolved, the hooks have nothing
  to call, and any call that does go out goes to a public Base RPC where that
  address holds no code.
- **The wallet prompts on Base mainnet with real gas** — the wagmi config is
  built from `targetNetworks`, so the write is prepared for chain 8453. That is
  a real transaction on real Base, paid in real ETH. It only fails to do damage
  because the address is empty; a colliding address would be worse.

## Why the line looked logical

The reasoning is "we are forking Base, so our target network is Base." It
conflates two different things:

- **What the fork *simulates*** — the upstream chain whose state is copied. That
  is Base, and it's the argument to `yarn fork --network base`.
- **What the frontend must *connect to*** — the node actually holding your
  deployment and serving your JSON-RPC. That is the local Anvil node, 31337.

A fork is a *copy*. Balances, Uniswap pools, USDC, and every other bit of Base
state are visible on it, which is exactly why you forked — but the copy has its
own chain ID and its own state going forward. Your vault exists only in the
copy. `targetNetworks` selects the connection, not the lineage.

## The one-line fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — the local Anvil fork, not chains.base
```

Then reload the app and switch the wallet's network to Localhost 8545 (chain
31337). The vault resolves from the `31337` entry, reads hit the fork, and
writes are signed with worthless local ETH against local block state.

You still get everything you forked Base *for*: the fork lazily pulls real Base
state on demand, so the vault can interact with the real USDC address, real
pools, and real balances — all inside the local copy.

Two fork-mode conveniences worth using while you are here:

```bash
# fund a demo account from state that already exists, instead of deploying a mock token
cast rpc anvil_impersonateAccount <whale>
cast send <token> "transfer(address,uint256)" <demo-account> <amount> --from <whale> --unlocked

# keep block.timestamp moving, so vault deadlines/vesting/expiry render live
cast rpc anvil_setIntervalMining 1
```

That second one matters for a vault specifically. Anvil mines only when a
transaction arrives, so between transactions `block.timestamp` is frozen and
any lock-up, deadline, or accrual display sits still — even though `vm.warp`
unit tests pass. Interval mining (or `--block-time 1` on the fork script) makes
time advance continuously.

## When `chains.base` becomes right

At real deployment — the moment you stop pointing at a local fork and ship
against Base mainnet itself. Concretely, when you have:

1. run `yarn deploy --network base`, broadcasting the vault to Base with a
   funded real deployer key,
2. got an `8453` entry in `deployedContracts.ts` with the real address (and
   verified the contract on Basescan), and
3. decided that users' wallets *should* be prompted for real transactions
   paying real gas.

Only then does `targetNetworks: [chains.base]` describe reality. Flipping it
before the vault exists on 8453 is what produced this bug: the config was
written for the destination while the code still lived on the fork. During
development against a fork, the value is always `chains.foundry`.
