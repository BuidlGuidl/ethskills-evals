The teammate is not right.

An unchanged IPFS CID proves that the content addressed by the upload is unchanged. In practical release terms, the bytes submitted to IPFS were identical to the previous deploy: same exported files, same asset bytes, same content-addressed DAG. That is stronger than "the gateway is caching." If the CID did not change, the gateway is expected to serve the same app, because the address still names the same content.

So the bug is not downstream in the gateway. The failure happened before or at the upload input:

- the UI fix was not present in the source tree that was built;
- the app was not rebuilt after the fix;
- stale `.next` or `out` artifacts were reused;
- the build used the wrong environment or branch;
- or the upload command pointed at the old export directory instead of the newly generated `packages/nextjs/out`.

Gateway caching can make a changed CID slow to appear through a particular URL, but it cannot explain a successful upload producing the exact same CID after a real byte-level change to the exported app.

The release discipline should be:

```bash
# From the repo root, confirm the fix is actually in the checkout.
git status
git diff
git rev-parse --short HEAD

# Build a fresh static IPFS export.
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

For a Scaffold-ETH 2 IPFS build, the Next config should export static files when `NEXT_PUBLIC_IPFS_BUILD=true`, use route directories, and avoid optimized Next image handling:

```ts
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

Before uploading anything, prove the generated static app contains the fix:

```bash
# Confirm routes were exported as directories.
ls out/*/index.html

# Search for a stable string, class, label, or code fragment that represents the fix.
# Replace the pattern with something specific to the bug you fixed.
rg "fixed-label-or-expected-copy|removed-buggy-marker" out

# Serve the exact static output that will be uploaded.
npx serve@latest out
```

Then open the local server URL and reproduce the fixed workflow against the static export, not the dev server. If the bug affected a non-home route, test that route directly. A dev server passing is not enough; the question is whether `out/` contains the fixed release.

Optional but useful: snapshot the export bytes before upload.

```bash
find out -type f -print0 | sort -z | xargs -0 shasum -a 256 > /tmp/nextjs-out.sha256
```

Only after those checks pass should you upload the freshly built `out` directory. Record the returned CID. If it is unchanged, stop: the upload input is still byte-for-byte the old release. If it changes, verify the deployed content through the gateway, including at least one non-root route:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L \
  "https://<gateway>/ipfs/<new-cid>/<route>/"
```

Expect `200`, not `404`. For ENS, update the content hash only after the new CID has been reviewed and confirmed.
