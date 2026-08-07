# The teammate is wrong — and the CID proves it

## What an unchanged CID actually proves

An IPFS CID is a **content hash** of the bytes you uploaded. It is derived
deterministically from the file contents (the DAG of your `out/` directory).
This gives one hard guarantee:

> **Same CID ⇒ byte-for-byte identical content.**
> A real code change *always* produces a different CID. There is no exception.

So the unchanged CID does **not** settle the "gateway is caching" theory —
it *refutes* it. The gateway isn't serving the old version because it's stale;
the gateway is serving the old version because **you uploaded the old version
again.** The bug-free bytes never reached IPFS at all.

Gateway caching is real, but it can only ever cache *per CID*. A brand-new CID
is a brand-new URL/content-hash and bypasses any prior cache entirely. "Wait it
out" fixes nothing here, because there is nothing new to propagate.

## Where in the pipeline it went wrong

The failure is **upstream of the gateway**, before the upload. Given identical
CIDs, the fix is not present in the `out/` directory you handed to the uploader.
In order of likelihood:

1. **Stale build (the #1 IPFS footgun).** You edited the source, but never
   rebuilt — or rebuilt without cleaning — so `next build` reused cached
   artifacts in `.next`/`out`. The uploader faithfully re-uploaded the old
   static export. Identical input → identical CID.
2. **Uploaded the wrong directory.** The build did produce fresh output, but the
   upload command pointed at a stale/previous `out/` (or a copy), not the one
   just generated.
3. **Fix didn't land in the built output.** The edit was in a file that gets
   tree-shaken/skipped, in the wrong package, or on an unsaved/uncommitted
   buffer — so even a clean rebuild produced the same bytes.

All three collapse to the same fact: **the bytes were identical, therefore the
fix was not in them.** No gateway behavior can explain an unchanged CID.

## Build discipline that prevents a repeat

The rule: **clean, rebuild from scratch, and prove the fix is in `out/`
locally — before you upload anything.** The CID is your receipt, not your check.

### 1. Always clean first — never trust incremental artifacts

```bash
cd packages/nextjs
rm -rf .next out          # delete ALL prior build artifacts
```

### 2. Full, reproducible build command

```bash
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

### 3. PROVE the fix is in the output *before* uploading

This is the step that would have caught the bug. Don't upload on faith —
grep the built chunks and check timestamps.

```bash
# (a) Grep the compiled output for a string unique to your fix.
#     If the fix changed a label, condition, or value, search for it:
grep -rl "YOUR_FIX_STRING" out/_next/static/chunks/app/*.js
#     Zero matches = the fix is NOT in the build. STOP. Do not upload.

# (b) Prove the build is newer than the source you edited.
stat -f '%Sm' app/page.tsx     # source modified time
stat -f '%Sm' out/             # build output time
#     Source NEWER than out/  = STALE build. Rebuild before doing anything.

# (c) Sanity-check routes and metadata survived the export.
ls out/*/index.html            # each route has a dir + index.html
grep 'og:image' out/index.html # absolute production URL, not localhost
```

Only when (a) shows the fix present and (b) shows `out/` newer than source is
the build trustworthy.

### 4. Then, and only then, upload

```bash
yarn bgipfs upload out         # save the new CID
```

### 5. Use the CID as the final verification

```
Old CID:  bafy...OLD
New CID:  bafy...NEW   ← MUST differ. If it matches, you uploaded stale output —
                          go back to step 1. Do NOT touch ENS or blame the gateway.
```

If the CID changed and the fix was grep-confirmed in `out/`, the deploy is
genuinely new. At that point (and only that point) is gateway/ENS cache
propagation a legitimate thing to wait on — typically 5–15 minutes — and you
point ENS's content hash at the **new** CID (`ipfs://bafy...NEW`).

## One-line summary

An unchanged CID is mathematical proof you re-uploaded identical bytes — the fix
never made it into the build, so the failure is a **stale local build**, not a
caching gateway. Fix it with `rm -rf .next out`, a full rebuild, and a
`grep`-of-`out/` + timestamp check that proves the fix is present *before* upload;
a changed CID is then your receipt that the new content actually shipped.
