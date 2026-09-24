# LAUNCH.md — localhost → Base mainnet, public URL, real users

**Scope:** creator-tipping dApp. Fans tip creators in USDC; contract takes a 1% platform fee.
**Stack:** Scaffold-ETH 2, foundry flavor (`packages/foundry` + `packages/nextjs`).
**Starting state:** works on a local fork, tests pass, nothing has ever touched a live network.
**Ending state:** verified contract on Base mainnet (chain 8453), owned by a 2-of-2 Safe, frontend on a custom HTTPS domain, monitoring live, soft-launched to a handful of real users.

Follow this in order. Every phase ends with a **GATE** — a concrete check. If a gate fails, stop and fix; do not proceed. Phases 0–4 are cheap and reversible. Phase 5 onward spends real money and is where mistakes become permanent.

Two people, so: one person drives, the other reads the gate output independently. Don't both watch the same terminal.

Realistic clock: Phases 0–4 ≈ 1–2 days. Phase 5 (testnet soak) ≈ 3–7 days of calendar time, mostly waiting. Phases 6–10 ≈ 1 day. Budget a week.

---

## Constants — fill these in first, before any command

Write these into a scratch file you both can see. Wrong values here are the single most common launch failure.

| Thing | Value |
|---|---|
| Base mainnet chain ID | `8453` |
| Base mainnet public RPC | `https://mainnet.base.org` |
| Base mainnet explorer | `https://basescan.org` |
| Base Sepolia chain ID | `84532` |
| Base Sepolia public RPC | `https://sepolia.base.org` |
| Base Sepolia explorer | `https://sepolia.basescan.org` |
| **USDC on Base mainnet** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **USDC on Base Sepolia** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| USDC decimals | **6**, not 18 |
| Platform fee recipient | _your Safe address — Phase 4_ |
| Contract owner | _your Safe address — Phase 4_ |

Verify the mainnet USDC address yourself rather than trusting this table:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url https://mainnet.base.org
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url https://mainnet.base.org
```

Expect `USDC` and `6`. That is Circle's native USDC on Base. There is also a bridged `USDbC` (`0xd9aA...`) — **do not use it**; it's legacy, thinner liquidity, and wallets display it confusingly next to real USDC. If your contract hardcodes an address, it must be the one above.

---

## Phase 0 — Freeze and inventory

You can't deploy a moving target. Nothing here costs money.

```bash
git checkout -b launch/base-mainnet
git status                    # must be clean
yarn install --frozen-lockfile
```

Now read your own contract with launch eyes. Open `packages/foundry/contracts/` and answer these in writing (paste answers into the PR description for the launch branch — your teammate reviews them):

1. **Is the USDC address a constructor arg or a hardcoded constant?** If hardcoded to your local mock, it must become a constructor/deploy-script arg. Deploying with a mock address on mainnet is unrecoverable if the address is `immutable`.
2. **Does the contract use `SafeERC20`?** USDC's `transfer`/`transferFrom` do return a bool, so a raw call happens to work — but use `SafeERC20` anyway. One line, removes a whole class of future-token bugs.
3. **Where does the 1% fee land?** Three options, and you need to pick deliberately:
   - *Push both* (creator + fee recipient paid in the tip tx) — simplest, but **if either address is ever Circle-blacklisted, every tip reverts**, including tips to unrelated creators if the fee recipient is the blocked one.
   - *Push creator, accrue fee* (fee accumulates in the contract, owner pulls later) — **recommended.** A blacklisted fee recipient can never break tipping. A blacklisted creator's tips revert, which is the correct outcome — the fan isn't charged.
   - *Accrue both* — makes you a custodian of creator funds. Worse legal and worse UX. Avoid.
4. **How is the fee computed?** If it's `amount * 1 / 100` or `amount * 100 / 10_000`, integer truncation means any tip under 100 base units (0.0001 USDC) pays **zero** fee. Harmless economically, but enforce a `MIN_TIP` (suggest `100_000` = 0.10 USDC) so you never emit meaningless dust events and so the fee math is never zero.
5. **Is the fee rate immutable or settable?** Immutable is safest and most credible to creators. If settable, it needs a hard upper bound in the setter (`require(bps <= 300)`) so a compromised owner can't set 100%.
6. **Is there a pause?** You need one. Without it your only response to a live bug is "tweet at people to stop."
7. **Is ownership `Ownable2Step`?** Single-step `transferOwnership` to a typo'd address bricks the contract permanently. This is a real risk in Phase 7 when you hand off to the Safe.
8. **Is there a zero-address check on the creator param?** `tip(address(0), amount)` should revert, not burn a fan's money.
9. **Is there a token-rescue function?** If yes, confirm it cannot touch accrued creator/fee balances. If it can, that's a rug vector creators will (correctly) flag.
10. **Reentrancy:** USDC has no transfer callback, so you're fine today — but apply checks-effects-interactions ordering and `nonReentrant` on state-mutating external functions anyway. Costs ~2k gas, which on Base is nothing.

**GATE 0:** All ten answered, and any code changes from them are merged into `launch/base-mainnet` with tests. Both people have read the contract top to bottom. It is ~200 lines; there is no excuse for skipping this.

---

## Phase 1 — Make the test suite launch-grade

Your suite passes, but "passes on a local fork" and "safe with strangers' money" are different bars.

```bash
cd packages/foundry
forge fmt --check
forge build --sizes
forge test -vvv
forge coverage --report summary
```

Add these tests if missing. Each maps to a way this specific app breaks:

```bash
# Run them individually as you write them
forge test --match-test testFeeIsExactlyOnePercent -vvv
```

- `testFeeIsExactlyOnePercent` — tip 100 USDC (`100_000_000` units) → creator gets `99_000_000`, fee side gets `1_000_000`. Assert exact integers, not approximations.
- `testFeeRoundingFavorsCreator` — tip `12_345_679` units. Assert `creatorAmount + feeAmount == totalAmount` exactly. **No wei may ever be created or destroyed.** This invariant catches every future fee-math edit.
- `testDustTipReverts` — tip `1` unit reverts with your `MIN_TIP` error.
- `testTipWithoutApprovalReverts` — the #1 thing real users will hit.
- `testTipWithInsufficientBalanceReverts`.
- `testTipToZeroAddressReverts`.
- `testPauseBlocksTipsAndUnpauseRestores`.
- `testOnlyOwnerCanWithdrawFees` — fuzz the caller address.
- `testNonOwnerCannotPause`.
- **Fork test against real Base USDC** — this is the one that catches hardcoded-mock and decimals bugs:

```solidity
// packages/foundry/test/ForkBase.t.sol
function setUp() public {
    vm.createSelectFork(vm.envString("BASE_RPC_URL"));
    usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    // fund a fan by stealing from a whale
    deal(address(usdc), fan, 1_000e6);
}
```

```bash
BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/ForkBase.t.sol -vvv
```

Then an invariant run — cheap, and it's what finds the accounting drift a two-person team won't spot by inspection:

```bash
forge test --match-contract Invariant -vvv
```

Invariant to assert: **contract USDC balance == sum of accrued fees + sum of accrued creator balances** (or `== accrued fees` if you push to creators). Any tip sequence, any order, any amounts.

Then static analysis:

```bash
pipx install slither-analyzer          # once
cd packages/foundry
slither . --filter-paths "lib|test" --exclude-dependencies
```

Triage every High and Medium. "Slither is noisy" is true and is not a reason to skip reading them.

**GATE 1:**
- `forge test` green, including the mainnet fork test.
- Coverage ≥ 90% on your own contracts (`forge coverage` — ignore `lib/`).
- Invariant test passes with ≥ 10,000 runs.
- Zero unresolved Slither High/Medium.
- `forge build --sizes` shows you're under the 24,576-byte limit with room.

---

## Phase 2 — Independent review

You are two people who wrote this code. You cannot review it. This is the single highest-value hour in this document, and it's the phase teams skip.

Pick at least one, ideally two:

1. **A competent Solidity dev you don't work with.** Pay them for two hours. Give them: the contract, this doc's Phase 0 answers, and one sentence — "fans tip creators in USDC, we take 1%."
2. **A public review venue** — post the single file to a Solidity community and ask for holes. It's 200 lines of token plumbing; people will read it.
3. **A cheap automated audit pass** (`slither` is already done; add `aderyn` or an LLM-driven review) — weakest of the three, but non-zero.

A full paid audit is overkill for a 200-line non-upgradeable fee splitter with no price oracle and no custody. Two hours of an outside expert is proportionate.

**GATE 2:** Written sign-off from someone outside the two of you. Every finding either fixed or explicitly accepted in writing with a reason. If a finding is fixed, **return to GATE 1** and re-run the full suite.

---

## Phase 3 — Accounts, keys, and API credentials

Still no money spent. Getting this wrong is how people lose their deployer key.

### 3.1 Deployer account

Scaffold-ETH 2 supports an encrypted keystore. **Use it.** A plaintext `DEPLOYER_PRIVATE_KEY` in `.env` is fine for localhost and unacceptable for mainnet.

```bash
cd packages/foundry
yarn account:generate          # creates a new encrypted keystore, prompts for a password
# or, to bring your own:
yarn account:import            # prompts for private key + password
yarn account                   # prints the address and balances per network
```

This writes an encrypted keystore (alias `scaffold-eth-custom`) and sets `ETH_KEYSTORE_ACCOUNT` in `packages/foundry/.env`. Confirm no raw key is on disk:

```bash
grep -r "DEPLOYER_PRIVATE_KEY" packages/foundry/.env
# should be empty or commented out
cat packages/foundry/.env | grep ETH_KEYSTORE_ACCOUNT
```

The deployer is a **hot, throwaway key.** It deploys, then hands ownership to the Safe (Phase 7), then holds nothing. Do not reuse a personal wallet.

Back up the keystore file and password to both people, separately, in a password manager. If one of you is hit by a bus mid-launch the other must be able to finish.

### 3.2 Confirm `.gitignore`

```bash
git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
# both must print a matching .gitignore rule
git log --all --full-history -- "**/.env" "**/.env.local"
# must be empty — if not, those keys are burned; rotate everything
```

### 3.3 API keys

Create these now; you'll need all four:

- **Alchemy** (or equivalent) app for **Base Mainnet** → RPC URL + API key. The public `mainnet.base.org` endpoint is rate-limited and will 429 your frontend under any real traffic. It's fine for deploy scripts, not for users.
- **Alchemy** app for **Base Sepolia** → same.
- **Etherscan V2 API key** (`https://etherscan.io/myapikey`). The unified V2 key covers Base — you do **not** need a separate Basescan account anymore. Set `ETHERSCAN_API_KEY` in `packages/foundry/.env`.
- **WalletConnect / Reown project ID** (`https://dashboard.reown.com`). Without a real one, mobile wallet connections fail for users even though your desktop browser extension works fine — a bug that is invisible to you locally.

`packages/foundry/.env`:
```
ETH_KEYSTORE_ACCOUNT=scaffold-eth-custom
ETHERSCAN_API_KEY=<v2 key>
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<key>
```

**GATE 3:** `yarn account` prints your deployer address and zero balances. No secret is in git history. All four credentials exist and each has been smoke-tested:

```bash
cast block-number --rpc-url $BASE_RPC_URL           # returns a number
cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL   # returns a number
```

---

## Phase 4 — Create the Safe (do this before deploying anything)

Create it now so the Safe address exists as a constructor argument in Phase 5 and you never deploy with a hot key as owner.

1. Go to `https://app.safe.global`, select **Base** as the network.
2. Create a **2-of-2** Safe with both of your personal wallets as signers.
3. Fund it with a tiny amount of ETH on Base.
4. Record the address. This is both your **owner** and your **fee recipient**.

Two-person team, so 2-of-2 has a real failure mode: if one of you loses a key, the Safe is frozen and your platform fees are stuck. Mitigations, pick one: add a third signer (a hardware wallet in a drawer, or a trusted third person) and go 2-of-3, or accept the risk and make sure both seed phrases are backed up offline. **Decide explicitly, don't drift into it.**

Verify the Safe is real and on the right chain:

```bash
cast code <SAFE_ADDRESS> --rpc-url $BASE_RPC_URL | head -c 20
# must NOT be "0x" — empty code means the Safe isn't deployed on Base
```

That check matters: Safe addresses can be identical across chains but only deployed on some. Sending fees to an address with no code on Base means the fees are gone.

**GATE 4:** Safe exists on Base (chain 8453), has code, both signers can each independently load it in the Safe UI and see it, and you have successfully executed one trivial 2-of-2 transaction (send 0.0001 ETH to one of yourselves) to prove the signing flow works. **Do not discover your signing flow is broken during an incident.**

---

## Phase 5 — Base Sepolia dress rehearsal

This is a full rehearsal of Phases 6–9 against a network where mistakes are free. Do not skip it because "it works on the fork." The fork does not exercise: real RPC latency, wallet network-switching, WalletConnect, verification, Vercel's build environment, or your frontend's decimal handling against the real token.

### 5.1 Config

`packages/foundry/foundry.toml` — confirm the endpoints exist:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base = { key = "${ETHERSCAN_API_KEY}", chain = 8453 }
baseSepolia = { key = "${ETHERSCAN_API_KEY}", chain = 84532 }
```

`packages/foundry/script/DeployYourContract.s.sol` — the USDC address must be selected by chain, never hardcoded:

```solidity
function usdcFor(uint256 chainId) internal pure returns (address) {
    if (chainId == 8453)  return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    if (chainId == 84532) return 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    if (chainId == 31337) return address(0); // deploy a mock in the local branch
    revert("unsupported chain");
}
```

The `revert` matters: it makes deploying to an unconfigured chain impossible rather than silently wrong.

### 5.2 Fund and deploy

Get Base Sepolia ETH from a faucet (Coinbase Developer Platform or Alchemy). Get Base Sepolia USDC from Circle's faucet (`https://faucet.circle.com`, select Base Sepolia).

```bash
cd packages/foundry
yarn account                                  # confirm testnet ETH landed
yarn deploy --network baseSepolia
```

Then verify:

```bash
yarn verify --network baseSepolia
```

Open the contract on `https://sepolia.basescan.org/address/<addr>#code`. You must see a green checkmark and your actual source. If verification fails here it will fail on mainnet — fix it now, while it's free. Usual causes: wrong compiler version, wrong optimizer runs, constructor args not ABI-encoded correctly.

### 5.3 Frontend on testnet

`packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.baseSepolia],
pollingInterval: 30000,          // 4000 is for localhost; on a real chain it burns RPC quota
alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
onlyLocalBurnerWallet: true,     // CRITICAL — see below
```

`onlyLocalBurnerWallet: true` means the burner wallet only appears on chain 31337. If it's `false`, your production site offers strangers a wallet whose key lives in their browser's localStorage, and they will lose funds. Confirm it, don't assume it.

`packages/nextjs/.env.local`:
```
NEXT_PUBLIC_ALCHEMY_API_KEY=<key>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<project id>
```

Then:

```bash
cd packages/nextjs
yarn next:check-types
yarn lint
yarn build          # must pass; Vercel runs this and will fail on type errors you've been ignoring
yarn start          # production build locally, not `yarn dev`
```

Deploy it:

```bash
yarn vercel          # from repo root; links the project, first deploy is a preview
```

Add the two `NEXT_PUBLIC_*` env vars in the Vercel dashboard for **all three** environments (Production, Preview, Development). A missing var in Production is the classic "works on preview, blank on prod" failure.

### 5.4 Full user journey on testnet — from a device you've never used

Use a phone on cellular data, with a wallet app you install fresh. This is the only way to catch the mobile/WalletConnect failures that never appear on your dev machine.

Walk through, and check each:

- [ ] Site loads over HTTPS on the Vercel URL.
- [ ] Wallet connects via WalletConnect from the phone.
- [ ] Connecting while on Ethereum mainnet shows a **"wrong network"** prompt and switching to Base Sepolia works.
- [ ] Balance displays as `12.50 USDC`, not `12500000` and not `0.0000000000125`. **This is the decimals bug**: `formatUnits(v, 6)` / `parseUnits(s, 6)`, never `formatEther`/`parseEther`. Grep for it: `grep -rn "parseEther\|formatEther" packages/nextjs/` — every hit near a USDC amount is a bug.
- [ ] Tipping 1.50 USDC prompts an **approve** tx first, then the **tip** tx.
- [ ] After approving once, a second tip does **not** re-prompt for approval (unless you approve exact amounts by design — decide which, and make the UI honest about it).
- [ ] Rejecting the approve in the wallet shows a clean error, not a hung spinner.
- [ ] Tipping more than your balance shows a useful message *before* the wallet prompt, not a raw revert after.
- [ ] Tipping `0` or empty is blocked by the UI.
- [ ] Tipping below `MIN_TIP` is blocked by the UI with an explanation, not a bare revert.
- [ ] Explorer links in the UI point at `sepolia.basescan.org` (i.e. they're chain-aware and will point at `basescan.org` on mainnet, not hardcoded).
- [ ] The Faucet button and Debug Contracts page do not appear (or are clearly dev-only).
- [ ] Hard refresh mid-flow doesn't corrupt state.

Now verify on-chain what the UI claims:

```bash
cast call <USDC_SEPOLIA> "balanceOf(address)(uint256)" <CREATOR> --rpc-url $BASE_SEPOLIA_RPC_URL
```

Tip exactly 100 USDC and assert the creator received exactly `99000000` and the fee side exactly `1000000`. **Check the integers, not the rendered UI.** The UI is the thing you're testing.

### 5.5 Soak

Leave it running for a few days. Tip a dozen times at odd amounts. Have a friend use it. Watch your Alchemy dashboard for request volume — extrapolate: if 1 idle user burns N requests/hour, what does 100 do against your plan's quota? Adjust `pollingInterval` accordingly.

**GATE 5:** Every box above checked, on a real phone. Exact-integer fee assertion passed on-chain. Verified source on Sepolia Basescan. Vercel production build green. No unexplained RPC error spikes over the soak period. Tag it:

```bash
git tag -a v0.1.0-rc1 -m "Base Sepolia rehearsal passed"
git push origin v0.1.0-rc1
```

---

## Phase 6 — Pre-mainnet freeze

The last off-ramp. Money is spent in Phase 7.

```bash
git checkout launch/base-mainnet
git status                        # clean
forge test                        # green
forge fmt --check
cd packages/nextjs && yarn next:check-types && yarn lint && yarn build
```

Final read-through of the deploy script. Both of you, separately, confirm:

- [ ] USDC address resolves to `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` for chain 8453.
- [ ] Fee recipient constructor arg == your Safe address, character by character. **Read it aloud to each other.** An address typo here sends 1% of all revenue to a black hole forever.
- [ ] Fee is 1% (100 bps) and the units are what you think (`100` in a bps system, not `1`).
- [ ] Initial owner is either the Safe directly, or the deployer with a Phase 7 handoff step. Pick one and know which.
- [ ] Contract starts **unpaused** (or know that you must unpause in Phase 7).
- [ ] No `console.log` / `console2` imports left in the contract (`grep -rn "console" packages/foundry/contracts/`).

Dry-run against a mainnet fork, which executes the real deploy script against real mainnet state without broadcasting:

```bash
anvil --fork-url $BASE_RPC_URL --port 8545 &
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast --unlocked --sender <deployer>
# then poke the deployed address with cast to sanity-check constructor state
kill %1
```

Fund the deployer with just enough ETH on Base — `0.01 ETH` is generous; Base deploys cost cents. Bridge via `https://bridge.base.org` or withdraw from a CEX directly to Base (cheaper and faster). **Send a 0.0005 ETH test transfer first and confirm it arrives** before sending the rest; a wrong-network CEX withdrawal is a bad way to start launch day.

```bash
cast balance <DEPLOYER> --rpc-url $BASE_RPC_URL
```

**GATE 6:** All boxes checked by both people independently. Fork dry-run deployed successfully and its constructor state reads back correct. Deployer funded on Base 8453. Nothing uncommitted.

---

## Phase 7 — Deploy to Base mainnet

```bash
cd packages/foundry
yarn deploy --network base
```

Record the address immediately — put it in your scratch doc and in Slack/wherever, so there's a timestamped record.

Verify the source **right now**, before anything else. An unverified contract is untrustworthy to users and undebuggable to you:

```bash
yarn verify --network base
```

Open `https://basescan.org/address/<addr>#code`. Green checkmark, your source, correct constructor args decoded in the "Constructor Arguments" section.

Now read the live contract state directly from chain — do not trust the deploy log:

```bash
cast call <CONTRACT> "usdc()(address)"          --rpc-url $BASE_RPC_URL
cast call <CONTRACT> "feeRecipient()(address)"  --rpc-url $BASE_RPC_URL
cast call <CONTRACT> "feeBps()(uint256)"        --rpc-url $BASE_RPC_URL
cast call <CONTRACT> "owner()(address)"         --rpc-url $BASE_RPC_URL
cast call <CONTRACT> "paused()(bool)"           --rpc-url $BASE_RPC_URL
```

Expected: real USDC, Safe address, `100`, owner (deployer or Safe), `false`.

### 7.1 Hand ownership to the Safe

If the deployer is still owner:

```bash
cast send <CONTRACT> "transferOwnership(address)" <SAFE> --rpc-url $BASE_RPC_URL --account scaffold-eth-custom
```

With `Ownable2Step`, the Safe must then **accept**. Do it now, from the Safe UI (Transaction Builder → `acceptOwnership()`), with both signers. Then confirm:

```bash
cast call <CONTRACT> "owner()(address)" --rpc-url $BASE_RPC_URL     # must equal the Safe
cast call <CONTRACT> "pendingOwner()(address)" --rpc-url $BASE_RPC_URL  # must be address(0)
```

**An un-accepted pending ownership means the deployer hot key still controls your contract.** Verify, don't assume.

### 7.2 First real transaction — you go first

Before any user touches it, tip yourself with real money.

```bash
# approve 1 USDC
cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "approve(address,uint256)" <CONTRACT> 1000000 \
  --rpc-url $BASE_RPC_URL --account scaffold-eth-custom

# tip 1 USDC to a creator address you control
cast send <CONTRACT> "tip(address,uint256)" <YOUR_CREATOR_ADDR> 1000000 \
  --rpc-url $BASE_RPC_URL --account scaffold-eth-custom
```

Then assert the arithmetic on the real chain:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <YOUR_CREATOR_ADDR> --rpc-url $BASE_RPC_URL
# expect +990000  (0.99 USDC)
cast call <CONTRACT> "accruedFees()(uint256)" --rpc-url $BASE_RPC_URL
# expect 10000    (0.01 USDC)
```

### 7.3 Prove you can pause

Before users, confirm your emergency brake actually works from the Safe. Propose `pause()` from the Safe UI, execute with both signers, confirm:

```bash
cast call <CONTRACT> "paused()(bool)" --rpc-url $BASE_RPC_URL   # true
```

Then `unpause()` the same way and confirm `false`.

This costs ten minutes and two small gas fees. It is the difference between having an incident response and having a wish. **If you discover during a live incident that pausing requires a signing flow you've never run, you will lose the funds you were trying to protect.**

**GATE 7:** Verified on Basescan. Owner == Safe, `pendingOwner` == zero. Self-tip moved exactly 990000/10000. Pause and unpause both executed successfully from the Safe. Contract currently unpaused.

---

## Phase 8 — Frontend to production

```bash
git add packages/nextjs/contracts/deployedContracts.ts
git commit -m "chore: Base mainnet deployment addresses"
```

That file is generated by the deploy script and is how the frontend finds your contract. **If it isn't committed, the Vercel build produces a frontend pointing at nothing.** Confirm it contains an `8453` key:

```bash
grep -n "8453" packages/nextjs/contracts/deployedContracts.ts
```

Flip the target network in `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.base],
pollingInterval: 30000,
onlyLocalBurnerWallet: true,
```

Ship it:

```bash
yarn next:check-types && yarn lint
cd packages/nextjs && yarn build && yarn start   # verify the prod build locally first
yarn vercel --prod
```

In the Vercel dashboard:
- Confirm both `NEXT_PUBLIC_*` vars are set on **Production**.
- Add your custom domain, wait for the certificate to issue, confirm `https://` with a valid cert.
- Confirm `NEXT_PUBLIC_IGNORE_BUILD_ERROR` is **not** set to `true`. It's a local-convenience escape hatch that ships broken code.

In the Reown/WalletConnect dashboard, add your production domain to the allowed origins. Missing this breaks mobile wallet connections **only in production** — the exact bug your preview testing cannot catch.

Update the site metadata (`packages/nextjs/utils/scaffold-eth/getMetadata.ts` and `app/layout.tsx`): real title, description, OG image, correct canonical URL. You're about to send this link to people; the preview card is the first thing they see.

Add two pages before real users arrive:
- **Terms + fee disclosure.** One paragraph stating plainly: 1% platform fee, non-custodial, no refunds, contract address linked to Basescan.
- **Support contact.** An email or a Telegram. When someone's tip gets stuck they need somewhere to go that isn't a tweet.

**GATE 8:** Repeat the entire Phase 5.4 checklist against the **production domain**, on a **phone on cellular**, with a **real wallet holding real USDC**. Tip 1 USDC to a creator address, confirm exact integers on Basescan. Both of you do this independently, from different devices and different wallets. Only after both pass does anyone else get the link.

---

## Phase 9 — Monitoring, before users not after

You cannot watch a chain by hand. Set these up now; each takes minutes.

1. **Basescan address watch** — email alert on every transaction to your contract and to the Safe. Free, instant, zero setup cost. Turn it on for both addresses.
2. **Tenderly** — import the contract, add alerts for: any **failed transaction** against your contract, and any call to `pause`/`unpause`/`transferOwnership`/`setFeeBps`. Failed-tx alerts are the highest-signal thing on this list: a cluster of reverts is a user-facing bug happening right now, and it's how you find out before the complaints do.
3. **Uptime check** on the production URL (UptimeRobot or Vercel's own). 5-minute interval.
4. **Alchemy usage alert** at 80% of your quota. Blowing through the quota silently degrades every user's experience into an infinite spinner, and looks like "the site is broken" — the failure mode you're least likely to reproduce yourself.
5. **Sentry** (or Vercel's error tracking) in the Next.js app, so frontend exceptions reach you.
6. **A saved Basescan/Dune query** for tip volume and accrued fees. You want a daily number you can eyeball.

Write a one-page incident runbook and put it where both of you can find it at 2am. It says:

> **If tips are reverting or funds look wrong:**
> 1. Propose `pause()` from the Safe: `https://app.safe.global` → Transaction Builder → `<CONTRACT>` → `pause()`.
> 2. Both sign and execute. Confirm with `cast call <CONTRACT> "paused()(bool)"`.
> 3. Post to the site banner and support channel: "Tipping paused while we investigate. No funds are at risk — the contract holds only accrued platform fees."
> 4. Diagnose with Tenderly's trace on the failing tx.
> 5. Do not unpause until the failing case has a passing regression test in `forge test`.

**GATE 9:** All six alerts configured and each **test-fired** — trigger a failing transaction on purpose and confirm the alert actually reaches your phone. An alert you've never seen fire is not monitoring.

---

## Phase 10 — Soft launch

Do not post the link publicly yet.

**Day 1 — 5 users.** People you know, who will tell you when something is confusing. Ask each for their real reaction to: the approve step (two wallet prompts is the #1 drop-off point), whether the 1% fee was clear before they confirmed, and whether they knew what to do after tipping.

Check daily for the first week:

```bash
cast call <CONTRACT> "accruedFees()(uint256)" --rpc-url $BASE_RPC_URL
```

Reconcile against the contract's actual USDC balance:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <CONTRACT> --rpc-url $BASE_RPC_URL
```

If you push to creators and accrue fees, **these two numbers must be equal.** A divergence means either accounting drift (a bug) or someone sent USDC directly to the contract (harmless but worth knowing). Check this manually every day for a week; it's the invariant from Phase 1 running against production.

Also watch: your failed-transaction rate in Tenderly. A few reverts are normal (users rejecting prompts, insufficient allowance). A rising rate, or reverts clustered on one code path, is a bug.

**Day 3–7 — 25 users.** Widen. Withdraw fees once via the Safe to prove that path works end to end with real money, before there's a meaningful amount at stake.

**Day 7+ — public.** Only after: a week with no unexplained reverts, the balance invariant holding every day, and at least one successful fee withdrawal through the Safe.

**GATE 10:** Seven consecutive days where accrued fees == contract balance, no unexplained failed transactions, and one completed Safe fee withdrawal. Then post the link.

---

## Post-launch hygiene

- Drain the deployer key to near-zero. It should hold dust and nothing else. It is now only a historical artifact.
- Tag the release: `git tag -a v1.0.0 -m "Base mainnet launch" && git push origin v1.0.0`.
- Record in the repo README: contract address, Basescan link, Safe address, deploy commit hash, deploy date.
- Rotate the Alchemy and WalletConnect keys if they were ever pasted into a chat, a screenshot, or a terminal you shared.
- Set a calendar reminder for one week out to re-run the balance invariant check and re-read your Tenderly alert history.

---

## The five things most likely to actually bite you

Ranked by probability × damage, specific to this app:

1. **Decimals.** USDC is 6, everything in your Ethereum muscle memory is 18. A single `parseEther` in a tip form charges a user 1,000,000,000,000× what they meant. Caught by: GATE 5.4's exact-integer assertion, and `grep -rn "parseEther\|formatEther" packages/nextjs/`.
2. **Fee recipient typo.** An address with no code on Base silently swallows 1% of all revenue forever. Caught by: GATE 6's read-aloud check, plus `cast code` on the Safe in GATE 4.
3. **Ownership never actually transferred.** With `Ownable2Step`, `transferOwnership` alone leaves the hot deployer key in control. Caught by: GATE 7's `owner()` and `pendingOwner()` reads.
4. **Approve UX.** Two wallet prompts, and most users have never seen an ERC-20 approve. Half of them will abandon at the first one. Not a bug — a conversion problem you must design for and measure. Caught by: GATE 10's day-1 user feedback.
5. **Missing production env var or WalletConnect origin.** Works perfectly on your machine and on Vercel preview; blank page or dead connect button for every real user. Caught by: GATE 8's test from an outside device on cellular.

Notice that four of five are caught by gates and not by code review. That's the point of the gates. Don't skip them because the previous one passed.
