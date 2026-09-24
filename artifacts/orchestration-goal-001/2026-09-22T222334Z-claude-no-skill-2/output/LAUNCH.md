# LAUNCH.md — localhost fork → live on Base

Runbook for taking the USDC creator-tipping dApp (Scaffold-ETH 2, foundry flavor)
from "works on the local fork" to "real users on a public URL, on Base mainnet."

**Read this whole file once before running anything.** Steps are ordered and
several are one-way doors (a mainnet deploy, a verified contract, a public URL).
Each phase ends with a **GATE** — a concrete check. Do not start the next phase
until the gate passes. If a gate fails, fix and re-run the gate; don't proceed
"and fix it later."

Two of you: for every phase marked **[2P]**, the person who did *not* write the
code runs the check. That is the only real review process a two-person team has.

Conventions:
- `$REPO` = repo root. `packages/foundry` and `packages/nextjs` are the workspaces.
- Anything in `<angle brackets>` is a value you fill in.
- "Fill in" lines like `___` are meant to be edited into this file as you go, so
  the doc becomes the record of the launch.

Rough time: Phases 0–4 in one focused day. Phase 5 (testnet soak) is 48h of
mostly waiting. Phases 6–9 in a second day. Don't compress the soak.

---

## Phase 0 — Freeze and inventory (30 min)

Before changing anything, establish exactly what you're shipping.

```bash
cd $REPO
git status --porcelain            # must be empty
git rev-parse HEAD                # record this
git log --oneline -10
```

Record the tool versions you are launching with — they matter when something
behaves differently in three weeks:

```bash
node --version                    # SE-2 wants >= 20.18.3
yarn --version
forge --version
cast --version
```

Confirm the current state actually is what you think it is:

```bash
yarn compile
yarn foundry:test -vv             # or: cd packages/foundry && forge test -vv
yarn next:check-types
yarn next:lint
```

Then tag the starting point so you can always answer "what was deployed":

```bash
git tag -a pre-launch -m "state before mainnet launch prep"
```

**GATE 0:** clean tree, all four commands above exit 0, tag created. Write the
commit SHA here: `___`

---

## Phase 1 — Secret hygiene (do this before you create any real key) (45 min)

You have been developing against a local chain, which means the repo has almost
certainly been near well-known test mnemonics, and may have real secrets in
`.env` files. Clean this up *before* a funded key exists, because the habits you
have now are the habits you'll have when the key is real.

### 1.1 Confirm nothing sensitive is tracked

```bash
cd $REPO
git ls-files | grep -E '(^|/)\.env' || echo "OK: no .env tracked"
cat .gitignore | grep -nE '\.env'
```

`.gitignore` must contain `.env` and `.env*.local` patterns covering both
`packages/foundry/.env` and `packages/nextjs/.env.local`. Fix and commit if not.

### 1.2 Scan history for anything that leaked

```bash
git log --all -p -- '*.env*' | head -200
git grep -nIE '(0x)?[a-fA-F0-9]{64}' -- . ':!*.lock' ':!packages/foundry/lib' | head -40
```

Anything that looks like a private key or an API key in history: assume it is
public. Rotate that credential now (or if it's a test key, note it as test-only
and move on). Do **not** plan to rewrite history — rotate instead; it's faster
and actually works.

### 1.3 Decide the key model now

Three distinct roles. Do not let one key play two of them:

| Role | What it is | Where it lives |
|---|---|---|
| **Deployer** | EOA that sends the deploy tx | foundry encrypted keystore, on one laptop |
| **Owner** | Address that can withdraw fees / change fee / pause | **Safe multisig, 2-of-2** (both of you) |
| **Fee recipient** | Where platform fees land | The Safe (can be the same as owner) |

The deployer is a hot key on a laptop. It will hold ~$20 of ETH and nothing
else. If it's compromised after launch, you lose $20 — *provided* ownership has
been moved to the Safe (Phase 7). That transfer is the single most important
step in this document.

**GATE 1 [2P]:** no secrets tracked or in history (or rotated), `.gitignore`
correct, and both of you agree on the table above. Safe is *not* created yet —
that's Phase 3, because it needs a funded chain.

---

## Phase 2 — Contract hardening (half a day; the real work)

Everything here is cheaper now than after deploy. A deployed tipping contract
that takes a fee is a contract holding other people's money.

### 2.1 Pin the USDC address per chain — never hardcode one

Base mainnet USDC (native Circle USDC, 6 decimals):
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Base Sepolia USDC (Circle testnet, 6 decimals):
`0x036CbD53842c5426634e7929541eC2318f3dCF7e`

**Verify both from Circle's own documentation before you paste them.** Do not
trust an address from a chat log, a blog post, or this file. Then confirm on
chain:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url https://mainnet.base.org
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url https://mainnet.base.org
```

Expect `USDC` and `6`. If you get `USDbC` you've got the old bridged token —
wrong one; use the native address above.

The USDC address must be a **constructor argument**, not a constant, so the same
bytecode deploys to Sepolia and mainnet. In `Deploy.s.sol` select it by
`block.chainid`:

```solidity
address usdc;
if (block.chainid == 8453)       usdc = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
else if (block.chainid == 84532) usdc = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
else                             usdc = address(mockUsdc);   // local fork only
require(usdc.code.length > 0, "USDC: no code at address");
```

That `require` is the cheap guard that catches a typo'd address before it costs
you a deploy.

### 2.2 The decimals / fee-rounding trap

USDC has **6** decimals, not 18. If any test, script, or frontend path uses
`parseEther` / `1e18` for a USDC amount, you are off by 10^12 — a "1 USDC" tip
becomes a 1,000,000 USDC transfer that reverts, or worse, a 0.000001 tip that
succeeds silently.

```bash
cd packages/foundry
grep -rn "parseEther\|1e18\|ether;" src/ script/ test/
cd ../nextjs
grep -rn "parseEther\|18" --include=*.ts --include=*.tsx app/ components/ hooks/ | grep -i usdc
```

Every USDC amount should go through `parseUnits(x, 6)` / `formatUnits(x, 6)`, or
better, read `decimals()` from the token.

Fee rounding: with `fee = amount * 100 / 10_000`, integer division truncates, so
any tip below 100 units (0.0001 USDC) pays **zero** fee. That's economically
irrelevant but it means "fee is always ≥ 1 unit" is not an invariant you can
assert. Either accept it or enforce a minimum tip. Decide explicitly:

- [ ] Minimum tip enforced at `___` USDC, or
- [ ] Zero-fee dust accepted (document it)

Also decide rounding direction. `amount * 100 / 10000` rounds the fee *down*
(favoring the creator). That's the right default. What you must guarantee is
`feeAmount + creatorAmount == amount` exactly — compute one and subtract:

```solidity
uint256 fee = (amount * feeBps) / 10_000;
uint256 toCreator = amount - fee;      // never compute this independently
```

### 2.3 Required contract properties

Walk this list against your actual source. Each line is either "already true" or
a change you make now.

- **Checks-Effects-Interactions** ordering, plus `ReentrancyGuard` on `tip()` and
  on `withdrawFees()`. USDC itself has no callback, but you may not always be
  paired with USDC, and the guard is ~2k gas on a chain where gas is free.
- **`SafeERC20`** (`safeTransfer` / `safeTransferFrom`) everywhere. Raw
  `transfer` return values are the classic silent-failure bug.
- **Balance-delta accounting.** Measure `balanceOf(address(this))` before and
  after `safeTransferFrom` and use the *delta* as the amount. USDC is not
  fee-on-transfer today, but it is an upgradeable proxy — this costs one SLOAD
  and makes you immune to a future change.
- **`feeBps` is a variable with a hard cap**, e.g. `require(newFeeBps <= 500)`
  in the setter. Users need to know you cannot set it to 100%. Emit
  `FeeUpdated(oldBps, newBps)`.
- **Fees accrue to a storage variable, withdrawn separately.** Never transfer the
  fee to the owner inside `tip()` — a blocked owner would break every tip.
- **`accruedFees` must not be inflatable by a direct token transfer.** Withdraw
  `accruedFees`, not `balanceOf(address(this))`, so someone sending USDC
  directly to the contract can't skew accounting.
- **`pause()` / `unpause()`** (OpenZeppelin `Pausable`) on `tip()`. This is your
  only incident-response lever. Without it, your Phase 9 plan is "tweet at
  people." Withdrawals must stay callable while paused.
- **Zero-address and self-tip guards:** `require(creator != address(0))`,
  `require(amount > 0)`, and decide whether `creator == msg.sender` is allowed.
- **A rescue function** for non-USDC tokens accidentally sent in
  (`rescueToken(address token, ...)` that **reverts if `token == usdc`** so it
  can never touch user funds in flight).
- **`Ownable2Step`, not `Ownable`.** Single-step `transferOwnership` to a wrong
  address is unrecoverable, and you are about to transfer ownership to a Safe.
- **Events carry everything an indexer needs:**
  `Tipped(address indexed from, address indexed creator, uint256 amount, uint256 fee)`.
  You cannot add fields later. Your entire analytics and support story depends on
  this one line.

### 2.4 Tests to add before deploying

```bash
cd packages/foundry
forge test -vv
forge coverage --report summary
```

Targeted tests that must exist, because each maps to a real failure mode:

1. `test_tip_splitsExactly` — fee + creator == amount, over fuzzed amounts.
2. `test_tip_revertsWithoutApproval` — the #1 support ticket you will get.
3. `test_tip_revertsOnInsufficientBalance`.
4. `test_tip_dustAmount` — amount = 1 unit; asserts your chosen dust behavior.
5. `test_withdrawFees_onlyOwner` and `test_withdrawFees_worksWhilePaused`.
6. `test_setFee_revertsAboveCap`.
7. `test_pause_blocksTips_and_unpauseRestores`.
8. `testFuzz_accounting` — after N random tips, `accruedFees` equals the sum of
   computed fees and the contract's USDC balance ≥ `accruedFees`.
9. **A fork test against real Base USDC**, not a mock. This is the one that
   catches decimals and proxy-behavior surprises:

```bash
forge test --fork-url https://mainnet.base.org --match-test testFork -vvv
```

Also run the analyzers — they're free and they find real things:

```bash
cd packages/foundry
forge fmt --check
slither . --config-file slither.config.json    # if installed; triage every High
```

### 2.5 Fee-blacklist edge case (Circle-specific, easy to miss)

Circle can blacklist addresses on USDC. Consequences to accept knowingly:

- Blacklisted **fan** → their tip reverts. Fine, fails loudly.
- Blacklisted **creator** → tips to them revert. Fine, and it's why you must not
  push the fee through the creator's transfer path.
- Blacklisted **fee recipient / Safe** → `withdrawFees()` reverts permanently.
  Mitigated by `setFeeRecipient()` being owner-callable. Make sure it exists.

**GATE 2 [2P]:** the partner who didn't write the contract reads `src/*.sol`
line by line against §2.3, checks every box, and runs `forge test` + `forge
coverage` themselves. Coverage on the contract's own lines ≥ 90%. The fork test
passes. Commit:

```bash
git add -A && git commit -m "harden tipping contract for mainnet"
```

---

## Phase 3 — Accounts, RPC, and API keys (1 hour)

### 3.1 Create the deployer keystore

SE-2's foundry flavor uses an encrypted keystore, not a plaintext private key in
`.env`. Never put a real private key in `.env`.

```bash
cd $REPO
yarn account:generate          # creates an encrypted keystore, prompts for a password
# or, to import an existing key:
# yarn account:import
```

This writes `ETH_KEYSTORE_ACCOUNT=scaffold-eth-custom` (or similar) into
`packages/foundry/.env`. Confirm and view the address:

```bash
cat packages/foundry/.env
yarn account                   # prints deployer address + balances per network
```

Record the deployer address: `___`

Back up the keystore file and password to a password manager **now**, both of
you. `~/.foundry/keystores/`. If that laptop dies mid-launch, you want the other
person to be able to continue.

### 3.2 Get your own RPC

The SE-2 default Alchemy key is a shared demo key and it *will* rate-limit you
under real traffic. This is the most common "the app is broken" report that
isn't a bug.

1. Create an Alchemy (or equivalent) app for **Base Mainnet** and **Base Sepolia**.
2. In the dashboard, restrict the key by HTTP referrer to your production domain.
   The key is shipped to the browser via `NEXT_PUBLIC_` — it is public by
   definition, so the referrer allowlist is what actually protects it.

### 3.3 WalletConnect project ID

The SE-2 default is also shared and will break wallet connections for real users.
Create a project at the WalletConnect/Reown dashboard, add your production domain
to the allowlist, and record the project ID.

### 3.4 Block explorer API key

Needed for source verification. Etherscan's V2 API uses a single key across
chains with a `chainid` param; older setups use a Basescan-specific key. Check
which your repo expects:

```bash
grep -n -A6 '\[etherscan\]' packages/foundry/foundry.toml
grep -n -A10 '\[rpc_endpoints\]' packages/foundry/foundry.toml
```

If `base` / `baseSepolia` entries are missing, add them:

```toml
[rpc_endpoints]
base = "https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
baseSepolia = "https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}"

[etherscan]
base = { key = "${ETHERSCAN_API_KEY}", chain = 8453 }
baseSepolia = { key = "${ETHERSCAN_API_KEY}", chain = 84532 }
```

### 3.5 Fill the env files

`packages/foundry/.env`:

```
ETH_KEYSTORE_ACCOUNT=scaffold-eth-custom
ALCHEMY_API_KEY=<your key>
ETHERSCAN_API_KEY=<your key>
```

`packages/nextjs/.env.local`:

```
NEXT_PUBLIC_ALCHEMY_API_KEY=<your key>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<your project id>
NEXT_PUBLIC_IGNORE_BUILD_ERROR=false
```

Then update `packages/nextjs/.env.example` with the *names* (no values) so the
next person knows what's required.

### 3.6 Create the Safe

Go to the Safe app, connect on **Base mainnet**, create a **2-of-2** Safe with
both of your personal wallets as signers. You'll need a little ETH on Base to
deploy it — bridge that in §3.7.

Record the Safe address: `___`

Both of you: confirm you can each sign a trivial transaction from it (send 0 ETH
to yourself) *before* it owns anything. A Safe you can't actually operate is
worse than an EOA.

### 3.7 Fund

Bridge ETH to Base (Base Bridge, or buy directly on an exchange that supports
Base withdrawals — usually faster and cheaper).

- Deployer EOA: **0.01 ETH** is plenty. Base fees are tiny; a deploy is cents.
- Safe: enough to deploy it (~0.002 ETH) and to send occasional txs.
- Your personal test wallet: 0.005 ETH + **~5 USDC** for the mainnet smoke test
  in Phase 8.

```bash
yarn account                   # confirm balances landed on Base
```

**GATE 3:** `yarn account` shows a funded deployer on Base; Safe exists and both
signers have successfully signed once; all four env values set; USDC address
confirmed on chain per §2.1.

---

## Phase 4 — Frontend configuration (1 hour)

Open `packages/nextjs/scaffold.config.ts`.

### 4.1 Target network

```ts
import * as chains from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [chains.baseSepolia],   // Phase 5. Becomes [chains.base] in Phase 6.
  pollingInterval: 30000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  onlyLocalBurnerWallet: true,            // MUST be true
} as const satisfies ScaffoldConfig;
```

`onlyLocalBurnerWallet: true` is non-negotiable. A burner wallet on mainnet is a
key generated in localStorage holding real funds — users will lose money.

`pollingInterval`: the default 30s is right for mainnet. Lowering it multiplies
your RPC bill and buys nothing on a 2-second-block chain.

### 4.2 Remove the dev surface

`grep` for and delete/guard anything that shouldn't be public:

```bash
cd packages/nextjs
grep -rn "console.log" app/ components/ hooks/ | grep -v node_modules
grep -rn "localhost\|127.0.0.1\|31337" app/ components/ hooks/ utils/
```

The Debug Contracts page (`/debug`) is fine to leave — it's read/write against
your own verified contract and it's genuinely useful for support. The Block
Explorer page (`/blockexplorer`) only works against a local chain; hide it from
nav when the target network isn't local, or it's a broken link on day one.

### 4.3 UX that prevents support tickets

These are frontend changes, but each one prevents a class of "it's broken" reports:

- **Approve → Tip as two clearly labelled steps**, with the approve step skipped
  when allowance already covers the amount. Read `allowance()` before showing
  the button. The single biggest source of confusion in any ERC-20 dApp is a
  user clicking "Tip", signing an *approval*, and thinking they tipped.
- **Approve the exact amount, not `MaxUint256`**, unless you've deliberately
  chosen infinite approval and say so in the UI. (USDC on Base supports EIP-2612
  `permit`, so a gasless single-signature approve is possible — nice, but
  optional; don't let it block launch.)
- **Show the fee explicitly before signing:** "Tip 10.00 USDC → creator receives
  9.90, platform fee 0.10." A fee the user discovers afterward is the thing that
  gets you written about.
- **Wrong-network state:** detect `chainId !== 8453` and render a "Switch to
  Base" button rather than letting a tx fail.
- **Insufficient-balance and insufficient-allowance pre-checks**, so the button
  disables instead of the wallet showing a scary simulation failure.
- **Post-tx confirmation with a Basescan link.**
- **Every tx failure path shows a human message**, not a raw revert string.

### 4.4 Public-facing minimum

You are taking a fee from real users. Before a public URL:

- A page or footer stating the **1% platform fee** plainly.
- Terms of service and a privacy policy (even minimal ones), linked in the footer.
- The contract address, linked to Basescan, visible in the UI. Users should be
  able to verify what they're interacting with.
- A contact address for support: `___`
- If you use analytics, a cookie/privacy note. Don't log wallet addresses to a
  third-party analytics tool without saying so.

None of this is legal advice — if you're taking a revenue cut from creators in
multiple jurisdictions, a one-hour conversation with a lawyer before you scale
is cheap relative to the alternative.

**GATE 4 [2P]:** `yarn next:check-types && yarn next:lint && yarn next:build`
all pass. Partner clicks through the full journey on localhost one more time
with the new approve/tip UX. Commit.

---

## Phase 5 — Base Sepolia dress rehearsal (1 day + 48h soak)

**Do not skip this.** Sepolia is where you find the config bugs, and it is
identical in shape to mainnet apart from the chain ID.

### 5.1 Get testnet funds

Base Sepolia ETH from a faucet; Base Sepolia USDC from Circle's testnet faucet.
Get USDC into at least two addresses so you can test fan → creator with real
distinct parties.

### 5.2 Deploy

```bash
cd $REPO
yarn deploy --network baseSepolia
```

(If you have multiple scripts: `yarn deploy --file Deploy.s.sol --network baseSepolia`.)

This writes `packages/foundry/deployments/84532.json` **and** regenerates
`packages/nextjs/contracts/deployedContracts.ts`. Confirm both:

```bash
cat packages/foundry/deployments/84532.json
grep -n "84532" packages/nextjs/contracts/deployedContracts.ts | head
```

If `deployedContracts.ts` didn't update, the frontend will silently point at
nothing. This is the most common SE-2 deploy failure.

### 5.3 Verify source

```bash
yarn verify --network baseSepolia
```

Open the contract on the Base Sepolia explorer and confirm the source is
readable and the constructor arg shows the correct testnet USDC address.

**If verification fails**, the usual causes are: a mismatched compiler version or
optimizer setting between `foundry.toml` and what the explorer assumes, or a bad
API key. Fix it here — you do **not** want to be debugging verification against
mainnet with a live contract and no source.

### 5.4 Confirm on-chain state matches intent

```bash
export SEP=https://sepolia.base.org
export C=<deployed address>
cast call $C "usdc()(address)"        --rpc-url $SEP
cast call $C "feeBps()(uint256)"      --rpc-url $SEP   # expect 100
cast call $C "owner()(address)"       --rpc-url $SEP   # deployer, for now
cast call $C "paused()(bool)"         --rpc-url $SEP   # expect false
```

### 5.5 Deploy the frontend to a preview URL

```bash
cd $REPO
yarn vercel                           # preview deployment, not --prod
```

Set the env vars in the Vercel project settings (`NEXT_PUBLIC_ALCHEMY_API_KEY`,
`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`). Vercel does **not** read your local
`.env.local`; forgetting this is the #2 SE-2 deploy failure and shows up as
"wallet won't connect" on the deployed site only.

### 5.6 Full journey on the preview URL [2P]

Both of you, on **separate devices**, at least one on **mobile**:

1. Connect a browser wallet (MetaMask and one WalletConnect mobile wallet).
2. Land on the wrong network on purpose → confirm the switch prompt works.
3. Approve → tip 1.00 USDC.
4. Check on the explorer: creator received 0.99, contract holds 0.01.
5. Tip again → confirm the approve step is correctly skipped/re-requested.
6. Tip the dust amount (0.000001) → confirm your chosen behavior.
7. Tip with insufficient balance → confirm the button disables with a clear message.
8. Reject the tx in the wallet → confirm the UI recovers, doesn't hang.
9. Call `pause()` from the deployer → confirm the UI shows tipping unavailable
   rather than letting users submit reverting txs. Then `unpause()`.
10. `withdrawFees()` → confirm 0.01 USDC arrives and `accruedFees` resets to 0.
11. Send USDC directly to the contract, then `withdrawFees()` → confirm only the
    real accrued fee is withdrawn, accounting isn't skewed.
12. Hard-refresh mid-flow; close and reopen the wallet. Confirm no stuck state.

### 5.7 Soak for 48 hours

Leave the preview deployment up. During this window:

- Check the Vercel function/build logs for errors.
- Check your Alchemy dashboard for request volume and any 429s.
- Have 2–3 friends outside the team try it and **watch them without helping**.
  Every place they hesitate is a place real users will bounce. This is the single
  highest-value hour in the whole launch.

**GATE 5 [2P]:** all twelve journey steps pass on two devices, source verified,
no errors in logs over 48h, at least two outside testers completed a tip without
being told how. Record the Sepolia address here: `___`

---

## Phase 6 — Mainnet deploy (30 min, irreversible)

Do this when you are both awake, at a keyboard, with hours free afterward. Not
on a Friday evening.

### 6.1 Pre-flight

```bash
cd $REPO
git status --porcelain          # empty
yarn foundry:test               # green
yarn account                    # deployer funded on Base
cast chain-id --rpc-url https://mainnet.base.org   # expect 8453
```

Re-read `Deploy.s.sol` out loud to each other. Specifically: the USDC address
branch for chain 8453, the initial `feeBps` (100), and the initial owner.

### 6.2 Simulate first

```bash
cd packages/foundry
forge script script/Deploy.s.sol --rpc-url base       # NO --broadcast
```

Read the simulation output: correct constructor args, plausible gas. Only when
that looks right:

### 6.3 Deploy

```bash
cd $REPO
yarn deploy --network base
```

Record immediately:

- Contract address: `___`
- Deploy tx hash: `___`
- Block number: `___`
- Commit SHA deployed: `___`

### 6.4 Verify source, immediately

```bash
yarn verify --network base
```

Open `https://basescan.org/address/<contract>#code`. Source must be readable and
the constructor argument must decode to
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

An unverified contract that takes fees looks exactly like a scam to anyone
evaluating it. Don't publicize the address until this is green.

### 6.5 Assert live state

```bash
export BASE=https://mainnet.base.org
export C=<mainnet contract address>
cast call $C "usdc()(address)"   --rpc-url $BASE   # 0x8335...2913
cast call $C "feeBps()(uint256)" --rpc-url $BASE   # 100
cast call $C "owner()(address)"  --rpc-url $BASE   # deployer (changes in Phase 7)
cast call $C "paused()(bool)"    --rpc-url $BASE   # false
```

If `usdc()` returns anything other than the native Base USDC address: **stop**.
Do not point the frontend at it. Redeploy. The contract is worthless and cost you
a few cents — the only real loss is the wrong address getting into circulation.

### 6.6 Commit the deployment artifacts

```bash
git add packages/foundry/deployments/8453.json packages/nextjs/contracts/deployedContracts.ts
git commit -m "deploy tipping contract to Base mainnet"
git tag -a mainnet-v1 -m "mainnet deploy <address>"
```

**GATE 6:** verified on Basescan, all four `cast call` assertions correct,
artifacts committed and tagged.

---

## Phase 7 — Transfer ownership to the Safe (20 min)

Do this **before** the public URL, not after. Between deploy and this step, a
laptop compromise costs you the platform.

```bash
export SAFE=<safe address>
cast send $C "transferOwnership(address)" $SAFE \
  --rpc-url base --account scaffold-eth-custom
```

With `Ownable2Step`, the Safe must then **accept**. From the Safe UI, use the
transaction builder to call `acceptOwnership()` on your contract, and have both
signers approve. Then confirm:

```bash
cast call $C "owner()(address)"        --rpc-url $BASE   # == $SAFE
cast call $C "pendingOwner()(address)" --rpc-url $BASE   # == 0x0
```

Now prove the Safe can actually operate the contract — an untested owner is not
an owner. From the Safe, execute `pause()`, verify, then `unpause()`:

```bash
cast call $C "paused()(bool)" --rpc-url $BASE   # true, then false again
```

If this transaction is painful to assemble, practice it now and write the exact
steps here. During an incident you will not want to be learning the Safe
transaction builder:

```
Incident pause procedure:
  Safe UI → New transaction → Transaction Builder
  → address: <contract>  (ABI auto-loads from Basescan since it's verified)
  → method: pause()  → no args → Create batch → Send → both sign
```

**GATE 7 [2P]:** `owner()` is the Safe, `pendingOwner()` is zero, and you have
executed a pause/unpause cycle from the Safe end to end. Deployer EOA now
controls nothing.

---

## Phase 8 — Production frontend (1 hour)

### 8.1 Flip the target network

In `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.base],
```

```bash
cd $REPO
yarn next:check-types && yarn next:lint && yarn next:build
git commit -am "point frontend at Base mainnet"
```

### 8.2 Deploy to production

```bash
yarn vercel --prod
```

Then in the Vercel dashboard:
- Confirm both `NEXT_PUBLIC_` env vars are set for the **Production** environment
  specifically (env vars are per-environment; preview-only values are a classic
  miss).
- Add your custom domain, confirm HTTPS.
- Add the final production domain to the **Alchemy referrer allowlist** and the
  **WalletConnect allowlist**. Forgetting this means wallet connect fails for
  everyone but you.

Production URL: `___`

### 8.3 The real-money smoke test [2P]

With a personal wallet holding ~5 real USDC, on the production URL:

1. Connect. Confirm the chain reads Base and the contract address in the UI
   matches Phase 6.
2. Tip **0.10 USDC** to your partner's address.
3. On Basescan: partner received 0.099, contract holds 0.001, `Tipped` event
   emitted with correct fields.
4. Partner repeats in the other direction from a different device/wallet.
5. From the **Safe**, call `withdrawFees()` → confirm fees arrive at the Safe.

This is the first time the whole system runs end to end with real value. If
anything is off, pause from the Safe and fix before going further.

### 8.4 Monitoring, before announcing

- **Basescan address watch** on the contract → email alerts on any transaction.
  Free, 2 minutes, and it's your baseline "is anything happening" signal.
- **Tenderly** (or equivalent): add the contract, set an alert on **failed
  transactions** to your contract. A spike in reverts is how you learn about a
  frontend bug before a user emails you.
- **Vercel**: enable log drains/alerts on build and runtime errors.
- **Alchemy**: set a usage alert well below your plan limit. Hitting the RPC
  ceiling presents as "the app is down" with no other signal.
- **Uptime check** (any free pinger) hitting the production URL every 5 min.

Write down what "normal" looks like on day one so you can recognize abnormal:
tips/day `___`, unique tippers `___`, revert rate `___`.

**GATE 8 [2P]:** real-money round trip completed in both directions, fees
withdrawn to the Safe successfully, all five monitors configured and each one
confirmed to actually fire (trigger a test alert — an untested alert is not an
alert).

---

## Phase 9 — Soft launch, then open up (1 week)

Resist announcing widely on day one. The failure modes you haven't found are
found by strangers, and you want a small number of strangers first.

**Days 1–2 — private.** Share the URL with 10–20 people you can talk to directly.
Watch every transaction on Basescan as it lands. Ask each person one question:
"was there any moment you weren't sure what would happen?"

**Days 3–5 — semi-public.** One post in one community. Keep watching. Check daily:

```bash
cast call $C "paused()(bool)"       --rpc-url $BASE
cast call $C "accruedFees()(uint256)" --rpc-url $BASE
```

Reconcile: does `accruedFees` equal 1% of the total tipped volume in the `Tipped`
events? If it drifts, stop and investigate — that's an accounting bug and it's
the one class of bug that gets worse the longer it runs.

**Day 6+ — announce.** Only after a full week with no reverted-tx spike, no
accounting drift, and no support ticket you couldn't explain.

### Incident response

Keep this visible. Both of you should be able to execute it from a phone.

| Symptom | First action | Then |
|---|---|---|
| Wrong amounts / accounting drift | **`pause()` from the Safe** | Reconcile events vs. balance before unpausing |
| Tips reverting broadly | Check USDC status, RPC status, Tenderly | Pause only if funds are at risk; a frontend fix is faster |
| Suspected contract exploit | **`pause()` immediately**, then look | Pause first, diagnose second — it is reversible, funds are not |
| Site down, contract fine | Vercel status / redeploy last good tag | Contract keeps working; only the UI is down |
| RPC rate-limited | Raise Alchemy plan or swap RPC URL | Then raise `pollingInterval` |
| Deployer key compromised | Nothing urgent — it owns nothing after Phase 7 | Rotate, re-fund a new keystore |

Rollback reality: **you cannot patch a deployed contract.** The plan is
`pause()` → deploy a new version → point the frontend at it → let users
withdraw/migrate. Because of this, `pause()` existing (Phase 2.3) is the only
thing standing between "a bad afternoon" and "a catastrophe."

Emergency contacts / on-call: `___`

---

## Appendix A — Fill-in record

| Item | Value |
|---|---|
| Launch commit SHA | |
| Deployer address | |
| Safe address (owner + fee recipient) | |
| Base Sepolia contract | |
| Base mainnet contract | |
| Deploy tx hash / block | |
| Production URL | |
| Alchemy app / WalletConnect project ID | |
| Date live | |

## Appendix B — Command quick reference

```bash
# local
yarn chain / yarn fork          # local chain
yarn deploy                     # local deploy
yarn start                      # local frontend
yarn foundry:test               # contract tests
yarn next:check-types && yarn next:lint && yarn next:build

# accounts
yarn account:generate           # new encrypted keystore
yarn account:import             # import existing key
yarn account                    # show address + balances

# testnet
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
yarn vercel                     # preview

# mainnet
forge script script/Deploy.s.sol --rpc-url base    # simulate, no broadcast
yarn deploy --network base
yarn verify --network base
yarn vercel --prod

# reading live state
export BASE=https://mainnet.base.org
cast call $C "owner()(address)"       --rpc-url $BASE
cast call $C "paused()(bool)"         --rpc-url $BASE
cast call $C "accruedFees()(uint256)" --rpc-url $BASE
```

## Appendix C — Addresses to verify, never paste blindly

| Thing | Value | Verify by |
|---|---|---|
| Base mainnet chain ID | 8453 | `cast chain-id --rpc-url https://mainnet.base.org` |
| Base Sepolia chain ID | 84532 | `cast chain-id --rpc-url https://sepolia.base.org` |
| Base mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Circle docs + `cast call symbol()` → `USDC`, `decimals()` → `6` |
| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Circle testnet docs + same calls |

Note: `USDbC` (`0xd9aA...D22CA`) is the older **bridged** USDC and is a different
token. If any call returns `USDbC`, you have the wrong address.

---

## The five things most likely to bite you

Ranked by (likelihood × damage), from this specific stack:

1. **6 vs 18 decimals** somewhere in the frontend or a script. Caught by the
   mainnet-fork test (§2.4.9) and the 0.10 USDC smoke test (§8.3).
2. **`deployedContracts.ts` not regenerated**, so the frontend points at the old
   or wrong address. Caught by the grep in §5.2 and by checking the UI's
   displayed address against Basescan in §8.3.
3. **Vercel env vars unset in Production**, so wallets won't connect for anyone
   but you. Caught by testing the production URL from a device that never saw
   your dev environment (§8.3).
4. **Ownership never moved to the Safe**, leaving the platform on a laptop key.
   Caught by GATE 7 — and it's the reason that gate exists as a separate phase.
5. **No `pause()`**, so your only incident response is a tweet. Caught by GATE 2;
   unfixable after deploy.
