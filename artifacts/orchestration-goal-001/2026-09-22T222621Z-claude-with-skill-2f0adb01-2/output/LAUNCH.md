# LAUNCH.md — Creator Tipping dApp: local fork → live on Base

**Status today:** Phase 1 complete. Contracts + frontend work end-to-end against a local
Base fork with a browser wallet. Nothing is live, nothing is funded, nothing is public.

**Goal:** real users tipping real USDC on Base mainnet, at a public URL we control.

This document is ordered. Follow it top to bottom. Every step has a **GATE** — do not start
the next step until the gate passes. Steps that can go wrong have a **HOW THIS BITES US**
block naming the failure and the check that catches it before a user does.

---

## 0. Ground rules for the whole launch

Two people, two roles, for the duration of this doc:

- **Driver** — runs the commands, holds the deployer key.
- **Checker** — reads every diff before it's committed, independently confirms every GATE.
  The Checker never rubber-stamps: they re-run the check themselves.

Rules that hold at every step:

1. **Never hack around a bug in production.** Phase 3 bug → drop back to Phase 2 (local UI
   against live contracts). Phase 2 contract bug → drop back to Phase 1 (fix on the fork,
   write a regression test, redeploy). There is no "just patch it live."
2. **Never commit a secret.** See Step 4. Bots scrape public repos in seconds.
3. **Money amounts are real from Step 8 onward.** Small, but real.
4. Keep a `LAUNCH-LOG.md` as you go: every address, tx hash, and timestamp. You will need it
   when something looks wrong at 11pm.

---

## 1. Freeze scope and set up the release branch

No new features from here until you're live. Feature work during a launch is how you ship a
half-tested fee calculation.

```bash
git checkout main
git pull
git status                      # MUST be clean
git checkout -b launch/base-mainnet
```

Record the starting point:

```bash
git rev-parse HEAD >> LAUNCH-LOG.md
```

**GATE:** working tree clean, on `launch/base-mainnet`, both of you agree the feature set is
final.

---

## 2. Contract hardening pass

Do this **before** you spend a cent on gas. A deployed contract is immutable; a bad fee
calculation is permanent.

Fetch and work through the audit skill in full:

```
https://ethskills.com/audit/SKILL.md
```

On top of whatever that surfaces, these are the issues specific to *this* contract — a
USDC tip splitter that takes 1%:

### 2.1 USDC is 6 decimals, not 18

Every `parseEther`/`formatEther` in a USDC path is a 10^12x bug. Sweep for them:

```bash
grep -rn "parseEther\|formatEther" packages/nextjs packages/foundry
```

Every hit that touches a tip amount must be `parseUnits(x, 6)` / `formatUnits(x, 6)`, and
the `6` should come from an on-chain `decimals()` read or a single shared constant — not
typed inline in five files.

### 2.2 The 1% fee truncates

Integer division means `fee = amount * 100 / 10000` rounds **down**. Decide and document the
answer to each of these, then assert it in a test:

- A 99-unit tip (0.000099 USDC) yields a **zero** fee. Intended? Do you enforce a minimum
  tip instead?
- Does the creator get `amount - fee` (fee taken out), or does the fan pay `amount + fee`?
  The UI must say the same thing the contract does. Write the sentence down, then check the
  UI copy against it.
- Rounding direction is a policy choice. Truncating in the creator's favour is fine; just be
  sure it isn't truncating into a gap where tokens are stranded in the contract.

Fuzz it:

```solidity
function testFuzz_FeeInvariant(uint256 amount) public {
    amount = bound(amount, 1, 1_000_000e6);
    // ...
    assertEq(creatorReceived + feeReceived, amount);   // nothing is stranded
    assertLe(feeReceived, amount / 100 + 1);           // fee never exceeds 1%
}
```

The `creatorReceived + feeReceived == amount` invariant is the important one. If it can ever
fail, tokens accumulate in the contract with no way out.

### 2.3 Use SafeERC20, and don't assume USDC's behaviour is frozen

USDC on Base is an **upgradeable proxy** run by Circle. Today it returns a `bool` and doesn't
take a transfer fee. That's a fact about the current implementation, not a guarantee.

- Use `SafeERC20.safeTransferFrom` / `safeTransfer`, never bare `transfer`.
- If you credit the creator based on the *requested* amount rather than the *actual* balance
  delta, a future fee-on-transfer implementation silently breaks your accounting. Measuring
  the delta (`balanceAfter - balanceBefore`) is the defensive version. Decide explicitly.
- USDC has a **blacklist**. A blacklisted creator or fee recipient makes `transfer` revert.
  Confirm this reverts cleanly and doesn't lock other users' funds or leave the contract in
  a half-updated state.

### 2.4 Reentrancy and state ordering

Even with a well-behaved token: update all state **before** external calls, and put
`nonReentrant` on any function that moves tokens. It costs ~2k gas on Base. Pay it.

### 2.5 Admin surface

Check each of these and write the answer in LAUNCH-LOG.md:

- Who owns the contract? Ownership must end up at a **multisig**, not a hot key (Step 11).
- Can the fee recipient be changed? Is it zero-address-checked?
- Can the fee rate be changed? Is it capped (e.g. `require(bps <= 500)`)? An uncapped setter
  means a compromised owner can set the fee to 100% and drain every future tip.
- Is there a **pause**? If not, add one now. Without a kill switch your only incident
  response is "tweet at people to stop using it."
- Is there a rescue function for tokens accidentally sent to the contract? If yes, prove it
  cannot touch funds owed to creators.

### 2.6 Static analysis

```bash
slither packages/foundry/contracts/ --exclude-dependencies
forge build --sizes            # under 24576 bytes
```

Triage every high/medium. "Known and accepted, because X" is an acceptable outcome; silence
is not.

**GATE:** audit skill completed; every item in 2.1–2.6 has a written answer; slither
high/medium all triaged; a pause function exists; the fee rate is capped.

**HOW THIS BITES US:** decimals or fee-rounding bugs are invisible on a fork where you test
with round 100 USDC numbers, and obvious the first time someone tips 1.37 USDC. The fuzz test
in 2.2 with a low bound (`bound(amount, 1, ...)`) is what catches it.

---

## 3. Prove the tests actually cover the live-network path

```bash
cd packages/foundry
forge test -vv
forge coverage --report summary
```

**Coverage floor: 90% lines and branches on the tipping contract.** Branch coverage matters
more than line coverage here — the reverts (zero amount, paused, blacklisted recipient,
insufficient allowance) are the branches that show up in production.

Then run tests against **forked real USDC**, not a mock. This is the whole point of using
`yarn fork` rather than `yarn chain`:

```bash
forge test --fork-url https://mainnet.base.org --match-contract TippingForkTest -vv
```

These fork tests must cover:

- A tip from an address holding real USDC (impersonate a whale with `vm.prank`).
- Allowance exactly equal to the tip amount (the exact-approval path the UI uses).
- Allowance one unit short → reverts cleanly with a message the UI can translate.
- A tip while the contract is paused → reverts.
- Two tips in the same block from the same fan.

Record gas so you can sanity-check mainnet costs later:

```bash
forge test --gas-report | tee ../../gas-report.txt
```

**GATE:** all tests green including fork tests; ≥90% branch coverage on the tipping contract;
gas report saved.

**HOW THIS BITES US:** mock-ERC20 tests pass against a token you wrote to be agreeable. Real
USDC is a proxy with a blacklist and non-standard approve semantics. Fork tests are the only
thing that catches that difference before mainnet.

---

## 4. Secrets hygiene — do this before any `git push`

This is the step that, skipped, ends with a drained deployer and a leaked Alchemy key billed
to you.

Confirm `.gitignore` contains at minimum:

```
.env
.env.*
!.env.example
*.key
broadcast/
cache/
node_modules/
```

Then scan, from the repo root:

```bash
# any env-ish or key-ish file staged?
git diff --cached --name-only | grep -iE '\.env|key|secret|private'

# raw private keys anywhere in source
grep -rn "0x[a-fA-F0-9]\{64\}" packages/ --include="*.ts" --include="*.js" --include="*.sol"

# hardcoded RPC provider keys
grep -rn "g\.alchemy\.com/v2/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
grep -rn "infura\.io/v3/[A-Za-z0-9]"     packages/ --include="*.ts" --include="*.js"

# full-history check, not just the working tree
git log -p --all | grep -nE "PRIVATE_KEY=0x[a-fA-F0-9]{64}" | head
```

**If anything matches, stop.** Move it to `.env`, and if it was ever committed, treat the
secret as burned: rotate the API key, and never fund that wallet.

### The Scaffold-ETH trap to watch specifically

`packages/nextjs/scaffold.config.ts` **is committed**. `rpcOverrides` and `alchemyApiKey`
live in it. Never paste a key there:

```typescript
// ❌ WRONG — this key is now public
rpcOverrides: {
  [chains.base.id]: "https://base-mainnet.g.alchemy.com/v2/8GVG8WjDs-REAL-KEY",
},

// ✅ RIGHT
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
},
```

Note that `NEXT_PUBLIC_*` variables are **shipped to the browser**. An Alchemy key there is
readable by anyone who opens devtools. That's normal and mostly fine — but you must set
domain allowlisting on the key in the Alchemy dashboard (Step 5) or you're paying for
someone else's RPC traffic.

Add a pre-commit guard so this can't regress:

```bash
cat > .git/hooks/pre-commit <<'HOOK'
#!/bin/sh
if git diff --cached -U0 | grep -qE '(PRIVATE_KEY=0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]{10,})'; then
  echo "BLOCKED: possible secret in staged diff"; exit 1
fi
HOOK
chmod +x .git/hooks/pre-commit
```

**GATE:** all four scans return nothing; `.gitignore` correct; hook installed and tested with
a deliberate dummy secret (then `git reset`).

---

## 5. Provision the accounts and keys you'll need

Do all of this **before** deploy day so nothing is rushed.

| What | Where | Used for |
|---|---|---|
| Alchemy (or QuickNode) Base app | dashboard.alchemy.com | Reliable RPC. `https://mainnet.base.org` is fine for a deploy, rate-limited for a frontend with users. |
| WalletConnect Project ID | cloud.reown.com | Mobile wallet connections. Free. |
| Basescan account | basescan.org | Reading your contract; SE2 handles verification without a key. |
| **Safe multisig on Base** | app.safe.global | Contract owner + fee recipient. Both of you as signers, 2-of-2. |
| Vercel account | vercel.com | Hosting. |
| Domain | registrar of choice | The public URL. |

Create the Safe **now** and record its address. On the Alchemy key, set **domain
allowlisting** to your production domain + `localhost` before you ship the frontend.

Write `.env.example` (committed, no values) documenting every variable so the second person
can reproduce the setup:

```bash
cat > packages/nextjs/.env.example <<'ENV'
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_RPC=
ENV
```

**GATE:** Safe deployed on Base with both signers, 2-of-2 confirmed by sending it a test
transaction of 0 value; all API keys created; `.env.example` committed; real `.env.local` is
gitignored.

**HOW THIS BITES US:** the fee recipient is the address that collects your revenue forever.
Getting it wrong — a typo, or an EOA whose key one person controls — is discovered the first
time you try to withdraw. Verify the Safe address by *sending it something and seeing it
arrive*, not by reading it twice.

---

## 6. Optional: Base Sepolia dress rehearsal

The fork already gave you real USDC behaviour, so testnet adds less than people assume. What
it *does* rehearse is the deploy-and-verify pipeline itself, for free.

Worth 30 minutes if either of you has never run `yarn deploy --network` against a live chain.
Skip it otherwise.

```bash
# fund the deployer from a Base Sepolia faucet first
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
```

Base Sepolia USDC (Circle test token): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
Chain ID: `84532`

**GATE (if run):** contract verified on sepolia.basescan.org and one test tip succeeded.

---

## 7. Generate and fund the deployer

```bash
yarn generate          # creates a fresh deployer key in packages/foundry/.env
yarn account           # shows the address and balances across chains
```

Read the address off `yarn account` and record it. Then:

- Send **0.01 ETH on Base** to it from an exchange or bridge. That is far more than a deploy
  needs (a deploy is typically well under $1 on Base), and the surplus covers the smoke test
  and a redeploy if one is needed.
- Confirm arrival with `yarn account` before proceeding.

**Rules for this key:**

- It is a **deployment key**, not a treasury. It should never hold meaningful value.
- It never becomes the contract owner long-term (Step 11 moves ownership to the Safe).
- `packages/foundry/.env` is gitignored by SE2 by default. Do not override that, do not copy
  the key into a script, a config file, or a terminal you're screen-sharing.

**GATE:** `yarn account` shows ≥0.01 ETH on Base for the deployer; the key exists in exactly
one place on disk; `git status` shows no `.env` file.

---

## 8. Point the project at Base and deploy the contracts

### 8.1 Config change

`packages/nextjs/scaffold.config.ts`:

```typescript
const scaffoldConfig = {
  targetNetworks: [chains.base],          // was chains.foundry
  pollingInterval: 30000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  rpcOverrides: {
    [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  onlyLocalBurnerWallet: true,            // newer SE2: burnerWalletMode: "localNetworksOnly"
} as const satisfies ScaffoldConfig;
```

Set `burnerWalletMode` / `onlyLocalBurnerWallet` **now**, not in Step 12. If you leave it for
later you will forget, and production users will get a burner wallet offered to them as a way
to hold real money.

### 8.2 Pin the USDC address per chain

The deploy script must not have a hardcoded address that happens to be the fork's. Make it
explicit and chain-keyed:

```solidity
// Base mainnet (chainId 8453)
address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
```

**Verify this address against Circle's official docs before deploying** — do not trust it
because it's written in this file. Then add a deploy-time assertion so a wrong address can't
get past you:

```solidity
require(block.chainid == 8453, "wrong chain");
require(IERC20Metadata(USDC_BASE).decimals() == 6, "not USDC");
require(keccak256(bytes(IERC20Metadata(USDC_BASE).symbol())) == keccak256("USDC"), "not USDC");
```

Constructor args to double-check before you hit enter:

- USDC address → the constant above
- fee recipient → **the Safe address** from Step 5
- fee bps → `100` (= 1%). Not `1`, not `1000`.

### 8.3 Dry run against the fork one final time

```bash
yarn fork --network base      # terminal 1
yarn deploy                   # terminal 2 — same script, forked state
```

This runs the exact deploy script, including the new assertions, against real Base state.

### 8.4 Deploy for real

```bash
yarn deploy --network base
```

**GATE:** deploy tx confirmed; contract address recorded in LAUNCH-LOG.md; and read the
deployed state back from the chain rather than trusting the script output:

```bash
cast call <CONTRACT> "feeRecipient()(address)"  --rpc-url https://mainnet.base.org
cast call <CONTRACT> "feeBps()(uint256)"        --rpc-url https://mainnet.base.org
cast call <CONTRACT> "owner()(address)"         --rpc-url https://mainnet.base.org
cast call <CONTRACT> "usdc()(address)"          --rpc-url https://mainnet.base.org
```

Fee recipient must equal the Safe. Fee bps must be `100`. USDC must equal the Circle address.

**HOW THIS BITES US:** a wrong constructor arg is immutable. The `require`s in 8.2 and the
`cast call` readback in 8.4 are two independent checks on the same facts — that redundancy is
deliberate, because this is the step you cannot undo.

---

## 9. Verify on Basescan — immediately

Run this in the same sitting as the deploy, not tomorrow.

```bash
yarn verify --network base
```

SE2 handles the block explorer key for you; you don't need to configure one.

Then open `https://basescan.org/address/<CONTRACT>#code` and confirm:

- Green "Contract Source Code Verified" checkmark
- Constructor arguments decoded at the bottom of the source, matching Step 8
- The **Read Contract** tab works and shows your fee recipient

**GATE:** verified, source readable on Basescan, constructor args match.

**HOW THIS BITES US:** an unverified contract is a black box to your users and to you. If
verification fails, it's usually a compiler-settings mismatch — fix it before you build
anything on top, because debugging it after a frontend deploy is much worse.

---

## 10. Phase 2 validation: live contracts, local UI, real money (small)

This is the most valuable step in the document. Live contracts, local frontend, tiny amounts.

```bash
yarn start        # localhost:3000, now pointed at Base mainnet
```

Commit the regenerated `packages/nextjs/contracts/deployedContracts.ts` — it's auto-generated
by the deploy, and Vercel's build needs it to know the mainnet address. (Auto-generated means
*don't hand-edit it*; it does not mean don't commit it.)

Connect a **real browser wallet** holding ~$5 of USDC on Base and walk the full journey:

1. **Wrong network** → app offers "Switch to Base", switching works.
2. **Approve** → approval is for the **exact tip amount**, not `type(uint256).max`. Check the
   value in the wallet confirmation dialog. Infinite approvals on a tipping app are an
   unnecessary standing risk to every user.
3. **Tip $1.00** → confirm the button flow shows **one** action at a time (Switch → Approve →
   Tip), never Approve and Tip side by side.
4. **Check the maths on Basescan**, in the token transfer log of the tx:
   - creator received `0.99 USDC`
   - Safe received `0.01 USDC`
   - contract balance is `0`
5. **Tip an awkward amount — $1.37, then $0.03.** This is where truncation bugs surface.
   Confirm the split is what Step 2.2 says it should be.
6. **Reject a transaction in the wallet** → UI recovers with a plain-language message, not a
   stuck spinner or a raw `user rejected transaction (action="sendTransaction"...)` dump.
7. **Tip with insufficient USDC balance** → clear error before the wallet even opens.
8. **Event history / tip feed** populates from the real chain.
9. **Hard refresh mid-flow** → state recovers correctly.

Watch the browser console the entire time. Zero errors.

**GATE:** every one of the nine passes; the $1.37 split is exactly as specified; Safe balance
shows the accumulated fees; console clean.

**HOW THIS BITES US:** this is the last point where a contract bug costs you $2 instead of a
public incident. If anything here is wrong, go back to Phase 1 — fix on the fork, add a
regression test, redeploy, re-verify, redo this step. Do not patch it in the frontend.

---

## 11. Hand ownership to the Safe

Only after Step 10 passes.

```bash
cast send <CONTRACT> "transferOwnership(address)" <SAFE_ADDRESS> \
  --rpc-url https://mainnet.base.org --private-key $DEPLOYER_PRIVATE_KEY
```

If the contract uses `Ownable2Step` (it should), accept from the Safe via the Safe UI's
transaction builder.

Confirm:

```bash
cast call <CONTRACT> "owner()(address)" --rpc-url https://mainnet.base.org
```

Then **rehearse the emergency action from the Safe**, today, while nothing is on fire:

- Propose and execute `pause()` from the Safe UI → confirm a tip now reverts.
- Execute `unpause()` → confirm tipping works again.

**GATE:** owner is the Safe; you have personally executed pause and unpause through the Safe
UI and seen both take effect.

**HOW THIS BITES US:** the first time you use a multisig should never be during an incident.
Signer confusion, a missing signature, a Safe on the wrong chain — you want to find that out
on a calm Tuesday.

---

## 12. Prepare the frontend for production

### 12.1 Config final pass

Confirm in `scaffold.config.ts`:

- `targetNetworks: [chains.base]` — and **only** Base
- `onlyLocalBurnerWallet: true` / `burnerWalletMode: "localNetworksOnly"`
- no literal API keys anywhere in the file

### 12.2 Strip the scaffolding

- Remove the SE2 default branding, header links, and the "Debug Contracts" page from the
  production nav (keep the route if you want it, but don't advertise it).
- Remove any faucet / burner UI.
- Remove `console.log`s: `grep -rn "console\.log" packages/nextjs/app packages/nextjs/components`

### 12.3 Metadata and link previews

In `packages/nextjs/app/layout.tsx` (or SE2's `getMetadata` helper):

- Title and description that describe *your* app, not "Scaffold-ETH 2 App"
- OG image at exactly **1200x630px**, referenced by absolute URL
- Favicon replaced

### 12.4 Restore production values

Search for anything you softened for testing — hardcoded test addresses, a lowered minimum
tip, a shortened polling interval, a mock creator list:

```bash
grep -rn "TODO\|FIXME\|HACK\|test\|mock\|localhost\|127.0.0.1" packages/nextjs --include="*.ts" --include="*.tsx" | grep -v node_modules
```

### 12.5 Design

No LLM slop. No generic purple gradient on a dark background. This is a product people will
send money through — it should look like someone chose how it looks.

### 12.6 Build clean

```bash
yarn next:check-types
yarn next:lint
yarn next:build
```

**GATE:** production build succeeds with zero type errors and zero lint errors; no burner
wallet visible when pointed at Base; grep for test values comes back clean.

---

## 13. Independent frontend QA audit

Hand this to a **separate agent or the other person** — not whoever wrote the frontend. Fetch
and work through:

```
https://ethskills.com/qa/SKILL.md
```

Fix everything it raises before deploying. It is much cheaper to fix now than after the URL
is public.

**GATE:** QA audit complete, findings fixed or explicitly accepted in writing.

---

## 14. Deploy the frontend

**Vercel is the right call here** — you want a custom domain, and IPFS can't do server-side
rendering, API routes, or functions.

```bash
yarn vercel           # preview deploy first
```

Open the preview URL and walk the journey once. Then:

```bash
yarn vercel --prod
```

In the Vercel dashboard, set the environment variables from Step 5 (`NEXT_PUBLIC_ALCHEMY_API_KEY`,
`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, `NEXT_PUBLIC_BASE_RPC`) for the Production
environment, then **redeploy** — env vars are baked in at build time, so setting them after a
build does nothing until you rebuild.

Attach your domain, and wait for the SSL certificate to be issued before sharing the link.

Optionally publish an IPFS mirror for censorship resistance:

```bash
yarn ipfs             # → https://{CID}.ipfs.community.bgipfs.com/
```

**GATE:** production URL loads over HTTPS on your own domain; env vars set *and* a build run
after they were set.

**HOW THIS BITES US:** the classic Vercel failure is a production build with missing env
vars — WalletConnect silently fails and mobile users simply can't connect, while it works
perfectly on your desktop with an injected wallet. Step 15 tests mobile explicitly for this
reason.

---

## 15. Production QA on the public URL

Run this against the real domain, not the preview, not localhost.

- [ ] App loads on the public URL, HTTPS valid
- [ ] Wallet connects — **MetaMask, Rainbow, and WalletConnect** each tested separately
- [ ] Network switching to Base works from a wrong-network start
- [ ] Reads work: creator list, tip history, balances
- [ ] Writes work: a real **$1 tip end-to-end from the production URL**
- [ ] Fee split on that tx confirmed on Basescan (0.99 / 0.01)
- [ ] **Burner wallet is NOT offered** — this is the one to check twice
- [ ] Zero console errors, zero failed network requests
- [ ] Mobile responsive; tested in a real mobile browser with a real mobile wallet
- [ ] OG image renders — paste the link into Slack/Discord/X and look at the preview
- [ ] Cold load with no wallet installed → sensible prompt, not a crash
- [ ] Lighthouse: performance and accessibility both ≥ 90

**GATE:** every box ticked, by the Checker, on the public URL.

---

## 16. Monitoring and the incident runbook

Set this up **before** you announce, not after.

### Watch

- Basescan "watch address" alerts on both the contract and the Safe.
- A Tenderly alert (free tier) on failed transactions to your contract. A spike in reverts is
  your earliest signal that something is broken — users won't tell you, they'll just leave.
- Vercel deployment + error notifications to a shared channel.
- Alchemy usage alerts — if someone lifts your public RPC key, you want to know from an alert
  rather than from a bill.

### Daily for the first week

```bash
cast call <CONTRACT> "feeRecipient()(address)" --rpc-url https://mainnet.base.org
cast call <CONTRACT> "paused()(bool)"          --rpc-url https://mainnet.base.org
# contract should hold ~zero USDC — a growing balance means tokens are being stranded
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <CONTRACT> \
  --rpc-url https://mainnet.base.org
```

That last one is the single highest-value check you can run. A non-zero, growing contract
balance means your accounting is leaking, and you want to find that at $3, not $3,000.

### If something is wrong

1. **Pause**, from the Safe. Ask questions after. Pausing a tipping app for an hour costs
   almost nothing; letting a fee bug run does not.
2. Put a banner on the frontend saying it's paused and why. Silence reads as a rug.
3. Diagnose on a **fork pinned to the block where it broke**:
   `yarn fork --network base --fork-block-number <N>`
4. Fix in Phase 1. Regression test. Redeploy. Re-verify. Re-run Step 10.
5. Point the frontend at the new address, redeploy the frontend, unpause.

### Rollback

There is no rollback for a deployed contract — only pause plus redeploy. That's why Steps 2,
3, and 10 are as heavy as they are.

---

## 17. Go public

Only now:

- Announce the URL.
- Start with a small, known group before a broad launch. First real users find things two
  people never will.
- Keep both of you reachable for the first 48 hours, with the Safe accessible to both.
- Merge `launch/base-mainnet` into `main` and tag it:

```bash
git checkout main && git merge --no-ff launch/base-mainnet
git tag -a v1.0.0 -m "Base mainnet launch"
git push origin main --tags
```

---

## Appendix A: Reference

| Item | Value |
|---|---|
| Base mainnet chain ID | `8453` |
| Base public RPC | `https://mainnet.base.org` |
| USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals — **verify against Circle's docs**) |
| Base Sepolia chain ID | `84532` |
| USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Explorer | https://basescan.org |

## Appendix B: Fill this in as you go

```
Deploy commit SHA:      ________
Deployer address:       ________
Safe address:           ________
Contract address:       ________
Deploy tx hash:         ________
Verified at:            ________
Ownership transfer tx:  ________
First mainnet tip tx:   ________
Production URL:         ________
Launched (UTC):         ________
```

## Appendix C: The things that end launches

1. Committing a private key or API key. → Step 4, every time, no exceptions.
2. Wrong fee recipient in the constructor. Immutable. → Step 8 `cast call` readback.
3. `parseEther` on a 6-decimal token. → Step 2.1 grep + Step 10's $1.37 test.
4. Burner wallet live in production. → Step 8.1 (set early) + Step 15 (verify).
5. Skipping `yarn verify`. → Step 9, same sitting as the deploy.
6. Deployed contracts owned by a hot key. → Step 11.
7. Vercel env vars set but never rebuilt. → Step 14.
8. No pause function, so no incident response. → Step 2.5.
