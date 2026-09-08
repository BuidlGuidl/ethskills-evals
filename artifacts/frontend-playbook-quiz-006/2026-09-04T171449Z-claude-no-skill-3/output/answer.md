# Same CID after a "fix + rebuild + re-upload" — is the gateway to blame?

**No. The teammate has the causality exactly backwards.** An unchanged CID is not
evidence *of* gateway caching; it is proof that there was nothing new for the
gateway to serve. Waiting will never fix this, because no amount of cache
expiry changes what bytes a CID points at.

---

## 1. What an unchanged CID actually proves

A CID is not a version tag, an upload receipt, or a timestamp. It is a
self-describing hash of the DAG built from your file bytes: it encodes the
multihash (sha2-256 by default), the codec (dag-pb / raw), and the CID version.
Two consequences, and only these two:

* **Different content ⇒ different CID.** Guaranteed in practice by the collision
  resistance of sha2-256. There is no mechanism by which changed bytes keep
  their old address.
* **Same CID ⇒ same bytes**, given the same import parameters.

So the unchanged CID proves: **the byte tree handed to the upload tool this time
is identical to the byte tree handed to it last time.** The fix was never in the
artifact you uploaded. That is a fact about *your machine*, established before a
single packet reached IPFS.

Two precision points worth stating so nobody re-litigates this later:

* The CID is a function of content **and** import parameters — `--cid-version`,
  `--raw-leaves`, chunker (`size-262144`), hash function, and whether the
  directory is wrapped. Change a parameter and the CID moves even with identical
  files. That direction of the implication is the one that bites people; it does
  not rescue the teammate's theory, because here the CID *didn't* move.
* **Caching is per-CID and that is the entire point.** `/ipfs/<CID>` is immutable
  and safe to cache forever — gateways send `Cache-Control: public, max-age=29030400,
  immutable`. Staleness in IPFS lives in the *mutable pointers*: IPNS records,
  DNSLink TXT TTLs, ENS `contenthash`, plus the browser's own HTTP cache and any
  service worker. Those are the things that can lag. But every one of them lags
  by *pointing at an old CID* — and the old CID is the CID you just re-published.
  There is no waiting-it-out state to exit.

Corollary worth knowing about Next.js specifically: unless you pin
`generateBuildId`, each `next build` emits a fresh build ID that appears in the
output paths (`out/_next/static/<buildId>/_buildManifest.js`). A genuinely
re-executed build almost always produces a *different* CID even from identical
source. Getting the old CID back is therefore strong evidence that **the build
step did not run at all**, or that the upload read a directory the build never
touched.

---

## 2. Where in the pipeline it must have gone wrong

The failure is upstream of IPFS, in one of four places. In rough order of how
often each is the culprit:

1. **The fix was never in the tree that got built.** Edited on a different
   branch or git worktree; left uncommitted and then built from a clean
   checkout/CI; edited a duplicated or dead component that the route doesn't
   actually render; edited outside `packages/nextjs` in a monorepo where only
   that workspace is exported.
2. **The build never ran, or ran and failed without stopping the pipeline.**
   A `;` where you needed `&&`; a script that ignores exit codes; a type error
   that failed `next build` while the shell marched on to the upload step; a
   Turbo/Nx cache replay ("FULL TURBO") whose key didn't include what you
   changed. The upload step then faithfully re-uploaded the previous artifact.
3. **Stale artifacts survived.** `out/` and `.next/` were never cleaned, so the
   export merged into or left behind the prior output. This is the classic way
   to get a directory whose mtime looks new but whose contents are old.
4. **The upload pointed at the wrong directory** (`out/` vs `build/` vs
   `.next/`, or repo-root vs workspace-root), or the upload tool printed a
   remembered/pinned CID from its own state file rather than re-hashing the
   directory. Confirm the tool actually re-read the folder.

And the one that will bite you *next*, once the CID does change: **publishing a
new CID is not deploying.** The ENS `contenthash` / DNSLink TXT / IPNS record
must be updated to the new CID, and *that* is where TTL patience is genuinely
warranted — but only after the CID has moved.

---

## 3. Build discipline that prevents a repeat

First, look at what your scripts actually do — Scaffold-ETH 2's `ipfs` script has
changed across versions (older ones chain `next build` into an uploader; newer
ones shell out to `bgipfs upload`):

```bash
cat packages/nextjs/package.json | sed -n '/"scripts"/,/}/p'
cat package.json | sed -n '/"scripts"/,/}/p'
```

### 3.1 Confirm the fix is in the source you're about to build

```bash
git status --porcelain           # nothing unexpected uncommitted
git rev-parse HEAD               # note this SHA; it's your deploy identity
git log --oneline -3 -- packages/nextjs
grep -rn "<string from the fix>" packages/nextjs/app packages/nextjs/components
```

### 3.2 Build clean, and make failure loud

```bash
set -euo pipefail                # non-negotiable in any deploy script
rm -rf packages/nextjs/.next packages/nextjs/out
yarn install --immutable

yarn workspace @se-2/nextjs next:check-types   # fail here, not silently later
NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_BUILD_SHA="$(git rev-parse --short HEAD)" \
  yarn workspace @se-2/nextjs build
```

`NEXT_PUBLIC_IPFS_BUILD=true` is what flips SE-2's `next.config` to
`output: "export"` with unoptimized images and relative asset paths — required
for gateway subpath serving. Confirm your config still keys off that variable.

Chain with `&&` (or `set -e`) so a failed build can never reach the uploader.

### 3.3 Stamp the build so this is never ambiguous again

Write the commit SHA into the artifact — e.g. emit
`packages/nextjs/public/build-info.json` in a prebuild step and render the SHA
in the footer:

```bash
printf '{"sha":"%s","builtAt":"%s"}\n' \
  "$(git rev-parse HEAD)" "$(date -u +%FT%TZ)" \
  > packages/nextjs/public/build-info.json
```

Then any deploy is verifiable in one request:
`curl -s https://<gateway>/ipfs/<CID>/build-info.json`. It also guarantees every
real source change produces a different CID.

---

## 4. Prove the fix is in the build *before* uploading

Four checks, cheapest first. Do them on `out/`, never on the dev server —
`yarn start` can be perfectly correct while the static export is broken.

**a. Grep the emitted bundles for the change.**

```bash
grep -rl "<string from the fix>" packages/nextjs/out/_next/static/chunks | head
grep -rl "<string the fix removed>" packages/nextjs/out/_next/static/chunks | head   # expect empty
```

**b. Serve the export and exercise the actual UI path.**

```bash
npx serve packages/nextjs/out -p 3001
# open http://localhost:3001 and reproduce the original bug report
```

**c. Compute the CID offline and compare it to the last deploy.** This is the
single highest-value check — it turns "did anything change?" into a one-line
assertion, with no upload and no network:

```bash
npx ipfs-only-hash -r packages/nextjs/out
# or, with a local kubo node:
ipfs add -rQ --only-hash --cid-version=1 packages/nextjs/out
```

Use the **same import parameters as your upload tool** (CID version, raw-leaves,
chunker), or you'll get a different CID for reasons unrelated to your fix. If
the computed CID equals the previously deployed CID: **stop — do not upload.**
Your artifact is unchanged, and you are about to reproduce exactly today's
situation.

**d. Diff the artifact trees when you need to see *what* changed.**

```bash
(cd packages/nextjs/out && find . -type f | sort | xargs sha256sum) > /tmp/new.manifest
diff /tmp/old.manifest /tmp/new.manifest   # keep each deploy's manifest alongside its CID
```

### 4.1 After upload

```bash
curl -s "https://ipfs.io/ipfs/<NEW_CID>/build-info.json"   # SHA matches HEAD?
```

Then update the mutable pointer (ENS `contenthash` / DNSLink / IPNS) to the new
CID, and pin the new CID on your pinning service *before* repointing. Only at
this step is "wait for the TTL" a legitimate sentence.

---

## Summary

* Unchanged CID ⇒ byte-identical upload. It is proof the artifact never changed,
  not evidence of caching.
* `/ipfs/<CID>` is immutable and cached deliberately; only IPNS/DNSLink/ENS and
  the browser cache can go stale, and they go stale by pointing at an old CID —
  which is what you republished.
* The defect is upstream: the fix wasn't in the built tree, the build didn't run
  or failed silently, stale `out/`/`.next/` survived, or the uploader read the
  wrong directory.
* Discipline: `set -euo pipefail`, `rm -rf .next out`, typecheck then build,
  stamp the commit SHA into the artifact, hash the output locally with
  `ipfs-only-hash -r` and refuse to upload if the CID hasn't moved.
