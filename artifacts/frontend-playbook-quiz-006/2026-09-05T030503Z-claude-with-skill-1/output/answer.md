# Unchanged CID After a "Fixed" Rebuild — Diagnosis and Discipline

## Short answer

No, the teammate is wrong, and the reasoning is backwards. The identical CID is not
evidence *for* a gateway cache — it is proof that **the bytes never changed**, which
rules the gateway out entirely as the root cause. Waiting it out will accomplish
nothing, because there is nothing new on IPFS to propagate.

## What an unchanged CID actually proves

A CID is a content hash of the directory you uploaded. Content addressing means:

- **Different bytes ⇒ different CID.** Always. There is no cache, no TTL, no
  eventual consistency in this relationship — it's a hash function.
- Therefore **same CID ⇒ byte-for-byte identical upload.** You re-uploaded the
  previous deploy.

So the CID proves exactly one thing: *the directory handed to the uploader had the
same content as last time.* Users seeing the old bug is not a symptom of a stale
gateway; it is the correct, faithful serving of the content you actually published.

Note the direction of the argument the teammate got inverted: if the bug had really
been fixed and uploaded, the CID **would have changed**, and then — and only then —
a gateway cache could plausibly delay *that new CID's* content reaching users. A
stale gateway can never cause an unchanged CID. It's a consequence, not a cause.

Also worth saying plainly: the CID alone does *not* tell you which upstream step
failed. It narrows the search to everything before the upload. Diagnose with
evidence, not guessing.

## Where in the pipeline it must have gone wrong

The failure is upstream of IPFS, in one of two places:

1. **The build never picked up the fix.** Stale `.next` / `out` artifacts were
   reused, the build silently failed and left the previous `out/` in place, or the
   edit landed in a file/branch that isn't part of what was built. Result: `out/`
   still contains the old code.

2. **The wrong directory was uploaded.** The build was fine, but the uploader was
   pointed at a stale path — a different worktree, a leftover `out/` elsewhere, the
   repo root, or `.next` instead of `out`.

A third, subtler variant of (1): the page containing the fix crashed during static
prerendering and was silently skipped, so the exported output kept an older or
missing route. Any page that throws during `yarn build` gets dropped from the export
without failing the build loudly.

One `grep` tells you which of the two it is (below). Don't guess between them.

## Prove locally that the new build contains the fix — before uploading anything

Run this from `packages/nextjs`. Nothing gets uploaded until the greps pass.

```bash
cd packages/nextjs

# 1. Destroy every prior artifact. Non-negotiable — this is the actual fix
#    for the most common cause.
rm -rf .next out

# 2. Full clean build with the production env vars
NEXT_PUBLIC_PRODUCTION_URL="https://myapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

# 3. PROVE the fix is in the output. Pick a string unique to the fix — new
#    copy, a new class name, a renamed handler — and find it in the bundle.
grep -rl "YOUR_UNIQUE_FIX_STRING" out/_next/static/chunks/ out/*.html
#    Expect at least one hit. Zero hits = the build did not pick up the change.
#    STOP and fix that; do not upload.

# 3b. Prove the OLD string is gone (catches "added but old path still live")
grep -rl "OLD_BUGGY_STRING" out/_next/static/chunks/ out/*.html
#    Expect no output.

# 4. Timestamp sanity: source must be OLDER than the build output
stat -c '%y' app/page.tsx
stat -c '%y' out/
#    Source newer than out/ = stale build. Rebuild.

# 5. Routes survived the export (each route is a directory + index.html)
ls out/*/index.html

# 6. OG image is absolute production URL, not localhost
grep 'og:image' out/index.html
```

Only when steps 3–6 pass do you upload — and note the exact path:

```bash
yarn bgipfs upload out       # 'out', not '.next', not '..'
```

Then confirm the CID **differs** from the previous deploy. Record CIDs per deploy so
this comparison is possible at all:

```bash
# keep a running log
echo "$(date -Iseconds) $(git rev-parse --short HEAD) <NEW_CID>" >> ../../deploys.log
```

If the CID is *still* unchanged after a passing grep, the fault is definitively
step 2 — you uploaded a different directory than the one you just verified.

Finally, verify what the network actually serves, before touching ENS:

```bash
curl -s -o /dev/null -w "%{http_code}" -L "https://community.bgipfs.com/ipfs/<NEW_CID>/debug/"
curl -s -L "https://community.bgipfs.com/ipfs/<NEW_CID>/" | grep -c "YOUR_UNIQUE_FIX_STRING"
```

## The build discipline that prevents a repeat

1. **`rm -rf .next out` before every single build.** Not "when it seems stale" —
   every time. This one line eliminates the most common cause outright.
2. **Grep the build output for a string unique to the change.** The build succeeding
   is not evidence the change is in it. The grep is.
3. **Check timestamps** (`stat` source vs `out/`) as a cheap second signal.
4. **Upload an explicit, verified path** (`out`), and never a path you haven't just
   greped.
5. **Log every CID against its git commit.** An unchanged CID should be caught
   immediately and treated as a hard failure of the build, not shrugged off.
6. **Verify via the gateway URL before setting the ENS content hash.** ENS updates
   are mainnet transactions — money and latency. Get approval on the CID first.

## A note on cache reasoning generally

Gateway caching *is* real, and it does affect how fast a **new** CID's content
becomes widely available (allow ~5–15 min for `.eth.link` after an ENS content-hash
update). But it can only ever delay new content — it can never make new content
hash to an old CID. "It's just the cache" is a claim that must be *earned* by first
showing the CID changed. Here it didn't, so the claim is unavailable.
