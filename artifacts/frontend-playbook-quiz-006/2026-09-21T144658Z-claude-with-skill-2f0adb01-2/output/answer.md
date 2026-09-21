# Same CID after a "fixed" deploy: is it the gateway cache?

## Short answer: no, the teammate is wrong

The upload printed the **same CID** as last time. That means you uploaded **the same bytes** as last time. The fix never got into the files you uploaded. Waiting won't help. Every gateway, now and later, will serve the old buggy build for that CID, because that CID *is* the old buggy build.

## What an unchanged CID proves

- A CID (content identifier) is a hash of the content. The upload tool hashes every file plus the folder layout of `out/`, and that hash becomes the CID.
- **Same CID ⇒ the uploaded folder was byte-for-byte identical to the previous upload**, as long as it's the same tool with the same settings. Every file, every byte, every path matches. Two different inputs landing on the same hash by accident is not a realistic possibility.
- **Any real code change that reaches the build output gives a new CID.** Even a one-character change in one JS chunk changes that file's hash, then its folder's hash, then the root CID.
- So an unchanged CID proves the fix is **not in the uploaded folder**. It says nothing about the network. The problem happened on your machine, before the upload.

### Why "the gateway is caching the old version" can't explain it

- Content at `/ipfs/<CID>` never changes: one CID always maps to the same content. A gateway can't hold a "stale" copy of a CID. Old and new are the same thing.
- The only part that can change over time is the **name → CID pointer**: the ENS `contenthash` record, read by `.eth.link`/`.eth.limo`. That pointer can lag (gateway caches of the ENS lookup take about 5–15 min). But even if you updated it, you'd be pointing it at the **same CID**. Nothing changes for users.
- Caching only becomes a plausible suspect once all three are true: (1) the CID changed, (2) the ENS contenthash was updated to the new CID and you confirmed it onchain, and (3) `https://<gateway>/ipfs/<NEW_CID>` shows the fix but the `.eth.link` URL doesn't. None of that is true here.

## Where the pipeline must have broken

The pipeline is: **source edit → build (`.next/` → `out/`) → upload `out/` → CID → ENS contenthash → gateway**. The CID came out the same, so the break is somewhere **before the hash**: the uploaded `out/` never got the fix. Likely causes, most common first:

1. **No real rebuild.** Someone uploaded the `out/` left over from the last deploy. Maybe the build was never run, or it was run in another terminal or another checkout.
2. **The build failed or partly failed, and the old `out/` was still there.** With `NEXT_PUBLIC_IGNORE_BUILD_ERROR=true`, errors are easy to miss. If `out/` wasn't deleted first, the old files stay behind and get uploaded again.
3. **The page with the fix was skipped during prerendering** (the build step that renders each page to static HTML). Examples: a `localStorage`/browser-API crash, or the Node 25+ `localStorage.getItem is not a function` error. The page is dropped quietly and the old or missing version stays.
4. **Wrong directory built or uploaded.** For example, you built in the repo root but uploaded `packages/nextjs/out` from an old run. Or you built a different branch or worktree, or ran `yarn bgipfs upload` from the wrong folder.
5. **The fix wasn't in the source that got built.** The edit wasn't saved, it's on another branch, it wasn't pulled on the machine that built, or it's in a file the app doesn't actually import.
6. **A non-IPFS build.** The build ran without `NEXT_PUBLIC_IPFS_BUILD=true`, so no new static export went to `out/` and the old `out/` was uploaded.

## Build discipline that prevents a repeat

Run from `packages/nextjs`, every time, with no shortcuts:

```bash
cd packages/nextjs

# 0. Make sure the source is the fixed source
git status                      # fix saved and committed, right branch
git log -1 --oneline            # note which commit you're shipping

# 1. ALWAYS delete old build output first, so leftover files can't be uploaded
rm -rf .next out

# 2. Full IPFS build from scratch
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build 2>&1 | tee build.log

# 3. Read the log. Pages that failed to prerender are missing from the upload
grep -iE "error|failed|prerender" build.log
```

`next.config.ts` must have the IPFS settings (`output: "export"`, `trailingSlash: true`, `images.unoptimized: true` when `NEXT_PUBLIC_IPFS_BUILD === "true"`). Otherwise `out/` isn't produced correctly and routes return 404.

## Prove locally that the new build contains the fix, before uploading

```bash
# a) out/ is newer than the source you changed
#    (source newer than out/ means STALE BUILD: rebuild)
stat -f '%Sm' app/page.tsx          # or whichever file holds the fix
stat -f '%Sm' out/

# b) The fix's unique text or code is actually in the output
#    Pick a string that exists only in the fixed version
#    (new class name, new label, changed text)
grep -rl "UNIQUE_FIX_STRING" out/_next/static/chunks/
grep -l  "UNIQUE_FIX_STRING" out/**/index.html   # if it's in prerendered HTML
#    And make sure the OLD buggy string is gone:
grep -rl "OLD_BUGGY_STRING" out/ && echo "STILL CONTAINS BUG"

# c) Every route was exported (each needs dir/index.html)
ls out/*/index.html
grep 'og:image' out/index.html      # production URL, not localhost

# d) Click through the exact static files you're about to upload
npx serve out                        # open it, reproduce the bug scenario, confirm it's fixed

# e) Optional: compute the CID WITHOUT uploading, and compare with the last deploy's CID
#    (use the same CID version/chunking settings as your upload tool)
ipfs add -r -Q --only-hash --cid-version 1 out
#    Same as the previous CID means you're about to re-upload the bug. Stop.
```

Only after (a)–(d) pass:

```bash
yarn bgipfs upload out              # write down the CID next to the git commit
```

## After uploading

1. **Compare the new CID to the previous one.** If it's the same, stop: nothing changed. Go back to the build steps and don't touch ENS.
2. Open `https://community.bgipfs.com/ipfs/<NEW_CID>` and confirm the fix is live at the raw CID.
3. Update the ENS content hash to `ipfs://<NEW_CID>` (ENS app → Records → Other → Content Hash), then verify it onchain:
   ```bash
   RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
     "resolver(bytes32)(address)" $(cast namehash yourapp.yourname.eth) \
     --rpc-url https://eth.llamarpc.com)
   cast call $RESOLVER "contenthash(bytes32)(bytes)" \
     $(cast namehash yourapp.yourname.eth) --rpc-url https://eth.llamarpc.com
   ```
4. Check routes and the ENS URL:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -L "https://community.bgipfs.com/ipfs/<NEW_CID>/debug/"
   curl -s -o /dev/null -w "%{http_code}" -L "https://yourapp.yourname.eth.link"
   ```
   Only now does "wait a few minutes for gateway caches" make sense, and only for the `.eth.link` name lookup. It never applies to the CID itself.

## Rule of thumb

**Deleted old output + rebuilt + fix string found in `out/` + new CID ≠ old CID + ENS contenthash updated and verified onchain.** If any one is missing, the deploy isn't done. An unchanged CID always means "we uploaded the old build". It never means "the gateway is caching".
