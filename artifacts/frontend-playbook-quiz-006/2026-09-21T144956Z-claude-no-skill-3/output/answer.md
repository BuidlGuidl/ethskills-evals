# Same CID after a "fix" deploy — is it gateway caching?

## Short answer: no, the teammate is wrong

A CID (content identifier) is a **hash of the uploaded bytes** (plus the settings used to split them into chunks and build the directory tree). Same CID means **the upload was byte-for-byte identical to the last one**. Every file, every byte.

What that proves:

- The directory you uploaded **does not contain the fix**. Any change, even one character in one JS chunk, would give a different root CID (with the same upload tool and settings).
- A gateway **can't** be serving "an old version of this CID". A CID can only ever point to one piece of content, so there's no old or new version of it to cache. Users see the bug because the bug is in what you uploaded.
- Waiting won't help. The content at that CID will never change.

Caching *can* be a real issue, but only after a **new** CID exists, and only in the layer that points a name at it (ENS contenthash, IPNS, DNSLink, or a browser/CDN caching the HTML for a domain). None of that matters until the CID changes.

## Where it went wrong: before the upload, in the build/output step

The upload tool faithfully hashed a folder that has no fix in it. So the break is somewhere between "code edited" and "folder uploaded":

1. **The fix never reached the build input.** File not saved, change on another branch or worktree, edited the wrong package or file, or `git stash`/checkout undid it.
2. **The static export wasn't regenerated, so a stale `out/` got uploaded.** In Scaffold-ETH 2 (SE2), `packages/nextjs/next.config.ts` only sets `output: "export"` (which writes `out/`) when `NEXT_PUBLIC_IPFS_BUILD=true`. A plain `yarn build` / `yarn next:build` writes to `.next/` and **leaves the old `out/` alone**. You then upload last week's `out/` and get last week's CID. This is the most likely cause.
3. **The build failed or stopped partway**, and the upload step ran anyway on the old `out/` (for example, commands chained with `;` instead of `&&`, or errors ignored).
4. **The wrong directory was uploaded** (repo root, `.next/`, a copy made elsewhere, or another checkout).

(Stale Next.js build cache in `.next/cache` is rarely the cause on its own, but wiping it costs nothing. See below.)

## Build discipline that prevents a repeat

Run from the SE2 repo root.

### 1. Confirm the fix is in the source you're building

```bash
git status                     # clean, or you know exactly what's uncommitted
git log -1 --oneline           # the fix commit is HEAD (or you know it's there)
git grep -n "<unique string from the fix>" packages/nextjs
```

### 2. Clean build output, then build the static export

```bash
rm -rf packages/nextjs/out packages/nextjs/.next
# SE2 flag that turns on output:"export" -> writes packages/nextjs/out
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_IGNORE_BUILD_ERROR=true yarn build || { echo "BUILD FAILED"; exit 1; }
cd ../..
test -f packages/nextjs/out/index.html || { echo "no export produced"; exit 1; }
```

Deleting `out/` first means that if the build doesn't produce a fresh export, there's **nothing** to upload. You can't ship a stale folder by accident.

(SE2's `yarn ipfs` script does the IPFS build and the upload together. That's fine, as long as you do the checks below first, or run the build step yourself before uploading.)

### 3. Prove locally that the new build contains the fix, before uploading

a) **Search the output for the fix.** Pick a string that only exists after the fix (new class name, changed text, new label):

```bash
grep -rl "<unique string from the fix>" packages/nextjs/out   # must print files
grep -rl "<string only in the OLD buggy code>" packages/nextjs/out   # should print nothing
ls -la --time-style=full-iso packages/nextjs/out | head         # timestamps = just now (macOS: ls -laT)
```

b) **Serve the exact folder you'll upload and click through the fixed flow:**

```bash
npx serve packages/nextjs/out      # or: npx http-server packages/nextjs/out
```

Open it in a private window (no cache) and reproduce the old bug. It should be gone.

c) **Work out the CID locally without uploading, and compare it to the last deploy:**

```bash
ipfs add -r -Q --only-hash --cid-version 1 packages/nextjs/out
# or, without a local IPFS node:
npx ipfs-car pack packages/nextjs/out --output /tmp/site.car   # prints root CID
```

If it matches the previous deploy's CID, **stop**: the fix isn't in the build. (The exact value only matches your upload tool if the chunking settings match. But "did it change from the last local hash?" is always a reliable test.)

Optional but cheap: put the build's commit hash in the page, e.g. `NEXT_PUBLIC_GIT_SHA=$(git rev-parse --short HEAD)` shown in the footer. Then anyone can see which build a CID serves.

### 4. Upload, check the CID changed, and verify the live content

```bash
# upload (SE2 default uses bgipfs; any pinning tool works)
yarn bgipfs upload packages/nextjs/out      # note the printed CID

# Rule: new CID == previous CID  ->  deploy failed, don't announce it.
curl -s "https://<NEW_CID>.ipfs.dweb.link/" | grep -c "<unique string from the fix>"
```

Keep a log of commit → CID for every deploy so this comparison is automatic.

### 5. Update the pointer users actually visit

If users reach the app through ENS (`yourapp.eth.limo`), IPNS or DNSLink, point it at the **new** CID (e.g. set the ENS contenthash). Only after that step can "wait for caches" be a legitimate explanation, and even then it's the pointer/HTML cache, not the content behind a CID.

## Summary

Unchanged CID = the same bytes were uploaded = the fix isn't in the uploaded folder. The gateway is serving exactly what you gave it. The bug is in the build/output step, most likely a stale `packages/nextjs/out` because the IPFS export wasn't rebuilt. Fix it by deleting `out/` and `.next/`, rebuilding with `NEXT_PUBLIC_IPFS_BUILD=true`, grepping and serving `out/` locally, and hashing it before upload. Treat "same CID as last time" as a failed deploy.
