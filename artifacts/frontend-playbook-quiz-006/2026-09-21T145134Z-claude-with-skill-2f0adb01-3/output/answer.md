# Same CID after a "fix" deploy: is it the gateway cache?

## Short answer: no, the teammate is wrong

An IPFS CID is a hash of the uploaded content. Same bytes give the same CID. Change any byte and you get a different CID.

So an **unchanged CID proves that you uploaded exactly the same bytes as last time**. The upload tool reported the old CID because it received the old files. The new build never reached it.

The gateway can't be the problem for this CID either. Content under `/ipfs/<CID>` never changes, because the address *is* the content hash. A gateway can't hold a stale copy of a CID. It either has those bytes or it doesn't. If a gateway served you the new CID's page with the bug, those bytes contain the bug.

Waiting won't help. The files you uploaded still have the bug, so every gateway will keep serving the bug forever. The fault is **before the upload**, on your machine or in CI.

(A cache delay only applies at the name layer: ENS contenthash or `.eth.link`/`.eth.limo` resolution caches take 5–15 min to pick up a *new* CID. That can't be the cause here, because there is no new CID.)

## Where the pipeline must have broken

Somewhere between "edit source" and "upload", the old output was used. Likely causes, most common first:

1. **Stale `out/` uploaded.** The build failed or never ran, but `out/` from the last deploy was still on disk, and `yarn bgipfs upload out` uploaded it anyway.
2. **Build failure hidden.** `NEXT_PUBLIC_IGNORE_BUILD_ERROR=true`, or a page that crashed during prerendering and was skipped quietly. A missing Node 25+ `localStorage` polyfill is one example. The script "finished" but didn't write fresh output for the changed page.
3. **Wrong build mode.** `NEXT_PUBLIC_IPFS_BUILD=true` wasn't set, so `output: "export"` was off. `next build` then wrote only to `.next/` and left the old `out/` alone.
4. **Wrong directory or wrong source.** The build ran in the repo root instead of `packages/nextjs`, or you uploaded a different `out/` path. Or the fix wasn't in the tree that got built: unsaved file, different branch, not pulled, or CI building an older commit.
5. **Stale `.next` cache reused**, so the changed module wasn't recompiled into new chunks.

Each of these ends the same way: `out/` byte-for-byte equal to the last deploy, so the same CID.

## Build discipline that prevents a repeat

Run every deploy from `packages/nextjs`, always from a clean state:

```bash
cd packages/nextjs

# 0. Confirm the fix is really in the tree being built
git status && git log -1 --oneline
grep -rn "SOME_UNIQUE_STRING_FROM_THE_FIX" app/ components/

# 1. Delete old artifacts. Never build on top of an old out/ or .next/
rm -rf .next out

# 2. Full IPFS build, exact flags every time
NEXT_PUBLIC_PRODUCTION_URL="https://myapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build \
  || { echo "BUILD FAILED, do not upload"; exit 1; }
```

`rm -rf .next out` is the key step. Because of it, a failed or skipped build leaves **no `out/`**, and the upload fails loudly. It can no longer quietly upload the old files.

## Proving locally that the new build contains the fix, before uploading

```bash
# a. out/ exists and is fresh: build output must be NEWER than the source you changed
stat -f '%Sm' app/page.tsx     # source modified time (macOS; Linux: stat -c '%y')
stat -f '%Sm' out/             # build output time
# If the source is newer than out/, the build is stale. Rebuild.

# b. The fix is really in the compiled output.
#    Pick a string unique to the fix (new class name, label text, etc.)
grep -l "SOME_UNIQUE_STRING_FROM_THE_FIX" out/_next/static/chunks/app/*.js out/**/*.html
#    Also check that the buggy string is gone:
grep -rl "OLD_BUGGY_STRING" out/ && echo "BUG STILL PRESENT"

# c. Every route was exported (trailingSlash: true -> dir/index.html)
ls out/*/index.html

# d. Metadata isn't pointing at localhost
grep 'og:image' out/index.html

# e. Test it in a browser, served as static files the way a gateway will serve them
npx serve out        # open the printed URL, reproduce the old bug, confirm it's fixed
```

Upload only after all of these pass:

```bash
yarn bgipfs upload out        # save the CID
```

## After upload

- **The CID must differ from the previous deploy.** If it matches, stop: you uploaded the old files. Don't touch ENS. Go back to the clean build.
- Check the new CID directly, bypassing ENS: `https://community.bgipfs.com/ipfs/<NEW_CID>/`. The fix should be there right away, with no cache wait.
- Update the ENS contenthash to `ipfs://<NEW_CID>` (one mainnet tx), then verify it onchain:
  ```bash
  RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
    "resolver(bytes32)(address)" $(cast namehash myapp.yourname.eth) --rpc-url <RPC>)
  cast call $RESOLVER "contenthash(bytes32)(bytes)" $(cast namehash myapp.yourname.eth) --rpc-url <RPC>
  ```
  Only now does waiting make sense: the `.eth.link` name layer can take minutes to pick up the new CID. The content under the CID itself never goes stale.

## Rule of thumb

A code change always produces a new CID. **Same CID means same bytes means the fix wasn't uploaded.** Fix the build, not the gateway.
