# Fork mode: frontend on wrong chain

## Where each side is

| | Chain | Chain ID | RPC |
|---|---|---|---|
| Vault actually lives | local Anvil fork of Base (`chains.foundry`) | **31337** | `http://127.0.0.1:8545` |
| Frontend talks to (`chains.base`) | real Base mainnet | **8453** | public Base RPC / wallet's Base RPC |

- `yarn fork --network base` starts Anvil with Base's state copied in, but it runs as the local chain **31337** (SE-2's fork script passes `--chain-id 31337`). Nothing on it is broadcast to Base.
- `yarn deploy` deploys to that local node, and writes the address to `packages/nextjs/contracts/deployedContracts.ts` under key **31337**.
- With `targetNetworks: [chains.base]`, the frontend works on chain **8453**:
  - looks up `deployedContracts[8453]` → no entry → "contract not deployed";
  - reads go to real Base RPC, where the vault address has no code → empty results;
  - writes ask the wallet to switch to/sign on chain 8453 → real Base mainnet tx, real gas (and it would hit an address with no vault on it).

## Why the line looked logical

"We fork Base, so target Base" confuses **what state is copied** with **which network you connect to**. The fork has Base's *state* (tokens, protocols, balances), but it is a separate local network: different RPC URL (localhost), different chain ID (31337), and it holds contracts that exist nowhere on real Base. `targetNetworks` picks the network the app connects to — the chain ID it filters contracts by, the RPC it reads from, and the chain the wallet signs for. So pointing it at Base sends the app off the fork and onto mainnet.

## One-line fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],
```

Then in the wallet use the local network (Localhost 8545, chain 31337) or the SE-2 burner wallet. Contract shows as deployed, reads come from the fork, writes cost only fork ETH.

## When `chains.base` becomes right

Only when the vault is **really deployed to Base mainnet** (e.g. `yarn deploy --network base` with a real funded deployer key), so `deployedContracts.ts` has an entry under **8453**. At that point — getting ready to ship the production frontend against the live contract — switch `targetNetworks` to `[chains.base]`. Before that, during all fork development and demos, keep `chains.foundry`.
