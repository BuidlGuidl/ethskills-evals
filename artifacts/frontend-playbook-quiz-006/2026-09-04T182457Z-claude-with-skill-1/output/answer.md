# An unchanged CID is not a caching problem

## Short answer: the teammate is wrong, and has it exactly backwards

Waiting it out will never fix this. An identical CID is the one piece of evidence
that *rules out* gateway caching as the cause. The old content is still being
served because the old content is what you uploaded.

## What an unchanged CID actually proves

A CID is a content address: it is derived by hashing the bytes of the directory
you uploaded (plus the chunking/DAG parameters the tool used). It is not a
name, a pointer, or a version label that IPFS assigns to "your latest deploy."

So an unchanged CID proves exactly one thing:

> **The bytes you uploaded this time are identical to the bytes you uploaded last time.**

That is a fact about *your upload*, not about any gateway. Two useful corollaries:

- **Caching is excluded as the cause.** If the new build had differed by even one
  byte, you would have gotten a different CID, and a fetch of that *new* CID
  could not return stale content — nothing was ever published at that address
  before. Gateway caching only ever explains a stale response for the *same*
  CID/ENS name, never a CID that is unexpectedly unchanged.
- **The corollary is not "the fix is missing from your source."** The CID proves
  the uploaded *directory* didn't change. Where the fix got lost is still open —
  see below.

The failure is therefore upstream of IPFS entirely. IPFS did its job correctly:
you asked it to store the same content, and it handed you back the same address.

One caveat worth keeping in mind so you don't chase the wrong ghost later: the
converse does **not** hold. A *changed* CID does not prove your fix shipped —
any incidental byte difference (a new build ID, a timestamp, a different
chunker) will change the CID too. CID equality is a strong negative signal; CID
inequality is a weak positive one. That is why the local proof step below
matters regardless.

## Where in the pipeline this must have gone wrong

The fix exists somewhere (you saw it work in dev), but the bytes in `out/`
were the same as last time. So the break is in one of these links, roughly in
order of likelihood:

1. **The build didn't run against the fixed source.**
   Wrong directory, wrong branch/worktree, uncommitted fix on another machine,
   or the build ran on a stale checkout in CI.

2. **The build ran but was served from stale artifacts.**
   A leftover `.next` cache or a leftover `out/` from the previous deploy. If
   the export step fails or short-circuits, the *old* `out/` is still sitting
   there, and the upload tool happily re-uploads it. This is the classic cause
   of a byte-identical redeploy.

3. **The build silently failed and nobody looked.**
   Especially likely if the deploy is a chained one-liner where a non-zero exit
   didn't stop the upload, or where the build failure was a prerender crash on
   one route. A green-looking terminal is not proof; on Node 25 the built-in
   `localStorage` global can exist without the standard Web Storage methods,
   and libraries that feature-detect it crash on `getItem()` during static
   prerender.

4. **You built the wrong configuration.**
   Without `NEXT_PUBLIC_IPFS_BUILD=true`, Next.js doesn't do a static export at
   all — `output: "export"`, `trailingSlash`, and `images: { unoptimized: true }`
   never get applied, so there may be no fresh `out/` for the build to have
   updated.

5. **The upload pointed at the wrong path.**
   The tool was aimed at a stale directory, a previously pinned CID, or
   `packages/nextjs/out` from a different package/worktree than the one you
   just built.

6. **Only the ENS content hash / pinning was skipped** — a different bug, but
   worth ruling out. If the CID is genuinely unchanged, this is *not* your
   problem; if the CID *had* changed and users still saw the old app, this
   would be the first place to look.

The single fastest triage: run the build again cleanly and look at whether
`out/` even has fresh mtimes and whether it contains the fixed string. If the
CID changes after a clean rebuild, you were in case 2 or 3.

## Build discipline that prevents a repeat

### 0. Confirm you're on the fixed source

```bash
git status --short          # fix must not be sitting unstaged/unpushed elsewhere
git log --oneline -1        # the commit you think you're shipping
```

### 1. Configure the IPFS build once, in `next.config.ts`

```typescript
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

Static export, route directories, and unoptimized images are all required for
a gateway-served build. Without them a "successful" build produces something
that cannot be served from IPFS correctly even when it *is* fresh.

### 2. Always destroy artifacts before rebuilding

This is the step that makes a stale re-upload structurally impossible.

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

Set `NEXT_PUBLIC_PRODUCTION_URL` *before* building, not after — Open Graph URLs
and images are baked in at build time and will otherwise point at `localhost`.

If the build crashes on `localStorage` during prerender, apply the remedy at the
process level so build workers inherit it (code in `instrumentation.ts` or
`next.config.ts` alone is not inherited by workers). Pick whichever suits the app:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage"
# or
NODE_OPTIONS="--no-experimental-webstorage"
```

### 3. Never chain build and upload in a way that hides a failure

Make the upload depend on the build's exit status, and refuse to upload if
`out/` is missing or empty:

```bash
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true yarn build \
  && test -d out && test -n "$(ls -A out)" \
  && <upload-command> out
```

## How to prove locally that the new build contains the fix — before uploading

Do all of this against `out/`, not against the dev server. The dev server can be
right while the export is wrong.

**a. Confirm `out/` is actually from this build.**

```bash
ls -la out
find out -newermt '-10 minutes' -name '*.html' | head   # should not be empty
```

**b. Confirm the fix's bytes are present in the exported output.** Pick a string
that only exists because of the fix — new copy, a new class name, a renamed
handler, a changed number — and grep the emitted bundle:

```bash
grep -rl "<string-introduced-by-the-fix>" out/ | head
grep -rl "<string-the-fix-removed>"        out/ | head   # expect NO matches
```

Both directions matter. The presence check catches "the fix never made it in";
the absence check catches "the new code shipped alongside the old code."

**c. Confirm every route emitted its own directory with an index.**

```bash
ls out/*/index.html
```

A route missing here will 404 on the gateway even though the root loads.

**d. Confirm generated metadata carries the production origin, not localhost.**

```bash
grep -r "og:url\|og:image" out/index.html
grep -rn "localhost" out/ | head            # expect nothing meaningful
```

**e. Serve `out/` and click the actual bug.** Static output, static server,
same shape as the gateway will serve:

```bash
npx serve out            # or: python3 -m http.server -d out 3000
```

Open the affected page and verify the bug is gone in *this* artifact. This is
the only step that proves the user-visible behavior, and it costs 30 seconds.

**f. Optional but decisive: compute the CID locally before uploading.**

```bash
npx ipfs-car pack out --no-wrap  # prints the root CID for these exact bytes
```

If that CID equals the previous deploy's CID, stop — you have reproduced the
failure locally and there is nothing to gain by uploading. If it differs, you
know the upload will publish new content.

## After the upload

1. **Record the CID.** If it is unchanged, treat that as a build/upload bug and
   go back to the checks above — do not blame the gateway.
2. **Load the root and at least one non-home route through the gateway.** Root
   success does not prove exported routes resolve:

   ```bash
   curl -s -o /dev/null -w "%{http_code}" -L "https://<gateway>/ipfs/<cid>/debug/"
   # expect 200, not 404
   ```

3. **Verify the Open Graph image and URL use the production origin.**
4. **For ENS, update the content hash only after the deployed CID has been
   reviewed and approved**, then confirm the resolver and a public gateway
   serve that CID. Note that a stale *ENS-name* view genuinely can be a
   propagation/caching effect — that is the one place the teammate's instinct
   would have applied, and it is not what happened here.

Don't call the release complete until those pass.

## One-line version for the team channel

> Same CID means we uploaded the same bytes — it rules caching *out*, it doesn't
> explain it. The fix never reached `out/`. Fix: `rm -rf .next out` before every
> IPFS build, grep `out/` for the fix and serve it locally before uploading, and
> never let the upload run when the build didn't.
