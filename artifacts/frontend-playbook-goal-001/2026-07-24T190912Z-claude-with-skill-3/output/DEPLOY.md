# Deploy — static build on IPFS

The frontend ships as a **static export** hosted on **IPFS**. Nothing is uploaded by this repo;
this document is the exact command list to build the site, upload it, and verify the result.

The production config is already in place:

- `packages/nextjs/next.config.ts` — when `NEXT_PUBLIC_IPFS_BUILD=true`, sets
  `output: "export"`, `trailingSlash: true` (so IPFS gateways resolve `/debug/` →
  `debug/index.html` instead of 404), and unoptimized images.
- `packages/nextjs/polyfill-localstorage.cjs` — restores the standard `localStorage` API that
  Node 23+ ships broken, so prerendering doesn't crash. It's injected via
  `NODE_OPTIONS="--require ./polyfill-localstorage.cjs"` (works in every build worker, unlike
  `instrumentation.ts` / `next.config`).
- `utils/scaffold-eth/getMetadata.ts` — reads `NEXT_PUBLIC_PRODUCTION_URL` so the OG image
  resolves to an absolute production URL (not `localhost`).

## Prerequisites

- The contract is deployed to **real Base** and `packages/nextjs/contracts/deployedContracts.ts`
  contains its Base (`8453`) entry:
  ```bash
  yarn deploy --file DeployTipJar.s.sol --network base
  ```
- In `packages/nextjs/scaffold.config.ts`, set `targetNetworks: [chains.base]` for the
  production build (it's `[chains.foundry]` for local fork dev). Keep it a single concrete
  network — a runtime ternary widens the type and breaks the scaffold contract-name types.
  The Base RPC override and `pollingInterval: 3000` are already configured.
- Use **Node 20 or 22** if you can; the polyfill also makes Node 23–25 work.

## 1. Clean + build (static export)

Run from `packages/nextjs`. Set `NEXT_PUBLIC_PRODUCTION_URL` to your final gateway/ENS URL.

```bash
cd packages/nextjs
rm -rf .next out                      # ALWAYS clean first — avoids shipping a stale build

NEXT_PUBLIC_PRODUCTION_URL="https://tipjar.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

## 2. Verify the build BEFORE uploading

```bash
# Every route exists as a directory with an index.html (trailingSlash working):
ls out/index.html out/debug/index.html

# OG image points at the production URL, not localhost:
grep -o 'og:image[^>]*' out/index.html

# The app actually rendered (not an empty shell):
grep -o 'USDC Tip Jar' out/index.html

# Build is fresh: out/ must be newer than your source.
stat -f '%Sm' app/page.tsx
stat -f '%Sm' out
```

## 3. Upload to IPFS

```bash
# From packages/nextjs
yarn bgipfs upload out
# → note the CID it prints. SAVE IT.
```

Preview it: `https://community.bgipfs.com/ipfs/<CID>`

> The CID is proof of a fresh deploy: a real code change **always** produces a new CID. If the
> CID didn't change, you uploaded stale output — re-run step 1.

## 4. Post-deploy verification

```bash
CID=<your-cid>
GATEWAY=https://community.bgipfs.com

# Home + a nested route both return 200 (nested route proves trailingSlash routing):
curl -s -o /dev/null -w "home:  %{http_code}\n" -L "$GATEWAY/ipfs/$CID/"
curl -s -o /dev/null -w "debug: %{http_code}\n" -L "$GATEWAY/ipfs/$CID/debug/"

# OG metadata resolves to the production URL:
curl -s -L "$GATEWAY/ipfs/$CID/" | grep -o 'og:image[^>]*'
```

Then open the preview URL in a browser and do a real walkthrough: connect wallet, confirm it
prompts to switch to **Base**, approve USDC, send a tip, and watch the feed update.

## 5. (Optional) Point an ENS subdomain at the CID

1. `https://app.ens.domains/yourname.eth` → **Subnames** → **New subname** → e.g. `tipjar`
   (skip this if the subname already exists).
2. Open `https://app.ens.domains/tipjar.yourname.eth` → **Records** → **Edit Records** →
   **Other** → set **Content Hash** to `ipfs://<CID>` → save + confirm in wallet.
3. Verify onchain + via gateway (allow a few minutes for propagation):

```bash
NODE=$(cast namehash tipjar.yourname.eth)
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $NODE --rpc-url https://eth.llamarpc.com)
cast call $RESOLVER "contenthash(bytes32)(bytes)" $NODE --rpc-url https://eth.llamarpc.com

curl -s -o /dev/null -w "%{http_code}\n" -L "https://tipjar.yourname.eth.link"
```

Use `.eth.link` (better mobile support than `.eth.limo`).

---

### One-shot build + upload

The repo also wires `yarn ipfs` (from the repo root or `packages/nextjs`) to build with
`NEXT_PUBLIC_IPFS_BUILD=true` and upload in one step. Prefer the explicit steps above when you
need `NEXT_PUBLIC_PRODUCTION_URL` and the localStorage polyfill set for correct OG metadata and
prerendering.
