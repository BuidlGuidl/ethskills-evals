# DEPLOY.md — Static IPFS build for the USDC Tip Jar

The site ships as a **static export on IPFS**. This document has the exact **build**,
**upload**, and **post-deploy verification** commands. Nothing here uploads automatically —
run the steps deliberately.

Two things are deployed separately:

1. **The `TipJar` contract** → Base mainnet (one-time, or already done).
2. **The frontend** → a static bundle pinned on IPFS.

---

## 0. Prerequisites & config

- Node `>= v20` (Node 25 is fine — the `localStorage` polyfill below handles it).
- The production config in `packages/nextjs/`:
  - `next.config.ts` already switches to a static export when `NEXT_PUBLIC_IPFS_BUILD=true`
    (`output: "export"`, `trailingSlash: true`, `images.unoptimized: true`). Trailing slashes
    are **required** so IPFS gateways resolve every route to a directory `index.html`
    (without them, `/debug` → 404).
  - `polyfill-localstorage.cjs` supplies the WebStorage methods Node 25 omits, injected into
    **every** build worker via `NODE_OPTIONS="--require ./polyfill-localstorage.cjs"`.
    Without it, static prerendering crashes with `localStorage.getItem is not a function`.
  - `scaffold.config.ts` already has `pollingInterval: 3000`.

### Point the frontend at Base for production

For the live site the app must target **Base**, not the local fork. Set:

```typescript
// packages/nextjs/scaffold.config.ts
import * as chains from "viem/chains";
targetNetworks: [chains.base],
```

Also set a real Base RPC (avoid the public `mainnet.base.org` in production) via an
`rpcOverride` / `NEXT_PUBLIC_ALCHEMY_API_KEY` in `packages/nextjs/.env.local`:

```typescript
rpcOverrides: {
  [chains.base.id]: "https://base-mainnet.g.alchemy.com/v2/<YOUR_KEY>",
},
```

> Switch `targetNetworks` back to `[chains.foundry]` when you return to local fork development.

---

## 1. (If not already live) Deploy the TipJar contract to Base

```bash
# From repo root. Requires a funded deployer keystore (see `yarn account:import`).
yarn deploy --file DeployTipJar.s.sol --network base
```

This deploys `TipJar(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, deployer)` and regenerates
`packages/nextjs/contracts/deployedContracts.ts` with the Base (`8453`) address. Commit that file
so the static build includes the real contract address.

Optional verification on BaseScan:

```bash
yarn verify --network base
```

---

## 2. Build the static bundle (exact command)

```bash
cd packages/nextjs
rm -rf .next out                      # ALWAYS clean first — avoids shipping a stale build

NEXT_PUBLIC_PRODUCTION_URL="https://usdc-tipjar.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

- `NEXT_PUBLIC_PRODUCTION_URL` makes the OG/Twitter image an absolute URL instead of
  `localhost` (see `utils/scaffold-eth/getMetadata.ts`). Set it to your final gateway URL.
- Output is written to `packages/nextjs/out/`.

### Verify the build BEFORE uploading

```bash
# Every route is a directory with an index.html (trailingSlash working):
ls out/index.html out/debug/index.html out/blockexplorer/index.html

# OG image is absolute (your domain), NOT localhost:
grep -o 'property="og:image"[^>]*' out/index.html

# Page title is correct, not the stock SE-2 title:
grep -o '<title>[^<]*</title>' out/index.html          # -> <title>USDC Tip Jar</title>

# The real TipJar address is baked into the JS (paste your Base TipJar address):
grep -rl "<your-base-tipjar-address-without-0x>" out/_next/static/chunks/ | head

# Not stale — build output is newer than the source you changed:
stat -f '%Sm' app/page.tsx
stat -f '%Sm' out
```

---

## 3. Upload to IPFS (exact command)

```bash
# Still in packages/nextjs. Uploads the ./out directory to BuidlGuidl IPFS.
yarn bgipfs upload out
```

Copy the **CID** it prints. Your build is reachable at:

```
https://community.bgipfs.com/ipfs/<CID>
```

> A real code change **always** produces a new CID. If the CID didn't change after you edited
> code, you uploaded a stale `out/` — re-run step 2 (with `rm -rf .next out`) and try again.

---

## 4. Post-deploy verification (exact commands)

Replace `<CID>` with the CID from step 3.

```bash
GATEWAY="https://community.bgipfs.com/ipfs/<CID>"

# 1. Home page loads (200):
curl -s -o /dev/null -w "home:  %{http_code}\n" -L "$GATEWAY/"

# 2. Routes resolve via trailing-slash directories (200, NOT 404):
curl -s -o /dev/null -w "debug: %{http_code}\n" -L "$GATEWAY/debug/"

# 3. OG metadata points at the production URL (not localhost):
curl -s -L "$GATEWAY/" | grep 'og:image'

# 4. The page is the tip jar (matches on the H1 text):
curl -s -L "$GATEWAY/" | grep -o "USDC Tip Jar" | head -1
```

All four must pass: `200`, `200`, an absolute `og:image` URL, and `USDC Tip Jar`.

---

## 5. (Optional) Point an ENS subdomain at the CID

If you're publishing under `usdc-tipjar.yourname.eth`, set its **content hash** to
`ipfs://<CID>` in the [ENS app](https://app.ens.domains) (Records → Other → Content Hash),
then verify onchain and via the gateway:

```bash
# Content hash set onchain:
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $(cast namehash usdc-tipjar.yourname.eth) \
  --rpc-url https://eth.llamarpc.com)
cast call $RESOLVER "contenthash(bytes32)(bytes)" \
  $(cast namehash usdc-tipjar.yourname.eth) --rpc-url https://eth.llamarpc.com

# Gateway responds (allow 5–15 min for propagation) — use .eth.link (better on mobile):
curl -s -o /dev/null -w "%{http_code}\n" -L "https://usdc-tipjar.yourname.eth.link"
```

---

## Notes / gotchas

- **Clean before every build** (`rm -rf .next out`). The #1 IPFS footgun is uploading a stale `out/`.
- **`--require`, not `instrumentation.ts`:** the polyfill must load in the prerender worker
  processes, which only `NODE_OPTIONS="--require ..."` guarantees.
- **Custom OG thumbnail (optional):** the default `public/thumbnail.jpg` is the stock SE-2 image.
  Replace it with a 1200×630 PNG/JPG before a public launch if you want a branded unfurl.
- **`NEXT_PUBLIC_IGNORE_BUILD_ERROR=true`** lets the static export finish past non-fatal type
  checks; run `yarn check-types` separately to keep the code honest.
