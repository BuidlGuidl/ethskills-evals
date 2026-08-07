# Production deploy — static site on IPFS + TipJar on Base

Production is a **static export** of the frontend, pinned to **IPFS**, talking to a
**TipJar deployed on Base mainnet** (chain id `8453`). There is no server.

> ⚠️ This document lists the exact commands. Running the IPFS upload **publishes the
> build publicly** and deploying to Base **spends real ETH and moves real USDC** — only
> run those steps intentionally, with a funded deployer you control.

---

## 0. Prerequisites

- A deployer account with a little ETH on Base (for the contract deploy + gas).
- A Base RPC URL (public `https://mainnet.base.org` works; a dedicated RPC is better).
- API keys for the production frontend (recommended, not required for the build to run):
  - `NEXT_PUBLIC_ALCHEMY_API_KEY`
  - `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `BASESCAN`/Etherscan v2 API key for contract verification (`ETHERSCAN_API_KEY`).

---

## 1. Deploy the TipJar to Base

Set up a deployer keystore (skip if you already have one):

```bash
yarn generate            # creates a new encrypted keystore, OR
yarn account:import      # import an existing private key
yarn account             # print the deployer address + balances — fund it with Base ETH
```

Deploy and export the ABI/address into the frontend:

```bash
yarn deploy --network base
```

This writes the deployed address into
`packages/nextjs/contracts/deployedContracts.ts` under chain id **8453**, so the
production frontend can find it. Note the printed `TipJar` address.

### Verify the contract on Basescan

```bash
# from packages/foundry — TipJar takes (IERC20 usdc, address owner)
cd packages/foundry
forge verify-contract <TIPJAR_ADDRESS> contracts/TipJar.sol:TipJar \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address)" \
      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 <OWNER_ADDRESS>) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --watch
cd ../..
```

---

## 2. Build the static site (targets Base)

The build is driven entirely by env vars — no code edits:

- `NEXT_PUBLIC_IPFS_BUILD=true` → `next.config.ts` switches to `output: "export"`,
  `trailingSlash: true`, and unoptimized images (all required for IPFS).
- `NEXT_PUBLIC_TARGET_NETWORK=base` → the app targets Base mainnet (`8453`) instead of the
  local fork.

Build only (produces `packages/nextjs/out/`, uploads nothing):

```bash
NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_TARGET_NETWORK=base \
NEXT_PUBLIC_ALCHEMY_API_KEY=<key> \
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<id> \
yarn workspace @se-2/nextjs build
```

Sanity-check the output before uploading:

```bash
ls packages/nextjs/out/index.html          # must exist
npx serve packages/nextjs/out              # optional: preview at http://localhost:3000
```

Because the export uses `trailingSlash` and relative assets, it works from any IPFS
gateway subpath.

---

## 3. Upload to IPFS

Pick one. **Neither is run automatically — run it when you're ready to publish.**

### Option A — one shot (build + upload) with bgipfs

```bash
# builds with NEXT_PUBLIC_IPFS_BUILD=true and uploads packages/nextjs/out
NEXT_PUBLIC_TARGET_NETWORK=base yarn ipfs
```

This prints the resulting CID and a gateway URL like
`https://community.bgipfs.com/ipfs/<CID>`.

### Option B — upload an already-built `out/` yourself

```bash
cd packages/nextjs
yarn bgipfs upload config init -u https://upload.bgipfs.com   # first time only
yarn bgipfs upload out
# -> prints "CID: <CID>"
cd ../..
```

Or with a local Kubo node / a pinning service (Pinata, web3.storage, …):

```bash
ipfs add -r --cid-version 1 packages/nextjs/out   # the root CID is the last line
```

**Record the CID** — that is your immutable site version.

---

## 4. Post-deploy verification

Run these after uploading. Replace `<CID>` and `<TIPJAR_ADDRESS>`.

```bash
# 1. The site is retrievable from IPFS and returns the app HTML (HTTP 200).
curl -sI "https://<CID>.ipfs.dweb.link/" | head -n 1
curl -s  "https://<CID>.ipfs.dweb.link/" | grep -o "USDC Tip Jar"

# 2. A second gateway resolves the same CID (content is really pinned/propagated).
curl -sI "https://ipfs.io/ipfs/<CID>/" | head -n 1

# 3. The TipJar exists on Base and points at the right USDC token.
cast call <TIPJAR_ADDRESS> "token()(address)"  --rpc-url https://mainnet.base.org
# expect: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
cast call <TIPJAR_ADDRESS> "owner()(address)"  --rpc-url https://mainnet.base.org

# 4. Frontend is wired to the same address the app will call.
grep -A2 '"8453"' packages/nextjs/contracts/deployedContracts.ts | grep -i address
```

Then, in a browser pointed at `https://<CID>.ipfs.dweb.link/`:

- The page loads, styles/blockies render (assets resolved over IPFS).
- Connecting a wallet on **Base** shows your USDC balance.
- A small real tip goes through (`approve` → `tip`) and appears in the feed; the
  transaction is visible on https://basescan.org.
- The owner’s **Withdraw** button transfers collected USDC to the owner.

---

## Updating the site later

IPFS content is immutable — any change produces a **new CID**. Rebuild (step 2), re-upload
(step 3), and re-verify (step 4). If you front the site with IPNS or a DNSLink domain,
repoint it at the new CID so the human-friendly URL always serves the latest build.
