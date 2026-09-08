# Same CID After a Re-Deploy: No, the Gateway Isn't the Problem

## Short answer

The teammate is wrong, and "wait it out" will never fix it.

A CID is a hash of the bytes you uploaded. If the bytes had changed, the CID
would have changed — that is the entire point of content addressing. The
uploader printing the *same* CID is proof that the directory you handed it was
**byte-for-byte identical to the previous deploy**. The bug is still live
because the fix is not in the artifact, not because a gateway is serving
something old.

Gateway caching is real, but it is a different failure with a different
signature: a **new** CID that the gateway is slow to resolve or that hasn't
propagated. Under a new CID the old content stays reachable at the old CID
forever — that's immutability, not staleness. Waiting cannot turn an unchanged
CID into changed content.

## What an unchanged CID proves — precisely

**It proves:** the bytes of the directory tree you uploaded hashed to the same
value as last time. Same file contents, same names, same structure. (Same
chunker/CID version too — assume so here, since it's the same tool.)

**It does *not* prove:**

- which step went wrong — only that *something upstream of the upload* produced
  identical bytes;
- that your source code is unchanged (the fix may well be committed and correct);
- anything at all about gateways, DNS, ENS content hashes, or browser caches.
  Those all sit *downstream* of the CID and cannot influence what it is.

So the unchanged CID is a genuine, hard signal — it just narrows the search to
the build-and-upload half of the pipeline. It doesn't finish the diagnosis.

## Where in the pipeline it must have gone wrong

The pipeline is:

```
source edit → build (.next → out/) → upload out/ → CID → ENS contenthash → gateway → user
                └────────── the fault is in here ──────────┘
```

Everything from the CID rightward is exonerated by the evidence. Two candidates
remain, and they are the classic Scaffold-ETH 2 / Next.js static-export
footguns:

**1. The build didn't actually rebuild.** `out/` (and `.next/`) were left over
from the previous deploy. Next.js static export writes into an existing `out/`
without clearing it, and a cached `.next/` can let a stale chunk survive. The
build "succeeded", the output was never regenerated with your change. This is
the single most common cause.

**2. You uploaded the wrong directory.** Pointing the uploader at a stale copy,
at `.next/` instead of `out/`, at a sibling worktree, or at a path from a
previous project layout. The build was fine; the bytes shipped weren't the
build's.

A third, less common variant worth ruling out: the fix lives on a **page that
crashes during static prerendering** and is silently skipped from the export, so
the fixed page never lands in `out/` at all. That would normally change the CID
(the rest of the bundle shifts), so it's unlikely here — but check the build log
for prerender errors regardless.

**These two are distinguishable with one `grep`, not by guessing.** See below.

## The diagnostic: prove the fix is in the artifact *before* uploading

Pick a string that only exists because of your fix — a new label, a new class
name, a renamed handler, a new error message. Then:

```bash
cd packages/nextjs

# Does the freshly built output contain the fix?
grep -rl "YOUR_FIX_STRING" out/ | head
```

- **Hits in `out/`** → the build picked up the change. The fault was **#2**: you
  uploaded the wrong directory. Re-upload `out/` and the CID will change.
- **No hits in `out/`** → the build did not pick up the change. The fault was
  **#1**: stale artifacts. Clean and rebuild.

Two corroborating checks:

```bash
# Timestamps: build output must be NEWER than every source file.
stat -c '%y' app/page.tsx        # source mtime
stat -c '%y' out/                # build output mtime
# Source newer than out/ ⇒ STALE BUILD. Do not upload.

# Routes actually exported (each route needs its own directory + index.html):
ls out/*/index.html
```

If you want to be exhaustive, hash the tree before and after — an identical
local hash predicts the identical CID you already saw:

```bash
find out -type f -exec sha256sum {} + | sort -k2 | sha256sum
```

## The build discipline that prevents a repeat

Run this every time, top to bottom. The `rm -rf` is not optional and the
verification gate is not optional.

```bash
cd packages/nextjs

# 1. ALWAYS clean first — this is what prevents the stale-artifact failure.
rm -rf .next out

# 2. Full production build with the required env.
NEXT_PUBLIC_PRODUCTION_URL="https://myapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

# 3. VERIFY BEFORE UPLOADING — all four must pass.
grep -rl "YOUR_FIX_STRING" out/            # the fix is present in the artifact
ls out/*/index.html                        # every route exported as a directory
grep 'og:image' out/index.html             # absolute prod URL, not localhost:3000
stat -c '%y' app/page.tsx; stat -c '%y' out/   # out/ newer than source

# 4. Only now upload — and only ever the `out/` directory.
yarn bgipfs upload out
# Save the CID. It MUST differ from the last deploy. If it doesn't, STOP and
# go back to step 3 — do not touch ENS.
```

**The rule that makes this stick:** *a CID identical to the previous deploy is a
build failure, not a deploy success.* Treat it as a hard stop. Never set the ENS
contenthash off a CID you haven't confirmed is new and haven't loaded yourself
at `https://community.bgipfs.com/ipfs/<CID>`.

Notes on the env vars above, since skipping them causes adjacent bugs that look
like caching:

- `NEXT_PUBLIC_IPFS_BUILD=true` switches `next.config.ts` to
  `output: "export"`, `trailingSlash: true`, `images.unoptimized`.
  `trailingSlash: true` is what makes `/debug` resolve to `debug/index.html`;
  without it every route but `/` 404s on a gateway.
- `NODE_OPTIONS="--no-experimental-webstorage"` avoids the Node 25 built-in
  `localStorage` crash during prerender. It must be on `NODE_OPTIONS` — a
  polyfill in `next.config.ts` or `instrumentation.ts` never reaches the
  prerender worker processes.
- `NEXT_PUBLIC_PRODUCTION_URL` keeps `og:image` off `localhost:3000`.

## Post-deploy verification (once the CID *has* changed)

```bash
# New content reachable and correct:
curl -s -o /dev/null -w "%{http_code}\n" -L "https://community.bgipfs.com/ipfs/<NEW_CID>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://community.bgipfs.com/ipfs/<NEW_CID>/debug/"

# Then update ENS contenthash to ipfs://<NEW_CID> and confirm onchain:
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $(cast namehash myapp.yourname.eth) \
  --rpc-url https://eth.llamarpc.com)
cast call $RESOLVER "contenthash(bytes32)(bytes)" \
  $(cast namehash myapp.yourname.eth) --rpc-url https://eth.llamarpc.com
```

Here — and *only* here — the teammate's instinct becomes valid. After the
contenthash changes onchain, `.eth.link` gateway and DNS caches genuinely can
take ~5–15 minutes to reflect it, and users may need a hard refresh. That is a
real waiting game. It just isn't the one you're in right now.
