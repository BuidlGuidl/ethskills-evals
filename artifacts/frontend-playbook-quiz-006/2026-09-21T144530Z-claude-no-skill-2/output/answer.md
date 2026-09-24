# Same CID after a "fix" deploy: diagnosis and build discipline

## Short answer: no, the teammate is wrong

Waiting won't help. A gateway cache can't be the cause here, because **you uploaded the old site again.**

## What an unchanged CID proves

A CID (content identifier) is a cryptographic hash of the uploaded content: every file's bytes, plus the directory structure and file names, under a given chunking/CID-version setting.

- **Same CID ⇒ byte-for-byte identical upload.** Every file in the directory you uploaded matches the previous deploy exactly. If the fix had changed even one byte of one JS chunk, the CID would be different. The only exception is a hash collision, which you can ignore in practice.
- So the upload tool has proven that **the fix is not in the artifact you uploaded**. The tool did its job: it hashed the old files and correctly got the old CID.
- **A gateway can't serve "an old version" of a CID.** Content-addressed data can't change: `/ipfs/<CID>` always means exactly one set of bytes. Caching `/ipfs/<CID>` forever is correct, because that content can never change. Staleness only exists for *mutable pointers* such as IPNS, DNSLink, an ENS `contenthash`, or a browser/service-worker cache of a domain. Those pointers only matter once a *new* CID exists to point at. You don't have one yet.

(A side point: even with a new CID, users only get the fix if the ENS contenthash / DNSLink / link you share is updated to it. That comes *after* you have a correct new CID.)

## Where the pipeline must have broken

The fault sits somewhere between "fix in the editor" and "files handed to the uploader". Checking the SE-2 flow (`yarn ipfs` → Next.js static export into `packages/nextjs/out/` → upload `out/`) from the start:

1. **The fix wasn't in the source that got built.** The file wasn't saved, you were on the wrong branch, the build ran in a different checkout/worktree/CI clone, or the change was only stashed.
2. **The build didn't produce a fresh `out/`, and a stale `out/` was uploaded.** This is the most common cause:
   - The build **failed** (type error, lint error, OOM), but the script or you kept going and uploaded the leftover `out/` from last time. Example: a chain written with `;` instead of `&&`, or someone running the upload step by hand.
   - The build ran **without static-export mode**. In SE-2, `NEXT_PUBLIC_IPFS_BUILD=true` switches on `output: "export"`. Without it, `next build` writes only `.next/` and never touches `out/`, so the old `out/` gets uploaded.
   - The upload was run on its own (for example `bgipfs upload out` or a web UI drag-and-drop) against an old folder, with no rebuild before it.
3. **The wrong directory was uploaded.** For example a copied `out/` somewhere else, or a path relative to the wrong working directory.
4. (Rare) Stale build cache in `.next/cache` reusing old output. Deleting it rules this out cheaply.

The gateway, the IPFS network and the pinning service are all *after* the CID is computed, so none of them can be the cause.

## Build discipline that prevents a repeat

Run everything from a clean tree, always wipe old output, stop on any error, and check the artifact before uploading.

```bash
# 0. Source is what you think it is
git status                      # must be clean: fix committed, nothing stray
git log -1 --oneline            # the commit containing the fix
git rev-parse HEAD > /tmp/deploy-commit

# 1. Wipe ALL previous build output + build cache
cd packages/nextjs
rm -rf .next out

# 2. Reproducible deps
cd ../.. && yarn install --immutable

# 3. Static-export build, abort on any failure
set -euo pipefail
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true yarn build      # must end successfully and create ./out
test -f out/index.html || { echo "no fresh export"; exit 1; }
```

(`yarn ipfs` at the repo root does the build + upload in one step. Only use it once steps 0–1 are done, and check that its script chains with `&&` so a failed build can't lead to an upload.)

## Prove locally the fix is in the build, before uploading

**a) The fix's bytes are in the export.** Pick a string unique to the fix (new label text, class name, constant):

```bash
grep -rl "Your new unique string" out/ || { echo "FIX NOT IN BUILD"; exit 1; }
# and make sure the old buggy string is gone:
! grep -rq "old buggy string" out/
```

Also check that the output is fresh: `ls -la --time-style=full-iso out/` (or `stat out/index.html`) should show timestamps from just now.

**b) The export behaves correctly, served the way IPFS serves it** (static files, no Next server):

```bash
npx serve out            # or: cd out && python3 -m http.server 3000
```

Open it in a private window (no old cache or service worker), reproduce the original bug steps, and confirm it's fixed. Also try a deep route and a hard reload to catch path/trailing-slash problems.

**c) Compute the CID locally without uploading, and compare it to the live one:**

```bash
ipfs add -r --only-hash -Q --cid-version=1 out     # Kubo; hashes only, publishes nothing
# or: npx ipfs-car pack out --output /tmp/site.car   (prints the root CID)
```

- If it **equals the currently deployed CID → stop.** You are about to upload the same thing again. Go back to "Where the pipeline must have broken".
- If it differs, you have a new artifact. Note: the exact value only matches the uploader's CID if the chunker/CID-version settings match. The key question is simply *different from last time or not*.

**d) Upload, then check the result:**

- The uploader's CID must be **different** from the previous deploy. Treat a same CID as a failed deploy, not a caching problem.
- Open `https://<gateway>/ipfs/<NEW_CID>/` directly and confirm the fix.
- Only then update the ENS contenthash / DNSLink, and record `CID ↔ git commit` (from `/tmp/deploy-commit`) in the deploy log.

## Summary

The same CID proves you uploaded exactly the same bytes as before, so the fix never made it into the uploaded folder. The cause is in the source → build → `out/` steps (fix not in source, a failed or non-export build leaving a stale `out/`, or uploading the wrong folder). It is not the gateway. Prevent it by building from a clean tree, deleting `.next` and `out` first, building with `NEXT_PUBLIC_IPFS_BUILD=true` and fail-fast chaining, then grepping and serving `out/` locally and computing its CID with `--only-hash`. Only upload when that CID is new.
