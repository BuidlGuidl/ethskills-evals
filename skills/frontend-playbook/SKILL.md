---
name: frontend-playbook
description: The complete build-to-production pipeline for Ethereum dApps. Fork mode setup, IPFS deployment, Vercel config, ENS subdomain setup, and the full production checklist. Built around Scaffold-ETH 2 but applicable to any Ethereum frontend project. Use when deploying any dApp to production.
---

# Frontend Playbook

## What You Probably Got Wrong

**"I'll use `yarn chain` for everything."** Only if nothing you are building touches deployed state. `yarn chain` gives you an empty local chain — no protocols, no tokens, no balances — which is the right tool for isolated contracts and unit tests. The moment behavior depends on real Uniswap, Aave, USDC or whale balances, `yarn fork --network base` is the only thing that will show you the truth (verified addresses: `addresses/SKILL.md`). Choose deliberately; do not default to either.

**"I deployed to IPFS and it works."** Did the CID change? An unchanged CID means the bytes you uploaded were identical — so either the build did not pick up your change or you uploaded the wrong directory. Did routes work? Without `trailingSlash: true`, every route except `/` returns 404. Did you check the OG image? Without `NEXT_PUBLIC_PRODUCTION_URL`, it points to `localhost:3000`.

**"I'll set up the project manually."** Don't, unless the user asked for a specific other stack. For a conventional contract-plus-frontend dApp, `npx create-eth@2.0.23` handles everything — Foundry, Next.js, RainbowKit, scaffold hooks. Don't run `forge init` or hand-roll a Next.js project when the generator covers it.

---

## Fork Mode Setup

### Choosing Chain vs Fork

```
yarn chain                      yarn fork --network base
└─ Empty local chain            └─ Fork of real Base mainnet
└─ No protocols                 └─ Uniswap, Aave, etc. available
└─ No tokens                    └─ Real USDC, WETH exist
└─ Isolated contracts, unit     └─ Integration against REAL
   tests, mocks                    deployed state
```

Use `yarn chain` when the code under test is self-contained. Use `yarn fork --network <chain>` when behavior depends on deployed protocols, tokens, balances, or any other real chain state.

### Setup

```bash
npx create-eth@2.0.23          # Tested version; update deliberately
cd <project-name>
yarn install
yarn fork --network base       # Terminal 1: fork of real Base
yarn deploy                    # Terminal 2: deploy contracts to fork
yarn start                     # Terminal 3: Next.js frontend
```

### Critical: Chain ID Gotcha

**When using fork mode, the frontend target network MUST be `chains.foundry` (chain ID 31337), NOT the chain you're forking.**

The fork runs locally on Anvil with chain ID 31337. Even if you're forking Base:

```typescript
// scaffold.config.ts during development
targetNetworks: [chains.foundry],  // ✅ NOT chains.base!
```

Only switch to `chains.base` when deploying contracts to the REAL network.

### Fork Powers — Fund Demo Identities from Real State

A fork grants powers the real chain does not. When a demo needs token balances, take them from a holder that already exists instead of deploying a mock token:

```bash
cast rpc anvil_impersonateAccount <whale>
cast send <token> "transfer(address,uint256)" <demo-account> <amount> \
  --from <whale> --unlocked
```

`anvil_setBalance` and `anvil_setStorageAt` are equivalent overrides when no suitable holder exists. Nothing here is broadcast — the fork is a local copy, so no real money is at risk.

### Block Mining

Anvil mines only when a transaction arrives, so between transactions the latest block and `block.timestamp` stay frozen and the next transaction advances time in one jump. Any live deadline, expiry or vesting display breaks silently even when `vm.warp` unit tests pass.

```bash
# In a new terminal — for anything with a running clock
cast rpc anvil_setIntervalMining 1
```

**Make it permanent** by editing `packages/foundry/package.json` to add `--block-time 1` to the fork script.

Manual mining is a different tool, not a lesser one: `evm_mine` restamps `block.timestamp` once and it freezes again immediately, and `evm_increaseTime` jumps the clock on demand. Both are correct for controlled single-step tests. Neither is a substitute for interval mining under a running demo.

---

## Deploying to IPFS (Recommended)

IPFS is the recommended deploy path for SE2. Avoids Vercel's memory limits entirely. Produces a fully decentralized static site.

### Full Build Command

```bash
cd packages/nextjs
rm -rf .next out  # ALWAYS clean first

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

# Upload to BuidlGuidl IPFS
yarn bgipfs upload out
# Save the CID!
```

### Node 25+ Web Storage Crash (REQUIRED reading)

Node.js 25 exposes a built-in `localStorage` global. With no backing file configured it exists as an object but without the standard Web Storage methods, so libraries that feature-detect it — `next-themes`, RainbowKit, anything calling `localStorage.getItem()` — find a truthy global and then crash on the call during static page generation.

**Error you'll see:**
```
TypeError: localStorage.getItem is not a function
Error occurred prerendering page "/_not-found"
```

**The fix must reach the build workers.** Next.js spawns separate Node processes for prerendering. A polyfill in `next.config.ts` runs only in the main process, and `instrumentation.ts` does not run in the build worker at all. Only a process-level remedy — one carried by `NODE_OPTIONS`, which every child process inherits — actually applies. Any of these work:

```bash
NODE_OPTIONS="--no-experimental-webstorage"          # Removes the global; pre-25 behavior
NODE_OPTIONS="--localstorage-file=.node-localstorage" # Gives it a real, working store
NODE_OPTIONS="--require ./polyfill-localstorage.cjs"  # Injects a shim into every process
```

`--no-experimental-webstorage` is the simplest: it makes `localStorage` undefined again, which is the case every SSR-aware library already guards for. Use `--localstorage-file` when something genuinely wants a working store during the build. The `--require` shim is the portable option if you need it to work across Node versions:

```javascript
// packages/nextjs/polyfill-localstorage.cjs
if (typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem !== "function") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
}
```

Dealing with the crash-prone pages directly — see the block explorer note below — is also a valid fix, and the right one when you did not want those pages in the export anyway.

### IPFS Routing — Why Routes Break

IPFS gateways serve static files. No server handles routing. Three things MUST be true:

**1. `output: "export"` in next.config.ts** — generates static HTML files.

**2. `trailingSlash: true` (CRITICAL)** — This is the #1 reason routes break:
- `trailingSlash: false` (default) → generates `debug.html`
- `trailingSlash: true` → generates `debug/index.html`
- IPFS gateways resolve directories to `index.html` automatically, but NOT bare filenames
- Without trailing slash: `/debug` → 404 ❌
- With trailing slash: `/debug` → `debug/` → `debug/index.html` ✅

**3. Pages must survive static prerendering** — any page that crashes during `yarn build` (browser APIs at import time, localStorage) gets skipped silently → 404 on IPFS.

**The complete IPFS-safe next.config.ts pattern:**
```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";
if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

**SE2's block explorer pages** use `localStorage` at import time and crash during static export. Rename `app/blockexplorer` to `app/_blockexplorer-disabled` if not needed.

### Stale Build Detection

**The #1 IPFS footgun:** You edit code, then deploy the OLD build.

```bash
# MANDATORY after ANY code change:
rm -rf .next out                     # 1. Delete old artifacts
# ... run full build command ...     # 2. Rebuild from scratch
grep -l "YOUR_STRING" out/_next/static/chunks/app/*.js  # 3. Verify changes present

# Timestamp check:
stat -c '%y' app/page.tsx            # Source modified time
stat -c '%y' out/                    # Build output time
# Source NEWER than out/ = STALE BUILD. Rebuild first!
```

**What the CID proves:** the CID is a hash of the bytes you uploaded. An unchanged CID after a deploy means those bytes were identical to last time — it does *not* by itself say which step failed. Diagnose with evidence rather than guessing: `grep` the new string in `out/_next` to see whether the build picked the change up, and check which directory you handed the uploader. Build did not rebuild, or you uploaded the wrong path — the grep tells you which.

### Verify Routes After Deploy

```bash
ls out/*/index.html                  # Each route has a directory + index.html
curl -s -o /dev/null -w "%{http_code}" -L "https://GATEWAY/ipfs/CID/debug/"
# Should return 200, not 404
```

---

## Deploying to Vercel (Alternative)

SE2 is a monorepo — Vercel needs special configuration.

### Configuration

1. **Root Directory:** `packages/nextjs`
2. **Install Command:** `cd ../.. && yarn install`
3. **Build Command:** leave default (`next build`)
4. **Output Directory:** leave default (`.next`)

```bash
# Via API:
curl -X PATCH "https://api.vercel.com/v9/projects/PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory": "packages/nextjs", "installCommand": "cd ../.. && yarn install"}'
```

### Common Failures

| Error | Cause | Fix |
|-------|-------|-----|
| "No Next.js version detected" | Root Directory not set | Set to `packages/nextjs` |
| "cd packages/nextjs: No such file" | Build command has `cd` | Clear it — root dir handles this |
| OOM / exit code 129 | SE2 monorepo exceeds 8GB | Use IPFS instead, or `vercel --prebuilt` |

### Decision Tree

```
Want to deploy SE2?
├─ IPFS (recommended) → yarn ipfs / manual build + upload
│   └─ Fully decentralized, no memory limits, works with ENS
├─ Vercel → Set rootDirectory + installCommand
│   └─ Fast CDN, but centralized. May OOM on large projects
└─ vercel --prebuilt → Build locally, push artifacts to Vercel
    └─ Best of both: local build power + Vercel CDN
```

---

## ENS Subdomain Setup

Two mainnet transactions to point an ENS subdomain at your IPFS deployment.

### Transaction 1: Create Subdomain (new apps only)

1. Open `https://app.ens.domains/yourname.eth`
2. Go to "Subnames" tab → "New subname"
3. Enter the label (e.g. `myapp`) → Next → Skip profile → Open Wallet → Confirm
4. If gas is stuck: switch MetaMask to Ethereum → Activity tab → "Speed up"

### Transaction 2: Set IPFS Content Hash

1. Navigate to `https://app.ens.domains/myapp.yourname.eth`
2. "Records" tab → "Edit Records" → "Other" tab
3. Paste in Content Hash field: `ipfs://<CID>`
4. Save → Open Wallet → Confirm in MetaMask

For **updates** to an existing app: skip Tx 1, only do Tx 2.

Set the content hash only after the deployed CID has been reviewed and approved.

### Verify

```bash
# 1. Onchain content hash matches
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $(cast namehash myapp.yourname.eth) \
  --rpc-url https://eth.llamarpc.com)
cast call $RESOLVER "contenthash(bytes32)(bytes)" \
  $(cast namehash myapp.yourname.eth) --rpc-url https://eth.llamarpc.com

# 2. Gateway responds (may take 5-15 min for cache)
curl -s -o /dev/null -w "%{http_code}" -L "https://myapp.yourname.eth.link"

# 3. OG metadata correct (not localhost)
curl -s -L "https://myapp.yourname.eth.link" | grep 'og:image'
```

**Use `.eth.link` NOT `.eth.limo`** — `.eth.link` works better on mobile.

---

## Go to Production — Complete Checklist

When the user says "ship it", follow this EXACT sequence.

### Step 1: Final Code Review 🤖
- All feedback incorporated
- No duplicate h1, no raw addresses, no shared isLoading
- `scaffold.config.ts` has `rpcOverrides` and `pollingInterval: 3000`

### Step 2: Choose Domain 👤
Ask: *"What subdomain do you want? e.g. `myapp.yourname.eth` → `myapp.yourname.eth.link`"*

### Step 3: Generate OG Image + Fix Metadata 🤖
- Create 1200×630 PNG (`public/thumbnail.png`) — NOT the stock SE2 thumbnail
- Set `NEXT_PUBLIC_PRODUCTION_URL` to the live domain
- Verify `og:image` will resolve to an absolute production URL

### Step 4: Clean Build + IPFS Deploy 🤖
```bash
cd packages/nextjs && rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://myapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

# Verify before uploading:
ls out/*/index.html                        # Routes exist
grep 'og:image' out/index.html             # Not localhost
stat -c '%y' app/page.tsx                  # Source older than out/
stat -c '%y' out/

yarn bgipfs upload out                     # Save the CID
```

### Step 5: Share for Approval 👤
Send: *"Build ready for review: `https://community.bgipfs.com/ipfs/<CID>`"*
**Wait for approval before touching ENS.**

### Step 6: Set ENS 🤖
Create subdomain (if new) + set IPFS content hash. Two mainnet transactions.

### Step 7: Verify 🤖
- Content hash matches onchain
- `.eth.link` gateway responds with 200
- OG image loads correctly
- Routes work (`/debug/`, etc.)

### Step 8: Report 👤
*"Live at `https://myapp.yourname.eth.link` — ENS content hash confirmed onchain, unfurl metadata set."*

---

## Build Verification Process

A build is NOT done when the code compiles. It's done when you've tested it like a real user.

### Phase 1: Code QA (Automated)
- Scan `.tsx` files for raw address strings (should use `<Address/>`)
- Scan for shared `isLoading` state across multiple buttons
- Scan for missing `disabled` props on transaction buttons
- Verify RPC config and polling interval
- Verify OG metadata with absolute URLs
- Verify no public RPCs in any file

### Phase 2: Smart Contract Testing
```bash
forge test                    # All tests pass
forge test --fuzz-runs 10000  # Fuzz testing
```
Test edge cases: zero amounts, max amounts, unauthorized callers, reentrancy attempts.

### Phase 3: Browser Testing (THE REAL TEST)

Open the app and do a FULL walkthrough:

1. **Load the app** — does it render correctly?
2. **Check page title** — is it correct, not "Scaffold-ETH 2"?
3. **Connect wallet** — does the connect flow work?
4. **Wrong network** — connect on wrong chain, verify "Switch to Base" appears
5. **Switch network** — click the switch button, verify it works
6. **Approve flow** — verify approve button shows, click it, wait for tx, verify action button appears
7. **Main action** — click primary action, verify loader, wait for tx, verify state updates
8. **Error handling** — reject a transaction in wallet, verify UI recovers
9. **Address displays** — all addresses showing ENS/blockies, not raw hex?
10. **Share URL** — check OG unfurl (image, title, description)

### Phase 4: QA Sub-Agent (Complex Builds)
For bigger projects, spawn a sub-agent with fresh context. Give it the repo path and deployed URL. It reads all code against the UX rules, opens a browser, clicks through independently, and reports issues.

---

## Don't Do These

- ❌ `yarn chain` when the work depends on deployed state — use `yarn fork --network <chain>`
- ❌ A mock token on a fork when a real holder exists — impersonate and transfer
- ❌ `forge init` for a conventional dApp — use `npx create-eth@<pinned version>`
- ❌ `create-eth@latest` in anything you want reproducible — pin the tested version
- ❌ Manual Next.js setup — SE2 handles it
- ❌ Manual wallet connection — SE2 has RainbowKit pre-configured
- ❌ Edit `deployedContracts.ts` — it's auto-generated by `yarn deploy`
- ❌ Hardcode API keys in `scaffold.config.ts` — use `.env.local`
- ❌ Use `mainnet.base.org` in production — use Alchemy or similar
- ❌ A Node 25 localStorage fix in `next.config.ts` or `instrumentation.ts` — it never reaches the build worker

---

## Resources

- **SE2 Docs:** https://docs.scaffoldeth.io/
- **UI Components:** https://ui.scaffoldeth.io/
- **SpeedRun Ethereum:** https://speedrunethereum.com/
- **ETH Tech Tree:** https://www.ethtechtree.com
- **BuidlGuidl IPFS:** https://upload.bgipfs.com
