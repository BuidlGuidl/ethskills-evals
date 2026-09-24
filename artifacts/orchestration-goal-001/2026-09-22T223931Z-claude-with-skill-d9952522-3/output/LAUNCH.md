# LAUNCH.md — creator tipping dApp, localhost → live on Base

Follow this top to bottom. It is written to be executed verbatim, and the order
is the point.

Going live is **three moves, never one**:

1. **Contracts local** — hardened and rehearsed against a fork of Base itself.
2. **Contracts live on Base, frontend still on localhost** — real chain, real
   gas, real USDC, real wallet, while the UI is still yours alone to edit in
   seconds.
3. **Frontend public** — and only then.

Move 2 is the one teams skip and the one that catches everything: decimals,
approvals, gas, a fee recipient that was silently the deployer. Do not collapse
it into move 3.

Each move ends with a **GO / NO-GO** gate. A runbook that lists commands but not
conditions will happily keep going after something has already gone wrong. If a
gate fails, you go back inside that move — you do not proceed and fix it later.

Two people: pick a **driver** (runs every command from one checkout) and a
**checker** (reads the explorer, confirms numbers, holds the go/no-go). The
driver's checkout matters later — verification replays local artifacts.

---

## Move 0 — Decisions to make before you touch a network

Write the answers down; several steps below hard-code them.

| Decision | Why it must be decided now |
| --- | --- |
| **Fee recipient address** | It is a constructor/config value burned into the deployment. If you leave it defaulting to the deployer EOA you will discover it only when fees have piled up in a hot key. Use a multisig (Safe on Base) or at minimum a cold address you both control. |
| **Owner / admin address** | Same reasoning. Whoever can change the fee or the recipient should not be a key that sits in `packages/foundry/.env`. |
| **USDC address on Base** | Base has *native* USDC and *bridged* USDbC. They are different tokens. Pick one, and confirm the address on the fork in Move 1 rather than trusting any document, including this one. |
| **Is there an upgrade path?** | If the contract is not behind a proxy, a bug means redeploy + repoint + migrate. That is fine — but decide it now, because it changes how fast Move 4 can be. |
| **Deployer funding** | Deployer needs real ETH on Base *before* the deploy, not after it fails. ~0.01 ETH is generous for one deploy; bridge or buy it during Move 1 so it has settled by Move 2. |

Two things people put on launch checklists that do **not** belong here:

- **A block explorer API key.** `packages/foundry/.env.example` already carries a
  working `ETHERSCAN_API_KEY` and postinstall copies it to `.env`, so `yarn
  verify` works on a fresh checkout. Swapping in your own key is optional
  housekeeping *after* launch. Do not hand anyone an env template with a blank
  `ETHERSCAN_API_KEY=` to fill in — it waits for nothing.
- **Changing `targetNetworks` "so we're ready."** The frontend goes to Base in
  Move 3, in the same step that repoints it at the deployed addresses. Flipping
  it early gives you a frontend reading a chain nobody is on.

---

## Move 1 — Contracts local, rehearsed on a fork of Base

You have tests passing on a local chain. That is not the same as having
rehearsed the deploy against Base.

### 1.1 Clean-room check that the repo is actually reproducible

```bash
git status --porcelain          # must be empty; uncommitted state is invisible to your teammate
yarn install
yarn foundry:test               # or: yarn test
yarn compile
```

**Check:** all tests green on a checkout with nothing stashed, on *both* your
machines. If it only builds on the driver's laptop, you do not have a
deployable repo.

### 1.2 Stand up a fork of Base — not a bare local chain

```bash
yarn fork --network base
```

This gives you the real Base state: real USDC, real balances, funded whales, so
you write no mocks of things that already exist.

**The argument form matters.** yarn binds the first bare token after the script
name to the script itself, so the network is only read if something precedes the
value. These work:

```bash
yarn fork --network base
yarn fork -n base
yarn fork -- base
```

These **silently fork Ethereum mainnet** instead, with no error:

```bash
yarn fork base            # WRONG
yarn fork --network=base  # WRONG
```

**Check — and do not skip this, it is the single most common silent failure in
this whole document:** the fork answers chain id `31337` no matter what it
forked, so the chain id tells you nothing. Prove it by looking for code that
only exists on Base:

```bash
# In another terminal. Substitute your chosen USDC address.
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545 | head -c 20
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url http://127.0.0.1:8545
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
```

Non-empty code, `USDC`, and `6`. Empty code means you forked mainnet — kill it
and re-run with the right argument form. Record the decimals value; it is the
next trap.

### 1.3 Rehearse the deploy script against the fork

```bash
yarn deploy                     # defaults to localhost, which is now your Base fork
```

**Check:** the script completes with no reverts, and the constructor arguments
in the output are the *real* ones from Move 0 — the Base USDC address, your
chosen fee recipient, your chosen owner. Read them off the deploy output with
your own eyes; this is a two-person check.

```bash
cast call <TIP_CONTRACT> "feeRecipient()(address)" --rpc-url http://127.0.0.1:8545
cast call <TIP_CONTRACT> "owner()(address)"        --rpc-url http://127.0.0.1:8545
cast call <TIP_CONTRACT> "usdc()(address)"         --rpc-url http://127.0.0.1:8545
```

If `feeRecipient` comes back as the deployer address, stop. That is the bug this
step exists to catch, and after Move 2 it costs a redeploy.

### 1.4 Walk the journey on the fork with real USDC

Set `scaffold.config.ts` `targetNetworks` to `chains.foundry` for this — the
fork answers 31337 whatever it forked. Leave it there until Move 3.

Impersonate a whale, fund your test wallet with real USDC, and tip:

```bash
cast rpc anvil_impersonateAccount <USDC_WHALE> --rpc-url http://127.0.0.1:8545
cast send <USDC> "transfer(address,uint256)" <YOUR_TEST_EOA> 1000000000 \
  --from <USDC_WHALE> --unlocked --rpc-url http://127.0.0.1:8545   # 1000 USDC at 6 decimals
yarn start
```

Then in the browser, against the fork: connect, approve, tip, see the creator
credited and the fee land.

**Checks that are specific to this app and that a localhost mock will not
surface:**

- **Decimals.** USDC is 6 decimals, not 18. Tip 1 USDC and confirm the UI shows
  `1.00` and the contract received `1000000`. If anywhere in the stack uses
  `parseEther`/`formatEther` for a USDC amount, a $1 tip becomes a $1,000,000,000,000
  tip request — it will fail on allowance and look like a wallet bug.
- **Approve → tip is two transactions.** USDC is not ETH; there is no `msg.value`.
  Confirm the UI handles: no allowance, partial allowance, allowance already
  sufficient (must *not* prompt a second approval), and a user who approves then
  abandons. Decide now whether you approve the exact amount or a large
  allowance, and make the UI say which.
- **USDC's `approve` race.** Some tokens revert on a non-zero → non-zero
  `approve`. Confirm your flow works when an old allowance is still outstanding.
- **The 1% fee is integer division.** Tip `99` wei-units (0.000099 USDC): does
  the fee round to 0? Does the creator get 99? Assert `fee + creatorAmount ==
  totalTipped` for amounts `1, 99, 100, 101, 10**6, 10**12` — no wei may vanish
  or be minted. Add these as tests if they are not already there.
- **USDC is pausable and has a blocklist.** A blocklisted creator address makes
  the transfer revert. Confirm you fail with a readable error rather than a
  stuck spinner.
- **Reentrancy / fee-on-transfer assumptions.** USDC is not fee-on-transfer
  today, but if the contract computes the creator's share from the *requested*
  amount rather than the balance delta, note it. It is fine for USDC; write it
  down as an assumption.
- **Gas.** Read the actual gas used for a tip on the fork. On Base this is
  pennies, but if a tip costs more than a small tip is worth, your product has a
  problem you want to know about now.

### 1.5 One last look at what is committed

```bash
git grep -nE "alchemyApiKey|rpcOverrides|0x[a-fA-F0-9]{40}" packages/nextjs/scaffold.config.ts
git check-ignore packages/foundry/.env && echo "foundry .env ignored OK"
git check-ignore packages/nextjs/.env.local && echo "nextjs .env.local ignored OK"
```

`scaffold.config.ts` **is committed**. An RPC or API key pasted into
`rpcOverrides` or `alchemyApiKey` is a published key. Read them from
`process.env` and keep values in `packages/nextjs/.env.local`.

### 🚦 GATE 1 — GO / NO-GO before deploying to Base

All of these, verified by the checker, not asserted by the driver:

- [ ] `yarn foundry:test` green, including the fee-rounding assertions from 1.4.
- [ ] Deploy script ran clean against a fork **proved to be Base** (code at the
      USDC address, symbol `USDC`, decimals `6`).
- [ ] `feeRecipient`, `owner`, and the USDC address read back from the deployed
      fork contract are the Move 0 decisions, not defaults.
- [ ] Full journey — connect, approve, tip, fee lands — walked in a browser
      against the fork with real USDC.
- [ ] A funded deployer exists:
      ```bash
      yarn generate      # creates the deployer, writes the key to gitignored packages/foundry/.env
      yarn account       # prints the address and its balance on each chain
      ```
      `yarn account` must show a **non-zero balance on Base**. Fund it before
      the deploy, not after it fails.
- [ ] No secrets in any committed file.

Any unchecked box is a NO-GO.

---

## Move 2 — Contracts live on Base, frontend still on localhost

This is the move that earns the launch. The frontend does **not** change yet.

### 2.1 Deploy

```bash
yarn deploy --network base
```

Same yarn argument rule as `yarn fork`: `--network base`, `-n base`, or
`-- base`. Not `yarn deploy base`.

**Check immediately:** the address printed, and the tx on the explorer showing
success. Save the address where both of you can see it.

### 2.2 Verify — in the same breath, not next week

```bash
yarn verify --network base
```

Run this **now**, from **the same checkout that did the deploy** — `yarn verify`
replays `packages/foundry/broadcast/run-latest.json`, so it is not portable to
your teammate's laptop or to a fresh clone. Until it runs, users and integrators
are looking at opaque bytecode and you are debugging a live contract without
source on the explorer.

You do not need to obtain an explorer API key first; `.env` already has a
working one from `.env.example`.

**Check:** the explorer shows verified source and, on the Read tab, the correct
`feeRecipient`, `owner`, and USDC address. If verification fails, fix it before
going further — usually a compiler-settings or constructor-args mismatch, and
both are cheaper to resolve in the next ten minutes than in a month.

### 2.3 Confirm live state from the command line too

```bash
cast call <TIP_CONTRACT> "feeRecipient()(address)" --rpc-url https://mainnet.base.org
cast call <TIP_CONTRACT> "owner()(address)"        --rpc-url https://mainnet.base.org
cast call <TIP_CONTRACT> "usdc()(address)"         --rpc-url https://mainnet.base.org
cast call <TIP_CONTRACT> "feeBps()(uint256)"       --rpc-url https://mainnet.base.org   # expect 100
```

Explorer and `cast` should agree. If they disagree you are looking at the wrong
address.

### 2.4 Point *your local* frontend at the live contracts

In `packages/nextjs/scaffold.config.ts`:

- `targetNetworks: [chains.base]`
- keep `onlyLocalBurnerWallet: true` — burner wallets must not be offered on a
  chain with real money
- RPC / Alchemy / WalletConnect values read from `process.env`, with real values
  in `packages/nextjs/.env.local` (gitignored)

```bash
yarn start        # still localhost:3000, now talking to Base
```

If the addresses did not land in `deployedContracts.ts`, re-run the deploy's
generation step — do **not** stand up a chain and redeploy just to regenerate
that file.

### 2.5 The real-money dress rehearsal

With a browser wallet, real ETH for gas, and a few real USDC:

1. Connect. The wallet shows **Base**; no burner wallet option appears.
2. Tip a small real amount — $1 — to a creator address you control.
3. Confirm on the explorer: creator received 0.99 USDC, fee recipient received
   0.01 USDC, and the sum equals what you sent.
4. Tip the smallest amount your UI permits, and confirm the rounding behaviour
   matches what 1.4 predicted.
5. Do it a second time and confirm **no second approval prompt** if allowance
   remains.
6. Reject a transaction in the wallet and confirm the UI recovers rather than
   hanging.
7. Try a tip larger than your USDC balance and confirm a readable error.
8. Reload mid-flow and confirm the app comes back to a sane state.

**Failure modes and how you catch them before users do:**

| What goes wrong | How it shows up | Catch |
| --- | --- | --- |
| Public RPC rate-limits | intermittent "failed to fetch", stale balances | Watch the browser console during step 2–8; move to a keyed RPC in `.env.local` before Move 3 |
| Wrong USDC (USDbC vs native) | approve succeeds, tip reverts, or user has "no balance" despite holding USDC | The `usdc()` read in 2.3 against your Move 0 decision |
| Fee recipient wrong | fees accrue to the hot deployer key | The explorer Read tab in 2.2 |
| Decimals bug | tip of 1 becomes an absurd allowance request | Step 2, read the number in the wallet prompt |
| Wallet on the wrong chain | tx sent to Ethereum, funds to a contract that isn't there | Step 1, plus a network-mismatch banner in the UI |

### 🚦 GATE 2 — GO / NO-GO before the frontend is reachable publicly

- [ ] Contract verified on the Base explorer, source readable.
- [ ] `feeRecipient` / `owner` / `usdc` / `feeBps` confirmed live by both of you.
- [ ] The **entire user journey walked against the live contracts with a real
      wallet and real money of your own** — every step above worked.
- [ ] Fee arithmetic checked on a real transaction: creator + fee = total.
- [ ] Console clean of RPC errors through a full session.
- [ ] No burner wallet offered on Base.

Walking the journey yourself with your own money is the condition. Not "it
worked on the fork." Anything less and it is a NO-GO.

---

## Move 3 — Frontend public

### 3.1 Freeze and commit

```bash
git add -A && git commit -m "Point frontend at Base deployment"
git log --oneline -1
```

Commit the `targetNetworks` change and `deployedContracts.ts`. Confirm again
that no key made it into `scaffold.config.ts`.

### 3.2 Build exactly what you will ship

```bash
yarn next:lint
yarn next:build
```

**Check:** the production build succeeds locally. A dev server that works and a
production build that fails is common — find it here, not in the deploy log.

### 3.3 Deploy

```bash
yarn vercel        # first run: yarn vercel:login, then this; use yarn vercel --prod for production
```

Set every `NEXT_PUBLIC_*` value in the Vercel project environment — they are not
read from your local `.env.local`. At minimum the RPC/Alchemy key and the
WalletConnect project ID. Missing ones do not fail the build; they fail silently
at runtime for users.

If you prefer IPFS: `yarn ipfs`.

### 3.4 The post-deploy check that is not optional

**Load the public URL yourself and put one real transaction through it.**

1. Open the public URL in a fresh browser profile — no extensions cached, no
   localhost state.
2. Connect a wallet that has never touched this app.
3. Tip a real $1.
4. Confirm on the explorer that the creator and the fee recipient both received
   the right amounts.
5. Have the second person repeat 1–4 independently on a different device and
   network.

Also check: WalletConnect works on mobile (not just the injected desktop
wallet), the site is HTTPS with the domain you intend, and the UI names the
chain so a user on Ethereum is told rather than left guessing.

### 🚦 GATE 3 — GO / NO-GO before telling anyone the URL

- [ ] Public URL loaded by both of you, on different devices.
- [ ] At least one real transaction completed end-to-end **through the public
      URL**, confirmed on the explorer.
- [ ] Mobile wallet path works.
- [ ] Explorer link to the verified contract is reachable from the UI.

Only now do you share the link.

---

## Move 4 — After launch

### Watch, for the first 48 hours

- The fee recipient's balance on the explorer — it should move in step with tips
  and be exactly 1%.
- Failed transactions to your contract on the explorer. A cluster of failures is
  usually approvals or a blocklisted address, and users will not report it, they
  will leave.
- Vercel logs / RPC provider dashboard for rate limiting.
- A way for users to reach you, stated on the page.

### If a bug turns up onchain

Deployed bytecode cannot be edited, and the contract is a public API — a guard
added in the frontend **binds nobody**, because direct calls, integrators and
other frontends reach the same function. Shipping a UI clamp to buy hours is
fine; calling it the fix is not.

The fix is the whole loop, in order:

1. Reproduce it locally — on a fork of Base, at the block where it happened.
2. Correct the source.
3. Add the regression test that **fails without** the correction.
4. Redeploy — or upgrade in place, if you chose a proxy in Move 0.
5. `yarn verify --network base`, immediately, from the deploying checkout.
6. Repoint the frontend if the address moved, and ship it.
7. Handle the state and users already there — migration, refunds, or comms.
   That is a judgment call, but it is part of the fix, not after it.

This loop is identical whether the bug surfaces the hour before launch or with
the app already public. The only thing that changes is step 7.

### Housekeeping worth doing in week one

- Swap the shared `ETHERSCAN_API_KEY` for your own (optional, never a launch
  blocker).
- Move ownership and the fee recipient to a Safe if they are not there already.
- Rotate the deployer key out of anything valuable — it lives in a `.env` on a
  laptop.

---

## Quick command reference

| Purpose | Command |
| --- | --- |
| Fork Base locally | `yarn fork --network base` *(never `yarn fork base`)* |
| Run tests | `yarn foundry:test` |
| Create deployer | `yarn generate` |
| Check deployer address + balances | `yarn account` |
| Deploy to fork | `yarn deploy` |
| Deploy to Base | `yarn deploy --network base` |
| Verify on Base | `yarn verify --network base` *(same checkout, right after deploy)* |
| Run frontend locally | `yarn start` |
| Production build | `yarn next:build` |
| Ship frontend | `yarn vercel --prod` |
