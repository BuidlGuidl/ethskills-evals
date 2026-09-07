# No — the teammate has it backwards. Waiting will never fix this.

## Short answer

The gateway is not the problem, and there is nothing to wait out. An unchanged CID
is proof that the bytes you uploaded this time were **identical** to the bytes you
uploaded last time. The fix never reached the directory you handed the uploader.
Every hour spent waiting on a cache is an hour spent serving a build that does not
contain the fix.

---

## What an unchanged CID actually proves (and what it does not)

A CID is a **content hash** — it is derived from the bytes of the directory you
uploaded, and from nothing else. Not the time of upload, not which node you pushed
to, not the gateway. Same bytes in, same CID out; different bytes in, different CID
out.

**Therefore an unchanged CID proves exactly one thing:**

> The content of the directory you uploaded is byte-for-byte the same as the
> previous deploy.

**It does not prove** which step failed. "Same CID" is the symptom, not the
diagnosis — it narrows the problem to the two steps before the upload, and you have
to `grep` to find out which one. (Caveat: CIDs are only comparable when produced
with the same chunker/CID-version/wrapping settings. You used the same tool both
times, so that holds here — identical CID means identical content.)

**Why the caching theory fails twice:**

1. **Caching cannot produce this symptom.** The CID is computed locally, from your
   files, before anything is published. A gateway has no influence on it. If your
   build had actually changed, the CID would have changed — even if every gateway on
   earth were serving stale bytes.
2. **Caching could not hide a real new build anyway.** Gateways cache *per CID*.
   A new build means a new CID, which is a new path (`/ipfs/<newCID>/`) that no cache
   has ever seen. Stale cached content lives under the *old* CID and is irrelevant.
   Content addressing is precisely what makes "the CDN is serving the old version"
   a non-problem on IPFS.

The one legitimate propagation delay is on the **ENS/DNS side**: after you change
an ENS content hash, `.eth.link` gateways can take ~5–15 minutes to resolve to the
new CID. That is a real wait — but it only applies once you have a *different* CID
to point at. It is not what is happening here.

---

## Where in the pipeline it must have gone wrong

Since the CID is a pure function of the uploaded bytes, and the bytes didn't change,
the failure is upstream of the upload. There are exactly two candidates:

### A. The build did not pick up the change

The `out/` directory still holds the previous export. Common causes:

- **Stale artifacts.** `.next/` and `out/` were not deleted, so `out/` still contains
  the old export (a failed or partially-skipped build leaves the previous `out/`
  sitting there, looking complete).
- **The build actually failed** and you uploaded the leftover `out/` from the last
  successful run. With `NEXT_PUBLIC_IGNORE_BUILD_ERROR=true` this is easy to miss —
  scroll back and confirm the build exited 0.
- **The fixed page crashed during static prerendering** and was silently skipped, so
  the old copy survived — the classic Node 25 `localStorage.getItem is not a function`
  prerender crash, or a browser API touched at import time.
- **You edited a different file than the one that ships** — a duplicated component,
  a file under a disabled route directory, or a change in `packages/foundry` that the
  frontend never consumes.

### B. You uploaded the wrong directory

The build was fine, but `yarn bgipfs upload` was pointed at a stale or wrong path —
`.next/` instead of `out/`, an `out/` from a different package, or the same absolute
path from a previous session while your shell was in a different directory.

You don't have to guess between A and B. `grep` for the fix in `out/` decides it:
**string present in `out/` → the build was fine, so you uploaded the wrong path (B).
String absent → the build never picked up the change (A).**

---

## The build discipline that prevents a repeat

### Step 1 — Always clean first (mandatory after *any* code change)

```bash
cd packages/nextjs
rm -rf .next out
```

This single line eliminates the entire class of "deployed the old build" failures.
There is no situation in which skipping it is worth the risk.

### Step 2 — Full build, from scratch

```bash
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

echo "build exit code: $?"     # must be 0 — do not proceed otherwise
```

`NODE_OPTIONS="--no-experimental-webstorage"` is required on Node 25+: Node exposes a
built-in `localStorage` global that is truthy but has no `getItem`, so `next-themes` /
RainbowKit crash during static generation and the affected pages are dropped from the
export. It must be set via `NODE_OPTIONS` — Next.js prerenders in **separate worker
processes**, so a polyfill in `next.config.ts` or `instrumentation.ts` never reaches
them; only process-level flags are inherited by children.

Also confirm `next.config.ts` sets, for IPFS builds:

```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";
if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;      // without this every route but / 404s on IPFS
  nextConfig.images = { unoptimized: true };
}
```

### Step 3 — Prove the fix is in the build, *before* uploading anything

This is the part that answers "how do I know the new build really contains the fix."
Pick a string that exists **only** in the fixed code — new copy text, a renamed
handler, a new CSS class — and prove it is in the emitted bundle:

```bash
# 1. The fix is present in the shipped JS/HTML
grep -rl "YOUR_NEW_STRING" out/_next/static/chunks/ out/*.html
#    Non-empty output = the fix is in the build. Empty = STOP, the build is stale.

# 2. The old buggy string is gone (guards against "both versions shipped")
grep -rl "OLD_BUGGY_STRING" out/ ; echo "matches above should be empty"

# 3. Timestamp sanity: output must be NEWER than source
stat -c '%y' app/page.tsx        # source mtime
stat -c '%y' out/                # build mtime
#    Source newer than out/ = STALE BUILD. Rebuild before going further.

# 4. Routes actually exported (trailingSlash working)
ls out/*/index.html

# 5. OG image is absolute production URL, not localhost
grep 'og:image' out/index.html
```

Only when steps 1–5 all pass do you upload:

```bash
yarn bgipfs upload out          # note the exact path: out — and save the CID
```

### Step 4 — Treat the CID as an assertion, not a receipt

```
New CID  ≠  old CID  →  new bytes shipped. Review at
                        https://community.bgipfs.com/ipfs/<CID>/
New CID  ==  old CID  →  build/upload problem. Go back to Step 1.
                         Never point ENS at it, never "wait it out."
```

Then verify over the gateway before touching ENS:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L "https://community.bgipfs.com/ipfs/<CID>/debug/"
# expect 200, not 404
```

Set the ENS content hash (`ipfs://<CID>`) only after the new CID has been opened and
approved. That is the only point at which "wait a few minutes for propagation" is a
legitimate thing to say — and it applies to ENS resolution, never to the CID itself.

---

## What to do right now

```bash
cd packages/nextjs
grep -rl "YOUR_FIX_STRING" out/_next/static/chunks/ out/*.html
```

- **No match** → the build never picked up the fix. `rm -rf .next out`, rebuild with
  the full command above, check the exit code, re-grep.
- **Match found** → the build was correct and you uploaded the wrong directory.
  Re-run `yarn bgipfs upload out` from `packages/nextjs` and confirm the CID changes.

Either way the CID will change once the real fix is in the uploaded bytes — and the
moment it does, users see the fix without waiting for any cache.
