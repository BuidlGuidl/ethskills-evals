# Fork mode: `targetNetworks: [chains.base]` is the bug

## 1. Which network is which (the chain IDs)

| | Chain ID | What is actually there |
|---|---|---|
| Where the frontend is pointed | **8453** — Base mainnet (`chains.base`) | The real Base. Your vault is *not* on it. |
| Where the vault actually lives | **31337** — local Anvil fork (`chains.foundry`) | `yarn fork --network base` copied Base's state into a local Anvil node; `yarn deploy` put the vault there. |

`yarn fork --network base` does **not** run Base. It runs Anvil locally, seeded with Base mainnet state pulled over RPC, and Anvil keeps its own chain ID of **31337**. The `--network base` flag only chooses which chain gets copied — it is a data source, not an identity. So you have a node that *contains* Base's state but *is* chain 31337 at `http://127.0.0.1:8545`.

## 2. Why every symptom follows from that one line

Scaffold-ETH keys everything off `targetNetworks[0].id`:

- **"Contract not deployed."** `yarn deploy` wrote the vault's address into `deployedContracts.ts` under key `31337`. The frontend, told it is on 8453, looks up `deployedContracts[8453].Vault`, finds nothing, and reports not-deployed. The address is sitting in the file the whole time — just under a key nobody is reading.
- **Reads return nothing.** wagmi's transport for chain 8453 is a public Base RPC, not `localhost:8545`. Even with an address it would be calling real Base, where nothing is deployed at that address.
- **Forced write prompts real gas.** The request goes out tagged chain 8453, so the wallet switches to Base mainnet and quotes real ETH. **This is the dangerous symptom** — everything else is a silent no-op, but this one can actually spend money. Do not confirm those prompts.

**Why the teammate's reasoning looked right:** "We're forking Base, so the target network is Base" is sound-sounding but conflates *whose state* with *which node*. `targetNetworks` answers "which RPC do I dial and which chain ID do I sign for" — that is the node's identity, 31337. The fork's Base-ness lives inside the node's storage, not in its chain ID. The flag `--network base` reads like it configures the network you're on; it configures the network you're copying.

## 3. The one-line fix

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — the local fork, even when forking Base
```

Restart `yarn start`, reconnect the wallet (MetaMask must be on Localhost 8545 / chain 31337), and the vault resolves, reads populate, and writes cost fake ETH. Nothing else needs to change: `deployedContracts.ts` is auto-generated and already correct — do not hand-edit it.

Contract-side, nothing was wrong. The vault is genuinely deployed and you still have full real-Base state around it: real USDC, WETH, Uniswap, Aave. You can impersonate a whale to fund demo accounts (`cast rpc anvil_impersonateAccount <whale>` then `cast send <token> "transfer(address,uint256)" <demo> <amt> --from <whale> --unlocked`) rather than deploying a mock token. If the vault has any deadline, lock or vesting display, also turn on `cast rpc anvil_setIntervalMining 1` — Anvil otherwise only mines on transactions, so `block.timestamp` freezes between them and time-based UI breaks silently even though `vm.warp` tests pass.

## 4. When `chains.base` becomes correct

Exactly when the vault is deployed to **real Base mainnet (8453)** — i.e. you run the deploy against Base itself rather than the fork, and `deployedContracts.ts` gains an `8453` entry with the real address. That is the production ship step, not a development step.

The rule: **`targetNetworks` names the chain the contracts you want to talk to are actually deployed on.** During fork development that is 31337 no matter what you forked. Flip to `chains.base` as part of going to production, and when you do, pair it with an `rpcOverrides` entry pointing at a paid provider (Alchemy or similar) — not `mainnet.base.org` — plus `pollingInterval: 3000`.

A useful tell for next time: if the wallet ever prompts for a *real-gas* transaction during local development, `targetNetworks` is wrong. Correct fork setup can never produce that prompt.
