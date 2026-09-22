# Is the unchanged CID a gateway-cache problem?

No. A gateway cache can make a mutable URL slow to update, but it cannot make a new IPFS object have the same CID as an old IPFS object.

An unchanged CID proves that the uploader handed IPFS the same content-addressed data as last time: the same files, bytes, paths, and metadata in the uploaded DAG. In practical terms, the root artifact that was uploaded did not change. If the UI fix had actually made it into the static bundle being uploaded, the CID would have changed.

So the teammate is drawing the wrong conclusion. The gateway may still cache responses for `/ipfs/<cid>/...`, but if the CID is unchanged, the gateway is serving the content named by that CID. That is the old deploy, by definition.

# Where the pipeline failed

The failure happened before or at the upload input selection, not after IPFS publication.

One of these happened:

- the source fix was not in the checkout used for the build;
- the app was not rebuilt after the fix;
- the build reused stale output;
- the wrong package/app was built;
- the uploader pointed at the previous output directory;
- the fix depends on build-time environment variables that were not changed for the production build;
- the upload command uploaded the old static export, usually something like `packages/nextjs/out`, instead of the freshly built one.

The important boundary is this: once the upload tool prints the same CID, IPFS has told you the uploaded artifact is identical to the previous artifact. The bug is upstream of IPFS.

# Build discipline to prevent this

Use a clean, repeatable sequence and treat the static output directory as the deploy artifact.

From the repo root:

```bash
git status --short
git rev-parse --short HEAD

yarn install --frozen-lockfile

rm -rf packages/nextjs/.next packages/nextjs/out
yarn next:build
```

If your project uses a custom IPFS export script instead of `yarn next:build`, run the script that produces the exact directory your uploader reads. For a static Next/IPFS deploy, that directory is commonly:

```bash
packages/nextjs/out
```

Before uploading, prove the built artifact contains the fix. Do not prove it against `yarn start` or the dev server; prove it against the generated production files.

For a text-visible UI fix:

```bash
rg --fixed-strings "new expected UI text" packages/nextjs/out packages/nextjs/.next/static
! rg --fixed-strings "old broken UI text" packages/nextjs/out packages/nextjs/.next/static
```

For a behavior fix, serve the exact static output locally:

```bash
npx serve@latest packages/nextjs/out -l 4173
```

Then open:

```text
http://localhost:4173
```

or run the relevant browser test against that static server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:4173 yarn playwright test
```

If your uploader has a dry-run/hash-only mode, compute the would-be CID before publishing. With the IPFS CLI, using the same add options as production:

```bash
ipfs add -Qr --only-hash packages/nextjs/out
```

If that local CID equals the previous deploy CID, the artifact is still unchanged.

Only after the generated artifact is verified should you upload it:

```bash
# example shape; use your team's actual uploader
ipfs add -r packages/nextjs/out
```

After upload, compare the printed CID with the previous deploy CID:

```bash
printf 'previous: %s\nnew:      %s\n' "$PREVIOUS_CID" "$NEW_CID"
test "$PREVIOUS_CID" != "$NEW_CID"
```

If the CID is still the same, stop. Do not blame the gateway. The uploaded directory is still byte-for-byte the same deploy artifact, so the fix is not in the artifact being published.
