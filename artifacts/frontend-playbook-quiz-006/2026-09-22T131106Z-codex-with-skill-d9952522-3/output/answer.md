The teammate is not right.

An unchanged IPFS CID proves that the content-addressed payload uploaded to IPFS is byte-for-byte identical to the previous payload. IPFS CIDs are derived from the uploaded bytes, so if the CID did not change after the supposed fix, the gateway is not the primary suspect. The upload did not contain new build output.

That means the failure happened before or at the upload boundary:

- the app was not rebuilt after the UI fix;
- the rebuild reused stale artifacts;
- the upload command pointed at the old `out/` directory or wrong package;
- the UI fix was not included in the checked-out source being built;
- the build was run without the IPFS/static-export environment expected by the app.

Gateway caching can make users temporarily see an old CID when a mutable pointer such as ENS, DNSLink, or an app link still resolves to that old CID. But it cannot make a newly uploaded, changed directory produce the exact same CID. If the CID is unchanged, the uploaded bytes are unchanged.

The release discipline should be:

```bash
cd packages/nextjs

# Start from a clean static-build target.
rm -rf .next out

# Build the exact IPFS/static export that will be uploaded.
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
yarn build
```

If running on Node 25 and the build crashes during static prerender because a library detects a broken built-in `localStorage`, apply the workaround at process level:

```bash
NODE_OPTIONS="--no-experimental-webstorage" \
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
yarn build
```

or:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage" \
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
yarn build
```

Before uploading anything, prove locally that the generated static files contain the fix. For a visible text/style/markup fix, inspect the exported output:

```bash
grep -R "<unique text or class from the fix>" out
```

For a behavioral UI fix, serve the static export and test the built files, not the dev server:

```bash
npx serve out
```

Then open the local `serve` URL and reproduce the fixed workflow there. This matters because `yarn start` or `yarn dev` can prove the source works without proving that the static IPFS export contains the fix.

Also check that the IPFS export has route directories, not only a working root page:

```bash
ls out/*/index.html
```

After the local proof passes, upload exactly `packages/nextjs/out`. Record the returned CID. If the CID is still the same as the previous deploy, stop: the upload is still receiving the same bytes, so inspect the build output and upload target before blaming any gateway.

After upload, verify the gateway by loading the immutable CID directly:

```bash
curl -L "https://<gateway>/ipfs/<new-cid>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<new-cid>/<non-home-route>/"
```

Only after the new CID has been reviewed should any mutable pointer, such as ENS contenthash or DNSLink, be updated to that CID.
