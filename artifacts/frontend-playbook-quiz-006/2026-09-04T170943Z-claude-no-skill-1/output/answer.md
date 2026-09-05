# The CID didn't change. That is not a caching problem.

**Short answer: the teammate is wrong, and the evidence they're citing proves the
opposite of what they think it proves.** An unchanged CID is the one piece of
evidence that conclusively rules out gateway caching. Waiting will not fix
anything, because there is nothing new for the gateway to eventually serve.

---

## 1. What an unchanged CID actually proves

A CID is not a deploy ID, a version number, or a receipt that an upload
happened. It is a hash of the content itself:

```
CID = multihash( UnixFS DAG built from your files )
```

The DAG is built from the file **bytes**, the file and directory **names**, and
the **structure** of the tree. UnixFS does not include mtimes, ownership, or
build timestamps by default, so the mapping is stable and deterministic: the
same tree imported with the same parameters always produces the same CID.

Therefore:

> **Same CID ⇒ byte-for-byte identical content.**
> You uploaded the exact same directory you uploaded last time.

Some precision on the edges, because they matter for how you use this signal:

- The implication holds *given the same import parameters* (CID version, hash
  function, chunker, `raw-leaves`, whether the directory is wrapped). Changing
  those settings on identical content gives you a *different* CID. But the
  reverse — different content colliding onto the same CID — is a SHA-256
  collision. It has not happened.
- The granularity is total. One flipped byte in one JS chunk changes that
  file's CID, which changes its parent directory node, which changes the root
  CID. There is no "close enough."
- With Next.js this is doubly conclusive: production chunk filenames embed a
  content hash. A real source change usually renames files, which changes
  directory entries, which changes the root CID even before you look at bytes.

So the unchanged CID tells you exactly one thing, and it's upstream of
everything the teammate is talking about: **the artifact you uploaded does not
contain the fix.**

## 2. Why "the gateway is caching it" cannot be the explanation

Gateway caching is a real phenomenon, but it is structurally incapable of
producing this symptom:

- **`/ipfs/<cid>/...` responses are immutable by construction.** Gateways serve
  them with `Cache-Control: public, max-age=29030400, immutable` precisely
  *because* the CID pins the content. A new CID is a new cache key. It can never
  be masked by a cached copy of the old one. "Deploy produces a new CID, users
  get the old bytes at that new CID" is not a failure mode that exists.
- **Only mutable pointers can go stale.** IPNS records and DNSLink TXT records
  are the only places where a cache/TTL sits between users and content. If your
  users load `ipns/<key>` or a DNSLink domain, staleness there is possible — but
  that's a *pointer that was never updated*, or a DNS TTL, and the fix is to
  republish and check the pointer, not to wait.
- Even in that scenario, the diagnostic is trivial: fetch the new CID path
  directly. If the direct CID fetch shows the fix and the name doesn't, it's the
  pointer. Here you don't have a new CID at all, so that branch is closed.

The one downstream thing that *can* legitimately show a user stale UI is their
own browser cache / service worker holding a previously-fetched `index.html` at
a stable domain. That is worth remembering — but only once the artifact actually
changes. It's not what's happening now.

## 3. Where in the pipeline it went wrong

The CID is computed from the directory handed to the uploader. Since it is
unchanged, the fault is strictly **upstream of the upload**, and every stage
downstream (upload, pinning, gateway, network, users' browsers) is exonerated.
That leaves four candidates, roughly in order of how often they're the culprit:

1. **The build never ran, but the upload did.** The stale `out/` from the
   previous deploy was still on disk and got re-uploaded. Classic causes: the
   build step failed and the script kept going (`;` instead of `&&`, or a shell
   script without `set -euo pipefail`); the upload was invoked as a separate
   command from a shell where the build hadn't happened; or the build ran in one
   workspace and the upload pointed at another directory.
2. **The fix wasn't in the source that was built.** Uncommitted or stashed
   changes, wrong branch, a second checkout/worktree, an editor buffer that was
   never saved, or a build run from a different clone than the one where the fix
   was written.
3. **The build ran but reused stale output.** A leftover `out/` or `.next/cache`
   that wasn't cleared, or a monorepo task-runner cache (Turbo/Nx) that
   considered the target up to date and replayed a previous artifact.
4. **The fix compiled but is inert in this build.** The edited component isn't
   the one actually rendered (duplicate/shadowed component), or the code path is
   gated on a `NEXT_PUBLIC_*` env var that is inlined at build time and was not
   set for the IPFS build. Note this class would normally still change the CID
   (the source change lands in the bundle even if the branch is never taken), so
   it's the least likely fit here — but it's worth ruling out.

Cause 1 is by far the most common shape of "same CID, confident teammate."

### Confirming which one, in about a minute

```bash
# Is the fix even in the working tree, and committed?
git status --porcelain
git log --oneline -3
git diff HEAD --stat

# Is the fix in the source that would be built? (use a string unique to the fix)
grep -rn "CorrectedLabel" packages/nextjs/app packages/nextjs/components

# Is the artifact stale? Look at its age relative to the source edit.
ls -la  packages/nextjs/out
stat -c '%y %n' packages/nextjs/out/index.html packages/nextjs/.next/BUILD_ID 2>/dev/null

# The decisive one: does the shipped artifact contain the old or the new string?
grep -rl "CorrectedLabel" packages/nextjs/out   # expect hits
grep -rl "OldBuggyLabel"  packages/nextjs/out   # expect nothing
```

If the last two greps say "old string present, new string absent," you have
confirmed the artifact is stale and the discussion about gateways is over.

## 4. Build discipline that prevents a repeat

The root problem is that *building* and *uploading* were two facts that could
drift apart, with nothing asserting they agreed. Fix that structurally.

> Scaffold-ETH 2's script names have changed across versions (`yarn ipfs` at the
> root typically delegates to the `nextjs` workspace, which does a static export
> to `out/` under `NEXT_PUBLIC_IPFS_BUILD=true` and then invokes the uploader).
> Check `package.json` and `packages/nextjs/package.json` in your repo and adapt
> the exact script names below — the discipline is what matters.

### 4.1 Build clean, from a clean tree, fail-fast

```bash
# 1. Refuse to deploy from a dirty tree.
git status --porcelain | grep . && { echo "dirty tree — commit or stash"; exit 1; }
git rev-parse --short HEAD          # record this; it's your deploy identity

# 2. Nuke every source of stale output. This is non-negotiable.
rm -rf packages/nextjs/out packages/nextjs/.next
rm -rf node_modules/.cache .turbo packages/nextjs/.turbo

# 3. Deterministic dependencies.
yarn install --immutable            # yarn 3/4; npm: `npm ci`

# 4. Build only. Do not upload yet.
yarn workspace @se-2/nextjs run build
```

Wrap that in a script with `set -euo pipefail` and chain steps with `&&`, so a
failed build can never fall through to an upload. The uploader must only ever
run in the same invocation that just produced the artifact — never as a
separately-typed command against whatever happens to be in `out/`.

### 4.2 Prove locally that the artifact contains the fix — before uploading

Three checks, cheapest first. Run all three.

**(a) Content assertion — grep the artifact, not the source.**

```bash
OUT=packages/nextjs/out
grep -rq "CorrectedLabel" "$OUT" || { echo "FIX NOT IN BUILD"; exit 1; }
grep -rq "OldBuggyLabel"  "$OUT" && { echo "OLD CODE STILL IN BUILD"; exit 1; }
```

Bake those two lines into the deploy script as a hard gate. This alone would
have caught the current incident.

**(b) Run the exact bytes you're about to ship.**

Do not trust `yarn start` / the dev server — that's a different code path.
Serve the export directory itself:

```bash
npx serve packages/nextjs/out -l 3001
# or: python3 -m http.server -d packages/nextjs/out 3001
```

Open it in a **private window** or with cache disabled in devtools, and
exercise the actual buggy flow. (SE-2's IPFS build emits relative asset paths so
this works from `/`.) You have now seen the artifact behave correctly.

**(c) Compute the CID locally and compare it to the last deploy.**

This turns the CID from a post-hoc mystery into a pre-flight gate:

```bash
ipfs add -rQ --only-hash --cid-version=1 packages/nextjs/out
```

`--only-hash` computes the CID without storing or publishing anything. Compare
against the previously recorded CID:

- **Different** → good, real content change, proceed to upload.
- **Identical** → **stop.** You are about to redeploy the same bytes. Nothing
  downstream will help.

Caveat to use this correctly: the value only matches your uploader's output if
the import parameters match (CID version, chunker, raw-leaves, directory
wrapping). Rather than fight that, make the comparison self-consistent —
compute both the old and new CIDs *with the same local command* and compare
those. Or skip CIDs entirely for this check and use a tool-independent manifest,
which has the advantage of telling you *which* files changed:

```bash
( cd packages/nextjs/out && find . -type f -exec sha256sum {} + | sort -k2 ) > /tmp/manifest-new.txt
sha256sum /tmp/manifest-new.txt
diff /tmp/manifest-prev.txt /tmp/manifest-new.txt   # expect a non-empty diff
```

An empty diff is the same red flag as an unchanged CID, and a non-empty diff
shows you exactly which chunks moved.

### 4.3 Make the deployed build self-identifying

Ship the commit SHA inside the artifact so "what is actually live?" is one
command, not an argument:

```bash
# during build, after export
printf '{"sha":"%s"}\n' "$(git rev-parse HEAD)" > packages/nextjs/out/build-info.json
```

or surface it in the UI via `NEXT_PUBLIC_BUILD_SHA` (remember `NEXT_PUBLIC_*`
values are inlined at build time, so it must be set for the build itself).

**Deliberately omit a build timestamp.** A timestamp makes every build produce a
new CID even when nothing changed, which destroys the exact signal that caught
this bug. Keep the artifact a deterministic function of the commit: same commit
in, same CID out. That property is what makes an unchanged CID informative.

### 4.4 Verify after upload, and keep a deploy log

```bash
CID=<new cid>
ipfs cat "/ipfs/$CID/build-info.json"                    # via your own node
curl -s "https://ipfs.io/ipfs/$CID/build-info.json"      # via a public gateway
curl -s "https://$CID.ipfs.dweb.link/build-info.json"    # and a second one
```

Confirm the SHA matches what you built. Confirm the content is pinned before you
announce it (an unpinned CID can be GC'd out from under you and look like a
"gateway problem" later). Append `date, git SHA, CID` to a checked-in
`DEPLOYS.md` — that log is what makes "the CID is the same as last time"
immediately meaningful instead of a thing someone half-remembers.

If users reach the app through IPNS or DNSLink, republishing the pointer is a
**separate step** with its own verification — and that is the only place in this
whole pipeline where TTLs and "wait it out" have any legitimate role.

---

## Summary

| Claim | Verdict |
|---|---|
| "The CID is the same" | True, and it's the key evidence |
| "…so the gateway is caching the old version" | **False.** Identical CID means identical bytes; a cache can only serve stale content for a *mutable* name, never for a CID you just published |
| "…we just have to wait it out" | **False.** Nothing new was ever published. Waiting changes nothing |
| Actual fault | Upstream of upload: the artifact that was uploaded does not contain the fix — almost certainly a stale `out/` uploaded because the build didn't run, failed silently, or ran against source without the fix |
| Fix | Clean, fail-fast build; assert the fix's presence in `out/` by grepping the artifact; run the exported directory locally; compute the CID with `ipfs add --only-hash` and refuse to deploy if it's unchanged; stamp the commit SHA into the build and verify it after upload |

The one-line takeaway for the team: **a CID is a fingerprint of what you
uploaded, not a receipt that you uploaded something new.** When it doesn't
change, look at the build, never at the network.
