# Deploying the Tip Jar site to IPFS

The frontend ships as a **static export** hosted on IPFS. There is no server —
`next build` with `output: "export"` produces a folder of static files
(`packages/nextjs/out/`) that any IPFS pinning service can serve.

This document lists the exact **build**, **upload**, and **post-deploy
verification** commands. It does **not** upload anything for you.

## 0. Prerequisites

- **Node 20 or 22 LTS** — run `nvm use` (an `.nvmrc` pins `22`). ⚠️ Node ≥ 23
  defines a global `localStorage` that crashes the static prerender. Verified on
  Node 22.2.0.
- `yarn install` has been run.
- Foundry installed (for the contract deployment step).

The IPFS build is switched on by `NEXT_PUBLIC_IPFS_BUILD=true`, which makes
`packages/nextjs/next.config.ts` set:

- `output: "export"` — emit a static `out/` folder
- `trailingSlash: true` — every route becomes `route/index.html` so IPFS gateways resolve directory paths
- `images.unoptimized: true` — no image optimization server

The target chain lives in `packages/nextjs/scaffold.config.ts` (`targetNetworks`).
It is a compile-time value the scaffold derives contract types from, so it must
be a single concrete network — you set it once for the production build (step 2),
not via an env var.

---

## 1. Deploy the contract to Base mainnet

The static site reads the TipJar address from
`packages/nextjs/contracts/deployedContracts.ts`. That file is regenerated per
network at deploy time, so **you must deploy to Base before building the
production site** — otherwise the build has no `TipJar` entry for chain `8453`.

```bash
# One-time: create/import a funded deployer keystore
yarn account:import        # or: yarn generate

# Deploy TipJar (pointed at Base USDC) to Base mainnet
yarn deploy --network base --keystore <your-keystore>
```

This writes the Base (`8453`) `TipJar` entry into `deployedContracts.ts`.

Verify the deployment before building:

```bash
BASE_RPC=https://mainnet.base.org
JAR=<address printed by yarn deploy>            # also in deployedContracts.ts under 8453
cast call $JAR "usdc()(address)" --rpc-url $BASE_RPC
# -> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  (Base USDC)
cast call $JAR "owner()(address)" --rpc-url $BASE_RPC
```

---

## 2. Build the static site

First point the frontend at Base mainnet. In
`packages/nextjs/scaffold.config.ts` set:

```ts
targetNetworks: [chains.base],   // was [chains.foundry] for local demos
```

Then build:

```bash
nvm use    # Node 22

# Static export for IPFS (output: "export")
NEXT_PUBLIC_IPFS_BUILD=true yarn next:build
```

Output lands in `packages/nextjs/out/`. Sanity-check it locally before
uploading:

```bash
# Every route is a directory with an index.html
ls packages/nextjs/out/tipjar/index.html packages/nextjs/out/index.html

# Serve the exact static bundle and click through /tipjar
npx serve packages/nextjs/out
# open http://localhost:3000/tipjar
```

> The identical export pipeline is what runs for the local fork build
> (`targetNetworks: [chains.foundry]` + `NEXT_PUBLIC_IPFS_BUILD=true yarn
> next:build`). It has been verified to emit `/tipjar` as a static page.

---

## 3. Upload to IPFS

Pick one. **Run these yourself — this repo does not upload during CI or build.**

### Option A — the built-in `yarn ipfs` script (build + upload via bgipfs)

```bash
# With targetNetworks set to [chains.base] (step 2), this builds with
# NEXT_PUBLIC_IPFS_BUILD=true and uploads out/ to a public bgipfs gateway.
yarn ipfs
# -> prints: 🚀 Upload complete! ... https://community.bgipfs.com/ipfs/<CID>
```

### Option B — upload the already-built `out/` with the IPFS CLI (Kubo)

```bash
CID=$(ipfs add -Q -r packages/nextjs/out)
echo "Root CID: $CID"
```

### Option C — a pinning service (Pinata / web3.storage / Filebase)

Upload the `packages/nextjs/out` folder through the service's CLI or dashboard
and note the returned **root CID**.

Whichever you use, the deliverable is the **root CID** of the `out/` directory.

---

## 4. Post-deploy verification

Replace `<CID>` with the root CID from step 3.

```bash
# 1. The pinned bundle resolves and the tip jar route exists on a public gateway
curl -sfI "https://ipfs.io/ipfs/<CID>/tipjar/index.html" | head -1        # -> HTTP/2 200
curl -sfI "https://<CID>.ipfs.dweb.link/tipjar/"          | head -1        # -> HTTP/2 200

# 2. The HTML actually rendered the app (not an error page)
curl -sf "https://ipfs.io/ipfs/<CID>/tipjar/" | grep -o "USDC Tip Jar"     # -> USDC Tip Jar

# 3. The content is pinned somewhere (survives your local node going away)
ipfs pin ls --type=recursive | grep <CID>                                  # if self-pinning
#    or confirm the "pinned" status in your pinning service dashboard

# 4. Load https://ipfs.io/ipfs/<CID>/tipjar/ in a browser, connect a wallet on
#    Base, and confirm the tip feed loads and the contract address shown matches
#    the Base deployment from step 1.
```

Optionally set a stable name so the CID can change on each redeploy:

```bash
ipfs name publish /ipfs/<CID>        # IPNS
# or point a DNSLink TXT record: _dnslink.tips.example.com -> dnslink=/ipfs/<CID>
```
