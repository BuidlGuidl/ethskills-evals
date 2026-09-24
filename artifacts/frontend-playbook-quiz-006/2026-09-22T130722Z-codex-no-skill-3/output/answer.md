# Diagnosis

The teammate is not right.

An IPFS CID is a content address. For a directory upload, the CID is derived from
the IPFS DAG for that directory: file names, directory structure, chunking, and
file bytes. If the upload tool printed exactly the same CID as the previous
deploy, it means the upload tool gave IPFS the same content DAG as before.

That does not prove that a gateway is caching an old response. It proves the
opposite problem: the newly uploaded artifact was not new. If the UI fix changed
any byte in the static build output that was uploaded, the CID would have
changed. Users seeing the old bug at that same CID is expected, because that CID
names the old bytes.

# Where The Pipeline Went Wrong

The failure happened before the gateway could matter.

The likely bad step is one of these:

- the source fix was not present in the checkout that produced the build;
- the frontend build was not rerun after the fix;
- a stale build directory was uploaded;
- the upload command pointed at the wrong directory;
- the build used different inputs than expected, such as stale env vars or an
  old branch;
- the deploy metadata was updated, but the IPFS payload was not.

In a Scaffold-ETH 2 app, the frontend artifact normally comes from
`packages/nextjs`, and the static output to upload is commonly
`packages/nextjs/out` for an IPFS/static export. If `packages/nextjs/out` did not
change, IPFS cannot invent a new CID.

# Build Discipline

Use a clean, repeatable sequence and verify the artifact before uploading it.

```bash
git status --short
git rev-parse --short HEAD
git diff --stat
```

Make sure the intended fix is actually in the working tree or committed at the
revision you plan to deploy.

Then remove stale frontend outputs:

```bash
rm -rf packages/nextjs/.next packages/nextjs/out
```

Install and build from the repo root:

```bash
yarn install --immutable
yarn build
```

If this project uses a workspace-specific build command instead, use the exact
frontend build:

```bash
yarn workspace @se-2/nextjs build
```

For an IPFS static export, confirm that the upload directory was regenerated:

```bash
test -d packages/nextjs/out
find packages/nextjs/out -type f | wc -l
find packages/nextjs/out -type f -print0 | xargs -0 shasum -a 256 | sort > /tmp/se2-out.sha256
```

To prove locally that the new build contains the fix before uploading anything,
inspect and run the built artifact, not the dev server.

First, search the generated files for a string, selector, route, or other
observable marker changed by the fix:

```bash
rg "text-or-code-that-only-exists-after-the-fix" packages/nextjs/out packages/nextjs/.next
```

Then serve the static output locally:

```bash
npx serve packages/nextjs/out
```

Open the local URL printed by `serve` and reproduce the bug scenario there. You
can also check with curl for simple HTML or asset-level changes:

```bash
curl -s http://localhost:3000 | rg "text-or-code-that-only-exists-after-the-fix"
```

Only after the local static artifact shows the fix should it be uploaded to
IPFS:

```bash
# Example shape; use your project's actual uploader.
ipfs add -r packages/nextjs/out
```

Record the returned CID together with the git commit:

```bash
git rev-parse HEAD
```

If the CID is unchanged from the previous deploy, stop. Do not blame the
gateway. The bytes being uploaded are still the same, so go back to the build
artifact and find why the fix did not land in `packages/nextjs/out`.
