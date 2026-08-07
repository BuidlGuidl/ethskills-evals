# DEPLOY.md — ship the USDC Tip Jar as a static IPFS site

The frontend ships as a **static export** pinned to IPFS (no server, no Vercel). This file
lists the exact commands for the production build, the IPFS upload, and post-deploy
verification. Run everything from `packages/nextjs` unless noted.

> Local development/demo runs against a **Base fork** (chain `31337`) — see
> [`README.md`](./README.md). The steps below are for the **real Base mainnet** production
> site (chain `8453`).

---

## 0. Prerequisites

- `yarn install` at the repo root.
- The IPFS build is verified on **Node 25** via `packages/nextjs/polyfill-localstorage.cjs`
  (Node 25 ships a broken global `localStorage` that otherwise crashes static prerendering).
  Node 20/22 also work.
- Already configured in this repo, no change needed:
  - `next.config.ts` — sets `output: "export"`, `trailingSlash: true`, `images.unoptimized`
    when `NEXT_PUBLIC_IPFS_BUILD=true` (trailing slash is required or every route 404s on IPFS).
  - `scaffold.config.ts` — `pollingInterval: 3000`.
  - `public/thumbnail.png` — 1200×630 Open Graph image.

## 1. Point the frontend at Base mainnet

For the local demo the app targets the fork (`chains.foundry`). For production, edit
`packages/nextjs/scaffold.config.ts`:

```ts
// targetNetworks: [chains.foundry],           // local fork (dev)
targetNetworks: [chains.base],                 // production: Base mainnet (chain 8453)

rpcOverrides: {
  [chains.base.id]: "https://base-mainnet.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>",
},
```

Use a dedicated RPC (Alchemy/Infura/BuidlGuidl) — **not** the public `mainnet.base.org` — for
production reliability.

## 2. Deploy the contract to Base mainnet

Only needed once (or when the contract changes). Requires a funded deployer keystore
(`yarn account:import` or `yarn generate`). This is the only step that spends real gas; the
deployer becomes the jar **owner**.

```bash
yarn deploy --network base --file DeployTipJar.s.sol
```

This writes the Base (`8453`) `TipJar` address + ABI into
`packages/nextjs/contracts/deployedContracts.ts`. USDC is already wired for chain `8453` in
`externalContracts.ts`.

## 3. Clean production build (static export)

```bash
cd packages/nextjs
rm -rf .next out                                   # ALWAYS clean first — avoids shipping a stale build

NEXT_PUBLIC_PRODUCTION_URL="https://tipjar.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

- `NEXT_PUBLIC_PRODUCTION_URL` → your live domain, so OG/Twitter image URLs are absolute
  (not `localhost`). Set it to the ENS gateway domain you'll use in step 6.
- `NODE_OPTIONS=--require ./polyfill-localstorage.cjs` → injected into every build worker so
  prerendering doesn't crash on Node 25.

## 4. Verify the build BEFORE uploading

```bash
ls out/index.html out/debug/index.html out/blockexplorer/index.html   # each route -> directory + index.html
grep -o 'og:image[^>]*content="[^"]*"' out/index.html                 # absolute https URL, NOT localhost
grep -o '<title>[^<]*</title>' out/index.html                         # "USDC Tip Jar"
stat -f '%Sm' app/page.tsx && stat -f '%Sm' out/                      # out/ must be NEWER than source (fresh build)
```

Every route must have a `<dir>/index.html` (that's what `trailingSlash: true` produces and
what IPFS gateways resolve). A route missing its `index.html` = it crashed during prerender.

## 5. Upload / pin to IPFS

```bash
yarn bgipfs upload out
# Copy the printed CID — e.g. CID: bafybei...
```

(Or `yarn ipfs` from `packages/nextjs` to build + upload in one step — it already includes the
polyfill and a clean rebuild; add `NEXT_PUBLIC_PRODUCTION_URL=...` in front of it so OG URLs
are absolute.)

**A real code change always yields a new CID.** If the CID didn't change, you uploaded stale
output — clean and rebuild (step 3).

Preview the pinned site: `https://community.bgipfs.com/ipfs/<CID>`

## 6. Point ENS at the CID (optional, for a human-readable domain)

Two mainnet transactions at https://app.ens.domains for `tipjar.yourname.eth`:

1. **New subname** (first deploy only): Subnames → New subname → `tipjar` → confirm.
2. **Set content hash**: `tipjar.yourname.eth` → Records → Edit → set **Content Hash** to
   `ipfs://<CID>` → save + confirm.

For updates, only redo step 2 with the new CID. Prefer the `.eth.link` gateway (better mobile
support): `https://tipjar.yourname.eth.link`.

## 7. Post-deploy verification

```bash
# a) Home + routes return 200 through the gateway (allow 5–15 min for ENS/IPFS cache):
for path in "" "debug/" "blockexplorer/"; do
  curl -s -o /dev/null -w "%{http_code}  $path\n" -L "https://tipjar.yourname.eth.link/$path"
done

# b) OG image resolves to the production URL (not localhost):
curl -s -L "https://tipjar.yourname.eth.link" | grep 'og:image'

# c) ENS content hash matches your CID on-chain:
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $(cast namehash tipjar.yourname.eth) \
  --rpc-url https://eth.llamarpc.com)
cast call $RESOLVER "contenthash(bytes32)(bytes)" \
  $(cast namehash tipjar.yourname.eth) --rpc-url https://eth.llamarpc.com
```

All routes should return `200` (not `404`), the OG image should be the absolute production URL,
and the on-chain content hash should decode to `ipfs://<CID>`.

---

### Quick reference

| Step | Command |
| --- | --- |
| Deploy contract to Base | `yarn deploy --network base --file DeployTipJar.s.sol` |
| Clean build (static) | `rm -rf .next out && NEXT_PUBLIC_PRODUCTION_URL=… NODE_OPTIONS="--require ./polyfill-localstorage.cjs" NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_IGNORE_BUILD_ERROR=true yarn build` |
| Verify output | `ls out/*/index.html && grep og:image out/index.html` |
| Upload to IPFS | `yarn bgipfs upload out` |
| Verify live | `curl -s -o /dev/null -w "%{http_code}" -L https://tipjar.yourname.eth.link/debug/` |
