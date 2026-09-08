# The teammate is wrong — and the same CID is the proof

## 1. What an unchanged CID actually proves

An IPFS CID is a **hash of the content**, not a name assigned to an upload. The
uploader chunks your directory into a Merkle DAG and the CID is the multihash of
the root node. So:

> **Identical CID ⇒ the bytes you uploaded were byte-for-byte identical to the
> previous deploy.** Same file names, same file contents, same directory
> structure — nothing changed.

The implication runs one way only, so state it carefully:

- **Same content, same encoder settings → same CID.** Guaranteed.
- **Same content, *different* encoder settings → different CID.** CIDv0 vs
  CIDv1, chunk size, `raw-leaves`, wrap-with-directory, UnixFS vs CAR packing
  all change the root hash. This is why you must always compare CIDs produced
  with the *same* flags.
- **Different content, same CID → does not happen.** That is a SHA-256
  collision. Treat it as impossible.

So the unchanged CID doesn't merely fail to support the caching theory — it
**refutes** it:

- Gateway caching explains *stale bytes served for a pointer* (IPNS, DNSLink, a
  bookmarked domain). It can never explain a CID. Content under
  `/ipfs/<cid>` is immutable; caching it forever is *correct* behaviour, and a
  cache can only ever return the one thing that CID can mean.
- The upload "succeeding" with the old CID means the pinning service already had
  every block and the write was a no-op dedupe. **Nothing new was ever
  published.** There is no new version sitting behind a cache waiting to be
  revealed. Waiting will not fix this — not in an hour, not in a week.

Also worth knowing: Next.js generates a fresh random build ID per build unless
you pin `generateBuildId`, and it lands in the asset paths
(`/_next/static/<buildId>/…`). Two genuine, independent builds of the *same*
source will normally still produce different CIDs. An identical CID is therefore
strong evidence that **no build ran at all** and the previous `out/` directory
on disk was re-uploaded.

What the unchanged CID does *not* tell you: whether the fix is correct, whether
it's in the right file, or whether your users' URL points at this CID anyway.
Those are separate checks (§4).

## 2. Where in the pipeline it must have gone wrong

Everything downstream of "bytes handed to the uploader" is exonerated by the
hash. The failure is strictly upstream, and it is one of two shapes:

**(a) The build never produced new bytes.**
- The build step silently failed and the script continued: `yarn build; yarn
  upload` instead of `&&`, or a shell script without `set -e`. The stale
  `packages/nextjs/out/` from last time was still on disk and got uploaded.
- The upload command was run on its own, without a build, out of muscle memory.
- A Docker/CI layer cache replayed the previous `RUN build` layer, so the
  artifact is literally the old one.
- The uploader points at a different directory than the one the build writes
  (`out/` vs `.next/` vs a custom `distDir`), so it re-uploads a stale path that
  nothing ever rewrites.

**(b) The build ran, but against source that lacks the fix.**
- Wrong branch, wrong worktree, or a detached checkout: the fix is committed on
  a feature branch and the build ran on `main`.
- The fix is unstaged/unsaved locally while CI builds from the remote.
- The edit landed in a file that isn't on the render path — a duplicate
  component, the wrong workspace (`packages/hardhat` vs `packages/nextjs`), a
  dead `components/` copy shadowed by one under `app/`.
- The behaviour is gated by a build-time `NEXT_PUBLIC_*` variable that wasn't
  set in the build environment.

Note that (b) would still normally change the build ID and hence the CID. Given
an *identical* CID, put your money on (a) — start by checking whether the build
actually executed and what the mtimes on `out/` say.

**One thing to confirm regardless:** what URL do users actually load? If they hit
a DNSLink domain, an IPNS name, or a hard-coded gateway link, then even a
correct new CID does nothing until you update that pointer. Caching and TTLs are
real *there* — the teammate's theory is right about a mechanism that simply
isn't the one in play here.

## 3. Build discipline that prevents a repeat

Adjust workspace names to your repo (`cat packages/nextjs/package.json` to see
what `yarn ipfs` actually chains together — it differs across Scaffold-ETH 2
versions).

**Step 0 — prove the source you're about to build contains the fix.**

```bash
git branch --show-current
git log --oneline -3
git status --porcelain            # must be empty; never deploy a dirty tree
git grep -n "someStringFromTheFix"   # the fix is in *tracked* source
```

**Step 1 — clean. Never deploy an incremental build.**

```bash
rm -rf packages/nextjs/out packages/nextjs/.next
```

**Step 2 — build, with failure fatal.**

```bash
set -euo pipefail
yarn install --immutable
yarn workspace @se-2/nextjs build
test -f packages/nextjs/out/index.html      # artifact exists
find packages/nextjs/out -newermt '-5 minutes' | head   # and is actually fresh
```

Wire `set -euo pipefail` and `&&` (never `;`) into any deploy script, so a failed
build can never fall through to an upload.

**Step 3 — stamp the build so provenance is visible in the app.**

In `next.config.*` / your env:

```bash
NEXT_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD) yarn workspace @se-2/nextjs build
```

Render it in the footer. From then on, "is prod running the fix?" is answered by
looking at the page instead of by argument.

**Step 4 — record every deploy.** Append `CID + git SHA + date` to a
`DEPLOYS.md`. Without the previous CID written down you can't do Step 6.

## 4. Proving locally that the new build contains the fix — before uploading

Four checks, cheapest first. Do all four; they fail in different ways.

**4a. Static: grep the artifact, not the source.**

```bash
grep -rl "new copy or identifier from the fix" packages/nextjs/out | head
grep -rl "old buggy string"                    packages/nextjs/out | head   # must be empty
```

For a logic-only fix with no new string, add a distinctive throwaway constant to
the changed code path, confirm it appears in the minified chunk, then decide
whether to keep it. Or build with source maps and grep those.

**4b. Dynamic: serve the exact artifact you're about to upload.**

```bash
npx serve packages/nextjs/out -l 3001
# or: python3 -m http.server 3001 --directory packages/nextjs/out
```

Open `http://localhost:3001` in a **fresh private window**, and walk the original
bug repro. Test `out/`, *not* `yarn start` — the dev server takes different code
paths (no static export, no `assetPrefix`, HMR), so it can pass while the
exported bundle is broken.

**4c. The decisive check: compute the CID locally, before uploading.**

```bash
# kubo — hashes only, no network, no upload:
ipfs add -rQ --only-hash --cid-version 1 packages/nextjs/out

# or without kubo:
npx ipfs-car pack packages/nextjs/out --no-wrap
```

Compare against the CID in `DEPLOYS.md`. **If it matches the last deploy, stop —
your build is byte-identical and uploading is pointless.** This single command,
run before every upload, converts the exact failure you just hit from a
multi-day user-facing bug into a five-second local abort.

Use the *same* flags every time and record them next to the CID; otherwise the
comparison is meaningless (see §1).

**4d. When you still can't explain it, diff the builds.**

```bash
mv packages/nextjs/out out.prev
yarn workspace @se-2/nextjs build
diff -rq out.prev packages/nextjs/out
```

Empty output = nothing changed; you now know exactly which of §2's causes to
chase.

**After uploading**, verify by CID rather than by the URL users have cached:

```bash
CID=<new cid>
curl -s "https://$CID.ipfs.dweb.link/" | grep -o 'build-[0-9a-f]\+'
```

Then — and only then — update the mutable pointer (IPNS / DNSLink) or ship the
new CID link. That pointer update is the step where propagation and TTL genuinely
matter, and it's the step that "we just have to wait it out" was quietly
skipping.
