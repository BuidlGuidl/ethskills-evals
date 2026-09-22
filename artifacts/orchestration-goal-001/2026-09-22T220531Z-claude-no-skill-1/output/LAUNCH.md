# LAUNCH.md — Creator Tipping dApp: localhost → Base mainnet

**Status today:** Scaffold-ETH 2 (foundry flavor), full journey works on a local fork
with a browser wallet. Nothing has touched a live network. Target: Base mainnet
(chain id **8453**), public URL, real users, USDC tips with a 1% platform fee.

**Team size:** 2. Everything below that says "both of you" means both, not one.

---

## 0. How to use this document

Phases are strictly ordered. Each phase ends with a **GATE** — a list of things that
must be true before you start the next phase. Do not run ahead of a gate; several
of them exist specifically to catch failures that are irreversible once mainnet
money is involved.

Conventions in this doc:

- Commands assume repo root unless a `cd` is shown.
- `$BASE_RPC`, `$DEPLOYER`, etc. are shell variables you set as you go. Keep one
  terminal session per phase so they persist.
- **⚠️ FAILURE MODE** blocks describe something that actually goes wrong at that
  step and how you detect it before a user does.
- **DECIDE** blocks are choices only you can make. Make them *before* the code
  freeze in Phase 2, because they change Solidity.

### Version drift warning — do this first

Scaffold-ETH 2's foundry package changed its key handling partway through its life.
Older versions put a raw `DEPLOYER_PRIVATE_KEY` in `packages/foundry/.env`; newer
versions use an encrypted keystore and `ETH_KEYSTORE_ACCOUNT`. Find out which you
have before anything else:

```bash
cat packages/foundry/.env.example
cat packages/foundry/package.json | grep -A1 '"account\|"deploy\|"verify'
ls packages/foundry/script/
```

Where this doc gives both variants, pick the one matching your repo. If a `yarn`
script name in this doc doesn't exist in your `package.json`, the script name
changed — read the `package.json` and use the real one rather than improvising a
raw `forge` command, because the yarn wrappers also do the ABI export into the
frontend.

---

## 1. Phase 0 — Decisions that change code

These are cheap now and expensive after deployment, because **your contract is
immutable**. There is no upgrade path, no admin fix, no migration that doesn't
involve asking every user to re-approve a new address. Settle all of these first.

### DECIDE 0.1 — Who owns the fee stream?

Right now the 1% fee almost certainly accrues to `owner()` or a `feeRecipient` set
at deploy time, and the deploy script sets that to a single EOA on a laptop. For a
two-person team holding real revenue, that's a single point of both theft and loss.

**Recommendation:** deploy a Safe (formerly Gnosis Safe) on Base and make it the
owner / fee recipient. Use **2-of-3**, not 2-of-2 and not 1-of-2:

- signer 1: person A hardware wallet
- signer 2: person B hardware wallet
- signer 3: a cold backup seed, written on paper, stored physically apart from both

2-of-2 means either of you losing a device permanently locks the fees. 1-of-2 means
either of you can unilaterally drain them, which is a bad thing to rely on trust for
even between two people who trust each other, because it also means either of you
getting phished drains them.

You do **not** need the Safe to be the deployer. Deploy from a throwaway EOA, then
transfer ownership to the Safe (Phase 7). That keeps the hardware wallets out of the
scripting path.

### DECIDE 0.2 — Is there a pause?

Ask: if you discover at 2am that tips are being misrouted, what do you do?

If the contract has no `pause()`, the honest answer is "nothing" — taking the
frontend down does **not** stop the contract. Anyone with the address and an ABI can
keep calling it, and any user who already approved USDC to it stays exposed.

**Recommendation:** add OpenZeppelin `Pausable`, guard the tip entrypoint with
`whenNotPaused`, and give `pause()` to the owner Safe. Deliberately do **not** guard
fee withdrawal with `whenNotPaused` — you want to still be able to move funds while
paused.

If you decide to ship without a pause, write down explicitly in this doc, here, that
your incident response is "publish a warning and ask users to revoke approvals," and
make sure Phase 12's runbook says that. Don't leave it implied.

### DECIDE 0.3 — Custody model for the tip

There are two shapes this contract can have, and they have very different risk:

- **(a) Pass-through:** `transferFrom(fan → creator, amount - fee)` and
  `transferFrom(fan → feeRecipient, fee)`. The contract never holds USDC. Costs one
  extra transfer's gas. A bug in it cannot lose anyone's principal, because there's
  no balance to lose.
- **(b) Custodial:** `transferFrom(fan → contract, amount)`, then the contract pays
  out creators and accrues fees. Cheaper per tip, but the contract accumulates a
  balance, which makes it a target and makes every accounting bug a loss.

**Recommendation for a first launch: (a).** The gas difference on Base is a fraction
of a cent. If you're currently on (b), seriously consider the change now — it
removes a whole category of "we got drained" outcomes, and it removes the need for
reentrancy guards on withdrawal paths.

If you stay on (b), you must also have: a `ReentrancyGuard` on every payout path,
an explicit invariant test that `USDC.balanceOf(contract) >= sum(unclaimed creator
balances) + accruedFees`, and a documented answer for what happens to a creator's
unclaimed balance if they lose their key.

### DECIDE 0.4 — Minimum tip amount

USDC has **6 decimals**. Your 1% fee is almost certainly `amount * 100 / 10_000` or
`amount / 100`, and integer division truncates. For any tip below `100` base units
(that's $0.0001) the fee rounds to zero and you eat the gas for nothing. More
importantly, dust tips let someone spam your events feed and your creator's
notifications for near-free on a cheap L2.

**Recommendation:** enforce a floor — `require(amount >= MIN_TIP)` with `MIN_TIP =
1_000_000` ($1.00) or `100_000` ($0.10). Pick one, hardcode it as a constant, and
make the frontend enforce the same number so users get a form error rather than a
reverted transaction.

### DECIDE 0.5 — Which USDC

Base has two. You want **native USDC**, not the bridged `USDbC`:

| Token | Network | Address | Decimals |
| --- | --- | --- | --- |
| USDC (native) | Base mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| USDbC (bridged, legacy) | Base mainnet | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | 6 |
| USDC | Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 |

**Verify these against Circle's own docs before you paste them into a deploy
script** (`https://developers.circle.com/stablecoins/usdc-contract-addresses`). Do
not trust a table in a markdown file — including this one — for an address you are
about to hardcode into an immutable contract. Cross-check the mainnet one on
Basescan too: it should be the token every Base DEX aggregator calls "USDC".

### DECIDE 0.6 — Domain and name

Buy the domain now; DNS propagation is the one thing in this list you can't compress
at the end. Registrar doesn't matter much; Cloudflare or Namecheap are fine.

### GATE 0

- [ ] Fee recipient / owner model decided, and the Safe signer set agreed by both of you.
- [ ] Pause: implemented, or explicitly declined in writing above.
- [ ] Custody model decided.
- [ ] `MIN_TIP` decided and written down.
- [ ] USDC address confirmed from Circle's docs, not from this file.
- [ ] Domain purchased.

---

## 2. Phase 1 — Make the code match the decisions

Implement whatever Phase 0 changed. Then, before you look at any network:

```bash
cd packages/foundry
forge fmt
forge build --sizes
forge test -vv
```

`--sizes` matters: if you're near the 24,576-byte EIP-170 limit you'll find out here
rather than watching a mainnet deploy revert. If you're close, enable the optimizer
in `foundry.toml` (`optimizer = true`, `optimizer_runs = 200`) and re-check — and
note that changing optimizer settings changes bytecode, so it must happen *before*
the fork tests in Phase 3, not after.

### 2.1 Coverage

```bash
forge coverage --report summary
```

You don't need 100%. You do need **100% on the tip path and the fee-withdrawal
path**. If `forge coverage` reports any uncovered line inside those functions, write
the test. These are the only two functions that touch money.

### 2.2 Fee arithmetic tests

Add these specific cases if they aren't already there — they're the ones that bite:

```solidity
// fee floor: tip just under and just over MIN_TIP
// fee rounding: MIN_TIP exactly; MIN_TIP + 1; a prime-ish amount like 1_234_567
// invariant: creatorReceived + feeTaken == amount, for all amounts (fuzz)
// no overflow: amount = type(uint256).max / 100 and above should revert cleanly
// self-tip: fan == creator
// zero address creator: must revert, not burn
```

And one fuzz test, which is the single highest-value test in the suite:

```solidity
function testFuzz_FeeInvariant(uint256 amount) public {
    amount = bound(amount, MIN_TIP, 1_000_000_000e6);
    // ... execute tip ...
    assertEq(creatorDelta + feeDelta, amount);
    assertLe(feeDelta * 10_000, amount * 100); // fee never exceeds 1%
}
```

The `assertLe` is the one that matters. A rounding bug that overcharges users by a
fraction of a basis point is invisible in a hand-written test and obvious to a
fuzzer.

### 2.3 Static analysis

```bash
pip install slither-analyzer
cd packages/foundry && slither . --config-file slither.config.json 2>&1 | tee /tmp/slither.txt
```

If you have no config file, create `packages/foundry/slither.config.json`:

```json
{
  "filter_paths": "lib/",
  "exclude_informational": false,
  "exclude_low": false
}
```

Triage every High and Medium. Expect false positives on `arbitrary-send-erc20`
(that's what `transferFrom` on behalf of the caller looks like to a static
analyzer) — but *read* each one and write a one-line justification next to it. The
ones you should not dismiss: `reentrancy-eth`, `reentrancy-no-eth`,
`unchecked-transfer`, `incorrect-equality`.

**⚠️ FAILURE MODE — unchecked transfer return value.**
USDC on Base is a proxy to a Circle implementation that *does* return a bool, so
a bare `transfer()` happens to work today. It is still wrong: if you ever point the
contract at a different token, or Circle ships an implementation change, silent
failure means the fan's money vanishes and the event still fires, so your UI shows a
successful tip that never happened. **Use OpenZeppelin `SafeERC20`'s
`safeTransfer` / `safeTransferFrom` everywhere.** Detection: slither's
`unchecked-transfer`, plus a test with a mock token whose `transfer` returns `false`
— your contract must revert.

### GATE 1

- [ ] `forge build --sizes` under 24,576 bytes, optimizer settings final.
- [ ] `forge test` green.
- [ ] Coverage 100% on tip + withdraw paths.
- [ ] Fuzz invariant test present and passing with ≥10,000 runs (`FOUNDRY_FUZZ_RUNS=10000 forge test`).
- [ ] Slither High/Medium all triaged in writing.
- [ ] `SafeERC20` used for every token movement.

---

## 3. Phase 2 — Fork-test against the *real* Base USDC

Your tests currently run against a mock ERC20. Mock ERC20s are polite. Real USDC is
not. This phase is non-negotiable and it is where most of the remaining bugs are.

Get an RPC endpoint first (you'll need it in Phase 4 anyway — see §4.1), then:

```bash
export BASE_RPC="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
cd packages/foundry
forge test --fork-url $BASE_RPC --fork-block-number 34000000 -vv
```

Pin the block number. An unpinned fork test is non-deterministic and will start
failing on someone else's machine for reasons unrelated to your code. Pick a recent
finalized block and commit that number.

Write a fork test file that does the following against address
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`:

1. `deal()` USDC to a test fan (`deal(USDC, fan, 1000e6, true)` — the `true` adjusts
   `totalSupply`; for USDC's proxy storage layout you may need
   `stdstore` or just `vm.prank` a transfer from a known whale address instead).
2. Approve and tip. Assert exact balances of fan, creator, and fee recipient.
3. Assert `IERC20Metadata(USDC).decimals() == 6` — a one-line test that permanently
   catches anyone later swapping in an 18-decimal token.

**⚠️ FAILURE MODE — the decimals bug.**
This is the most common way a USDC app ships broken. Somewhere in
`packages/nextjs` there is a `parseEther` or `formatEther` (18 decimals) where there
should be `parseUnits(x, 6)` / `formatUnits(x, 6)`. Symptom: user types `5`, the UI
requests approval for 5,000,000,000,000 USDC, and either the tx reverts on
insufficient balance or — worse, if they hold enough — they tip a million dollars.
**Detection:** grep before you deploy anything.

```bash
cd packages/nextjs
grep -rn "parseEther\|formatEther\|18" --include=*.ts --include=*.tsx app components hooks utils
```

Every hit on a USDC amount path is a bug. There should be exactly zero. Better:
define one constant `USDC_DECIMALS = 6` in a single module and route all formatting
through two helper functions, so there's one place to be wrong.

**⚠️ FAILURE MODE — the USDC blacklist.**
Circle can blacklist an address. `transfer` to or `transferFrom` from a blacklisted
address reverts. If your contract batches or loops over creators, one blacklisted
creator bricks the whole call for everyone. Detection: fork-test it —

```solidity
// vm.prank(USDC_BLACKLISTER); IBlacklistable(USDC).blacklist(creator);
// then assert your tip reverts cleanly with a sensible error, and that it
// does NOT leave the fan's funds stuck in your contract.
```

The acceptable behaviour is: whole transaction reverts, fan keeps their money, UI
shows an error. The unacceptable behaviour is: fee transfer succeeds, creator
transfer fails silently, money is stranded.

**⚠️ FAILURE MODE — USDC is upgradeable.**
You're integrating with a proxy whose implementation Circle controls. You can't
prevent that; you can make sure you're not depending on undocumented behaviour. Stay
on the plain IERC20 surface: `transfer`, `transferFrom`, `approve`, `balanceOf`,
`allowance`. Do not use `permit`/EIP-2612 on Base USDC without fork-testing it
specifically — the bridged and native tokens differ, and getting the domain
separator wrong produces signatures that fail only on mainnet.

### 3.1 Freeze

```bash
git add -A && git commit -m "chore: launch candidate"
git tag -a v1.0.0-rc1 -m "Base mainnet launch candidate"
git push origin main --tags
```

From here to the end of Phase 8, **no Solidity changes.** If you must change
Solidity, you go back to GATE 1 and re-run the whole testnet rehearsal. This rule is
the reason the rehearsal is worth anything.

### GATE 2

- [ ] Fork tests against real Base USDC pass at a pinned block.
- [ ] Blacklist behaviour tested and acceptable.
- [ ] `grep` for `parseEther`/`formatEther` on USDC paths returns nothing.
- [ ] `decimals() == 6` assertion in the suite.
- [ ] Tagged `v1.0.0-rc1`, pushed.

---

## 4. Phase 3 — Accounts, keys, and third-party services

Nothing here touches your contract; do it all in parallel between the two of you.

### 4.1 RPC provider — Alchemy (or QuickNode)

Scaffold-ETH 2 ships with a **shared public Alchemy key** in
`scaffold.config.ts`. It is rate-limited and shared by every SE-2 project on earth.
If you launch on it, your app works for you during testing and starts returning
429s the moment more than a handful of people load the page at once.

1. Create an Alchemy account → new App → **Base Mainnet**. Copy the key.
2. Create a second App → **Base Sepolia**. (Same key works for both on Alchemy;
   separate apps just give you separate usage graphs, which is useful.)
3. In the Alchemy dashboard, set the app's allowed-origins/domain restriction to your
   production domain once you have it (Phase 9). Until then leave it open.

**⚠️ FAILURE MODE — leaked RPC key.** `NEXT_PUBLIC_` env vars are shipped to the
browser. Your Alchemy key **will** be visible in the bundle; this is unavoidable and
normal. Mitigate with the domain allowlist and a usage cap/alert in Alchemy, not by
trying to hide it. Set a monthly compute-unit alert at ~50% of your plan.

### 4.2 WalletConnect project id

The default SE-2 `walletConnectProjectId` is also a shared placeholder. WalletConnect
is how mobile wallets connect, and on mainnet the burner wallet is (correctly)
disabled — so without this, mobile users simply cannot connect.

- Go to `https://dashboard.reown.com` (WalletConnect Cloud), create a project, copy
  the Project ID.
- Add your production domain to the project's allowed domains once you have it.

### 4.3 Block explorer verification key

Etherscan's V2 unified API covers Base with a single Etherscan key. Create a key at
`https://etherscan.io/myapikey`. (If your repo's `foundry.toml` predates V2 and
points at `api.basescan.org`, either create a separate Basescan key or update the
`[etherscan]` block to the V2 endpoint — check what `foundry.toml` actually says.)

### 4.4 Deployer account

This is a **throwaway hot key**. It deploys, then it is done forever. It must never
hold more than deploy gas, and it must never be the fee recipient.

Newer SE-2 (encrypted keystore — preferred):

```bash
cd packages/foundry
yarn account:generate          # creates encrypted keystore, prompts for a password
# or: yarn account:import      # if you want to bring an existing key
yarn account                   # prints address + balances per network
```

This writes an encrypted keystore and sets `ETH_KEYSTORE_ACCOUNT=scaffold-eth-custom`
in `packages/foundry/.env`. The password is **not** stored — put it in your password
manager now, shared with both of you, because you'll be prompted for it on every
deploy and a half-finished deploy because you forgot the password is an annoying
place to be.

Older SE-2 (raw private key):

```bash
cd packages/foundry
yarn generate      # writes DEPLOYER_PRIVATE_KEY into .env
yarn account
```

If you're on this variant, the key is plaintext on disk. Accept it only because it's
a throwaway, and:

```bash
grep -n "^\.env$\|^\*\*/\.env$" .gitignore   # must match
git check-ignore -v packages/foundry/.env    # must print a rule
```

**⚠️ FAILURE MODE — committed private key.** Install a pre-commit guard right now;
it costs 30 seconds and the alternative is a drained wallet and a rewritten history.

```bash
pip install detect-secrets
detect-secrets scan > .secrets.baseline
# then add a pre-commit hook, or at minimum run before each commit:
git diff --cached | grep -iE "0x[a-f0-9]{64}" && echo "STOP: possible private key" && exit 1
```

### 4.5 Fund the deployer

Base deploys are cheap. Send **0.01 ETH on Base mainnet** to the deployer address —
enough for the deploy plus several retries, small enough that losing the key is
irrelevant. Bridge via `https://bridge.base.org` or buy directly on Base via an
exchange that supports Base withdrawals (Coinbase does).

Also send **0.02 Base Sepolia ETH** from a faucet
(`https://www.alchemy.com/faucets/base-sepolia` or the Coinbase Developer Platform
faucet).

**Check before moving on:**

```bash
cd packages/foundry && yarn account
# must show a nonzero balance on both Base and Base Sepolia
```

### 4.6 Deploy the owner Safe

At `https://app.safe.global` → Create new Safe → network **Base**. Add the three
signers from DECIDE 0.1, threshold 2. Record the Safe address.

Then, **before** you rely on it: send $1 of USDC to the Safe and execute a
transaction sending it back out, signed by both of you on your actual hardware
wallets. A Safe you have never successfully executed a transaction from is not a
Safe you can trust with revenue.

### GATE 3

- [ ] Alchemy key for Base + Base Sepolia, usage alert configured.
- [ ] WalletConnect project id.
- [ ] Etherscan/Basescan API key.
- [ ] Deployer account created, funded on both networks, `yarn account` confirms.
- [ ] `.env` confirmed gitignored; secret-scan guard in place.
- [ ] Safe deployed on Base, 2-of-3, **and a test transaction successfully executed through it**.

---

## 5. Phase 4 — Full rehearsal on Base Sepolia

This is a dress rehearsal of Phases 5–9, on a network where mistakes are free. Do
not skip it and do not shortcut it: the point is to execute the *exact* commands
you'll run on mainnet, so that the mainnet run has zero novelty in it.

### 5.1 Config

`packages/foundry/foundry.toml` — confirm the rpc endpoints and etherscan config
exist:

```toml
[rpc_endpoints]
baseSepolia = "https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
base = "https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"

[etherscan]
baseSepolia = { key = "${ETHERSCAN_API_KEY}", chain = 84532 }
base = { key = "${ETHERSCAN_API_KEY}", chain = 8453 }
```

`packages/foundry/.env`:

```bash
ALCHEMY_API_KEY=<your key>
ETHERSCAN_API_KEY=<your key>
ETH_KEYSTORE_ACCOUNT=scaffold-eth-custom   # or DEPLOYER_PRIVATE_KEY=0x... on older SE-2
```

Your deploy script must take the USDC address and fee recipient per-chain, not
hardcoded to the local mock. In `packages/foundry/script/Deploy.s.sol` (or the
contract-specific deploy script it calls):

```solidity
address usdc;
address feeRecipient;
if (block.chainid == 8453) {
    usdc = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    feeRecipient = 0xYOUR_SAFE;
} else if (block.chainid == 84532) {
    usdc = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    feeRecipient = vm.envAddress("FEE_RECIPIENT");
} else {
    revert("unsupported chain");   // <-- important
}
require(usdc.code.length > 0, "USDC has no code on this chain");
```

That `revert` on the else branch is doing real work: without it, a typo in
`--network` silently deploys with mock/zero addresses.

The `require(code.length > 0)` catches the single nastiest deploy mistake — pointing
at a correct-looking address that has no contract on *this* chain. That deploy
succeeds, verifies, looks perfect, and every tip reverts.

### 5.2 Deploy to Base Sepolia

```bash
yarn deploy --network baseSepolia
```

Expected output: transaction hash, deployed address, and the ABI/address written
into `packages/nextjs/contracts/deployedContracts.ts` under key `84532`.

Then verify:

```bash
yarn verify --network baseSepolia
```

**Check:** open `https://sepolia.basescan.org/address/<addr>#code`. You should see
green-check verified source. Confirm the **constructor arguments** shown at the
bottom decode to the USDC address and fee recipient you intended. This is the
cheapest possible check that your deploy script did what you think.

**⚠️ FAILURE MODE — verification fails.** Usually a compiler-version or
optimizer-settings mismatch. Fix it *here*, on testnet. Verification is much more
annoying to do after the fact, and an unverified contract holding user approvals
looks exactly like a scam to anyone who checks — which is the users you most want.

### 5.3 Point the frontend at Base Sepolia

`packages/nextjs/scaffold.config.ts`:

```ts
const scaffoldConfig = {
  targetNetworks: [chains.baseSepolia],
  pollingInterval: 30000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  onlyLocalBurnerWallet: true,
} as const satisfies ScaffoldConfig;
```

`onlyLocalBurnerWallet: true` is the default and **must stay true**. If it's false,
your production site offers users a burner wallet whose key lives in localStorage,
and someone will fund it and lose the money.

`packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_ALCHEMY_API_KEY=<key>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<id>
```

Then:

```bash
yarn start
```

### 5.4 Rehearse the full user journey

Get testnet USDC from Circle's faucet (`https://faucet.circle.com`, select Base
Sepolia). Then, **both of you, independently**, on separate machines:

1. Fresh wallet with **no prior approval** to the contract. This matters — you have
   been testing with an already-approved account and have probably never exercised
   the first-time approval flow in a real UI.
2. Connect via browser extension wallet. Confirm the network-switch prompt appears
   and works if you're on the wrong chain.
3. Tip a creator. Watch for: does the UI clearly show two transactions (approve,
   then tip)? Does it handle you rejecting the first one? Does it handle you
   approving and then walking away for five minutes?
4. Check the creator received `amount * 0.99` and the fee recipient received
   `amount * 0.01`, to the base unit, on Basescan.
5. Tip below `MIN_TIP` — expect a form-level error, not a failed transaction.
6. Tip more than your balance — expect a clear error.
7. Connect from a **phone** via WalletConnect. This is where a wrong/missing
   WalletConnect project id shows up, and roughly half your real users will be here.
8. Execute a fee withdrawal to the (testnet) fee recipient.

**⚠️ FAILURE MODE — the approval UX cliff.** The single biggest source of "the app
is broken" reports for any ERC20 dApp is a first-time user who approves and then
sees nothing happen, because the UI is waiting for a receipt and shows no state. If
step 3 above feels confusing to you, it will be unusable for a stranger. Fix it now
— a spinner with "Step 1 of 2: approving USDC…" is enough.

**⚠️ FAILURE MODE — infinite vs exact approval.** Decide deliberately. Exact
approval means a second transaction on every single tip (worse UX, better safety).
Infinite means one approval forever (better UX, and your immutable contract now has
standing permission to move that user's entire USDC balance). For a brand-new
unaudited contract, **default to exact approval**, and consider offering infinite as
an opt-in checkbox later. Whatever you choose, say so in the UI.

### 5.5 Rehearse the Vercel deploy on testnet

Do this now, on testnet, so the mainnet frontend deploy is a repeat and not a first
attempt.

```bash
yarn vercel        # SE-2 wrapper; or `npx vercel` from packages/nextjs
```

Set env vars in the Vercel project (Settings → Environment Variables), for
Production, Preview, and Development:

- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

Then run the full journey (5.4) again against the deployed Vercel preview URL, from
a phone. Things that work on `localhost:3000` and break on a deployed URL: wallet
deep links, HTTPS-only wallet APIs, missing env vars, and anything that depended on
your local anvil still running.

### GATE 4

- [ ] Deployed and **verified** on Base Sepolia; constructor args confirmed correct on Basescan.
- [ ] Both team members completed the full journey from a fresh, never-approved wallet.
- [ ] Mobile/WalletConnect journey completed successfully.
- [ ] Fee split confirmed to the base unit on-chain.
- [ ] `MIN_TIP` and insufficient-balance errors surface as form errors, not reverts.
- [ ] Fee withdrawal executed successfully.
- [ ] Testnet frontend deployed to Vercel and journey re-run against the public URL from a phone.
- [ ] **No Solidity changed since `v1.0.0-rc1`** — if it did, return to GATE 1.

---

## 6. Phase 5 — Pre-mainnet final checks

Small phase, all of it cheap, all of it catches expensive things.

```bash
# 1. Confirm you are deploying the tagged commit
git status --porcelain          # must be empty
git describe --tags             # must be v1.0.0-rc1 (or -rcN you re-tagged)

# 2. Confirm the frontend builds clean for production
cd packages/nextjs
yarn next:check-types
yarn lint
yarn build                      # a production build, not `yarn start`

# 3. Confirm nothing local-only leaks into the bundle
grep -rn "localhost\|127.0.0.1\|31337\|hardhat" .next/static 2>/dev/null | head
```

Any hit on `31337` or `localhost` in the built bundle means a hardcoded local
endpoint survived into production. Track it down before deploying.

```bash
# 4. Dry-run the mainnet deploy without broadcasting
cd packages/foundry
forge script script/Deploy.s.sol --rpc-url $BASE_RPC
```

No `--broadcast`. This simulates against real mainnet state and will fail if, for
example, your USDC `code.length` check doesn't pass. Read the simulated output and
confirm the constructor args in the trace.

```bash
# 5. Estimate cost
cast gas-price --rpc-url $BASE_RPC
```

Base gas is cheap; a deploy is typically well under $1. If the simulation shows a
gas figure wildly out of line with testnet, something differs between the chains —
find out what before broadcasting.

### GATE 5

- [ ] Working tree clean, on the tagged commit.
- [ ] Type-check, lint, and production build all pass.
- [ ] No `localhost`/`31337` in the production bundle.
- [ ] Mainnet dry-run simulation succeeds with correct constructor args.
- [ ] Both of you are at keyboards, awake, with 2+ hours free. Do not deploy at the end of a long day.

---

## 7. Phase 6 — Deploy to Base mainnet

```bash
cd packages/foundry
yarn deploy --network base
```

Record immediately, in a scratch file you keep:

- deployed contract address
- deployment transaction hash
- block number
- exact commit sha (`git rev-parse HEAD`)

Verify:

```bash
yarn verify --network base
```

**Checks, in this order, before anything else happens:**

1. `https://basescan.org/address/<addr>#code` — source verified, green check.
2. Constructor arguments decode to: correct native USDC address, correct **Safe**
   fee recipient.
3. Read the contract on Basescan (Read Contract tab) and confirm every public
   getter: `owner()`, `feeRecipient()`, `feeBps()` (or equivalent) == 100,
   `MIN_TIP`, the USDC address.
4. Byte-for-byte sanity:

```bash
cast code <ADDR> --rpc-url $BASE_RPC | wc -c     # nonzero, matches expectations
cast call <ADDR> "owner()(address)" --rpc-url $BASE_RPC
cast call <ADDR> "feeRecipient()(address)" --rpc-url $BASE_RPC
```

**⚠️ FAILURE MODE — wrong network deployed to.** The `revert("unsupported chain")`
in §5.1 prevents the silent version of this. The loud version: check the chain id on
the Basescan page you're looking at is `basescan.org`, not `sepolia.basescan.org`.
People get this wrong while tired.

**⚠️ FAILURE MODE — deploy half-succeeded.** If `yarn deploy` errors partway
(nonce issue, RPC timeout), **do not blindly re-run it.** Check the deployer address
on Basescan first: if the contract deployed and only the ABI export failed, re-running
deploys a *second* contract and you'll have two live addresses and a confusing
`deployedContracts.ts`. If it did deploy, just re-run the export step
(`yarn deploy --network base` on newer SE-2 is idempotent-ish via the deployments
file; check `packages/foundry/deployments/8453.json`).

Then commit the artifacts:

```bash
git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/deployments/
git commit -m "chore: Base mainnet deployment 8453"
git tag -a v1.0.0 -m "Base mainnet"
git push origin main --tags
```

**Check:** open `deployedContracts.ts` and confirm there's an `8453` key with the
right address, and that the `31337` local entry doesn't shadow it.

### GATE 6

- [ ] Contract live on Base mainnet, address recorded.
- [ ] Verified on Basescan with correct constructor args.
- [ ] Every read-only getter returns the expected value.
- [ ] `deployedContracts.ts` has the `8453` entry; committed and tagged `v1.0.0`.
- [ ] Exactly **one** contract deployed (check the deployer's tx list on Basescan).

---

## 8. Phase 7 — Ownership handoff

If you deployed with the Safe already as owner/fee recipient, skip to the verify
step. Otherwise transfer now, *before* any user funds exist:

```bash
cast send <ADDR> "transferOwnership(address)" <SAFE_ADDR> \
  --rpc-url $BASE_RPC --account scaffold-eth-custom
# older SE-2: --private-key $DEPLOYER_PRIVATE_KEY
```

**Verify the handoff — do not take the transaction receipt as proof:**

```bash
cast call <ADDR> "owner()(address)" --rpc-url $BASE_RPC     # == Safe address
cast call <ADDR> "feeRecipient()(address)" --rpc-url $BASE_RPC
```

**⚠️ FAILURE MODE — transferred to an address you don't control.** If the contract
uses plain `Ownable` (not `Ownable2Step`), `transferOwnership` to a typo'd address
is instantly final and your contract is permanently unownable. Two mitigations:
prefer `Ownable2Step` if you can (it was a Phase 0 decision — too late now if not),
and regardless, **copy the Safe address from the Safe UI, never type it**, and
`cast call owner()` immediately after.

**Then prove the Safe can actually use it:** from the Safe UI, queue and execute one
owner-only call — `pause()` then `unpause()` is ideal, or a no-op setter. Both of you
sign. A Safe that owns the contract but has never successfully called it is an
untested dependency in your incident runbook.

Finally, drain the deployer:

```bash
cast send <YOUR_EOA_OR_SAFE> --value <almost all of it> \
  --rpc-url $BASE_RPC --account scaffold-eth-custom
```

Leave the deployer with dust. Its job is done.

### GATE 7

- [ ] `owner()` and `feeRecipient()` both return the Safe address, confirmed by `cast call`.
- [ ] An owner-only function has been successfully executed through the Safe by both signers.
- [ ] Deployer wallet emptied.

---

## 9. Phase 8 — Production frontend

### 9.1 Config

`packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.base],
pollingInterval: 30000,
onlyLocalBurnerWallet: true,
```

**Only `chains.base`.** Do not leave `chains.baseSepolia` or `chains.hardhat` in the
array for production — the network selector will offer them and users will connect
to the wrong chain, tip into a testnet contract, and file a bug about lost money.

`pollingInterval: 30000` matters for cost: SE-2's default is tuned for a local chain
and will burn through Alchemy compute units on mainnet. 30s is fine for a tipping
app.

### 9.2 Vercel production deploy

```bash
cd packages/nextjs
vercel --prod
```

Env vars must be set for the **Production** environment specifically (Vercel scopes
them per-environment, and a variable set only for Preview is a classic 20-minute
debugging session):

- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

Confirm:

```bash
vercel env ls
```

### 9.3 Domain

In Vercel → Project → Settings → Domains, add your domain and follow the DNS
instructions at your registrar. Then:

```bash
dig +short yourdomain.com
curl -sI https://yourdomain.com | head -1     # expect HTTP/2 200
```

Wait for the certificate to be issued (Vercel does this automatically; it can take a
few minutes). **Do not announce anything until `https://` works without a warning** —
a cert warning on a site that asks for wallet connections is fatal to trust.

### 9.4 Lock down the keys to the domain

Now that the domain exists, go back and restrict:

- **Alchemy** → App → Security → add `yourdomain.com` to allowed origins.
- **WalletConnect/Reown** → Project → add `https://yourdomain.com` to allowed domains.

**Check after each:** reload the production site and complete a read-only action
(does the tip history load?). If you restrict origins wrongly you'll break your own
site, and you want to find that out now rather than after announcing.

### GATE 8

- [ ] Production site live on the real domain over valid HTTPS.
- [ ] `scaffold.config.ts` targets **only** Base mainnet.
- [ ] Production env vars confirmed via `vercel env ls`.
- [ ] Alchemy + WalletConnect domain restrictions applied **and** site re-tested after.
- [ ] Site loads contract data (proves RPC + `deployedContracts.ts` + chain id all agree).

---

## 10. Phase 9 — Mainnet canary, before a single user

Real money, tiny amounts, your own wallets. Nothing is announced yet.

Both of you, independently, from wallets that have **never** interacted with the
contract:

1. Buy/bridge ~$5 of real USDC on Base.
2. Load the production URL on desktop, connect extension wallet.
3. Tip **$1.00** to a creator address you control.
4. On Basescan, verify to the base unit: creator received `990000`, Safe received
   `10000`. Not "about right" — exactly these numbers. A 1% fee on 1000000 base
   units is 10000 base units.
5. Repeat from a phone over WalletConnect.
6. Tip $0.05 (below `MIN_TIP` if yours is $0.10) — confirm the form blocks it.
7. Tip more than your balance — confirm a clean error.
8. Reject the approval transaction — confirm the UI recovers and doesn't hang.
9. Disconnect mid-flow, reconnect — confirm state recovers.
10. Withdraw the accumulated fees through the Safe, both signers. Confirm the USDC
    lands in the Safe.

**⚠️ FAILURE MODE — the fee math is off by a rounding direction.** Step 4 is the
only place you'll catch this with real money before users do. If creator gets
`989999` or Safe gets `10001`, stop. Do not announce. The contract is immutable, so
the decision is: accept the discrepancy publicly and document it, or redeploy. You'd
much rather make that decision at $1 of volume than $10,000.

**⚠️ FAILURE MODE — events don't index.** Your UI's tip history reads events. On a
local fork, everything is instant. On mainnet with a real RPC, `eth_getLogs` over a
wide block range gets rate-limited or truncated. **Check:** after step 3, does the
tip appear in your app's history within ~60 seconds? If the history is empty or slow,
your log query range is wrong — either constrain it (`fromBlock` = deployment block,
not `0`) or move to a proper indexer (Ponder, The Graph). Querying from block 0 on
Base is the specific mistake; the deployment block is in your scratch notes from
Phase 6.

### GATE 9

- [ ] Both team members completed a real mainnet tip end-to-end, desktop + mobile.
- [ ] Fee split exact to the base unit.
- [ ] Error paths (below min, insufficient balance, rejected approval) all behave.
- [ ] Fee withdrawal through the Safe succeeded.
- [ ] Tip history renders within 60s of the transaction.

---

## 11. Phase 10 — Monitoring, then soft launch

### 11.1 Set up alerting *before* users arrive

You are two people who will be asleep half the time. Automate the watching.

**Tenderly** (`https://tenderly.co`, free tier is adequate):

1. Add your contract at address `<ADDR>` on Base. It'll pick up the verified source.
2. Create Alert: *any failed transaction* on the contract → email + Telegram/Slack.
   A spike in reverts is your earliest signal that something is broken for users.
3. Create Alert: any call to `withdrawFees` / `transferOwnership` / `pause` →
   immediate notify. If one of these fires and it wasn't you, you're being attacked.
4. Create Alert: USDC `Transfer` where `to == <ADDR>` if you chose the custodial
   model — you should never see a balance accumulate unexpectedly.

**Basescan:** Watch List on the contract address and on the Safe address, with email
notification on any transaction.

**Vercel:** enable Analytics, and Log Drains if you have anywhere to send them.

**Sentry** (or equivalent) in the Next.js app, so frontend exceptions reach you:

```bash
cd packages/nextjs && npx @sentry/wizard@latest -i nextjs
```

Then add `SENTRY_DSN` to Vercel production env. The value here is that a wallet
integration bug shows up as a JS exception long before a user thinks to email you.

**Uptime:** a free monitor (Better Stack, UptimeRobot) on `https://yourdomain.com`,
5-minute interval, alerting both of you.

### 11.2 Publish the trust surface

Before real users, the site should show:

- The contract address, linked to Basescan, visible on the page. Users who check are
  users you want.
- A plain-language "how the fee works": 1% to the platform, 99% to the creator.
- Terms of Service and a Privacy Policy. You are taking a cut of payments between
  third parties; you need these. Get them reviewed — this document is not legal
  advice, and "we take 1% of stablecoin payments between strangers" is a business
  with real regulatory surface (money transmission, sanctions screening, tax
  reporting on your 1% as revenue). Budget a conversation with a lawyer who knows
  crypto payments *before* volume, not after.
- A note that the contract is unaudited, if it is. Say it plainly. It's both honest
  and the thing that protects you when something goes wrong.

### 11.3 Soft launch

Invite **5–10 people you know personally.** Not a public announcement. Give them no
instructions beyond the URL — you're testing whether the app explains itself.

Watch for 48 hours:

- Tenderly failed-transaction alerts
- Sentry exceptions
- Alchemy compute-unit consumption (extrapolate: will your plan survive 100x?)
- Every tip on Basescan, fee split checked manually

Ask each of them one question: "where did you get stuck?" The approval step is the
answer you should expect.

### 11.4 Go public

Only after 48 quiet hours with the soft-launch group, and only when:

### GATE 10

- [ ] Tenderly, Basescan watch, Sentry, and uptime monitoring all confirmed firing (test each one — trigger a deliberate failed tx and confirm the alert arrives).
- [ ] Contract address, fee explanation, ToS, privacy policy all live on the site.
- [ ] 5–10 soft-launch users completed real tips.
- [ ] Zero unexplained failed transactions in 48 hours.
- [ ] Every fee split spot-checked on-chain.
- [ ] Alchemy usage at soft-launch volume extrapolates safely to your expected launch volume.
- [ ] Incident runbook (§12) is written, and both of you have read it.

---

## 12. Incident runbook

Write this out and pin it somewhere both of you can reach from a phone.

**The core fact: taking the website down does not stop the contract.** Vercel
rollback protects new users from a broken UI. It does nothing about a contract bug,
and nothing about the approvals users have already granted.

### Severity 1 — funds at risk (wrong recipient, drain in progress, fee math wrong)

1. **Pause the contract** via the Safe, both signers. If you declined a pause in
   DECIDE 0.2, skip to 2 and accept that the contract keeps running.
2. Take the frontend down or replace it with a static warning page:
   ```bash
   cd packages/nextjs && vercel rollback           # or deploy a one-page notice
   ```
3. Post publicly, immediately, on every channel you have. Include: what happened,
   whether funds are affected, and **"revoke your USDC approval to `<ADDR>` at
   https://revoke.cash"**. That instruction is the single most useful thing you can
   give users, because it's the one action that protects them regardless of what
   your contract does next.
4. Only then start diagnosing. Use Tenderly's transaction simulator on the offending
   tx — it'll show you the exact revert or state change.

### Severity 2 — app broken, funds safe (UI bug, RPC down, wallet connect failing)

1. `vercel rollback` to the last known-good deployment.
2. Check Alchemy status and your compute-unit usage — rate limiting looks exactly
   like "the app is broken."
3. Fix, redeploy to a preview URL, run the full journey from §5.4 against it, then
   promote.

### Severity 3 — a single user has a problem

Get their transaction hash. Look it up on Basescan. In almost every case it's one
of: insufficient allowance, insufficient balance, wrong network, or a blacklisted
address. Each of those should surface as a clear UI error — if it didn't, that's a
Severity 2 fix.

### The redeploy path

If you must ship a fixed contract, it's a migration, not an update:

1. Pause the old contract.
2. Deploy the new one (Phases 5–7 again, in full, including the testnet rehearsal).
3. Update `deployedContracts.ts`, deploy the frontend.
4. Announce clearly, and tell users to **revoke their approval to the old address**.
5. Keep the old address documented forever. Someone will find it.

---

## Appendix A — Environment variable reference

| Variable | File / location | Notes |
| --- | --- | --- |
| `ALCHEMY_API_KEY` | `packages/foundry/.env` | server-side, for foundry RPC |
| `ETHERSCAN_API_KEY` | `packages/foundry/.env` | contract verification |
| `ETH_KEYSTORE_ACCOUNT` | `packages/foundry/.env` | newer SE-2; encrypted keystore name |
| `DEPLOYER_PRIVATE_KEY` | `packages/foundry/.env` | older SE-2 only; throwaway key only |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | `.env.local` + Vercel Production | **public, in the browser bundle** |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | `.env.local` + Vercel Production | **public**; required for mobile |
| `SENTRY_DSN` | Vercel Production | error reporting |

Nothing prefixed `NEXT_PUBLIC_` is secret. Nothing secret gets that prefix.

## Appendix B — Addresses to record

Fill this in as you go; you'll want it during an incident at 2am.

```
Tipping contract (Base 8453):   0x...
Deployment tx:                  0x...
Deployment block:               ...
Deployed from commit:           ...
Owner / fee recipient Safe:     0x...
Safe signers:                   A: 0x...  B: 0x...  backup: 0x...
USDC (Base):                    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Deployer EOA (retired):         0x...
Base Sepolia contract:          0x...
Production URL:                 https://...
```

## Appendix C — Failure-mode index

Quick reference to the traps called out above and where each is caught.

| Failure | Caught in | Signal |
| --- | --- | --- |
| 18 vs 6 decimals | Phase 2 | `grep` for `parseEther`; `decimals()` assertion |
| Unchecked ERC20 return | Phase 1 | slither `unchecked-transfer`; false-return mock test |
| USDC blacklist reverts | Phase 2 | fork test with blacklisted address |
| Fee rounding / overcharge | Phase 1, Phase 9 | fuzz invariant; exact base-unit check on $1 canary |
| USDC address has no code on this chain | Phase 4 | `require(code.length > 0)` in deploy script |
| Deployed to wrong network | Phase 4 | `revert("unsupported chain")` on the else branch |
| Verification mismatch | Phase 4 | `yarn verify` on testnet first |
| Shared/rate-limited RPC key | Phase 3, Phase 10 | Alchemy usage alerts |
| Missing WalletConnect id | Phase 4 | mobile journey in rehearsal |
| Burner wallet on mainnet | Phase 4 | `onlyLocalBurnerWallet: true` |
| Testnet chain in prod selector | Phase 8 | `targetNetworks: [chains.base]` only |
| Env var set only for Preview | Phase 8 | `vercel env ls` |
| `eth_getLogs` from block 0 | Phase 9 | tip history empty/slow after canary |
| Ownership transferred to a typo | Phase 7 | `cast call owner()` immediately after |
| Safe that can't actually execute | Phase 3, Phase 7 | test transaction through the Safe |
| Frontend takedown ≠ contract stop | Phase 12 | pause + revoke.cash instruction |
