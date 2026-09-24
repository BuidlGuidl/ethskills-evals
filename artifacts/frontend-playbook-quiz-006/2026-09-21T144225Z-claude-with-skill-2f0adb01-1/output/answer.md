# Same CID after "fixing" a bug: is the gateway caching it?

## Short answer: no, the teammate is wrong

An IPFS CID is a hash of the content. The CID for a folder like `out/` comes from every file's bytes, plus the file names and folder layout. So:

- **Same CID means the uploaded bytes were exactly the same as last time.** The upload tool hashed the same files and got the same result. The fix was never in the folder you uploaded.
- A real change to the UI code always changes at least one compiled JS chunk, so it always gives a new CID. The only exception is running the same tool with the same chunking settings on files that really are identical.
- Gateway caching can't explain this. `/ipfs/<CID>` is content-addressed, meaning the address is derived from the content. A gateway serving that CID returns exactly those bytes, forever. Every gateway, fresh or cached, serves the same old bug, because the old bug *is* the content. No amount of waiting will change `/ipfs/<oldCID>`.

(Caching does matter in one place: **after** you have a *new* CID and update the ENS contenthash, `yourapp.eth.link` can keep serving the old CID for about 5–15 minutes. That is a delay in looking up the ENS name, not a stale file. It doesn't apply here because no new CID exists.)

## Where the pipeline broke

The problem is somewhere between "edited source" and "`yarn bgipfs upload out`". The folder you uploaded did not contain the fix. Likely causes, most likely first:

1. **Stale `out/` or `.next/`.** The build wasn't run again, or it reused old files, or it failed partway and left the previous `out/` in place. Uploading that folder gives the old CID.
2. **The build failed without anyone noticing.** `NEXT_PUBLIC_IGNORE_BUILD_ERROR=true` hides type and lint errors. A page that crashes during static prerendering (for example, `localStorage` in Node 25+ without the polyfill) gets skipped. So you may have "rebuilt" but kept the old output.
3. **Wrong source.** The build ran from a different branch, worktree, or checkout (CI or another machine), or the fix was never saved, committed, or pulled.
4. **Wrong folder uploaded.** For example, an old `out/` from another path, or the `yarn bgipfs upload out` command run from the wrong directory.
5. **The fix isn't in the code that ships.** The edited file isn't imported by the page, or the change only exists in dev mode (`yarn start`) and not in the static export (`NEXT_PUBLIC_IPFS_BUILD=true`).

The gateway, IPFS, and ENS are not at fault. The upload did its job and faithfully published stale input.

## Build discipline that prevents a repeat

Run from `packages/nextjs`, every time, after any code change:

```bash
cd packages/nextjs

# 0. Make sure you're building the code you think you are
git status && git log -1 --oneline

# 1. Delete old build output. This step is required.
rm -rf .next out

# 2. Full clean build. Stop the script if the build fails.
set -e
NEXT_PUBLIC_PRODUCTION_URL="https://myapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

Read the build log. Don't just check the exit code, because `IGNORE_BUILD_ERROR` lets it succeed even with errors. Look for `Error occurred prerendering page`, and check that every expected route is listed.

## Proving locally that the fix is in the build, before uploading

```bash
# a) The fix's unique string/class/text is present in the compiled output
grep -rl "UNIQUE_STRING_FROM_FIX" out/_next/static/chunks/
grep -rl "UNIQUE_STRING_FROM_FIX" out/_next/static/chunks/app/*.js
# If nothing matches, the fix is not in the build. Do not upload.

# b) Build output is newer than the source you edited
stat -f '%Sm' app/page.tsx          # (the file you fixed)
stat -f '%Sm' out/
# If the source is newer than out/, the build is stale. Rebuild.

# c) Every route was exported (trailingSlash layout)
ls out/*/index.html
grep 'og:image' out/index.html      # must not be localhost

# d) Actually look at it: serve the static export and click through the fixed UI
npx serve out                        # open http://localhost:3000, check the bug is gone

# e) Predict the CID without uploading. It must differ from the last deploy's CID.
ipfs add -r --only-hash -Q out       # kubo; computes the hash only, publishes nothing
```

For (e), your local `ipfs` settings may not match bgipfs (different chunking settings give different CIDs). So compare this against the same command run on the previous build, not against the CID bgipfs printed. What matters is that it changed.

Optional but cheap: put the git commit hash into the build, for example `NEXT_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD)`, and show it in the footer or a `<meta>` tag. Every build then produces different bytes that you can check, and you can `grep` `out/` or the live site to see which commit is actually serving.

## Only then upload and publish

```bash
yarn bgipfs upload out     # the CID must be NEW. If it matches the last deploy, stop: the build is stale.
```

1. Check `https://community.bgipfs.com/ipfs/<newCID>` directly and confirm the bug is gone there.
2. Update the ENS contenthash to `ipfs://<newCID>`.
3. Check it onchain (`cast call $RESOLVER "contenthash(bytes32)(bytes)" $(cast namehash myapp.yourname.eth)`).
4. Wait out the short ENS lookup cache on `.eth.link`.

**Rule of thumb: an unchanged CID never means "wait". It means "you uploaded the old files, rebuild".**
