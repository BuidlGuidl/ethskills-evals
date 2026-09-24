# Same CID after "fix" — is it gateway caching?

## Short answer: No. Teammate is wrong.

A CID is a hash of the uploaded bytes. It is not a name or a pointer that can go stale.

- **Same CID = same bytes, exactly.** The directory you just uploaded matches the old deploy bit for bit: every file, every file name, the whole folder layout. Your fix is **not in what you uploaded.**
- Gateway caching can't cause this. A gateway serving `/ipfs/<CID>` can't return "old" content for a CID, because only one set of content ever has that CID. If the new upload really contained the fix, the tool would have printed a **different** CID. Nothing is stale on the server side, so waiting won't help: the server is already serving exactly what you gave it.
- Side point: even with a correct new CID, users still land on the old site if they reach it through a stable name (ENS `contenthash`, DNSLink, a bookmarked old CID link). That's a separate step. You never got that far, because there's no new CID yet.

## Where it broke: before upload, in the build step

The upload tool hashed the same `out/` folder as last time. SE-2's `yarn ipfs` (in `packages/nextjs`) is roughly:

```
NEXT_PUBLIC_IPFS_BUILD=true yarn build   # next build → static export into out/
yarn bgipfs upload out                   # hash + upload whatever is in out/
```

So `out/` held the old build. Likely causes, most likely first:

1. **Build failed or never ran, but upload ran anyway.** Example: the build was run separately and its error went unnoticed, then `bgipfs upload out` / `ipfs add -r out` was run on its own. `out/` from last deploy was still on disk.
2. **Uploaded the wrong folder.** For example `.next/` instead of `out/`, a folder from another checkout, or an `out/` at the repo root instead of `packages/nextjs/out`.
3. **The fix wasn't in the source that got built.** Unsaved file, wrong branch or worktree, uncommitted change on another machine, or the CI built an older commit.
4. **Stale build cache.** `.next/cache` reused old compiled output (rare, but `rm -rf .next` rules it out).
5. **The fix lives somewhere the static export doesn't read.** For example a change behind `process.env` that only takes effect at `next dev` / server runtime, or a `NEXT_PUBLIC_*` value that was baked in at build time from an old `.env`.

## Build discipline (prevents a repeat)

Run from `packages/nextjs` (or use `yarn workspace @se-2/nextjs ...`):

```bash
# 0. Build from the commit you mean to deploy
git status                      # must be clean
git log -1 --oneline            # note the commit hash that contains the fix

# 1. Delete ALL old output so nothing stale can be uploaded
rm -rf .next out

# 2. Build; stop immediately if the build fails
set -e
NEXT_PUBLIC_IPFS_BUILD=true yarn build
test -f out/index.html          # export really produced output

# 3. Prove the fix is in the built bytes (see next section)

# 4. Compute the CID locally, WITHOUT uploading, and compare to the live one
npx ipfs-car pack out --output /tmp/site.car   # prints root CID
#   or, with kubo:  ipfs add -r -Q --only-hash --cid-version=1 out
#   New CID must differ from the currently deployed CID. Same CID → stop, don't upload.
#   (Use the same settings as your upload tool, e.g. CID version, chunker, raw leaves;
#    different settings give a different CID for the same files.)

# 5. Only now upload
yarn bgipfs upload out          # CID printed must equal the local one from step 4

# 6. Point users at it: update ENS contenthash / DNSLink to the new CID,
#    then verify via a gateway:  curl -s https://<gateway>/ipfs/<NEW_CID>/ | grep <marker>
```

Best practice: run steps 1–5 as one script (or in CI) with `set -e`. That way a failed build can never be followed by uploading an old `out/`. Record commit hash → CID for every deploy.

## Proving locally the new build contains the fix, before uploading

1. **Grep the build output for the fix.** Choose a string that only exists after the fix: new text, a class name, a changed constant.
   ```bash
   grep -rl "the new string" out/          # must find matches
   grep -rl "the old buggy string" out/    # should find none
   ```
   Code gets minified, but string literals and text survive, so grep for those.
2. **Diff against the last deploy.** Keep the previous `out/` (or download it: `ipfs get <OLD_CID> -o prev-out`), then run:
   ```bash
   diff -rq prev-out out     # must list changed files; no output = identical = same CID
   ```
3. **Serve the exact folder you'll upload, and click through the fix.** Use a static server, not `yarn dev`: dev mode builds from source and can hide build/export problems.
   ```bash
   npx serve out            # or: npx http-server out
   ```
   Open it in a private window (no old browser cache), go to the fixed page, and confirm the bug is gone. Check some non-root routes too, since IPFS static hosting relies on `trailingSlash` / `index.html` routing.
4. **Local CID ≠ deployed CID** (step 4 above). This is the final check: a different hash proves the bytes changed. Grep + serve prove the change is your fix.

Only when all four pass should you upload. After upload, the CID printed by the tool should match the one you computed locally.
