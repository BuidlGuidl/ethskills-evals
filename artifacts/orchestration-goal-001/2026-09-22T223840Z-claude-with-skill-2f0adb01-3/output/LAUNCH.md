# LAUNCH.md — Creator Tipping dApp: Local Fork → Live on Base

**Status today:** Phase 1 complete. Contracts + frontend work end-to-end against a local Base fork with a browser wallet. Nothing live, nothing funded, nothing public.

**Goal:** real users, real USDC, public URL on Base mainnet.

This document is ordered. Each stage has **DO** (exact commands/config), **CHECK** (the gate you must pass before the next stage), and **HOW THIS BITES YOU** (the failure mode and how to catch it before a user does). Do not reorder. Do not run a stage in parallel with the one before it.

---

## The map

| Stage | Where contracts live | Where UI lives | Money at risk |
|---|---|---|---|
| 0 — Accounts & decisions | — | — | none |
| 1 — Close out Phase 1 | local fork | localhost | none |
| 2 — Testnet rehearsal | Base Sepolia | localhost | none |
| 3 — Phase 2: live contracts | **Base mainnet** | localhost | your $10 |
| 4 — Frontend hardening | Base mainnet | localhost | your $10 |
| 5 — Phase 3: public deploy | Base mainnet | **public URL** | your $10 |
| 6 — Soft launch | Base mainnet | public URL | small, invited users |
| 7 — Open launch + monitoring | Base mainnet | public URL | real |

**Phase transition rule (do not violate):** a bug found in Stage 5+ goes back to Stage 4 (local UI against prod contracts). A *contract* bug found at any stage after 3 goes all the way back to Stage 1 — fix locally, write a regression test, redeploy fresh. Never hotfix a live contract by hand, never "work around it in the frontend."

**Key facts pinned for this app:**

| Thing | Value |
|---|---|
| Base mainnet chain id | `8453` |
| Base mainnet USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC decimals | **6** — not 18. `parseUnits(x, 6)` everywhere |
| Base Sepolia chain id | `84532` |
| Base Sepolia USDC (Circle test) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` — re-confirm against Circle's current testnet docs before you rely on it |
| Base public RPC | `https://mainnet.base.org` (fine as fallback, too rate-limited as primary) |
| Explorer | basescan.org |

---

## Stage 0 — Accounts and decisions, before you touch code

These take hours-to-days of waiting in the worst case, so start them now and let them run while you do Stage 1.

### DO

1. **Create a Safe multisig on Base** at https://app.safe.global (network: Base). 2-of-2 between the two of you at minimum; 2-of-3 with a cold recovery key is better.
   - This Safe becomes **the contract owner** and **the platform fee recipient**. Not your EOA. Not the deployer key.
2. **Get an RPC provider key** — Alchemy or QuickNode, Base Mainnet + Base Sepolia apps. Free tier is fine at launch; you need it because `mainnet.base.org` will rate-limit a real frontend.
3. **Get a WalletConnect Project ID** at https://cloud.reown.com. Without it, mobile wallet connections silently fail in production.
4. **Get a Basescan/Etherscan API key** (etherscan.io/apis — one V2 key covers Base). SE2 can verify without one, but having it makes verification deterministic and lets you script checks.
5. **Buy the domain** and point it nowhere yet.
6. **Decide and write down, in the repo:** who can pause, who receives fees, who can change the fee, whether the fee is fixed at 1% or settable, and what the upper bound on a settable fee is.
7. **Fund a fresh deployer with a small amount of ETH on Base** — you'll generate the key in Stage 3. Cheapest path: buy ETH on Coinbase and withdraw **directly to the Base network** (no bridge fee). ~0.01 ETH covers deployment and a long tail of admin txs; Base gas is cheap.

### CHECK
- [ ] Safe address written down, checksummed, and **both owners have independently confirmed they can sign a test transaction on it** (send 0.0001 ETH to yourselves through the Safe). An untested multisig is not a multisig.
- [ ] All five keys/IDs exist and are stored in a password manager, not a chat thread.

### HOW THIS BITES YOU
> Teams deploy with the fee recipient set to a hot EOA "temporarily," then never change it. Six weeks later that key is on a laptop that got malware and the platform's revenue address is compromised. Set the Safe as owner **in the deploy script**, not in a follow-up transaction you'll forget.

---

## Stage 1 — Close out Phase 1 properly

You are "done" locally. You are not done. These are the things that only matter once the token is real.

### 1.1 Fix the USDC-specific contract issues

These three are specific to a USDC tipping contract and are the most likely reasons you'd have to redeploy after launch. Decide each one **now**, while redeploying is free.

**(a) Do not push fees straight to the fee recipient on every tip.**

USDC is a blacklistable token. If your platform fee address ever gets blacklisted by Circle — or is a contract that reverts — then a `transfer` to it inside the tip path makes **every tip in the app revert**. That's a total outage caused by an address you don't control.

Accrue instead, and withdraw separately:

```solidity
// in tip(): creator gets paid directly, fee is booked, not pushed
uint256 fee = (amount * FEE_BPS) / 10_000;   // FEE_BPS = 100
uint256 payout = amount - fee;                // no rounding leak: payout + fee == amount, always
accruedFees += fee;
IERC20(USDC).safeTransferFrom(msg.sender, creator, payout);
IERC20(USDC).safeTransferFrom(msg.sender, address(this), fee);

// separate, owner-only
function withdrawFees(address to) external onlyOwner { ... }
```

**(b) Add `Pausable` and gate `tip()` on it.** This is your only kill switch. A contract without one cannot be stopped, ever. `whenNotPaused` on `tip()`, `pause()`/`unpause()` restricted to the owner (the Safe). Withdrawals of *already accrued* creator funds must **not** be pausable — pausing must never trap user money.

**(c) Use `SafeERC20`** (`safeTransfer` / `safeTransferFrom`), CEI ordering, and validate `creator != address(0)` and `amount > 0`. Reject `creator == address(this)`.

**(d) Hardcode the USDC address as an immutable constructor arg.** Never let it be set post-deploy by anyone but a multisig, and ideally not at all.

### 1.2 Tests that must exist before you deploy

```bash
cd packages/foundry
forge test -vvv
forge coverage --report summary
```

New tests required beyond what you have:

- [ ] **Rounding:** tip of `1` (0.000001 USDC) → fee is 0, creator gets 1, contract accounting still balances. Tip of `99` → fee 0. Tip of `100` → fee 1. Assert `payout + fee == amount` for all.
- [ ] **Fuzz the invariant:** `forge test --fuzz-runs 10000` on `testFuzz_payoutPlusFeeEqualsAmount(uint256 amount)`.
- [ ] **Invariant test:** contract USDC balance is always `>= accruedFees`. Run with `forge test --match-test invariant`.
- [ ] **Insufficient allowance** reverts with a distinguishable error.
- [ ] **Insufficient balance** reverts.
- [ ] **Blacklisted creator** (fork test: `vm.prank` the USDC blacklister, blacklist the creator, assert the tip reverts and *nothing else in the app is bricked*).
- [ ] **Paused** blocks `tip()` and does not block fee/creator withdrawals.
- [ ] **Access control:** non-owner cannot `pause`, `withdrawFees`, or change the fee.
- [ ] **Re-entrancy** on the withdraw path (mock a malicious recipient).
- [ ] Coverage ≥ 90% on the tipping contract specifically, not repo-wide.

```bash
forge test --fork-url $BASE_RPC_URL   # all of the above, against real Base state
```

### 1.3 Audit pass

Fetch and work through https://ethskills.com/audit/SKILL.md against your contract. The relevant domains for this app: **general logic, math/precision, access control, ERC20 integration, DoS, centralization**. Have the second person on the team read the contract line-by-line independently — a second pair of human eyes catches what checklists don't.

File anything Medium+ as an issue and fix it before Stage 2.

### 1.4 Secret hygiene — the one that ends projects

```bash
cd <repo root>

# .gitignore must contain these
cat .gitignore | grep -E '^\.env|^\.env\.\*|^broadcast/|^cache/|^\*\.key'

# nothing staged that looks like a credential
git diff --cached --name-only | grep -iE '\.env|key|secret|private'

# no raw private keys anywhere in source
grep -rn "0x[a-fA-F0-9]\{64\}" packages/ --include="*.ts" --include="*.js" --include="*.sol"

# no API keys baked into committed config (scaffold.config.ts is the classic trap)
grep -rn "g.alchemy.com/v2/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
grep -rn "infura.io/v3/[A-Za-z0-9]"     packages/ --include="*.ts" --include="*.js"

# and check history, not just the working tree
git log -p --all | grep -cE "0x[a-fA-F0-9]{64}"
```

**If any of these match: stop.** Move the value to `.env`, and if it's already in a commit, treat the credential as burned — rotate it, and clean history with `git filter-repo` or BFG. Bots scrape GitHub in real time; a committed key is drained in seconds, not hours.

In `scaffold.config.ts`, RPC URLs must read from env, never be literals:

```ts
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
},
```

### CHECK — gate to Stage 2
- [ ] `forge test` green, coverage ≥90% on the tipping contract, fuzz + invariant tests present and passing
- [ ] Pausable, SafeERC20, fee-accrual (not fee-push), Safe-as-owner all in the code and covered by tests
- [ ] Audit checklist run; zero open Medium+ findings
- [ ] All five secret-scan commands return nothing
- [ ] `git status` clean, everything committed

### HOW THIS BITES YOU
> Every item in 1.1 is *invisible* on a local fork with a test USDC balance and no blacklist, no pause, no adversary. The fork tests in 1.2 are the only place you'll ever see them before a user does.

---

## Stage 2 — Testnet rehearsal on Base Sepolia

This stage exists purely so that the *first* time you run `yarn deploy --network <live chain>` is not against mainnet with real money. It costs you an hour.

### DO

```bash
# Generate a deployer key. SE2 foundry writes an encrypted keystore entry
# to packages/foundry/.env and never prints the raw key.
yarn generate

# Confirm what you got — some SE2 versions store plaintext DEPLOYER_PRIVATE_KEY,
# newer ones store DEPLOYER_PRIVATE_KEY_ENCRYPTED. Either way it must be gitignored.
cat packages/foundry/.env | cut -c1-40
git check-ignore -v packages/foundry/.env   # must print a match

yarn account   # shows the deployer address + balances per chain
```

Fund that address with Base Sepolia ETH from a faucet (https://portal.cdp.coinbase.com/products/faucet or Alchemy's). Get Base Sepolia USDC from Circle's faucet (https://faucet.circle.com).

`packages/foundry/foundry.toml` — confirm the RPC endpoints:

```toml
[rpc_endpoints]
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"
base        = "${BASE_RPC_URL}"
```

Point your deploy script at the **testnet** USDC address for chain 84532 and mainnet USDC for 8453 — make it a chain-id switch in the script, not a manual edit you'll forget to revert:

```solidity
address usdc = block.chainid == 8453
    ? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    : 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
```

Deploy, verify, and point the local UI at it:

```bash
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
```

`packages/nextjs/scaffold.config.ts`:
```ts
targetNetworks: [chains.baseSepolia],
```

```bash
yarn start
```

### CHECK — gate to Stage 3
- [ ] Contract verified and source-readable on sepolia.basescan.org
- [ ] Constructor args on the explorer show the **Safe address** as owner and the correct USDC address
- [ ] Full journey in the browser: connect → wrong-network state shows a "Switch to Base Sepolia" button as the *primary CTA* → approve exact amount → tip → creator balance up by 99%, contract up by 1%
- [ ] `withdrawFees` executes **from the Safe** (not your EOA) and lands correctly — this is the first real test that your Safe can actually drive the contract
- [ ] `pause()` from the Safe blocks tipping and the UI shows something human, not a raw revert string
- [ ] No console errors

### HOW THIS BITES YOU
> The two things that break here and would have broken on mainnet: (1) your Safe can't call the contract because you set the owner to a deployer EOA by accident, and (2) verification fails because of a compiler-settings mismatch, leaving an unverified contract that nobody will trust. Both are free to fix here and expensive to fix live.

---

## Stage 3 — Phase 2: live contracts on Base mainnet, UI still local

### DO

1. Fund the deployer on Base mainnet with ~0.01 ETH (from Stage 0). Confirm:

```bash
yarn account
```

2. Point the app at mainnet — `packages/nextjs/scaffold.config.ts`:

```ts
const scaffoldConfig = {
  targetNetworks: [chains.base],
  pollingInterval: 3000,                    // not the 30000 default; tips feel dead otherwise
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  rpcOverrides: {
    [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
  },
  burnerWalletMode: "localNetworksOnly",    // never a burner wallet on Base
  onlyLocalBurnerWallet: true,              // older SE2 field name; set whichever your version has
} as const satisfies ScaffoldConfig;
```

3. Confirm `packages/nextjs/contracts/externalContracts.ts` has USDC under chain id **8453** with the mainnet address above. Do **not** hand-edit `deployedContracts.ts` — it regenerates.

4. **Dry run the deploy first:**

```bash
forge script script/Deploy.s.sol --rpc-url base            # simulation only, no --broadcast
```
Read the simulated output. Confirm the owner and USDC args.

5. Deploy, then verify **immediately** — not later, not tomorrow:

```bash
yarn deploy --network base
yarn verify --network base
```

6. Record the deployed address in the repo README and in your password manager.

### CHECK — gate to Stage 4
- [ ] basescan.org shows **verified** source with a green checkmark
- [ ] `owner()` returns the Safe address — read it from the explorer, not from your deploy log
- [ ] The USDC address on the contract is `0x8335...2913` exactly (checksummed compare, character by character)
- [ ] `yarn start` against mainnet: **real** $1 tip from your own wallet to a creator address you control, with a real browser wallet
  - creator receives 0.99 USDC
  - contract holds 0.01 USDC
  - the tip event shows up in the UI's history without a refresh
- [ ] Second $1 tip from the *other* team member's wallet on a *different* device — catches wallet-specific and cache-specific breakage
- [ ] `withdrawFees` from the Safe moves that 0.01 USDC. Do this once now, at launch scale, so you know the revenue path works.
- [ ] `pause()` then `unpause()` from the Safe, live on mainnet. **Rehearse your kill switch before you need it.**
- [ ] Approve flow uses an **exact-amount** allowance, never `type(uint256).max`

### HOW THIS BITES YOU
> The most common live-contract failure in a tipping app is the decimals bug: someone used `parseEther` on a 6-decimal token, so a "$1 tip" is actually a request for 1,000,000,000,000 USDC. It doesn't revert visibly in a helpful way — it just fails allowance checks forever, or worse, succeeds against a whale wallet. The $1 real-money test above is the check. Look at the *actual integer* in the transaction input data on Basescan and confirm it's `1000000`, not `1000000000000000000`.

---

## Stage 4 — Frontend production hardening (still localhost)

Contracts are live and correct. Now make the UI shippable. Everything here is checked at `localhost:3000` pointed at mainnet contracts, because that's the fastest loop.

### DO

**4.1 The four-state button flow.** Exactly one primary action button visible, ever:

1. **Connect Wallet** — a real, prominent button, not instructional text. (This is the single most common agent-built-dApp failure: a page that says "please connect your wallet" with no button.)
2. **Switch to Base** — when on the wrong chain, the *main CTA itself* becomes the switch button. Do not rely on the header network dropdown; users don't look there.
3. **Approve N USDC** — exact amount.
4. **Send Tip**

Never render Approve and Send at the same time.

**4.2 Double-approval guard.** Two pieces of state on the approve button, or users will fire two approvals and pay twice:

```ts
const [approvalSubmitting, setApprovalSubmitting] = useState(false); // set on click, clear in finally{}
const [approveCooldown, setApproveCooldown]       = useState(false); // set on confirm, clear after 4s
// disabled={approvalSubmitting || approveCooldown || isMining}
```

**4.3 Amounts and errors.**
- `formatUnits(v, 6)` / `parseUnits(v, 6)` for all USDC display and input
- Show USD alongside amounts — for USDC that's trivially the same number, but show the ETH gas estimate in USD too
- Use `<Address/>` for every address shown and `<AddressInput/>` for every address entered (ENS + validation; a raw text input for a creator address is a funds-loss bug waiting to happen)
- Map revert reasons to plain English: `insufficient funds` → "You don't have enough USDC", `user rejected` → "Transaction cancelled", `execution reverted` → the specific custom error
- Loading spinner *inside* buttons (`<span className="loading loading-spinner loading-sm" />`), buttons disabled during pending txs

**4.4 Branding and metadata.** Remove every trace of default SE2: footer links, tab title, favicon, README, the "Debug Contracts" page (keep it if you want, but it shouldn't be in the nav for users).

```ts
// packages/nextjs/app/layout.tsx — absolute URLs, not relative
export const metadata = getMetadata({
  title: "<your app name>",
  description: "Tip your favorite creators in USDC on Base.",
  imageRelativePath: "/thumbnail.jpg",   // 1200x630, and confirm it resolves absolutely in prod
});
```

No generic purple gradients. Make it look like a product, not a template.

**4.5 Trust disclosure (CROPS).** Put a short, honest "How this works" section in the footer or an about page. Users tipping real money deserve to know:
- **C**ontrol — the 1% fee is taken by contract; the Safe (2-of-2) can pause tipping and withdraw accrued fees
- **R**isk — the contract is unaudited by a firm / audited by X; link the verified source
- **O**wnership — who owns the contract, and that it cannot take creator funds
- **P**ause — that a pause exists and what it does and does not stop
- **S**afety/exit — creators are paid instantly in the same transaction; there is no custody, nothing to withdraw, nothing to be stuck in

**4.6 Full QA audit.** Fetch https://ethskills.com/qa/SKILL.md and run the complete checklist against the app. Have the *other* person on the team run it — the person who wrote the UI cannot see its gaps.

### CHECK — gate to Stage 5
- [ ] QA checklist: zero ship-blockers open
- [ ] `yarn next:lint && yarn next:check-types && yarn next:build` all clean (a build error found after you've announced is much worse)
- [ ] Mobile: tested in a real phone wallet's in-app browser (Rainbow, Coinbase Wallet), not just Chrome devtools responsive mode
- [ ] Tested with MetaMask, Rainbow, and one WalletConnect mobile connection
- [ ] Dark mode is not broken (DaisyUI semantic classes, no hardcoded hex)
- [ ] Zero console errors and zero console warnings on the happy path

### HOW THIS BITES YOU
> `yarn build` passes locally but fails on the host because a `NEXT_PUBLIC_*` env var that's set in your `.env.local` isn't set on the host. It surfaces as an app that loads but silently can't connect a wallet. Stage 5 checks this explicitly.

---

## Stage 5 — Phase 3: public deploy

**Recommendation for this app: Vercel as the primary URL, IPFS as a mirror.** You want a custom domain, working OG previews, and analytics; IPFS gives you censorship resistance but only serves static content (no SSR, no API routes, and a CID-based URL nobody can remember). Do Vercel first, add the IPFS mirror after.

### DO

**5.1 Pre-flight, in order:**

```bash
# secrets, one more time — this is the commit that goes public
git diff --cached --name-only | grep -iE '\.env|key|secret|private'
grep -rn "g.alchemy.com/v2/[A-Za-z0-9]" packages/ --include="*.ts"

# confirm burner wallet is off for live networks
grep -n "burnerWallet\|onlyLocalBurnerWallet" packages/nextjs/scaffold.config.ts

# confirm target network
grep -n "targetNetworks" packages/nextjs/scaffold.config.ts   # must be [chains.base]

# restore any test values (test creator addresses, hardcoded amounts, debug flags)
grep -rn "TODO\|FIXME\|console.log\|DEBUG" packages/nextjs/app packages/nextjs/components
```

**5.2 Deploy:**

```bash
yarn vercel        # first run: links the project, prompts for scope
```

Set environment variables in the Vercel dashboard (Project → Settings → Environment Variables), for **Production**:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | your key |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | your Reown project id |
| `NEXT_PUBLIC_BASE_RPC` | your Base mainnet RPC URL |

Then redeploy so they take effect:

```bash
yarn vercel --prod
```

**5.3 Lock the RPC key down.** In the Alchemy/QuickNode dashboard, restrict the key by HTTP referrer to your domain. A `NEXT_PUBLIC_` RPC key is visible to everyone who opens devtools; referrer restriction is what stops someone else's app from burning your quota.

**5.4 Custom domain.** Add it in Vercel, update DNS, wait for the certificate. Update the OG `metadataBase` to the final domain and redeploy.

**5.5 Add the IPFS mirror** (optional but cheap, and a real credibility signal):

```bash
yarn ipfs
# → https://{CID}.ipfs.community.bgipfs.com/
```
Link it from the footer as "censorship-resistant mirror."

### CHECK — gate to Stage 6

Run this on the **public URL**, in a fresh browser profile with no extensions cached, on both desktop and a phone:

- [ ] App loads; no console errors
- [ ] Wallet connects — desktop extension **and** mobile WalletConnect
- [ ] Network switching works from the main CTA
- [ ] **Burner wallet is NOT offered** (if you see one, stop and fix `burnerWalletMode` — a burner on mainnet will lose a user's money)
- [ ] A read (creator's tip history / totals) renders correctly
- [ ] A **real $1 tip** through the public URL succeeds end to end
- [ ] OG preview renders: paste the URL into Slack/Discord/X and look at the card
- [ ] Mobile responsive, no horizontal scroll, buttons reachable with a thumb
- [ ] `curl -sI https://yourdomain.com | head -1` → `200`
- [ ] View source / devtools → no API key or private key visible beyond the intentionally-public referrer-locked RPC key

### HOW THIS BITES YOU
> Two things break here and only here. (1) The public URL uses the *public* Base RPC because your env var name has a typo — the app works fine for the two of you and rate-limits into failure the moment ten people use it at once. Catch it: open devtools → Network, confirm requests go to *your* RPC host. (2) OG image paths that are relative work locally and 404 in production, so every share link looks broken.

---

## Stage 6 — Soft launch

Do not announce yet.

### DO
1. Invite 5–10 people who will tell you the truth. Ask each to tip a real creator a real $1–5 with their own wallet, on their own device, unassisted. **Watch them, say nothing.** Every place they hesitate is a UI bug.
2. Run for 48 hours. Watch every transaction.
3. Set up monitoring **before** you announce (Stage 7).

### CHECK — gate to Stage 7
- [ ] ≥10 successful tips from ≥5 distinct wallets that are not yours
- [ ] Zero failed transactions that weren't a deliberate user cancel — investigate every single revert, do not write any off as "weird wallet thing"
- [ ] At least one mobile wallet user completed the flow with no help
- [ ] Accrued fees on the contract equal exactly 1% of total tipped volume — reconcile by hand against Basescan. Any mismatch is a contract bug: **stop, go back to Stage 1**
- [ ] `withdrawFees` executed once more from the Safe, successfully

---

## Stage 7 — Open launch and staying alive

### Monitoring — set up before announcing

```bash
# a 60-second canary you run on a cron; alerts you if the app or RPC is down
cast call $TIP_CONTRACT "paused()(bool)" --rpc-url $BASE_RPC_URL
cast call $TIP_CONTRACT "accruedFees()(uint256)" --rpc-url $BASE_RPC_URL
curl -sf -o /dev/null -w "%{http_code}" https://yourdomain.com
```

- **Basescan** — "Watch address" email alerts on the contract, the Safe, and the deployer
- **Tenderly** — add the contract, alert on: any failed transaction, any `Paused` event, any owner-function call
- **Dune** — a simple dashboard on your tip event: volume, unique tippers, unique creators, fees accrued. This is also your product analytics.
- **Vercel** — check the Analytics + Logs tab daily for the first week
- **RPC quota** — set a usage alert at 70% in the provider dashboard. Running out of RPC quota at 2am looks exactly like "the app is down" to users.

### Incident runbook — decide who does what, now

| Symptom | First move | Then |
|---|---|---|
| Tips reverting for everyone | Check USDC status + your fee-accrual path; check RPC health | If contract-side: **`pause()` from the Safe**, put a banner on the site, go to Stage 1 |
| A user reports funds went to the wrong place | Get the tx hash, read it on Basescan before believing anything | Reconcile against the event log; if it's a contract bug, pause immediately |
| Site down, contract fine | Vercel status + logs; check the IPFS mirror still serves | Point the domain at the mirror if needed |
| RPC rate-limited | Raise the plan or rotate to a backup RPC env var | Redeploy; this is a 5-minute fix if you have a backup key ready — have one ready |
| Suspected key compromise | **Assume it's compromised, don't hope.** Move funds, `pause()`, rotate the key | Rotate every API key too; clean git history if that's the vector |

### Standing rules
- Any contract change = new deployment + full re-run of Stages 1→3. There is no patching.
- Every fix gets a regression test first, in the same commit.
- Withdraw accrued fees on a schedule; don't let a large balance sit in a young contract.
- Re-run the secret scan from Stage 1.4 before every push. Make it a pre-commit hook.

---

## Appendix A — Environment variable reference

**`packages/foundry/.env`** (gitignored, never committed)
```
DEPLOYER_PRIVATE_KEY_ENCRYPTED=   # from `yarn generate` — encrypted keystore
BASE_RPC_URL=
BASE_SEPOLIA_RPC_URL=
ETHERSCAN_V2_API_KEY=
```

**`packages/nextjs/.env.local`** (gitignored) and **Vercel Production env**
```
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_RPC=
```

Anything `NEXT_PUBLIC_` is **shipped to the browser and readable by anyone.** Only put values there that are safe to be public, and referrer-lock the RPC key.

---

## Appendix B — One-screen launch-day checklist

```
[ ] Contract verified on basescan.org
[ ] owner() == Safe address (read from explorer)
[ ] USDC address == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
[ ] pause()/unpause() rehearsed live from the Safe
[ ] withdrawFees() executed live from the Safe
[ ] targetNetworks == [chains.base]
[ ] burner wallet disabled on live networks
[ ] RPC = your provider, referrer-locked (verify in devtools Network tab)
[ ] WalletConnect project id set in Vercel Production
[ ] OG image renders in a real link preview
[ ] Real $1 tip completed through the public URL, on mobile
[ ] Fee accounting reconciles to the cent against Basescan
[ ] Basescan + Tenderly alerts firing
[ ] Secret scan clean, including git history
[ ] Both team members know how to pause, and have signed on the Safe at least once
```

When every box is checked — announce.
