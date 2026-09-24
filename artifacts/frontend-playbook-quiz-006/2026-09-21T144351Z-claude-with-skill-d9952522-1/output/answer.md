# Same CID after "fixing" the bug: is it gateway caching?

## Short answer

No, the teammate is wrong. An unchanged CID is a strong sign that the **fix never made it into the uploaded files**. It does not point to a gateway caching problem.

## What an unchanged CID proves

- An IPFS CID is a hash of the content itself (for a directory: every file's bytes, file names and structure). It is not a label for "the latest version" of anything.
- Same CID means the **bytes you uploaded are identical** to the previous deploy, file for file. If even one byte of the fixed JS bundle had changed, the root CID would be different.
- A gateway cannot serve "an old version" of a CID. A CID has exactly one version, and the content can be checked against the hash. Caching only matters for mutable names (ENS contenthash, IPNS, DNSLink). Those can point to an old CID for a while. Here, though, the upload itself produced the old CID, so the old CID is simply what you uploaded.
- So "waiting it out" will never fix this. The bug is baked into that CID forever.

## Where the pipeline must have broken

The problem is **before or at the upload step**, not at the gateway. Likely causes, most common first:

1. **Stale build output.** `out/` (or `.next/`) was left over from the previous build and got uploaded again. Common ways this happens:
   - the build failed or was skipped (for example, a chained command stopped early and nobody noticed)
   - the build ran in a different directory or package than the one uploaded
   - `NEXT_PUBLIC_IPFS_BUILD=true` was not set, so Next did not write a fresh static export to `out/`. The old `out/` stayed there and was uploaded.
2. **Wrong upload target.** The tool uploaded a different path than the one that was just built (for example, repo root vs `packages/nextjs/out`, or a hardcoded path in a script).
3. **Fix not in the built source.** The build ran from code without the fix: fix not saved, not committed or pulled on the machine or CI that built it, wrong branch, or the fix is in a file the app does not actually use.
4. (Only after the above is ruled out) If users open the app through an **ENS name or IPNS**, check which CID that name resolves to. It may still point to the old CID. That is a separate "pointer not updated" issue, not a gateway cache issue, and it does not explain the upload tool printing the old CID.

## Build discipline that prevents a repeat

Run from `packages/nextjs` (Scaffold-ETH 2). First make sure `next.config.ts` switches to static export for IPFS builds:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

Then build from a clean state every time:

```bash
cd packages/nextjs

# 0. Make sure the fix is really in the source you are building
git status && git log -1 --oneline        # right branch/commit, nothing uncommitted you rely on

# 1. Delete ALL old artifacts. This is the key step.
rm -rf .next out

# 2. Clean production build, stop on failure
set -e
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
# (Node 25 only, if prerender crashes on localStorage.getItem:
#  prefix with NODE_OPTIONS="--no-experimental-webstorage"
#  or NODE_OPTIONS="--localstorage-file=.node-localstorage")

# 3. out/ must be brand new (fresh timestamps) and contain every route
ls -la out
ls out/*/index.html                        # one index.html per route
```

Upload **exactly** `packages/nextjs/out`, and nothing else, only after the checks below pass.

## Proving locally that the fix is in the build (before upload)

1. **Find a unique marker from the fix in the output.** Pick a string that exists only in the new code (a changed class name, label text, constant):
   ```bash
   grep -rl "<string-unique-to-the-fix>" out/        # must find at least one file
   grep -rl "<string-only-in-the-old-buggy-code>" out/   # should find nothing
   ```
2. **Compute the CID locally and compare it to the previous deploy.** No upload happens here:
   ```bash
   ipfs add -r -Q --only-hash --cid-version=1 out
   ```
   If this prints the **old CID**, stop: the build is unchanged, so don't upload. It must print a new CID. (Use the same CID version and chunking options as your upload tool so the numbers are comparable.)
3. **Serve the static export and check it in a browser:**
   ```bash
   npx serve out        # or: python3 -m http.server -d out
   ```
   Open the root and at least one non-home route (e.g. `/debug/`) and confirm the bug is gone.
4. **Check the metadata:** Open Graph URLs and images in `out/**/index.html` use the production domain, not `localhost`:
   ```bash
   grep -ro 'og:image" content="[^"]*' out | head
   ```

## After upload

- The upload tool must print the **same new CID** you computed locally. If it prints the old one, the tool uploaded the wrong directory.
- Check through a gateway, including a non-root route:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -L "https://<gateway>/ipfs/<new-cid>/"        # 200
  curl -s -o /dev/null -w "%{http_code}" -L "https://<gateway>/ipfs/<new-cid>/debug/"  # 200, not 404
  ```
- If you use ENS: update the contenthash to the new CID only after it has been reviewed. Then confirm the resolver returns the new CID and a public gateway (e.g. `<name>.eth.limo`) serves it. Only this pointer step can show a real propagation delay.
