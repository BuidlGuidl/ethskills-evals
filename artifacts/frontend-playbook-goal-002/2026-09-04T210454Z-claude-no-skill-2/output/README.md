# USDC Tip Jar

A tip jar for [Base](https://base.org): a Solidity contract that takes USDC tips with a short
public message, and a Next.js page that shows the tip feed, sends tips, and connects a wallet.

The feed is stored onchain and read straight from the contract, so the app runs with no backend,
no database and no indexer — just a chain and a static frontend.

**Nothing here is deployed.** The project runs entirely against a local chain. See
[Deploying](#deploying) for what would change.

---

## Requirements

| Tool | Version used | Install |
| --- | --- | --- |
| [Foundry](https://getfoundry.sh) | forge/anvil 1.5.1 | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | 25.9 (20+ works) | https://nodejs.org |

No wallet extension is needed to run this locally — see [Connecting a wallet](#connecting-a-wallet).

## Quick start

```bash
npm run setup          # installs forge-std and the web app's dependencies
```

Then, in **terminal 1**, start a local chain and leave it running:

```bash
npm run chain          # anvil on http://127.0.0.1:8545
```

In **terminal 2**:

```bash
npm run deploy:local   # deploys the jar, writes web/.env.local
npm run dev:web        # http://localhost:3000
```

Open <http://localhost:3000>, connect one of the **Anvil account** wallets, and send a tip.
Each anvil account is pre-funded with 10,000 test USDC.

> `deploy:local` writes the contract addresses into `web/.env.local`, and Next inlines those at
> build time. Deploy before starting the dev server; if you redeploy afterwards and the page still
> shows the old addresses, restart `npm run dev:web`.

### Running against the real USDC contract

`npm run chain` deploys a `MockUSDC` because a fresh anvil chain has no USDC on it. To use the
**real** Base USDC contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, fork Base instead:

```bash
npm run chain:fork                                   # terminal 1 — anvil forking Base mainnet
npm run deploy:local                                 # terminal 2 — finds the real USDC and uses it
npm run fund:usdc                                    # gives anvil account #1 10,000 real USDC
npm run fund:usdc 0x3C44Cd...93BC 5000               # ...or any account, any amount
npm run dev:web
```

The fork runs with `--chain-id 31337` so the local dev wallets keep working. Point it at your own
endpoint with `BASE_RPC_URL=https://... npm run chain:fork` if the public one is rate-limiting you.

`fund:usdc` works by impersonating USDC's `masterMinter` and authorising your account as a minter —
a trick that only works on a local fork, which is exactly the point.

## Connecting a wallet

The connect button offers three kinds of wallet:

- **Injected** — MetaMask, Rabby, or whatever else is in the browser.
- **Coinbase Wallet** — the extension, or a smart wallet via popup.
- **Anvil account #1–#3** — only on a local chain. Anvil already has these accounts unlocked, so
  the app can send transactions through them without any extension. This is the fastest way to try
  the app, and it exercises the real approve-and-tip path.

The dev wallets come from `NEXT_PUBLIC_DEV_ACCOUNTS`, which `deploy:local` only fills in for chain
ID 31337. **Leave it empty on any public network** — it is a local convenience, not a wallet.

To use MetaMask against the local chain instead, add a network with RPC `http://127.0.0.1:8545`
and chain ID `31337`, then import an anvil private key (they are printed when anvil starts).

## Sending a tip

USDC is pulled with `transferFrom`, so tipping takes two transactions:

1. `approve(tipJar, amount)` on USDC — for exactly the tip amount, so no standing allowance is
   left behind afterwards.
2. `tip(amount, message)` on the jar.

The form does both in sequence and waits for each receipt. If an allowance is already large enough,
the approval is skipped.

## The contract

`contracts/src/TipJar.sol`. Constructor takes the tip token and the owner.

| Function | Who | What |
| --- | --- | --- |
| `tip(uint256 amount, string message)` | anyone | Pulls `amount` of the token and appends a tip to the feed. Returns the tip id. |
| `latestTips(uint256 limit)` | view | The newest tips first — what the page renders. |
| `getTips(uint256 offset, uint256 limit)` | view | A page of the feed, oldest first. Clamps to the array bounds. |
| `getTip(uint256 id)` / `tipCount()` | view | A single tip / how many there are. |
| `totalTipped()` / `tippedBy(address)` | view | Lifetime totals, in USDC base units. |
| `balance()` | view | What the jar currently holds. |
| `withdraw(address to, uint256 amount)` | owner | Send part of the jar somewhere. |
| `withdrawAll(address to)` | owner | Empty the jar. |
| `transferOwnership` / `acceptOwnership` | owner / pending owner | Two-step handover. |

Design notes:

- **The feed lives onchain.** `latestTips` means the frontend needs no indexer and no `eth_getLogs`
  range juggling. It costs more gas per tip than an event-only design would — a deliberate trade for
  a tip jar, where tips are infrequent and a reader with just an RPC URL is worth a lot.
  A `Tipped` event is emitted as well, so an indexer can still be added later.
- **Amounts are recorded as received**, measured as a balance delta rather than trusting the
  requested amount, so a fee-taking token cannot put a number in the feed that never arrived.
- **Transfers tolerate non-standard ERC-20s** that return nothing instead of `true`, and bubble up
  the token's own revert reason (e.g. USDC's blacklist error) rather than flattening it.
- **Withdrawing does not touch the feed.** `totalTipped` and the tip history are a permanent record.
- Tips are capped at `uint96` (~7.9e22 USDC) so each entry packs into fewer storage slots, messages
  at 140 bytes, and the contract rejects plain ETH.

`MockUSDC` (`contracts/src/mocks/MockUSDC.sol`) is a 6-decimal ERC-20 with an open `mint`, used by
the tests and by local deploys. It is never used when a real USDC is present.

## Tests

```bash
npm test               # forge test — 39 tests
```

Covers the tip and withdrawal paths, access control, the two-step ownership handover, feed
pagination edge cases, and the awkward token cases: fee-on-transfer, no return data, a token that
returns `false`, and one that reenters `tip` mid-transfer. Two fuzz tests check that pagination
never reads out of bounds and that any valid amount round-trips through the feed.

## Layout

```
contracts/           Foundry project
  src/TipJar.sol       the tip jar
  src/mocks/           MockUSDC, for local chains and tests
  test/TipJar.t.sol    39 tests
  script/Deploy.s.sol  local deploy; picks real USDC when the chain has it
web/                 Next.js app (App Router, wagmi + viem)
  app/                 page, layout, providers, styles
  components/          connect flow, tip form, feed, stats
  hooks/useTipJar.ts   contract reads, refreshed on each new block
  lib/                 env config, wagmi config, USDC formatting
  lib/tipJarAbi.ts     generated — see `npm run sync:abi`
scripts/             deploy-local, sync-abi, fund-usdc
```

## Configuration

`web/.env.local` is generated by `npm run deploy:local`; `web/.env.example` documents every key.

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_CHAIN_ID` | `31337` for anvil, `8453` for Base. |
| `NEXT_PUBLIC_RPC_URL` | Endpoint the app reads from. |
| `NEXT_PUBLIC_TIP_JAR_ADDRESS` | Deployed jar. |
| `NEXT_PUBLIC_USDC_ADDRESS` | Tip token. Base USDC, or the local MockUSDC. |
| `NEXT_PUBLIC_MOCK_TOKEN` | `true` adds a "mint test USDC" button. Local only. |
| `NEXT_PUBLIC_DEV_ACCOUNTS` | Unlocked anvil accounts to offer as wallets. Empty off 31337. |

If the addresses are missing the page renders setup instructions instead of erroring.

The deploy script reads `PRIVATE_KEY` (defaults to anvil's account #0), `TIP_JAR_OWNER` (defaults to
the deployer) and `USDC_ADDRESS` (defaults to Base USDC when the chain has it, else a fresh MockUSDC).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Install forge-std and the web dependencies. |
| `npm run chain` | anvil on port 8545. |
| `npm run chain:fork` | anvil forking Base mainnet, with chain id 31337. |
| `npm run deploy:local` | Deploy, refresh the ABI, write `web/.env.local`. |
| `npm run fund:usdc` | Mint real USDC to a local account (fork only). |
| `npm run dev:web` | Next dev server. |
| `npm run build:web` | Production build of the frontend. |
| `npm test` | Contract tests. |
| `npm run sync:abi` | Regenerate `web/lib/tipJarAbi.ts` from the Foundry build. |
| `npm run typecheck` | TypeScript check for the web app. |

`web/lib/tipJarAbi.ts` is generated but committed, so the frontend builds without Foundry. Rerun
`npm run sync:abi` after changing the contract — `deploy:local` does it for you.

## Deploying

Out of scope here, and nothing has been deployed. For the record, going to Base would mean:
auditing the contract, setting `PRIVATE_KEY` and `TIP_JAR_OWNER` (ideally a multisig), running the
deploy script against a Base RPC with `--verify`, and pointing `web/.env.local` at chain `8453`
with `NEXT_PUBLIC_DEV_ACCOUNTS` empty.

## Troubleshooting

**The page shows "Almost there".** `web/.env.local` has no addresses yet — run `npm run deploy:local`.

**Stats show `—` and the connect button does nothing.** The frontend can't reach the chain. Check
that anvil is still running and that `NEXT_PUBLIC_RPC_URL` matches it.

**Addresses look stale after a redeploy.** Restart `npm run dev:web`; Next inlines `NEXT_PUBLIC_*`
values into the client bundle.

**`forge: command not found`.** Foundry isn't installed or isn't on `PATH` — `foundryup`.

**Tips fail after restarting anvil.** A fresh chain has no contracts on it. Redeploy with
`npm run deploy:local` and restart the dev server.
