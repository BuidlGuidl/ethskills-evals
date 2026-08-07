# The unchanged CID: what it proves and where the pipeline broke

## Short answer: the teammate is wrong

The teammate has the diagnosis exactly backwards. An unchanged CID is **not** evidence
of a gateway caching problem you can wait out — it is *proof that no caching is even
involved*. You re-uploaded the same bytes you uploaded last time. The gateway is serving
the old version because the old version is *what you gave it*. Waiting will change
nothing, ever, because there is nothing to invalidate.

## What an unchanged CID proves — precisely

A CID (Content IDentifier) is a cryptographic hash of the content itself. IPFS is
content-addressed: the address *is* the fingerprint of the bytes. This gives a hard,
one-line guarantee:

> **Same CID ⇔ byte-for-byte identical content.** A different CID is produced by *any*
> change to the uploaded files, no matter how small. Identical content can *never*
> produce a different CID, and different content can *never* produce the same one.

So the unchanged CID proves, with certainty:

- The directory you uploaded (`out/`) contains **exactly the same bytes** as the previous
  deploy.
- Therefore **the fix is not in the artifact you uploaded.** Full stop.

What it does **not** prove — and where the teammate's reasoning fails:

- It says **nothing** about whether you *edited the source*. You almost certainly did.
- It rules the gateway *out*, not in. A caching gateway would serve stale content behind
  a *new* CID (the content hash changed, the gateway just hasn't fetched it yet). Your
  CID didn't change, so the content the gateway is asked to serve is genuinely the old
  content. This is a **build/upload** problem, not a **propagation** problem.

The skill states this bluntly: *"The CID is proof: If the IPFS CID didn't change after a
deploy, you deployed the same content. A real code change ALWAYS produces a new CID."*

## Where in the pipeline it went wrong

The pipeline is:

```
edit source  →  rebuild (yarn build → out/)  →  upload out/ to IPFS  →  CID  →  gateway/ENS
```

The CID is derived from `out/`. Since the CID is unchanged, `out/` never changed, so the
break is **upstream of the upload, in the build step** — the edited source never made it
into `out/`. This is the classic *stale build* footgun. Concretely, one of:

1. **The build was never re-run.** You edited source, then re-uploaded the existing
   `out/` from the previous deploy. Most common cause.
2. **Stale artifacts poisoned the build.** `.next`/`out` from the prior run were left in
   place and the build reused cached output instead of regenerating the changed files.
   (This is why `rm -rf .next out` is mandatory.)
3. **You built the wrong tree / wrong directory** — e.g. built in a different worktree,
   or uploaded a different `out/` than the one you just built.
4. **The page containing the fix silently failed static prerender** and was skipped, so
   the changed chunk never landed in `out/` — leaving the prior artifact effectively
   unchanged for that route.

The unifying point: **the gateway is downstream of the CID, and the CID is downstream of
`out/`. An unchanged CID means the problem is at or before `out/` — never at the
gateway.**

## Build discipline that prevents a repeat

Rule: **a build is not done when the code compiles — it's done when you've proven the fix
is in `out/` and the CID moved.** Never upload until both are true.

### 1. Always clean, then rebuild from scratch

```bash
cd packages/nextjs
rm -rf .next out                    # MANDATORY — delete stale artifacts first

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

### 2. Prove the fix is in the build — *before uploading anything*

This is the step that would have caught the bug. Three independent local checks, no
gateway, no upload, no waiting:

```bash
# (a) grep the compiled output for a string unique to your fix.
#     Pick something the fix introduced (new label, new function name, corrected text).
grep -rl "YOUR_FIX_STRING" out/_next/static/chunks/app/*.js
#     -> a match means the fix compiled INTO the artifact. No match = fix not in out/. STOP.

# (b) Timestamp sanity: source must NOT be newer than the build output.
stat -f '%Sm' app/page.tsx          # source modified time
stat -f '%Sm' out/                   # build output time
#     Source NEWER than out/ = you're about to upload a stale build. Rebuild.

# (c) Routes exist as directories (IPFS needs dir/index.html, not bare .html)
ls out/*/index.html
```

Only when the fix string is present **and** `out/` is newer than the source do you
upload.

### 3. Upload, and let the CID confirm the change

```bash
yarn bgipfs upload out              # save the NEW CID
```

- **If the CID changed** → the content genuinely changed; the fix (verified in step 2) is
  now live at the new address. Point ENS at the new `ipfs://<CID>`.
- **If the CID is unchanged** → you uploaded identical bytes again. Do **not** wait for a
  gateway — go back to step 1. The build did not include your change.

### 4. Verify what the gateway serves (this is the only place caching lives)

```bash
# Fetch the NEW CID directly and confirm the fix is in what the gateway returns.
curl -s -L "https://community.bgipfs.com/ipfs/<NEW_CID>/" | grep "YOUR_FIX_STRING"
curl -s -o /dev/null -w "%{http_code}" -L "https://community.bgipfs.com/ipfs/<NEW_CID>/debug/"  # 200
```

Genuine gateway/ENS caching *can* exist — but it only ever manifests **after** the CID
has changed and you're waiting for propagation of the new hash (5–15 min for ENS gateway
cache). It can never explain a *stale CID*. If your CID didn't move, "the gateway is
caching" is never the answer.

## One-line summary

An unchanged CID is a mathematical guarantee that you uploaded the same bytes — it
*exonerates* the gateway and *indicts* your build/upload step. The cure is not patience;
it's `rm -rf .next out`, a clean rebuild, and a `grep` of `out/` that proves the fix is in
the artifact *before* you upload — after which a genuinely new CID confirms it.
