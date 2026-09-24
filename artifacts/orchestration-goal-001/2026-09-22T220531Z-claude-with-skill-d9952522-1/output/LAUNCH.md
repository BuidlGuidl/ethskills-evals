# LAUNCH.md — creator-tipping dApp, localhost → live on Base

Follow this top to bottom. Order matters: it is built so that every mistake
that can be made cheaply is made before the one that can't.

The launch is **three moves, never one**:

1. **Phase A — contracts local.** Harden against a *fork of Base*, not a bare
   local chain, so you're testing against the real USDC.
2. **Phase B — contracts live, frontend still on localhost.** Real chain, real
   gas, real 6-decimal USDC, real wallet — while the UI is still yours alone to
   edit in seconds.
3. **Phase C — frontend public.** Only after you personally walked the whole
   journey against the live contracts with your own money.

Phase B is the one teams skip and the one that catches everything. Do not
collapse it into Phase C.

Each phase ends with a **GATE**. A gate is a go/no-go condition, not a
formality. If a gate fails, you stop and fix — you do not proceed and
"circle back". A runbook that names the commands but not the conditions
will happily keep going after something has already gone wrong.

---

## Phase 0 — Facts to pin down before you touch anything

Fill these in now; several later steps need them and guessing mid-deploy is
how the wrong address ends up in a constructor.

| Thing | Value |
|---|---|
| Target chain | Base mainnet, chain id **8453** |
| USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (**6 decimals**) |
| Platform fee | 1% (confirm the exact basis-point constant in the contract) |
| Fee recipient | a **multisig or hardware wallet** you control — not the deployer EOA |
| Owner / admin | same as above, or a separate multisig |
| Frontend host | Vercel (assumed below; adapt if not) |

Two things to settle as a team *before* deploying, because both are baked in
at deploy time and one of them is irreversible in practice:

- **Fee recipient.** Fees accrue to this address from the first tip. If it's a
  hot EOA whose key lives in `packages/foundry/.env`, that's where your revenue
  sits. Use a Safe.
- **Can the fee recipient / fee rate be changed later?** If the contract has no
  setter, a wrong address at deploy means a redeploy and a migration. Check
  now. If there is a setter, confirm it's owner-gated and that the owner is
  the multisig, not the deployer.

Also decide the **USDC address source**. If it's hardcoded in the contract,
verify the literal matches the table above character for character. If it's a
constructor arg, it comes from the deploy script — see Step A4.

---

# Phase A — Contracts hardened locally

### A1. Clean checkout, clean install

```bash
git status                 # must be clean; you will be tagging this commit
yarn install
```

`postinstall` copies `packages/foundry/.env.example` → `packages/foundry/.env`.
That template already carries a working `ETHERSCAN_API_KEY`, so contract
verification works on a fresh checkout with nothing to obtain. **There is no
"get a block explorer API key" step in this launch.** Swapping in your own key
is optional housekeeping for later, not a dependency. Do not hand a teammate an
env template with a blank `ETHERSCAN_API_KEY=` to fill in — the value is
already there and waiting on it waits for nothing.

### A2. Tests green

```bash
yarn foundry:test
```

Before you move on, confirm the suite actually covers the things that bite a
fee-taking token app. Write the missing ones now — this is the cheapest moment
in the whole launch to add a test:

- **Decimals.** USDC is 6 decimals, not 18. A tip of "1 USDC" is `1_000_000`.
  Assert a full tip→split→payout cycle in 6-decimal units.
- **Fee rounding.** 1% of a tip that doesn't divide by 100 — e.g. `1` unit
  (0.000001 USDC), `99`, `101`, `1_000_001`. Assert `fee + creatorAmount ==
  tipAmount` exactly, with **no wei of USDC stranded** in the contract and no
  path where rounding lets the fee exceed 1%.
- **Zero / dust tips.** A 1-unit tip yields a 0 fee. Is that accepted, or does
  it revert? Either is a valid choice; an unintended revert on the smallest tip
  is not.
- **Transfer return values.** USDC on Base is a standard ERC-20, but use
  `SafeERC20` regardless. If the code calls `transfer`/`transferFrom` raw and
  ignores the return, fix it before you deploy.
- **Allowance path.** Insufficient `approve` must revert with something the UI
  can surface, not consume a partial tip.
- **Reentrancy / ordering.** State updated before external calls; `nonReentrant`
  on anything that moves tokens.
- **Access control.** Non-owner cannot change the fee, the recipient, or
  withdraw. Assert the revert, not just the happy path.

### A3. Fork Base and rehearse against real USDC

Do **not** rehearse on a bare `yarn chain`. Fork the chain you're targeting so
real USDC, real whales and real token behaviour are already deployed and you
write no mocks of things that exist:

```bash
yarn fork --network base
```

**Get the invocation exactly right.** yarn binds the first token after the
script name to `$0`, whatever it looks like, so the script's `$1` is only set
if something precedes the value. These work:

```bash
yarn fork --network base     # ✅
yarn fork -n base            # ✅
yarn fork -- base            # ✅
```

These **silently fork Ethereum mainnet** instead, with no error:

```bash
yarn fork base               # ❌
yarn fork --network=base     # ❌
```

A silent mainnet fork is the nastiest failure mode in this phase: everything
looks fine, USDC is at a different address, and you debug a ghost for an hour.

**The chain id cannot tell you what you forked** — the fork answers `31337`
either way. Check for state only Base has: code at the Base USDC address.

```bash
# in a second terminal, against the running fork
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545 | head -c 20
```

**GATE A3:** non-empty bytecode. If it prints `0x`, you forked the wrong chain
— kill it and re-run with `--network base` spelled as above. Belt and braces:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url http://127.0.0.1:8545
# → USDC
```

### A4. Run the real deploy script against the fork

Same script, same constructor args you intend to use on mainnet — including
the real fee recipient and the real USDC address. This is a rehearsal, so
rehearse the actual thing:

```bash
yarn deploy   # defaults to localhost, i.e. your Base fork
```

Check, before moving on:

- Deploy succeeded and printed the address.
- Constructor args are what you intended — read them back onchain rather than
  trusting the log:

```bash
cast call <DEPLOYED> "usdc()(address)"          --rpc-url http://127.0.0.1:8545
cast call <DEPLOYED> "feeRecipient()(address)"  --rpc-url http://127.0.0.1:8545
cast call <DEPLOYED> "owner()(address)"         --rpc-url http://127.0.0.1:8545
```

- Then drive one **real tip end to end on the fork**, funded from a USDC whale
  via `cast rpc anvil_impersonateAccount`: approve → tip → assert the creator's
  USDC balance rose by 99% and the fee recipient's by 1%, in 6-decimal units.

### A5. Walk the journey in the browser, still on the fork

Leave `scaffold.config.ts` `targetNetworks` on `chains.foundry` for this — the
fork answers 31337 no matter what it forked, so the *local* chain entry is the
correct one while you're forking. Do not point the frontend at `base` yet.

```bash
yarn start
```

Connect a browser wallet on chain 31337 and do the full loop: connect →
approve USDC → tip → see the creator balance change → see the fee land.

### 🚦 GATE A — before deploying to the live network

All four, no exceptions:

- [ ] `yarn foundry:test` passes, including the decimals/rounding/access tests.
- [ ] The deploy script runs **clean against a Base fork**, with mainnet args.
- [ ] A real tip completed on the fork with real USDC and split 99/1 exactly.
- [ ] A funded deployer exists — see Step B1, and it needs the ETH **before**
      the deploy, not after it fails.

---

# Phase B — Contracts live on Base, frontend still on localhost

### B1. Deployer account

```bash
yarn generate     # creates a deployer, writes the key to gitignored packages/foundry/.env
yarn account      # prints the address and its balance on each chain
```

- `yarn generate` writes the private key to `packages/foundry/.env`, which is
  gitignored. Confirm that with `git status` — if that file ever shows up as
  untracked-and-about-to-be-added, stop.
- Send real ETH on **Base** to the printed address. ~0.01 ETH is ample for a
  deploy plus a few admin txs; bridge or buy it now, not mid-deploy.
- Re-run `yarn account`.

**GATE B1:** `yarn account` shows a non-zero Base balance. The deployer EOA is
a hot key — it should own nothing after launch except leftover gas. Ownership
and fee receipt belong to the multisig from Phase 0.

### B2. Deploy to Base

```bash
yarn deploy --network base
```

Save the printed address. Note the commit you deployed from:

```bash
git rev-parse HEAD
git tag -a launch-base-v1 -m "Contracts deployed to Base" && git push --tags
```

### B3. Verify — in the same breath, not later

```bash
yarn verify --network base
```

This belongs **immediately** after the deploy, not in a checklist weeks out.
Until it runs, users and integrators are looking at opaque bytecode and you are
debugging a live contract without source on the explorer.

One real constraint: `yarn verify` replays `broadcast/run-latest.json`, so **run
it from the same checkout that did the deploy**. If your teammate deployed,
they run the verify — you can't run it from your machine.

**GATE B3:** open `https://basescan.org/address/<DEPLOYED>#code` and see green
verified source. If verification fails, fix it now while `run-latest.json` is
still the one you want, rather than after three more deploys have overwritten it.

### B4. Read the live contract back

Same three calls as A4, now against Base:

```bash
cast call <DEPLOYED> "usdc()(address)"         --rpc-url https://mainnet.base.org
cast call <DEPLOYED> "feeRecipient()(address)" --rpc-url https://mainnet.base.org
cast call <DEPLOYED> "owner()(address)"        --rpc-url https://mainnet.base.org
```

**GATE B4:** USDC is `0x8335…2913`, and owner/feeRecipient are the **multisig**,
not the deployer EOA. If ownership transfer is a separate transaction, do it
now and re-read `owner()` to confirm it landed. Getting this wrong means your
platform revenue accrues to a hot key.

### B5. Point the frontend at Base — one step, both changes

Change the deployed addresses and the target network **together**. A frontend
built after one and before the other reads a chain nobody is on.

In `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.base],
```

`yarn deploy --network base` regenerates
`packages/nextjs/contracts/deployedContracts.ts` with the Base entry — confirm
chain id `8453` appears there with your address.

**`scaffold.config.ts` is committed to git.** Do not paste an RPC URL, an
Alchemy key or any other secret into `rpcOverrides` or `alchemyApiKey` — that
is a published key the moment you push. Read it from `process.env` and keep the
value in `.env.local`:

```ts
// scaffold.config.ts — committed, so no literals
alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
```

```bash
# packages/nextjs/.env.local — gitignored, never committed
NEXT_PUBLIC_ALCHEMY_API_KEY=...
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
```

Then `git diff` before committing and confirm no secret is in the diff.

The default public Base RPC will rate-limit under real traffic. Get a
dedicated RPC (Alchemy/QuickNode/Infura) now rather than debugging "the app is
slow" on launch day.

### B6. UI correctness against a live chain

Run `yarn start` locally, now talking to Base, and check the things that only
break against real money:

- Amounts render with **6 decimals**, not 18 — a 5 USDC tip must show as
  `5.00`, not `0.000000000000005`.
- The approve → tip two-step handles: first-ever approve, an existing
  insufficient allowance, and a user who rejects the approve.
- Wrong-network state: connect the wallet to Ethereum and confirm the UI says
  "switch to Base" rather than silently sending to the wrong chain.
- Insufficient USDC and insufficient ETH-for-gas both produce a readable error.
- The fee shown to the user matches what the contract actually takes.

### B7. The real-money walk-through

With **$1–10 of your own USDC** on Base, through the localhost frontend against
the live contract: connect → approve → tip a creator address → confirm on
Basescan that 99% reached the creator and 1% reached the fee recipient.

Then do it a second time from your teammate's machine and a different wallet.
One person's browser working is not a launch signal.

### 🚦 GATE B — before the frontend is reachable publicly

- [ ] Contract deployed to Base and **verified on Basescan**.
- [ ] `owner()` and `feeRecipient()` are the multisig; ownership transfer
      confirmed onchain.
- [ ] You walked the **entire user journey** against the live contracts with a
      real wallet and real money, and every step worked.
- [ ] Two different people, two different wallets, both succeeded.
- [ ] No secret is committed in `scaffold.config.ts` or anywhere else.

---

# Phase C — Frontend public

### C1. Deploy

```bash
yarn vercel        # first run links the project; use --prod when you mean it
yarn vercel --prod
```

Set the env vars in the Vercel project settings — the same keys as
`.env.local` (`NEXT_PUBLIC_ALCHEMY_API_KEY`,
`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`). They are **not** read from your local
file. A missing key here is the classic "works locally, dead in prod".

Confirm the build used the commit that has `targetNetworks: [chains.base]`.

### C2. The last gate is a transaction, not a page load

**Load the public URL yourself and put one real transaction through it.**
Not a preview deploy, not localhost — the production URL, a fresh browser
profile, a wallet that has never touched this app.

Then once more on a phone, over cellular, with a mobile wallet. Mobile
WalletConnect is where a missing project ID surfaces.

### 🚦 GATE C — you are live

- [ ] Public URL loads, shows Base, connects a wallet.
- [ ] One real tip completed **through the public URL**, verified on Basescan.
- [ ] Mobile wallet path works.
- [ ] Links to the verified contract on Basescan are in the UI or the README.

Announce only after this gate, not after C1.

---

# After launch

### Watch for the first hour, then the first day

- Basescan address page → Events: watch tips arrive, confirm the 1% split holds
  on amounts you didn't pick.
- Fee recipient balance growing as expected.
- Vercel logs for RPC rate-limit errors (429s) — the first sign the public RPC
  isn't enough.
- Deployer ETH balance, if anything is automated.

### If you find a bug in the live contract

Deployed bytecode cannot be edited, and the contract is a **public API** — a
guard added in the frontend binds nobody, because direct calls, integrators and
other frontends reach the same function. Shipping a UI clamp to buy hours is
fine; calling it the fix is not.

The fix is the whole loop, in order:

1. **Reproduce locally** — on a Base fork, ideally pinned to the block where it
   happened.
2. **Correct the source.**
3. **Add the regression test that fails without the correction.** Not optional;
   without it you don't know you fixed it.
4. **Redeploy** (`yarn deploy --network base`), or upgrade in place if it's
   behind a proxy.
5. **`yarn verify --network base`** — same breath, from the deploying checkout.
6. **Repoint the frontend** if the address moved — `deployedContracts.ts` plus
   a redeploy of the frontend.
7. **Handle the state and users already there** — funds stuck in the old
   contract, tips in flight, comms. Migration or an announcement; your call,
   but make it deliberately.

This loop is the same whether the bug surfaces the day before launch or with
the app already public. The only thing that changes after launch is step 7.

---

## Quick reference

```bash
yarn install                      # postinstall copies .env.example → .env (ETHERSCAN_API_KEY included)
yarn foundry:test                 # contract tests
yarn fork --network base          # fork Base — NOT `yarn fork base`
yarn deploy                       # deploy to localhost/fork
yarn generate                     # create deployer, key → gitignored packages/foundry/.env
yarn account                      # deployer address + per-chain balances
yarn deploy --network base        # live deploy
yarn verify --network base        # immediately after; run from the deploying checkout
yarn start                        # frontend, localhost
yarn vercel --prod                # frontend, public
```

**Things that silently do the wrong thing:**

| Looks fine | Actually |
|---|---|
| `yarn fork base` | forks Ethereum mainnet |
| `yarn fork --network=base` | forks Ethereum mainnet |
| chain id `31337` on a fork | tells you nothing about what you forked |
| key in `scaffold.config.ts` | committed and published |
| `yarn verify` from the other machine | no `broadcast/run-latest.json`, fails |
| frontend guard on a contract bug | binds nobody; direct callers bypass it |
