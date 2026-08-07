# Deploying the USDC Tip Jar (static site on IPFS)

The site ships as a **static export** hosted on IPFS. There is no server. This document
lists the exact commands to **build**, **upload**, and **verify** a production deploy that
targets **Base mainnet**.

> These commands publish a real site and (in step 0) a real contract that spends real ETH
> for gas. Run them only when you actually intend to ship.

---

## Production build configuration (already wired)

| File | Behaviour when `NEXT_PUBLIC_IPFS_BUILD=true` |
| --- | --- |
| `packages/nextjs/next.config.ts` | `output: "export"`, `trailingSlash: true`, unoptimized images → static `out/` |
| `packages/nextjs/scaffold.config.ts` | `targetNetworks = [base]` (chain id 8453) |
| `packages/nextjs/contracts/externalContracts.ts` | Base USDC ABI + Base `TipJar` at `NEXT_PUBLIC_TIPJAR_ADDRESS` |

Two required inputs:

- **Node 20 or 22.** The static export prerenders pages in Node; Node ≥ 23 crashes on a
  global `localStorage` reference. Use `nvm use 22` before building.
- **`NEXT_PUBLIC_TIPJAR_ADDRESS`** — the TipJar address on Base (from step 0). The build
  bakes this in; the frontend reads it for chain id 8453.

---

## 0. Deploy `TipJar` to Base mainnet

```bash
# One-time: create (or import) a funded deployer keystore. Do NOT use the default account.
yarn generate                 # or: yarn account:import
yarn account                  # confirm the address is funded with Base ETH for gas

# Deploy the jar (constructor uses canonical Base USDC).
yarn deploy --file DeployTipJar.s.sol --network base
```

Grab the deployed address from the command output or from
`packages/foundry/deployments/8453.json`, and export it for the build:

```bash
export NEXT_PUBLIC_TIPJAR_ADDRESS=0x<your-deployed-tipjar-on-base>
```

---

## 1. Build the static site (no upload)

```bash
nvm use 22
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_TIPJAR_ADDRESS=$NEXT_PUBLIC_TIPJAR_ADDRESS yarn next:build
```

Output: `packages/nextjs/out/` — a fully static, relative-path site (`index.html`,
`_next/…`). Sanity-check it locally before uploading:

```bash
grep -q "USDC Tip Jar" out/index.html && echo "OK: homepage rendered"
npx serve out            # optional: open http://localhost:3000 and click around
```

---

## 2. Upload to IPFS

The repo bundles [`bgipfs`](https://bgipfs.com). Upload the already-built `out/`:

```bash
cd packages/nextjs
yarn bgipfs upload config init -u https://upload.bgipfs.com   # first time only
yarn bgipfs upload out
# → prints "CID: <cid>"; export it for verification:
export CID=<cid-from-output>
```

Alternatives (pick one, all produce a CID for the same `out/`):

```bash
# Kubo (local IPFS node)
ipfs add -r --cid-version 1 out

# Pinning service (e.g. Pinata) via their CLI/API — pin the out/ directory
```

> `yarn ipfs` is an all-in-one shortcut that **builds *and* uploads** in one step
> (`NEXT_PUBLIC_TIPJAR_ADDRESS=0x… yarn ipfs`). Use the split steps above when you want to
> inspect the build before publishing.

---

## 3. Post-deploy verification

**a. The site loads from a public gateway and is fully static:**

```bash
curl -sL "https://community.bgipfs.com/ipfs/$CID/" | grep -q "USDC Tip Jar" && echo "OK: served from IPFS"
# No absolute localhost/server URLs should appear in the export:
! grep -rql "http://localhost" out/_next && echo "OK: no localhost references"
```

Open `https://community.bgipfs.com/ipfs/$CID/` (or `ipfs://$CID`) in a browser.

**b. The baked-in Base contracts are correct:**

```bash
BASE=https://mainnet.base.org
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# TipJar points at canonical Base USDC:
cast call $NEXT_PUBLIC_TIPJAR_ADDRESS "token()(address)" --rpc-url $BASE   # → $USDC
cast call $NEXT_PUBLIC_TIPJAR_ADDRESS "owner()(address)" --rpc-url $BASE   # → your deployer
```

**c. Verify the source on Basescan** (optional but recommended):

```bash
yarn verify --network base
# or: forge verify-contract $NEXT_PUBLIC_TIPJAR_ADDRESS TipJar --chain base --watch
```

**d. End-to-end smoke test (spends a small real amount):** connect a Base wallet on the
IPFS-hosted site, approve + send a minimal USDC tip, and confirm it appears in the feed and
that `cast call $NEXT_PUBLIC_TIPJAR_ADDRESS "totalTipped()(uint256)" --rpc-url $BASE`
increased.

---

## Notes

- The Base `TipJar` address comes from `NEXT_PUBLIC_TIPJAR_ADDRESS` via
  `externalContracts.ts`. Because external contracts override generated ones, this env var is
  the single source of truth for the production address even if you also deployed from this
  repo — always build with it set.
- To roll a new frontend without redeploying the contract, rebuild (step 1) and re-upload
  (step 2); the CID changes, the contract address does not.
