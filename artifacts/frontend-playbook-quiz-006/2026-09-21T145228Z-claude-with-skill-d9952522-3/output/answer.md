# Same CID after a "fix" deploy: is it gateway caching?

## Short answer: no, the teammate is wrong

An IPFS CID is a hash of the content. With the same upload settings (CID version, chunker, raw leaves, wrapping), **the same CID means the same bytes**. Change one byte in one file and the CID changes.

So an unchanged CID proves one precise thing: **the directory you uploaded is byte-for-byte identical to the one you uploaded last time.** The fix isn't in it.

Gateway caching can't explain this:

- A gateway serving `/ipfs/<cid>/` can only serve the content that CID names. Content addressed by hash can't go stale. A cache holding the "old version" of a CID is holding the only version that CID has.
- Caching of *mutable pointers* (ENS contenthash, IPNS, DNSLink) can lag. But that only matters when the pointer moves from an old CID to a **new** one. Here there's no new CID to move to. Waiting fixes nothing: the bug is in the published artifact.

**The fix never reached the bytes that were uploaded.** Look at your own pipeline, not the gateway.

## Where it must have gone wrong

The break is somewhere between "source edited" and "directory handed to the uploader":

1. **The source that got built doesn't have the fix.** The edit wasn't saved, sits in another branch or worktree, or CI built a commit from before the fix.
2. **The build didn't regenerate `out/`, and the old export was uploaded.** This is the most common cause in SE-2:
   - The build ran without `NEXT_PUBLIC_IPFS_BUILD=true`. Then `output: "export"` isn't set, Next writes only `.next/`, and the `out/` left over from the last release stays untouched.
   - The build failed or stopped partway, the error was missed, and the old `out/` was still there to upload.
   - Old `.next/` / `out/` artifacts were never deleted, so it's unclear what's fresh.
3. **The uploader was pointed at the wrong directory:** an old `out/`, a copy somewhere else, the wrong package in the monorepo, or a folder saved from the last release.
4. (Less likely) The fix is only in code that isn't part of the static export: a server-only path, an env var only read at runtime, or an ignored file. A static export freezes `NEXT_PUBLIC_*` values at build time.

Whichever it was, it's upstream of IPFS. Once `out/` really contains the fix, the CID will change.

## Build discipline that prevents a repeat

### 1. Build from a known source state
```bash
git status                  # clean tree, or know exactly what's uncommitted
git log -1 --oneline        # the commit you think contains the fix
git diff <last-release-tag> -- packages/nextjs   # the fix shows up here
```

### 2. Delete old artifacts, then do a fresh static build with a checked exit code
```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build || { echo "BUILD FAILED - do not upload"; exit 1; }
test -d out || { echo "no out/ - static export not produced"; exit 1; }
```
`next.config.ts` must switch to export mode under that flag:
```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```
(On Node 25, if prerender crashes on `localStorage.getItem`, set `NODE_OPTIONS="--no-experimental-webstorage"` or `NODE_OPTIONS="--localstorage-file=.node-localstorage"` for the build. Don't ignore the failure and upload whatever `out/` holds.)

Because you deleted `out/` first, a failed or non-export build leaves no `out/` to upload by mistake.

### 3. Prove locally that the new build has the fix, before uploading
- **Freshness:** every file must be from this build.
  ```bash
  cat .next/BUILD_ID; ls out/_next/static/          # the build ID dir matches this build
  find out -type f ! -newer .next/BUILD_ID | head   # expect no stale files
  ```
- **The fix is in the bytes:** grep for a string or class that only the fixed code has (UI text and string literals survive minification). Also check that the buggy version is gone:
  ```bash
  grep -rl "<string unique to the fix>" out/ || echo "FIX NOT IN BUILD"
  grep -rl "<string unique to the bug>" out/ && echo "OLD CODE STILL PRESENT"
  ```
- **Routes and metadata:**
  ```bash
  ls out/*/index.html                       # one index.html per route
  grep -o 'og:[a-z]*" content="[^"]*' out/index.html   # production origin, not localhost
  ```
- **See it working:** serve the exact directory you'll upload and click through the fixed flow, including a non-home route:
  ```bash
  npx serve out    # open http://localhost:3000, check the fix
  ```
- **Compute the CID before uploading** and compare it with the previous release. Use the same settings as your upload tool (CID version, chunker, raw leaves). Otherwise the CIDs won't be comparable.
  ```bash
  ipfs add -r --only-hash -Q --cid-version=1 out    # prints root CID, uploads nothing
  # or: npx ipfs-car pack out --output release.car  (prints root CID)
  ```
  **If it equals the last release's CID, stop.** You're about to re-publish the bug. Go back to steps 1–2.

### 4. Upload that exact directory, then check the result
```bash
# upload packages/nextjs/out (the dir you just checked), record the CID
# it must equal the CID you computed locally
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"   # expect 200
curl -sL "https://<gateway>/ipfs/<cid>/" | grep -c "<string unique to the fix>"
```
- Check that the Open Graph URL and image use the production origin.
- If you serve through ENS, update the contenthash to the new CID only after this review. Then confirm the resolver returns that CID and a public gateway serves it. Only at *this* step can pointer caching cause a real, temporary lag. It still requires a **new** CID.

### Rules to keep
- A different CID is necessary but not sufficient. A same CID proves the fix didn't ship.
- Never upload an `out/` you didn't just rebuild from scratch with `NEXT_PUBLIC_IPFS_BUILD=true`.
- Record commit hash → BUILD_ID → CID for every release, so "what's live" can always be answered from the hashes.
