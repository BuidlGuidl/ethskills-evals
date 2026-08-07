# The teammate is wrong. An unchanged CID rules gateway caching *out*, not in.

## What an unchanged CID actually proves

IPFS is **content-addressed**. A CID is a cryptographic hash (a Merkle DAG root)
computed over the exact bytes of the directory you upload. The address *is* the
content. This gives one iron rule:

> **Different content → different CID. Same CID → byte-for-byte identical content.**

So the upload tool printing the *same* CID as the previous deploy proves one thing
with certainty: **the bytes you uploaded this time are identical to last time.**
The new directory contains the old app. The fix is not in what you shipped.

This is the exact opposite of a caching problem:

- If the fix *had* made it into the upload, the CID would have **changed** — even a
  one-character source change ripples through the bundle hash and produces a new
  root CID. A caching gateway would then be serving the *old* CID's content while
  the *new* CID sat un-fetched. That would look like caching.
- But the CID **didn't** change. There is no new CID for any gateway to be slow
  about. Users see the old bug because the old bug is the only thing that exists at
  that address. "Wait it out" waits forever.

Gateway/DNS/ENS caching is real and does cause propagation delay — but only *after*
a genuinely new CID exists and you've pointed a name at it. It can never make a
changed build collapse back onto the old CID.

## Where in the pipeline it must have gone wrong

Since upload → CID is deterministic and the CID is unchanged, the failure is
**upstream of the upload**, in one of these (all boil down to "the fix never reached
the `out/` directory that got uploaded"):

1. **Stale build artifacts (the #1 footgun).** The fix was saved to source, but
   `yarn build` reused a cached `.next`/`out/` and re-emitted the old output — or
   the build wasn't re-run at all. You then uploaded the old `out/`.
2. **Uploaded the wrong / previous directory.** The build wrote fresh output
   somewhere, but `yarn bgipfs upload out` pointed at a stale or previously-built
   `out/` (e.g. build failed partway, old `out/` left in place, wrong path).
3. **The "fix" never changed the emitted bundle.** The edit was to a file/branch
   that doesn't get compiled into the static export, or the page silently crashed
   during static prerender and got skipped, so the shipped chunks are unchanged.

In every case the diagnosis is the same and the CID told you so: **the content you
uploaded did not contain the fix.** Rebuild correctly and the CID *will* move.

## Build discipline that prevents a repeat

Never trust "I saved the file." Prove the fix is in `out/` before uploading. Run
everything from `packages/nextjs`.

```bash
cd packages/nextjs

# 1. ALWAYS clean first — this is what kills stale-artifact reuse
rm -rf .next out

# 2. Full clean rebuild from scratch (IPFS-safe flags)
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

## How to PROVE locally that the new build contains the fix — before uploading anything

Do all three checks against `out/` (the directory you're about to upload). Only
upload if all three pass.

```bash
# A. Freshness: source must be OLDER than the build output.
#    If a source file is NEWER than out/, you're about to ship a stale build.
stat -f '%Sm' app/page.tsx     # (the file you actually changed)
stat -f '%Sm' out/
#    out/ timestamp must be later than the source timestamp.

# B. Content proof: grep the emitted bundles for a string unique to your fix.
#    Pick a string that ONLY exists in the fixed version (new label, new
#    condition, a temporary marker) and confirm it landed in the shipped JS/HTML.
grep -rl "YOUR_FIX_STRING" out/_next/static/chunks/ out/**/index.html
#    A match here means the fix is physically in the upload payload.
#    (Bonus negative check: grep for the OLD buggy string and confirm it's GONE.)

# C. See it render from the exact bytes you'll upload — serve out/ statically:
npx serve out          # or: python3 -m http.server -d out 8080
#    Open the affected route (with trailing slash, e.g. /debug/) and confirm the
#    bug is actually fixed in this static output, not just in `yarn dev`.
```

Only after A, B, and C pass:

```bash
yarn bgipfs upload out     # Save the CID — it WILL differ from the last deploy
```

**The CID is your receipt.** If the new upload prints the *same* CID as before, stop
— you have not changed the content, so do not touch ENS or blame the gateway. Go
back and find why the fix isn't in `out/`. When the fix is genuinely in the build,
the CID changes; *then* (and only then) does gateway/ENS propagation delay become
the thing you actually wait out.
