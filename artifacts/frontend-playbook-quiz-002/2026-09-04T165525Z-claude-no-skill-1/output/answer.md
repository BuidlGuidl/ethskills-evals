# Why the vault is "not deployed": the fork is not Base

## TL;DR

| | Chain | ID | RPC |
|---|---|---|---|
| Where the frontend is pointed | Base mainnet | **8453** | public Base RPC |
| Where the vault actually lives | local Anvil fork ("foundry") | **31337** | `http://127.0.0.1:8545` |

One-line fix, in `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.foundry],   // 31337 — the local fork, not chains.base (8453)
```

(`chains.foundry` comes from the `import * as chains from "viem/chains"` already at the
top of that file. On the hardhat flavor the equivalent is `chains.hardhat`, also 31337.)

---

## What's actually happening

### 1. `yarn fork --network base` does not give you Base

Scaffold-ETH's fork script is Anvil with a fork URL, and it pins the chain ID:

```
anvil --fork-url <base rpc> --chain-id 31337 --config-out localhost.json
```

Anvil copies Base's *state* — balances, deployed bytecode, storage, the whole world at
the fork block — so USDC, Aerodrome, your target protocol are all there and behave like
production. But the node itself is a brand-new, separate chain: chain ID **31337**,
listening on `127.0.0.1:8545`, with its own block production and its own funded test
accounts.

Forking copies history. It does not make you Base. This is the single idea the whole
bug rests on.

### 2. `yarn deploy` therefore deployed to 31337

With no `--network` flag, the deploy script defaults to `localhost`. So the vault was
broadcast to the Anvil fork, and `packages/nextjs/contracts/deployedContracts.ts` got
written with the address nested under the key `31337`:

```ts
const deployedContracts = {
  31337: {
    Vault: { address: "0x…", abi: [...] },
  },
} as const;
```

Note there is **no `8453` key in that file**. That is the whole failure, visible in one
line. You can confirm it right now with `grep -n "^\s*[0-9]*:" packages/nextjs/contracts/deployedContracts.ts`.

### 3. What `targetNetworks: [chains.base]` then does

`targetNetworks[0]` is the app's active chain. Setting it to `chains.base` tells the
entire frontend stack "we are on 8453," and every symptom follows mechanically:

- **"Contract not deployed."** `useDeployedContractInfo` / `useScaffoldContract` look up
  `deployedContracts[targetNetwork.id]` → `deployedContracts[8453]` → `undefined`. The
  hook has no address, so it reports the contract as missing.
- **Reads return nothing.** With no address (and wagmi's transport now pointed at the
  public Base RPC rather than `localhost:8545`), `useScaffoldReadContract` has nothing to
  call. Even if an address were hardcoded, it would be queried against real Base, where
  your vault was never deployed.
- **The wallet prompts for real gas.** Forcing a write makes wagmi build a transaction for
  chain 8453. The wallet dutifully switches to Base mainnet and quotes real ETH — because
  you genuinely did ask it to transact on Base mainnet. Nothing is intercepting it; the
  local node is not in the path at all.
- **The burner wallet disappears.** SE-2's burner is gated on the target network being
  local (`onlyLocalBurnerWallet`), so on 8453 you're pushed to an injected wallet — another
  tell that the app thinks it's in production.

### 4. Why the teammate's line looked so reasonable

The reasoning was: "we're forking Base, so the target network is Base." That maps the
*data* the fork contains onto the *network identity* the frontend addresses — and those
are two different things.

`targetNetworks` is not a statement about which chain's state you're simulating. It's the
routing key that answers three concrete questions:

1. Which RPC URL does wagmi send calls to?
2. Which key does the app read out of `deployedContracts.ts`?
3. Which chain ID does the wallet get asked to sign for?

For all three, the correct answer during fork development is 31337 — the local node — even
though the world inside that node is a copy of Base. The teammate set a *content*
description where the config wanted an *address*.

The confusion is also reinforced by the fork feeling so real: your vault can call live
Aerodrome pools and read live USDC balances. That's exactly the point of forking, and it
makes it easy to forget you're on a private chain with a different ID.

---

## The fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],
```

Then restart the Next.js dev server (`scaffold.config.ts` is read at build/boot), and if
your wallet still has a stale "Base" session, disconnect and reconnect — or just use the
burner, which comes back automatically now that the target network is local again.

You should immediately see the vault as deployed, reads resolve against
`http://127.0.0.1:8545`, and writes sign with test ETH and confirm instantly.

Two things *not* to do:

- **Don't run the fork with `--chain-id 8453`** to make `chains.base` "true." It would
  half-work and then bite you: the chain IDs match, but `chains.base` also carries Base's
  public RPC URL and block explorer, so you'd need RPC overrides everywhere, your wallet
  would show a mainnet-labeled network it can't distinguish from the real one, and a
  moment of inattention becomes a real mainnet transaction. Keeping the fork at 31337 is a
  safety feature — the chain ID is the thing that stops a local test from leaking onto
  mainnet.
- **Don't hardcode the vault address** into a `useContractRead`. It papers over the routing
  problem while leaving the app pointed at mainnet.

If you want to browse both without editing the config each time, you can list several —
`targetNetworks: [chains.foundry, chains.base]` — but the first entry is the default active
chain, so keep `chains.foundry` first while developing.

---

## When `chains.base` becomes the right value

At the moment the vault actually exists on Base mainnet — i.e. right after:

```bash
yarn deploy --network base
```

That command broadcasts with a real deployer key funded with real ETH, and regenerates
`deployedContracts.ts` with an **`8453`** entry containing the mainnet address. Only once
that key exists does `targetNetworks: [chains.base]` resolve to something. Flipping the
config is the *last* step of shipping, not the first — config follows deployment, never
leads it.

The normal progression:

1. **Local fork development** — `chains.foundry` (31337). Fast, free, disposable, but with
   real Base state to integrate against.
2. **Public testnet** — `yarn deploy --network baseSepolia`, then `chains.baseSepolia`
   (84532). Real network conditions, real wallets, other people can click it, no money at
   risk.
3. **Mainnet launch** — `yarn deploy --network base`, verify the contract, then
   `chains.base` (8453), plus a production RPC key in `scaffoldConfig.rpcOverrides` /
   `NEXT_PUBLIC_ALCHEMY_API_KEY` so you're not on the rate-limited public endpoint.

The rule that generalizes: **`targetNetworks` must always name the chain ID that has a
matching key in `deployedContracts.ts`.** If those two disagree, the frontend will report
"not deployed" regardless of how successful the deploy looked — and, worse, will happily
quote you real gas on the chain you named.
