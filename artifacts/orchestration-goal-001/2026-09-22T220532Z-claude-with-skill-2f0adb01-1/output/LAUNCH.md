# LAUNCH.md — Local fork → real users on Base

**Where we are:** Phase 1 complete. Contracts + frontend work end-to-end against a local
Base fork with a browser wallet. Tests pass. Nothing live, nothing funded, nothing public.

**Where we're going:** Phase 2 (live contracts on Base mainnet, UI still on localhost) →
Phase 3 (public frontend, real users).

**How to use this doc:** follow it top to bottom. Each step ends with a **GATE** — a
concrete thing to check. If a gate fails, stop and fix before the next step. Do not
reorder: several steps exist specifically to catch a class of failure that the next step
would make permanent.

Two of us are following this. Where a step says **[both]**, both people are present and
one watches the other. Everything else can be done solo.

Estimated calendar time: 2–3 working days if nothing is wrong, plus the soft-launch
window in Step 12.

---

## Step 0 — Three decisions that become permanent the moment we deploy

Do this before writing a single command. A deployed contract is immutable. These three
choices cannot be changed afterward unless the code already supports changing them.

### 0.1 Who owns the contract and receives the platform fee?

We are a two-person team taking a fee on other people's money. A single EOA private key
held by one of us is the wrong answer: if that laptop is lost or compromised, the fee
balance and any owner-only functions go with it, and there is no recovery.

**Decision: deploy a Safe (multisig) on Base first, and make it the owner and the
fee recipient.** 2-of-2 for two people is simple and fine; if you'd rather not be
deadlocked by one person losing a key, add a third signer (a hardware wallet in a
drawer) and go 2-of-3.

```bash
# In a browser, on Base mainnet: https://app.safe.global
# Create Safe → network Base → add both owner addresses → threshold 2
# Record the Safe address. It is not a secret.
```

Write the Safe address into the deploy script as the constructor arg / initial owner.
Do **not** use the deployer EOA as owner "for now, we'll transfer later" — "later"
is how these things stay wrong.

**GATE:** Safe exists on Base, both of us can see it and sign in it, and we have sent a
trivial test transaction from it (e.g. 0.0001 ETH to one of our own addresses) to prove
the signing flow actually works for both signers. Proving this now is much cheaper than
discovering a broken signer setup when we're trying to sweep fees or pause the contract.

### 0.2 Is there a kill switch?

If a bug shows up after launch, what can we do? Options, in increasing order of power:

- Nothing — contract runs forever exactly as written.
- `Ownable` + `Pausable` — owner (the Safe) can halt `tip()`. Users can't tip; nobody's
  funds are stuck as long as the contract doesn't custody balances between calls.
- Upgradeable proxy — most power, most footgun, most audit surface.

**Recommendation for this app: `Pausable` on the tipping entrypoint, no proxy.** The
contract is small, forwards funds in the same transaction, and holds only accrued fees.
A pause is enough to stop the bleeding; a proxy adds a whole new class of bug for a
contract this simple.

If the contract doesn't have `whenNotPaused` on `tip()` today, **add it now, in Phase 1,
with a test** — not after deploy.

### 0.3 Does the contract custody anything between transactions?

Two shapes:

- **Forward-on-receipt:** `tip()` transfers 99% to the creator and 1% to the fee
  recipient in the same call. Contract balance is ~always zero. Lowest risk. Preferred.
- **Accrue-and-withdraw:** contract holds creator balances until they call `withdraw()`.
  Now we are custodying strangers' money, and a bug is a loss of *their* funds, not ours.

If we're currently shape 2 without a strong reason, move to shape 1 before deploying.
If we stay shape 2, the audit in Step 1 is not optional and the soft launch in Step 12
should be longer and cap the total value at risk.

**GATE for Step 0:** All three decisions written down in the repo (a short `DECISIONS.md`
is fine), both of us agree, and the code matches the decisions. Everything after this
assumes these are settled.

---

## Step 1 — Contract hardening pass (still local, still Phase 1)

Nothing here needs a live network. This is the last chance to change the bytecode for free.

### 1.1 USDC-specific correctness

USDC is not a generic ERC-20 and not ether. Go through this list line by line against
the actual contract source:

- [ ] **6 decimals, not 18.** Every amount in tests, scripts, and the frontend uses
      `parseUnits(x, 6)` / `formatUnits(x, 6)`. A single stray `parseEther` makes a
      "$5 tip" into a request for 5,000,000,000,000 USDC — which fails loudly (good) —
      or makes a "5,000,000 USDC" display read as "5" — which fails silently (bad).
- [ ] **`SafeERC20` everywhere.** Use `safeTransfer` / `safeTransferFrom`. USDC's
      `transfer` returns a bool; raw calls that ignore it are a known bug class.
- [ ] **Fee rounding.** 1% of a small tip truncates. Write down and test the exact
      behavior for the smallest tips:
      - `tip(1)` → fee = 0, creator gets 1 (we take nothing on dust — fine)
      - `tip(99)` → fee = 0, creator gets 99
      - `tip(100)` → fee = 1, creator gets 99
      Assert `fee + toCreator == amount` **always**, for every input, as a property.
      A rounding path where those don't sum is how USDC gets stranded in the contract.
- [ ] **Minimum tip.** Consider rejecting tips below ~`0.01 USDC` (10000 units) so the
      truncation edge cases never occur in production. Cheaper than reasoning about them.
- [ ] **Zero-address and self-tip.** `require(creator != address(0))`,
      `require(creator != address(this))`.
- [ ] **USDC blacklist.** Circle can freeze an address. If the creator or the fee
      recipient is blacklisted, `transfer` reverts and the whole tip reverts. That's the
      correct behavior — just make sure the frontend surfaces it as a readable message
      rather than a raw revert (Step 8), and make sure a blacklisted *creator* cannot
      block the fee recipient or vice versa in a way that bricks the contract.
- [ ] **USDC is an upgradeable proxy and is pausable by Circle.** If USDC pauses, we stop
      working. Nothing to do; just know it and don't debug for an hour.
- [ ] **No fee-on-transfer assumptions.** Native USDC on Base has no transfer fee today,
      but if the contract computes creator amount from the *input* rather than from the
      actual balance delta, note that assumption explicitly.
- [ ] **Reentrancy.** USDC has no transfer callback, so the direct risk is low, but add
      `nonReentrant` on any state-changing external entrypoint anyway. It costs ~2k gas
      on an L2 where gas is cheap and removes a whole category of argument.
- [ ] **Fee rate immutability.** If the fee is changeable by the owner, bound it in code
      (`require(newFeeBps <= 200)`). An owner-settable unbounded fee is indistinguishable
      from a rug to anyone reading our contract, and we want people to read it.
- [ ] **Events.** `Tip(address indexed from, address indexed creator, uint256 amount,
      uint256 fee)` — we need this for monitoring in Step 13 and we cannot add it later.

### 1.2 Coverage and the audit pass

```bash
cd packages/foundry
forge test -vvv
forge coverage --report summary
```

Target ≥90% line coverage on the tipping contract, and 100% on the fee-math function.

Then run the dedicated audit skill against the contract before moving on — fetch
`https://ethskills.com/audit/SKILL.md` and work through it, ideally handing it to a
fresh agent/person who did not write the contract. Authors do not find their own
assumptions.

### 1.3 Fork test against real USDC

The local fork already has real Base state, so test against the *real* USDC contract,
not a mock:

```bash
# Terminal 1
yarn fork --network base
# Terminal 2
yarn deploy
yarn test
```

Impersonate a real USDC whale on the fork, tip through the deployed contract, and assert
the creator's and fee recipient's real USDC balances moved by exactly the expected
amounts. If the test suite currently uses a `MockERC20`, add at least one fork test that
uses the real token address. Mock tokens are too well-behaved.

**GATE for Step 1:** `forge test` green, coverage ≥90%, audit checklist walked with no
open findings, and at least one fork test that moves real USDC through the real token
contract and asserts exact balance deltas including the 1% fee.

---

## Step 2 — Secret hygiene, before anything touches a network or a remote

Read this fully. This is the step where launches become incidents. Leaked keys on public
repos are scraped and drained in seconds, not hours.

### 2.1 `.gitignore` must contain

```
.env
.env.*
!.env.example
*.key
broadcast/
cache/
node_modules/
```

### 2.2 Scan the working tree and history

```bash
# Anything staged that smells like a secret
git diff --cached --name-only | grep -iE '\.env|key|secret|private'

# Raw 32-byte hex (private keys) anywhere in source
grep -rn "0x[a-fA-F0-9]\{64\}" packages/ --include="*.ts" --include="*.js" --include="*.sol"

# Provider keys baked into config
grep -rn "g\.alchemy\.com/v2/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
grep -rn "infura\.io/v3/[A-Za-z0-9]"      packages/ --include="*.ts" --include="*.js"

# And the history, not just the tip
git log -p --all | grep -nE "0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]" | head
```

If any of these hit: **stop**. Move the value into `.env`, rotate the credential at the
provider (a key that was committed is burned even after you delete the commit), and only
then continue. If it's already been pushed to a public remote, rotate first, scrub second.

### 2.3 The `scaffold.config.ts` trap

`scaffold.config.ts` **is committed**. Never paste a key into it.

```typescript
// ❌ leaked the moment we push
rpcOverrides: {
  [chains.base.id]: "https://base-mainnet.g.alchemy.com/v2/AbC123realkey",
},

// ✅ key lives in .env.local
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
},
```

Note that *any* `NEXT_PUBLIC_*` value ships to the browser and is world-readable. That's
unavoidable for an RPC key — the mitigation is provider-side (Step 9.2: domain
allowlisting + spend caps), not secrecy.

**GATE for Step 2:** All four greps return nothing. `.gitignore` covers the list above.
`git status` shows no `.env*` file as tracked or staged.

---

## Step 3 — Deployer key and funding **[both]**

The deployer key signs the mainnet deploy. It does not need to hold value afterward —
ownership and fees go to the Safe from Step 0.1 — so treat it as a hot, disposable key
with a small amount of gas on it.

### 3.1 Generate (or import) the deployer

SE2's foundry package uses an encrypted keystore account rather than a plaintext key in
`.env`. Check which your version does — if `packages/foundry/.env` has
`ETH_KEYSTORE_ACCOUNT`, you're on the keystore flow:

```bash
# Keystore flow (current SE2)
yarn account:generate        # creates an encrypted keystore account, prompts for a password
# or, to bring an existing key under keystore encryption:
yarn account:import

yarn account                 # prints the deployer address + balances per network
```

If your version still writes `DEPLOYER_PRIVATE_KEY` into `packages/foundry/.env`, that's
fine — just confirm `.env` is gitignored (Step 2) and never echo the key into a terminal,
a log, a screenshot, or a chat message.

Record the deployer **address** (public, safe to share). Store the keystore password in a
password manager shared between the two of us — losing it before the deploy costs
nothing, losing it after is only annoying, but let's not.

### 3.2 Fund it with gas on Base

Deploying on Base costs cents. Send a small amount of ETH **on Base** (not on Ethereum
mainnet — bridge or buy directly on Base) to the deployer address:

- **0.01 ETH** is plenty for a deploy, verification, and a dozen test transactions.
- Also send **~$20 of USDC on Base** to one of our personal wallets for live testing in
  Step 7 — not to the deployer, to a wallet we'll connect in the browser.

```bash
yarn account   # confirm the balance shows up on Base before moving on
```

**GATE for Step 3:** `yarn account` shows a non-zero Base balance for the deployer. The
Safe address from Step 0.1 is set as owner/fee recipient in the deploy script. One of us
has USDC on Base in a browser wallet.

---

## Step 4 — Dress rehearsal on Base Sepolia

We have never deployed to a live network. Doing that for the first time on mainnet means
debugging RPC config, network names, verification, and deploy-script arguments with real
money and a permanent record. Base Sepolia is free and exercises the identical code path.

This is a rehearsal, not a product. It exists to prove the *mechanics*, then we throw it away.

### 4.1 Config and funding

Confirm `packages/foundry/foundry.toml` has the RPC endpoints:

```toml
[rpc_endpoints]
base        = "https://mainnet.base.org"
baseSepolia = "https://sepolia.base.org"
```

Get testnet ETH from a Base Sepolia faucet to the deployer address. For USDC, use the
Base Sepolia test USDC (Circle's testnet USDC — **look the current address up on
Circle's docs and Basescan rather than trusting a copy-pasted constant**; testnet
addresses get redeployed). The deploy script should read the token address from a
per-network config, not a hardcoded mainnet constant — if it doesn't, fix that now,
because that same hardcoding will bite on mainnet.

### 4.2 Deploy and verify

```bash
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
```

### 4.3 Exercise the full journey on testnet

Point the local frontend at Base Sepolia temporarily:

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.baseSepolia],
```

```bash
yarn start
```

Then, in the browser with a real wallet:

1. Connect; confirm the network-switch prompt appears if you're on the wrong chain.
2. Approve USDC for the exact tip amount.
3. Tip a creator address.
4. Confirm on Basescan (Sepolia) that the creator received 99% and the Safe/fee recipient
   received 1%, to the unit.
5. From the Safe, call `pause()`, confirm `tip()` now reverts with a readable message in
   the UI, then `unpause()`.

Step 5 is the one that matters most: it proves the emergency brake works *and* that our
Safe signers can actually reach it under pressure.

**GATE for Step 4:** Contract verified and green on Base Sepolia's explorer; a real
browser wallet completed approve → tip; the on-chain split is exactly 99/1; pause and
unpause both executed from the Safe. **Revert `targetNetworks` to `[chains.base]` before
continuing** — do not carry a testnet config into Step 5.

---

## Step 5 — Deploy to Base mainnet **[both]**

### 5.1 Final pre-flight

```bash
git status                 # clean tree; we want to know exactly what bytecode we shipped
git rev-parse HEAD         # record this commit hash in DECISIONS.md
forge test                 # green one more time on the exact commit being deployed
yarn account               # deployer funded on Base
```

Confirm in the deploy script, out loud, to the other person:

- USDC address = Base **mainnet** native USDC — verify the address on Basescan right now
  (it should be the Circle-issued native USDC on Base, symbol `USDC`, 6 decimals, not the
  bridged `USDbC`). Paste the address you're about to deploy with into Basescan and read
  the contract page before you hit enter. Deploying against the wrong token is unfixable.
- Owner / fee recipient = the Safe address from Step 0.1.
- Fee = 100 bps.

### 5.2 Deploy

```bash
yarn deploy --network base
```

### 5.3 Verify **immediately**

Not later. Later means never, and an unverified contract asking people for USDC approvals
is a contract nobody should use.

```bash
yarn verify --network base
```

If `yarn verify` fails (it sometimes does on a fresh chain config), fall back to:

```bash
cd packages/foundry
forge verify-contract <DEPLOYED_ADDRESS> contracts/<Contract>.sol:<Contract> \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address,uint16)" <USDC> <SAFE> 100) \
  --watch
```

You may need an explorer API key in `.env` (`ETHERSCAN_API_KEY`) for the fallback path.

### 5.4 Read the deployed contract back

On Basescan, open the contract's **Read Contract** tab and confirm, with your eyes:

- token address == mainnet USDC
- owner / feeRecipient == the Safe
- feeBps == 100
- paused == false

**GATE for Step 5:** Contract verified on Basescan with source visible; all four read
values correct. Commit the regenerated `packages/nextjs/contracts/deployedContracts.ts`
— the frontend build in Step 10 reads the address from that file, and if it isn't
committed, the production build will ship pointing at nothing.

```bash
git add packages/nextjs/contracts/deployedContracts.ts
git commit -m "chore: deployed contracts for Base mainnet"
```

---

## Step 6 — Phase 2: live contracts, local UI

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.base],
```

```bash
yarn start   # localhost:3000, pointed at the real mainnet contract
```

Everything from here until Step 10 happens against the real contract with real money,
from localhost. This is deliberate: we want to find problems while the only users are us.

**GATE for Step 6:** App loads on localhost, reads state from the mainnet contract
(e.g. `feeBps` renders as 1%), no console errors.

---

## Step 7 — Live smoke test with real money **[both]**

Small amounts. $1–5 per transaction. One of us is the fan, the other is the creator, so
we can watch both sides.

1. **Wrong network.** Connect a wallet on Ethereum mainnet. The UI must show *only* a
   "Switch Network" button — not an approve or tip button.
2. **Approve.** Switch to Base. The UI must now show *only* "Approve USDC", for the exact
   tip amount (or a small multiple). **Never an infinite approval** — we are asking
   strangers to approve a brand-new contract; `type(uint256).max` is the difference
   between a bug costing one tip and costing someone's whole USDC balance.
3. **Tip.** Only after approval clears does "Send Tip" become available. Send $1.
4. **Verify the split on-chain.** Basescan → the tx → token transfers tab. Creator got
   0.99 USDC, Safe got 0.01 USDC. Confirm to the unit.
5. **Insufficient balance.** Try to tip more USDC than the wallet holds. The UI should say
   something like "You don't have enough USDC", not surface a raw revert blob.
6. **User rejects.** Hit reject in the wallet. The UI must return to a clean state, not
   hang on a spinner forever.
7. **Dust tip.** Tip the minimum allowed amount. Confirm the fee math behaves as Step 1.1
   documented and nothing gets stranded.
8. **Fee sweep.** If fees accrue in-contract, execute the withdrawal from the Safe and
   confirm USDC lands. If fees forward per-tip, confirm the Safe balance rose by 0.01.
9. **Pause drill.** Pause from the Safe. Confirm the UI disables tipping with a clear
   message rather than letting users submit a doomed transaction and pay gas for a
   revert. Unpause.

**GATE for Step 7:** All nine pass. Any failure here goes back to Step 1 — fix locally,
add a regression test, redeploy. **Do not patch around a contract bug in the frontend.**
A frontend workaround leaves the broken contract deployed and callable by anyone with
Basescan.

---

## Step 8 — Frontend polish and error handling

Now that the contract is trusted, make the app presentable.

- **Human-readable amounts everywhere.** `formatUnits(x, 6)` for display,
  `parseUnits(x, 6)` for calls. Grep for `formatEther`/`parseEther` and confirm every
  remaining hit is about ETH gas, not USDC.
- **Loading states on every async path.** `isLoading` on reads, `isMining` on writes.
  Buttons disabled while a tx is pending — Base blocks are ~2s, but wallet confirmation
  plus propagation is long enough for a user to double-click and double-tip.
- **Error translation.** Map at minimum:
  - `user rejected` → "Transaction cancelled."
  - `insufficient funds` → "Not enough ETH on Base to cover gas."
  - `transfer amount exceeds balance` → "Not enough USDC."
  - `EnforcedPause` → "Tipping is temporarily paused."
  - anything else → a short message plus the tx hash, so we can debug from a screenshot.
- **Fee transparency.** Show the split before confirmation: "Creator receives $4.95 ·
  Platform fee $0.05 (1%)". People tolerate a fee they were told about.
- **Remove SE2 default branding**, placeholder copy, and the debug/example pages we don't
  want public. Decide deliberately whether `/debug` stays — it's genuinely useful and also
  exposes every contract function to anyone. Recommend removing it for launch.
- **Design:** make it ours. No generic purple gradient. A tipping app for creators should
  look like someone made it on purpose.

Then run a real QA pass — fetch `https://ethskills.com/qa/SKILL.md` and hand it to a
separate agent or the other person. Whoever wrote the UI cannot QA the UI.

**GATE for Step 8:** QA pass complete with findings fixed; every error path above shows a
human sentence; no raw hex reverts reachable from normal use.

---

## Step 9 — Production configuration

### 9.1 `scaffold.config.ts`

```typescript
const scaffoldConfig = {
  targetNetworks: [chains.base],

  // Burner wallets are a local dev convenience. In production they hand users a
  // key in localStorage that they will lose, along with any USDC in it.
  burnerWalletMode: "localNetworksOnly",   // older SE2: onlyLocalBurnerWallet: true

  pollingInterval: 30000,

  rpcOverrides: {
    [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
  },

  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
} as const;
```

### 9.2 RPC: do not ship on the public endpoint

`https://mainnet.base.org` is rate-limited and shared by the world. It's fine for our
own testing and it will produce mysterious, intermittent "failed to fetch" errors for
real users at exactly the moment we're getting traffic.

Get a dedicated Base endpoint (Alchemy, QuickNode, whatever) and put it in
`packages/nextjs/.env.local`:

```bash
# packages/nextjs/.env.local   — gitignored
NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/xxxxxxxx
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxxxxxxx
```

Because this key ships to the browser, mitigate at the provider rather than by hiding it:

- Restrict the key to our production domain(s) in the provider dashboard.
- Set a monthly compute-unit cap and a billing alert, so a scraped key becomes a bill we
  notice rather than one we discover at the end of the month.

### 9.3 WalletConnect project ID

SE2 ships with a shared default. Register our own at
`https://cloud.reown.com` (WalletConnect Cloud), set the project's allowed domain to our
production URL, and put the ID in `.env.local` as above. Without our own ID, mobile
wallet connections are unreliable and we have no visibility into them.

### 9.4 Metadata and link previews

In `packages/nextjs/app/layout.tsx` (or `utils/scaffold-eth/getMetadata.ts`):

- `title`, `description` — actual product copy, not "Scaffold-ETH 2 App".
- OG image at **1200×630**, in `public/`, referenced absolutely.
- Favicon replaced.

Tips get shared as links. The preview card is most people's first impression.

### 9.5 Final build check

```bash
yarn next:check-types
yarn lint
yarn next:build        # must pass without NEXT_PUBLIC_IGNORE_BUILD_ERROR
```

If the build only passes with the ignore-errors flag set, that flag is hiding something
that will break at runtime. Fix it instead.

**GATE for Step 9:** Clean build with no error-suppression flags; `.env.local` present
locally and *not* in git (re-run the Step 2 greps); RPC key is domain-restricted and
capped.

---

## Step 10 — Deploy the frontend

### 10.1 Primary: Vercel

For a consumer-facing tipping app we want a stable custom domain, fast loads, and the
ability to ship a fix in two minutes. That's Vercel.

```bash
yarn vercel            # preview deployment first
```

Open the preview URL and re-run the smoke test from Step 7 items 1–4 against it before
promoting. A preview deploy that works is the cheapest possible proof that the production
deploy will.

Then add the environment variables in the Vercel dashboard (Project → Settings →
Environment Variables) — **`.env.local` is gitignored and therefore does not exist on
Vercel's build machine**:

- `NEXT_PUBLIC_BASE_RPC`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

Redeploy after adding them (env vars are baked in at build time; adding them without
rebuilding changes nothing), then promote:

```bash
yarn vercel --prod
```

Add the custom domain in the Vercel dashboard and update the domain allowlists from
9.2 and 9.3 to match it.

### 10.2 Optional: IPFS mirror

A censorship-resistant copy is cheap and a good look for a crypto app:

```bash
yarn ipfs
# → https://{CID}.ipfs.community.bgipfs.com/
```

Caveat: IPFS serves static files only — no SSR, no API routes, no server functions. If
the app uses any of those, the IPFS build will be subtly broken (usually: pages render
but data is missing). Test the IPFS URL independently rather than assuming it matches
Vercel. Treat it as a mirror, not the primary.

**GATE for Step 10:** Production URL loads, correct metadata, custom domain resolving
over HTTPS.

---

## Step 11 — Production QA on the real URL **[both]**

Re-test on the deployed site, not on localhost. Different origin, different env vars,
different bundler output — bugs live in that gap.

- [ ] Site loads on the public URL, no console errors, no 404s on assets.
- [ ] **Burner wallet is NOT offered.** If you see it, 9.1 didn't take — stop and fix.
      Shipping burner wallets to real users means real users losing real USDC.
- [ ] Wallet connects: MetaMask (desktop), Rainbow or Coinbase Wallet (mobile via
      WalletConnect), and one browser other than the one you built in.
- [ ] Wrong-network state shows Switch Network only.
- [ ] A real $1 tip completes end-to-end from the production URL. Verify the 99/1 split
      on Basescan one final time.
- [ ] Mobile: layout works at 390px wide; the tip flow is completable one-handed. Most
      tips will come from a phone.
- [ ] Paste the URL into Slack/Discord/X and confirm the OG card renders.
- [ ] Hard-refresh mid-transaction; confirm the app recovers to a sane state.
- [ ] Open the site in a private window with no wallet installed; confirm it degrades to
      a readable page with a "get a wallet" path rather than a white screen.

**GATE for Step 11:** Every box checked by *both* of us, independently, on different
devices.

---

## Step 12 — Soft launch before public launch

Do not go from "two of us tested it" to "posted publicly". Insert a bounded window.

**Day 1–2: friends-and-family.** Share the URL with 5–10 people we can call. Ask them to
send real, small tips. Watch for:

- Transactions that revert — every revert from a real user is a bug in our UI, our gas
  estimation, or our contract, not a user error.
- Approval confusion — did anyone get stuck at the approve step? That's the highest-drop
  step in every token app.
- Anyone who couldn't connect at all (which wallet? which browser? which phone?).

**Day 3: check the numbers.** On Basescan, pull the contract's transaction list and the
`Tip` events. Confirm total fees received by the Safe equals 1% of total tipped volume,
to the unit. If that reconciliation is off by any amount, stop and find out why before
anyone else uses it.

**Then launch publicly.** And for the first week, cap our own exposure to surprise: check
the contract daily (Step 13).

---

## Step 13 — Monitoring and incident response

### 13.1 Know what's happening without being asked

- **Basescan address watch** on the contract address and the Safe — email on every
  transaction. Crude, free, effective at this volume.
- **Tenderly alert** (or equivalent) on *failed* transactions to the contract address.
  Successful tips are self-reporting; failed ones are the signal we'd otherwise never
  see, because the user just quietly leaves.
- **Vercel analytics / error logging** for frontend errors.
- A weekly reconciliation: total `Tip` event volume × 1% == fees received by the Safe.

### 13.2 The runbook — write this down before we need it

**Symptom: users report tips failing.**
1. Check Basescan: are transactions reverting, or not arriving at all?
2. Not arriving → RPC problem. Check the provider dashboard for rate limiting or a
   dead key. Fix: temporarily point `NEXT_PUBLIC_BASE_RPC` at a backup endpoint and
   redeploy the frontend (~2 min).
3. Reverting → read the revert reason on Basescan. If it's `EnforcedPause`, someone
   paused. If it's USDC-side (blacklist, USDC paused), it's upstream and we wait.
4. Reverting with our own contract's logic → **pause immediately** (13.3), then debug.

**Symptom: the fee math looks wrong.**
Pause first, reconcile second. A fee bug that keeps running is a fee bug that keeps
growing and eventually has to be refunded by hand.

**Symptom: someone reports losing funds.**
Get the tx hash. Read the actual transfers on Basescan before concluding anything —
most such reports are a wrong-address tip or an unbridged token, not our bug. If it *is*
our bug: pause, then communicate publicly and quickly. The reputational damage comes from
the silence, not the bug.

### 13.3 Emergency pause

Rehearsed in Step 4.3 and Step 7.9, so this should be muscle memory:

1. Open the Safe on Base.
2. New transaction → contract interaction → our contract → `pause()`.
3. Both signers approve. Execute.
4. Confirm `paused == true` on Basescan's Read tab.
5. Post a short status note wherever our users are.

Target: under 10 minutes from decision to paused. If both of us are asleep, that's the
real number — consider whether a third signer in a different timezone is worth it before
volume gets meaningful.

### 13.4 Rolling back

- **Frontend bug:** `yarn vercel --prod` on the previous commit, or promote the prior
  deployment from the Vercel dashboard. Instant.
- **Contract bug:** there is no rollback. Pause → fix in Phase 1 with a regression test →
  redeploy a new contract → update `deployedContracts.ts` → redeploy the frontend →
  tell existing users to revoke their USDC approval to the old contract address
  (`revoke.cash` or the wallet's own token-approval UI). Publish the old and new
  addresses so nobody has to guess which is real — address confusion is exactly the gap
  phishers step into.

---

## Appendix A — Phase transition rules

- **Phase 3 (production) bug → drop to Phase 2.** Fix against the local UI pointed at
  the production contract. Don't debug in production.
- **Phase 2 (live contract) bug → drop to Phase 1.** Fix on the fork, add a regression
  test, redeploy.
- **Never hack around a contract bug in the frontend.** The contract stays callable by
  anyone regardless of what our UI does.

## Appendix B — Environment variables

| Variable | Where | Committed? | Notes |
|---|---|---|---|
| `ETH_KEYSTORE_ACCOUNT` | `packages/foundry/.env` | **No** | Names the encrypted deployer keystore |
| `ETHERSCAN_API_KEY` | `packages/foundry/.env` | **No** | Only needed for the manual verify fallback |
| `NEXT_PUBLIC_BASE_RPC` | `packages/nextjs/.env.local` + Vercel dashboard | **No** | Ships to browser; domain-restrict + cap at the provider |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `packages/nextjs/.env.local` + Vercel dashboard | **No** | Ships to browser; domain-restricted |

Keep a committed `.env.example` listing the *names* with empty values, so the second
person can set up without guessing.

## Appendix C — Addresses to fill in and verify

Fill these in as we go. **Verify every address on Basescan before use — do not trust a
value copied from a doc, including this one.**

| Thing | Address | Verified on Basescan? |
|---|---|---|
| USDC (Base mainnet, native, 6 decimals) | `0x…` | ☐ |
| Safe (owner + fee recipient) | `0x…` | ☐ |
| Deployer EOA | `0x…` | ☐ |
| TippingContract (Base mainnet) | `0x…` | ☐ |
| Deploy commit hash | `…` | — |

## Appendix D — Command cheat sheet

```bash
# Local (Phase 1)
yarn fork --network base        # fork with real Base state
yarn deploy                     # deploy to the fork
yarn deploy --watch             # auto-redeploy on contract changes
yarn start                      # Next.js on :3000
forge test -vvv                 # contract tests
forge coverage --report summary

# Keys
yarn account:generate           # new encrypted deployer keystore
yarn account                    # show deployer address + balances

# Live (Phase 2)
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
yarn deploy --network base
yarn verify --network base

# Production (Phase 3)
yarn next:check-types && yarn lint && yarn next:build
yarn vercel                     # preview
yarn vercel --prod              # production
yarn ipfs                       # IPFS mirror
```

## Appendix E — Failure modes, and where each one gets caught

| What can go wrong | Caught by | Cost if it reaches users |
|---|---|---|
| `parseEther` used for 6-decimal USDC | Step 1.1 review + Step 4.3 testnet tip | Wrong amounts, possibly by 10^12 |
| Fee rounding strands USDC in the contract | Step 1.1 property test (`fee + toCreator == amount`) | Slow leak, manual refunds |
| Wrong USDC address (bridged `USDbC` vs native) | Step 5.1 read-back on Basescan | Unfixable; full redeploy |
| Deployed but unverified | Step 5.3, run immediately after deploy | Nobody trusts the approval prompt |
| `deployedContracts.ts` not committed | Step 5 gate | Production build points at no contract |
| Env vars missing on Vercel | Step 10.1 preview test | Site loads, nothing works |
| Burner wallet enabled in production | Step 11 checklist | Users lose real USDC in localStorage keys |
| Public RPC rate limits under load | Step 9.2 (dedicated endpoint) | Intermittent failures exactly at peak traffic |
| Infinite USDC approval | Step 7.2 | A contract bug becomes a drain of full balances |
| Fee recipient is one person's EOA | Step 0.1 (Safe) | One lost laptop = lost fees, no recovery |
| No kill switch | Step 0.2 (Pausable) | A live bug we can only watch |
| Safe signers can't actually sign | Step 0.1 gate + Step 4.3 pause drill | Kill switch that doesn't work when needed |
| Secret committed to git | Step 2 greps, before any push | Drained in seconds by scrapers |
