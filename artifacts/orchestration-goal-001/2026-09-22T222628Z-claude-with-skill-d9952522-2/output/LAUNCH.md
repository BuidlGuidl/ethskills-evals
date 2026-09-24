# LAUNCH.md — localhost → live on Base

Creator tipping in USDC, 1% platform fee. Scaffold-ETH 2, foundry flavor.
Two people. Nothing live yet.

## The shape of this

Going live is **three moves, never one**:

1. **Contracts local** — harden the source and rehearse the deploy against a fork of Base.
2. **Contracts live, frontend still on localhost** — real chain, real gas, real USDC, real wallet, while the UI is still yours alone to edit in seconds.
3. **Frontend public** — and only then.

Move 2 is the one that gets skipped and the one that catches everything. Do not
collapse it into move 3.

Each phase below ends with a **GATE**. A gate is a condition, not a command. If a
gate does not hold, you go back inside the phase — you do not proceed and fix it
later. A runbook that names the commands but not the conditions will keep going
after something has already gone wrong.

### Roles

Pick now, write the names in here, don't swap mid-launch:

- **Deployer** — one person, one machine, one checkout. Runs every `yarn deploy`
  and every `yarn verify`. `yarn verify` replays `broadcast/run-latest.json`, so
  it only works from the checkout that did the deploy. If the other person
  deploys from their laptop, verification is stranded.
- **Reviewer** — walks the journeys at each gate on a *different* machine and a
  *different* wallet. The person who wrote a step is not the person who confirms it.

### Two things that will bite you if nobody said them out loud

**Yarn eats the first token.** `yarn <script>` binds the first bare token after
the script name to the script, whatever it looks like. So the network argument
only lands if something precedes the value:

| Works | Silently wrong |
| --- | --- |
| `yarn fork --network base` | `yarn fork base` |
| `yarn fork -n base` | `yarn fork --network=base` |
| `yarn fork -- base` | |

The silently-wrong forms leave the network empty and **fork Ethereum mainnet**.
You will then spend an afternoon wondering why your Base USDC address has no
code at it. Use the `--network base` form everywhere in this document, and if a
command behaves oddly, suspect the argument before you suspect the contract.

**The fork always answers chain id 31337.** Whatever you forked. So the chain id
can never tell you what you forked — check for state only Base has instead
(Phase 1 does this).

### Addresses and constants — fill these in before you start

Write the real values here and refer back to them; do not retype them at each step.

| Thing | Value |
| --- | --- |
| Base chain id | `8453` |
| USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC decimals | **6** (not 18) |
| Deployer address | _fill in at Phase 3_ |
| Fee recipient (Safe) | _fill in at Phase 0_ |
| Owner after handover (Safe) | _fill in at Phase 0_ |
| Deployed tipping contract | _fill in at Phase 4_ |
| Public URL | _fill in at Phase 7_ |

---

## Phase 0 — Decisions that must exist before any code moves

These are not deploy steps. They are the inputs the deploy steps need, and every
one of them is expensive to change after the contract is on Base.

### 0.1 Who receives the fee, and who owns the contract

The deployer key lives in a plaintext gitignored `.env` on someone's laptop. It is
a hot key. It must not be the long-term owner of a contract that accrues other
people's money, and it must not be the fee recipient.

Create a **Safe** (`app.safe.global`, Base network) with both of you as signers,
threshold 2-of-2 — or 1-of-2 if you genuinely need either person to act alone;
decide now, and know that 1-of-2 means either laptop being compromised drains
the fee balance.

Two addresses, which may be the same Safe:
- **fee recipient** — where the 1% accrues / is withdrawn to.
- **owner** — who can call admin functions (withdraw, set fee, pause).

Record both in the table above.

### 0.2 Kill switch

Before the first live deploy, confirm the contract has either a `pause()` that
blocks new tips, or an owner-callable path that lets you stop accepting funds.
If it does not, add it now — with a test — because you cannot add it later
without redeploying and migrating users.

A kill switch you have never called is not a kill switch. You will call it on the
fork in Phase 2 and on Base in Phase 5.

### 0.3 The fee recipient must be able to receive USDC

If your fee path does a direct `transfer` to the recipient at tip time, a Safe is
fine (it's a contract, but USDC transfers to contracts are ordinary transfers). If
your contract instead accrues and the owner withdraws, confirm the withdraw
function sends to an address you control and is callable by the Safe. Check now;
test it on the fork in Phase 2.

### 0.4 Legal/ops minimum for taking real money from real users

Not optional just because it isn't code:
- A terms page and a contact address on the site. Users tipping strangers with
  real USDC need somewhere to write when something goes wrong.
- Decide what you tell users about the 1%: disclose it in the UI at the moment of
  tipping, showing the exact split. Surprise fees are how a launch becomes a thread.
- Decide whether you're doing any screening of creator addresses. "No" is an
  answer; having never considered it is not.

**GATE 0** — Safe exists on Base and both of you can sign with it. Fee recipient
and owner addresses are written in the table above. A kill switch exists in the
source and has a test. You know what the UI will say about the fee.

---

## Phase 1 — Stand up a real Base fork

You said you're on "a local fork" already. Confirm it is a fork *of Base*, not a
bare `yarn chain`. This matters more than it sounds: against a bare chain you have
been testing a mock token, and the 1%-of-USDC arithmetic you're about to put in
front of users has never met the actual token.

```bash
# packages/foundry/.env — add the RPC you'll fork and deploy from
# (Alchemy/Infura/QuickNode Base mainnet endpoint; the free public Base RPC
#  will rate-limit a fork hard)
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
```

Start the fork — **note the two-token rule**:

```bash
yarn fork --network base
```

Verify you actually forked Base, in a second terminal. The chain id will say
31337 no matter what, so check for state only Base has — code at the Base USDC
address:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545 | head -c 20
# non-empty (0x60806040...) => you forked Base
# "0x"                      => you forked mainnet; you used the wrong arg form
```

Belt and braces — the symbol should be `USDC` and decimals `6`:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)"   --rpc-url http://127.0.0.1:8545
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)"  --rpc-url http://127.0.0.1:8545
```

Fund yourselves test USDC on the fork by impersonating a whale rather than
minting a mock:

```bash
# pick a large USDC holder on basescan, then:
cast rpc anvil_impersonateAccount <WHALE> --rpc-url http://127.0.0.1:8545
cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "transfer(address,uint256)(bool)" <YOUR_BURNER> 1000000000 \
  --from <WHALE> --unlocked --rpc-url http://127.0.0.1:8545
# 1000000000 = 1000 USDC (6 decimals). If you typed 18 zeros, that's the bug
# this whole phase exists to find.
```

Frontend stays pointed at the local chain for all fork work. In
`packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.foundry],
```

`chains.foundry`, **not** `chains.base` — the fork answers 31337 whatever it
forked, so the frontend must talk to 31337 to see it.

**GATE 1** — `cast code` at the Base USDC address returns non-empty bytecode,
`symbol()` is `USDC`, `decimals()` is `6`, and a test account holds forked USDC.

---

## Phase 2 — Harden the contract against real USDC, then rehearse the deploy

This is where the money bugs live. Every item is a thing that works fine against
a mock 18-decimal token and breaks against Base USDC.

### 2.1 The decimals audit

Grep the whole repo for `parseEther`, `formatEther`, `1e18`, `10**18`,
`ether` units:

```bash
grep -rn "parseEther\|formatEther\|1e18\|10\*\*18" packages/ --include=*.ts --include=*.tsx --include=*.sol
```

Every one of these that touches a tip amount is wrong. USDC is 6 decimals:
`parseUnits(amount, 6)` / `formatUnits(value, 6)`, and in Solidity your
constants are `1e6`, not `1e18`. A `parseEther("5")` tip asks the user to
approve five *trillion* USDC; it will either revert on balance or, if they're
rich, do something unrecoverable.

Better: read decimals from the token rather than hardcoding, and use SE-2's
`useScaffoldReadContract` on `decimals()` in the UI.

### 2.2 The 1% fee arithmetic

Integer division truncates. Write tests that pin down the edges, because these
are the amounts a curious user tries first:

| Tip (raw units) | Tip in USDC | What to assert |
| --- | --- | --- |
| `1` | 0.000001 | fee = 0; creator gets 1. No revert, no stuck wei. |
| `99` | 0.000099 | fee = 0; creator gets 99. |
| `100` | 0.0001 | fee = 1; creator gets 99. |
| `1000000` | 1.00 | fee = 10000; creator gets 990000. |
| `type(uint256).max / 100`-ish | — | no overflow in `amount * 1 / 100`. |

Assert the invariant every time: **fee + creatorAmount == amount, exactly.**
Not approximately. If your code computes the creator amount as
`amount * 99 / 100` and the fee as `amount / 100` independently, those two
truncations do not sum to `amount` and you leak dust into the contract forever.
Compute one, subtract for the other.

Also decide and test: does a tip of `0` revert? It should.

### 2.3 USDC-specific hazards

- **`transfer`/`transferFrom` return a bool.** Use OpenZeppelin `SafeERC20`
  (`safeTransfer` / `safeTransferFrom`). Real USDC does return a bool correctly,
  but `SafeERC20` costs you nothing and covers you if you ever support a second
  token.
- **USDC is a proxy and has a blocklist.** A tip to a blocklisted creator
  reverts inside the token. Your UI should surface "this transfer was rejected by
  the token" rather than a raw revert blob.
- **USDC can be paused by its issuer.** Rare, but your app should fail
  legibly, not look broken.
- **Approve → tip is two transactions.** Test both orderings in the UI:
  approve-then-tip, and tip-without-approve (must show a clear "approve first"
  state, never a silent failure). Decide exact-amount vs infinite approval —
  exact amount per tip is the safer default for a new contract nobody has
  audited; say so in the UI.
- **Reentrancy.** USDC won't call you back, but if the contract holds balances
  and has a `withdraw`, use `nonReentrant` and checks-effects-interactions anyway.

### 2.4 Full test pass

```bash
yarn compile
yarn foundry:test          # or: yarn test
forge test --match-contract Tipping -vvv   # from packages/foundry, when debugging
```

Fuzz the fee split — it's the highest-value fuzz target you have:

```solidity
function testFuzz_FeeSplitIsExact(uint256 amount) public {
    amount = bound(amount, 1, 1e15);          // up to 1B USDC
    (uint256 fee, uint256 toCreator) = tipping.previewSplit(amount);
    assertEq(fee + toCreator, amount);        // no dust, ever
    assertLe(fee * 100, amount);              // never over 1%
}
```

### 2.5 Rehearse the deploy against the fork

Run the *actual* deploy script you'll run on Base, with the *actual* constructor
args (real Base USDC address, real Safe as fee recipient/owner) — against the fork:

```bash
yarn deploy --network localhost
```

Read the output. Confirm on the fork that the deployed contract's stored USDC
address, fee recipient, owner and fee basis points are what you intended:

```bash
cast call <DEPLOYED> "usdc()(address)"         --rpc-url http://127.0.0.1:8545
cast call <DEPLOYED> "feeRecipient()(address)" --rpc-url http://127.0.0.1:8545
cast call <DEPLOYED> "owner()(address)"        --rpc-url http://127.0.0.1:8545
```

If your script hardcodes a chain-dependent USDC address, make sure it selects by
`block.chainid` — and remember the fork reports **31337**, so a `chainid == 8453`
branch will not fire on the fork. Either key off an env var or add 31337 to the
Base branch for the rehearsal; whichever you choose, re-confirm the stored
address with the `cast call` above rather than trusting the branch.

### 2.6 Walk the whole journey on the fork

Frontend still on `chains.foundry`. `yarn start`. With a browser wallet on the
local network, do the complete thing end to end:

1. Connect wallet.
2. Approve USDC.
3. Tip a creator — a normal amount (5 USDC) and a pathological one (0.000001 USDC).
4. Confirm the creator's USDC balance moved by exactly 99%.
5. Confirm the fee landed with the fee recipient, exactly 1%.
6. Withdraw the fee as the owner (if your design accrues).
7. **Call the kill switch. Confirm tipping now reverts with a legible message.
   Unpause. Confirm tipping works again.**

**GATE 2** — All tests pass including the fee fuzz. No `parseEther`/`1e18` left
on any tip path. The deploy script runs clean against the Base fork and the
deployed contract's stored addresses are correct. All seven journey steps above
worked against the fork, including pause and unpause.

---

## Phase 3 — Deployer account, funded

Still nothing on Base.

```bash
yarn generate          # creates a deployer, writes the key to packages/foundry/.env (gitignored)
yarn account           # prints the address and its balance on each chain
```

Confirm `packages/foundry/.env` is gitignored before you do anything else:

```bash
git check-ignore -v packages/foundry/.env    # must print a matching rule
git status --porcelain | grep -i "foundry/.env"   # must print nothing
```

If either check fails, stop and fix the ignore rules. A private key in git
history is a key you rotate, not a key you clean up.

Now fund it with **real ETH on Base** — bridge via `bridge.base.org`, or
withdraw from an exchange directly to Base (cheaper, faster). A deploy plus
verification plus a handful of admin transactions on Base is cheap;
**0.01 ETH** is comfortable, 0.005 is enough. Fund it *before* the deploy, not
after one fails.

```bash
yarn account           # re-run; Base balance must be non-zero
```

Note there is **no step here about getting a block explorer API key**.
`packages/foundry/.env.example` already carries a working `ETHERSCAN_API_KEY` and
postinstall copies it to `.env`, so `yarn verify` works on a fresh checkout.
Swapping in your own key is optional housekeeping for later; do not treat it as a
launch dependency and do not hand anyone an env template with a blank
`ETHERSCAN_API_KEY=` to fill in — the value is already there.

**GATE 3** — `yarn account` shows a non-zero ETH balance on Base for the deployer.
`packages/foundry/.env` is confirmed gitignored. The deployer address is written
in the table at the top.

---

## Phase 4 — Deploy to Base, and verify in the same breath

One person, one machine, one terminal session. Both of you present.

```bash
yarn deploy --network base
```

Then, **immediately** — not tomorrow, not in a later checklist item:

```bash
yarn verify --network base
```

Verification belongs in the same breath as the deploy. Until it runs, users and
integrators are looking at opaque bytecode, and if something goes wrong you are
debugging a live contract without source on the explorer. And it replays
`broadcast/run-latest.json`, so it must be the same checkout that deployed — if
you deploy and then verify from the other laptop, it will not work.

Record the address in the table at the top, and commit the regenerated
`packages/nextjs/contracts/deployedContracts.ts`.

### Confirm the live contract is what you think it is

Do not skip this because the deploy printed green.

```bash
cast call <DEPLOYED> "usdc()(address)"         --rpc-url $BASE_RPC_URL
# must equal 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

cast call <DEPLOYED> "feeRecipient()(address)" --rpc-url $BASE_RPC_URL
cast call <DEPLOYED> "owner()(address)"        --rpc-url $BASE_RPC_URL
# must equal the Safe from Phase 0 — not the deployer EOA
```

If `owner()` is still the deployer EOA because your script doesn't hand over,
transfer it now and confirm:

```bash
cast send <DEPLOYED> "transferOwnership(address)" <SAFE> \
  --rpc-url $BASE_RPC_URL --account <deployer>
cast call <DEPLOYED> "owner()(address)" --rpc-url $BASE_RPC_URL
```

Careful: if ownership is two-step (`Ownable2Step`), the Safe must `acceptOwnership()`
before it is actually the owner. Run the Safe transaction and re-read `owner()`.
A contract whose only admin key is an EOA on a laptop is one lost laptop from
being unadministrable.

Open the contract on `basescan.org` and confirm with your eyes: source is
verified and readable, constructor args decode to what you expect.

**GATE 4** — Contract is deployed, source is verified and readable on Basescan,
`usdc()` is the real Base USDC, and `owner()` is the Safe (accepted, if two-step).

---

## Phase 5 — Frontend on localhost, pointed at the live contracts

**This is the move that catches everything. Do not skip it.** You are about to
spend real money on your own app, with the UI still editable in seconds.

### 5.1 Switch the frontend to Base — now, and not before

`packages/nextjs/scaffold.config.ts`:

```ts
const scaffoldConfig = {
  targetNetworks: [chains.base],

  // committed file — never paste a key here
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,

  rpcOverrides: {
    [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL as string,
  },

  // burner wallet must never appear on a live chain
  onlyLocalBurnerWallet: true,

  pollingInterval: 30000,
} as const satisfies ScaffoldConfig;
```

`scaffold.config.ts` **is committed**. An RPC or API key pasted into
`rpcOverrides` or `alchemyApiKey` is a published key the moment you push. Read
from `process.env`; keep the values in `packages/nextjs/.env.local`:

```bash
# packages/nextjs/.env.local  (gitignored)
NEXT_PUBLIC_ALCHEMY_API_KEY=<key>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<id from cloud.reown.com>
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
```

```bash
git check-ignore -v packages/nextjs/.env.local     # must print a matching rule
git diff -- packages/nextjs/scaffold.config.ts     # eyeball it: no literal keys
```

Change `targetNetworks` in the **same step** that you repoint the frontend at the
deployed addresses, and not before. A frontend built while `targetNetworks` still
names the local chain reads a chain nobody is on.

Note: the public `https://mainnet.base.org` endpoint will rate-limit you under
real traffic. Use a keyed provider endpoint for the public launch.

### 5.2 Run locally against Base

```bash
yarn start      # localhost:3000, talking to Base
```

Sanity first, before spending anything:
- Wallet connect prompts for **Base**, and a wallet on the wrong network is told
  to switch (SE-2 shows a "Wrong network" banner — confirm it appears if you
  switch your wallet to Ethereum).
- Creator balances and any read calls show real Base data.
- The burner wallet does **not** appear as a connection option.

### 5.3 The real-money walkthrough

With a real browser wallet and real USDC on Base — a few dollars of your own.
Both of you, on two machines, two wallets:

1. Approve USDC for the contract. Confirm the approval amount shown matches what
   the UI said.
2. Tip a creator **1.00 USDC**. On Basescan, confirm: creator received 0.99,
   fee recipient received 0.01. Exactly.
3. Tip **0.000001 USDC** (the truncation edge from Phase 2). Confirm it does not
   revert and nothing is stranded.
4. Tip from a wallet with **zero USDC** — the UI must say so before asking for a
   signature, not fail in the wallet.
5. Tip from a wallet with USDC but **no ETH for gas** — must fail legibly.
6. **Reject** a transaction in the wallet. The UI must return to a usable state,
   not hang on a spinner forever.
7. Refresh mid-flow. State should recover.
8. Withdraw accrued fees to the Safe, signed by the Safe. Confirm the USDC lands.
9. On mobile — Base is a mobile-heavy chain and this is a tipping app. Walk at
   least steps 1–2 on a phone wallet over WalletConnect.

Where each of these can go wrong and how you catch it before users do: you are
the user, right now, with your own money, on a URL nobody else has. That is the
entire point of this phase. Anything you find here costs an edit and a refresh.
The same thing found in Phase 7 costs a redeploy and a public apology.

**GATE 5** — You have walked the entire user journey against the live contracts
with a real wallet and real money — a few dollars of your own — and every step
above worked, on two machines and one phone. The fee split was exact on-chain.
No key is in any committed file.

---

## Phase 6 — Pre-flight for a public URL

Now, and only now, the things that only matter once strangers can reach it.

### 6.1 Build clean

```bash
yarn next:build        # or: yarn build
yarn next:lint
```

A build that only works in dev will fail on the hosting provider in a way that's
slower to diagnose. Do it locally first.

### 6.2 Say the fee out loud in the UI

At the moment of tipping, show the split: "You tip 5.00 USDC — creator receives
4.95, platform fee 0.05 (1%)." Compute it from the same on-chain values, not a
hardcoded string that will drift if you ever change the fee.

### 6.3 Front-end guards are convenience, not safety

Any clamp or validation in the UI (minimum tip, address checks) binds nobody —
the contract is a public API, and direct calls, integrators and other frontends
reach the same function. Keep the UI checks for usability; make sure the contract
itself is correct regardless of them.

### 6.4 Monitoring, so you find out before a user tells you

- Watch the contract address on Basescan (address watch → email alerts).
- A Tenderly alert on any transaction to the contract that reverts, and on any
  transfer out of the contract, is 15 minutes of setup and the difference between
  noticing in minutes and noticing in days.
- Keep a `cast` one-liner handy to read total fees accrued, so you can eyeball
  the invariant against what Basescan shows.

### 6.5 Have the kill switch ready to run

Write the literal command in your shared notes, tested in Phase 2, with the Safe
transaction pre-scoped. In an incident you do not want to be reading
documentation:

```bash
# pause — run from the Safe
cast call <DEPLOYED> "paused()(bool)" --rpc-url $BASE_RPC_URL
```

### 6.6 Decide who is watching, and for how long

Someone is at a keyboard for the first few hours after the URL goes public.
Agree which of you, and when you hand over.

**GATE 6** — `yarn next:build` succeeds. The UI discloses the fee with numbers
derived on-chain. Alerts are live and you have received at least one test alert.
Both of you know how to pause and who is on watch.

---

## Phase 7 — Ship the frontend

```bash
yarn vercel:login      # first time only
yarn vercel            # preview deployment
```

Set the environment variables in the Vercel project settings (Production *and*
Preview) — the same three from `.env.local`. `.env.local` is not uploaded; a
deploy without them will build and then fail at runtime with confusing RPC errors:

- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_BASE_RPC_URL`

Add your production domain to the WalletConnect/Reown project's allowed origins,
or mobile wallet connections will fail on the public URL while working perfectly
on localhost. This is the single most common "it worked locally" failure at this
step.

Check the preview URL first — full connect-and-tip, one real transaction. Then:

```bash
yarn vercel --prod
```

### Immediately after the production deploy

**Load the public URL yourself and put one transaction through it.** Not the
preview URL — the production one, on the real domain, from a browser with no
cached state. Tip 1 USDC. Confirm on Basescan that the split was exact.

Then:
- Open it on a phone over cellular, not your wifi.
- Open it in a private window with a wallet that has never touched the app.
- Confirm the "wrong network" prompt appears for a wallet on Ethereum.
- Watch your Tenderly/Basescan alerts fire for your own transaction — that's how
  you know monitoring is actually wired up.

**GATE 7** — You have loaded the public production URL yourself and put one real
transaction through it successfully, and your alerting fired for it.

---

## Phase 8 — First hours live

- Refresh Basescan on the contract periodically for the first few hours. You are
  looking for reverted transactions from addresses that aren't yours — that's a
  user hitting something you didn't.
- Check the fee invariant holds in aggregate: fees received should be ~1% of
  total tipped volume. If it drifts, your split has a rounding bug that only
  shows at scale.
- Do not push contract changes on day one unless something is actually wrong.
  Frontend fixes are cheap; contract changes are not (see below).

---

## If a bug turns up in the live contract

Deployed bytecode cannot be edited. A guard added in the frontend **binds nobody**
— direct calls, integrators and other frontends reach the same function
regardless. Shipping a UI clamp to buy yourselves hours is fine; calling it the
fix is not.

The fix is the whole loop, in order:

1. **Pause**, if funds are at risk. Buying time is free; losing user money is not.
2. **Reproduce locally** — on a fork of Base at the block where it happened:
   `yarn fork --network base` (mind the two-token rule), then `--fork-block-number`
   at the offending block.
3. **Correct the source.**
4. **Add the regression test that fails without the correction.** If you can't
   write a test that fails first, you have not understood the bug.
5. **Redeploy** — `yarn deploy --network base` — or upgrade in place if it's
   behind a proxy.
6. **`yarn verify --network base`**, same breath, same checkout.
7. **Repoint the frontend** if the address moved: commit the regenerated
   `deployedContracts.ts`, redeploy the frontend, confirm the live site is
   reading the new address and not a cached build.
8. **Handle the state and users already there** — migration or comms, your call,
   but it is a step and not an afterthought. If anyone lost money, say so
   publicly and say what you're doing about it.

This loop is identical whether the bug surfaces the day before launch or with
the app already public. The only thing that changes is step 8.

---

## Quick reference

```bash
# fork Base locally (NOT `yarn fork base`)
yarn fork --network base

# confirm you forked Base, not mainnet (chain id will lie; code won't)
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545 | head -c 20

yarn compile
yarn foundry:test

yarn generate                    # deployer key -> gitignored packages/foundry/.env
yarn account                     # address + per-chain balances

yarn deploy --network base
yarn verify --network base       # same breath, same checkout

yarn start                       # localhost against Base — the phase that catches everything
yarn next:build
yarn vercel && yarn vercel --prod
```

Gates, in one line each:

0. Safe exists; fee recipient and owner decided; kill switch exists with a test.
1. `cast code` proves the fork is Base; USDC reports 6 decimals.
2. Tests pass incl. fee fuzz; no `1e18` on tip paths; deploy rehearsed on the fork; full journey walked on the fork incl. pause/unpause.
3. Deployer funded with real ETH on Base; `.env` confirmed gitignored.
4. Deployed **and verified**; `usdc()` correct; `owner()` is the Safe.
5. Full journey walked against live contracts with real money, frontend still on localhost; no keys committed.
6. Clean build; fee disclosed in UI; alerts live and tested.
7. Production URL loaded by you, one real transaction through it, alert fired.
