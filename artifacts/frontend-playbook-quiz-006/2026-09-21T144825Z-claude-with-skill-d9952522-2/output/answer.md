# Same CID after a "fixed" redeploy: what's wrong

## Short answer: the teammate is wrong

The upload tool calculates a CID (content identifier) by hashing the files it uploads. If the CID didn't change, the **bytes you uploaded didn't change**: you uploaded exactly the same directory tree as last time, bug included. So the fix never made it into the uploaded bytes.

Gateway caching can't explain this:

- Content under a CID can't change. `/ipfs/<cid>/` always serves the same bytes on every gateway, forever. No gateway has an "old version" and a "new version" of one CID, because only one version exists.
- The only thing that *can* be cached or stale is a changeable pointer to a CID, such as an ENS contenthash, IPNS, or DNSLink. But no new CID exists for any pointer to move to. Waiting won't help, and neither will purging caches or updating ENS. The bug is in the published content.

### What an unchanged CID proves, precisely

- **Proves:** the uploaded directory is byte-for-byte identical to the previous upload: same files, same contents, same structure. This assumes the tool's settings (CID version, chunker, hash function) didn't change. Different settings can give identical bytes a *different* CID, but different bytes never give the *same* CID (barring a hash collision, which doesn't happen in practice).
- **Doesn't prove:** anything about gateways, caches, or the network. It points to the local pipeline, **before** the upload.

One more clue: by default, Next.js creates a new random build ID on every `next build` and writes it into the output (`out/_next/static/<buildId>/`, plus references in the HTML). So a real fresh rebuild would normally produce a **different CID even with no code change**. An identical CID strongly suggests the uploaded `out/` wasn't regenerated at all. The one exception is a deterministic `generateBuildId` in `next.config` (for example, the git commit hash); check for that.

## Where it went wrong (check in this order)

1. **The upload used an old `out/`.** Common causes:
   - The build failed partway (a type/lint error or a prerender crash) and nobody noticed. The old `out/` from the previous release was still on disk and got uploaded.
   - The build ran without `NEXT_PUBLIC_IPFS_BUILD=true`, so `output: "export"` was off. Next wrote only `.next/` and never touched `out/`, which still held the old export.
   - Node 25 prerender crash (`localStorage.getItem is not a function`) killed the export step. The old `out/` stayed.
2. **The upload tool pointed at the wrong directory.** For example, a different path than `packages/nextjs/out`, an old copy, a folder in another checkout or worktree, or a path set in the tool's config.
3. **The fix wasn't in the source that got built.** The build ran on the wrong branch, the fix was uncommitted in a different checkout, the file wasn't saved, or a CI job built an older commit.
4. **The fix doesn't reach the static export.** For example, it lives in server-only code (API routes, middleware, server actions, runtime rewrites). A static export drops or ignores that code, so the exported HTML/JS stays the same.

All four happen before the upload. None is on the gateway side.

## Build discipline that prevents a repeat

Run from `packages/nextjs`, stop at the first error (`set -e`), and always start from a clean output folder:

```bash
set -euo pipefail
git status --porcelain            # must be empty: build only committed code
git log -1 --oneline              # record which commit you're shipping

cd packages/nextjs
rm -rf .next out                  # no stale artifacts can survive a failed build

# NODE_OPTIONS line: only needed on Node 25 if prerender crashes on localStorage
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
NODE_OPTIONS="--no-experimental-webstorage" \
yarn build
```

`next.config.ts` must turn on static export for IPFS builds:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

Because `out/` was deleted first, a failed build leaves **no** `out/`. The upload then fails loudly instead of quietly shipping the last release.

## Prove locally that the new build contains the fix before uploading

1. **The output is fresh and complete:**
   ```bash
   test -d out || { echo "no export produced"; exit 1; }
   find out -newer package.json -name index.html | head   # files written just now
   ls out/*/index.html                                     # every route has its own dir
   ```
2. **The fix itself is in the bytes.** Grep for a string, class name, or value that only exists after the fix (and make sure the buggy version is gone):
   ```bash
   grep -rl "<unique string from the fix>" out/ || { echo "FIX NOT IN BUILD"; exit 1; }
   grep -rl "<string only in the buggy version>" out/ && { echo "OLD CODE STILL PRESENT"; exit 1; }
   ```
3. **The fix works when served as static files**, the way IPFS serves them, not in `yarn start` (the dev server):
   ```bash
   npx serve out        # open the affected page and a non-home route and reproduce the bug scenario
   ```
4. **Calculate the CID locally, without uploading, and compare it to the last release:**
   ```bash
   ipfs add -r -Q --only-hash --cid-version 1 out
   ```
   If it equals the previous release's CID, **stop**: you're about to ship the same bytes again. To match the upload tool's CID exactly, use the same CID version and chunker settings. For the "did anything change?" check, it's enough that it differs from the previous local hash.
5. **Production origin is baked in** (no `localhost` in the metadata):
   ```bash
   grep -rho 'og:image" content="[^"]*' out/index.html
   grep -rl "localhost" out/ && echo "WARNING: localhost in build"
   ```

Upload only after all five checks pass.

## After uploading

1. Record the new CID. It **must differ** from the previous one. If it doesn't, go back to the pipeline; don't wait.
2. Fetch the new CID through a gateway and confirm the fix is there, plus a non-home route:
   ```bash
   curl -sL "https://<gateway>/ipfs/<newcid>/" | grep "<unique string from the fix>"
   curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<newcid>/debug/"   # expect 200
   ```
3. Check that the Open Graph URL and image use the production domain.
4. If users reach the app through ENS (or IPNS/DNSLink), update the contenthash to the **new** CID only after it's reviewed. Then confirm the resolver and a public gateway (for example, `<name>.eth.limo`) serve that CID. Until the pointer moves, users keep getting the old CID. That's a stale pointer, not a gateway cache.
