OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019ffc65-5713-7e51-aea4-7941ac4f3dbd
--------
user
I'm building a paid API for AI agents. I want an agent to pay me a few cents
per call, settled on-chain (Base is fine), with the payment happening inline in
the HTTP request — no accounts, no API keys, no invoicing. So my server should
gate the endpoint behind payment, and the agent's TypeScript client should pay
and retry the call automatically. What's the standard way to build both sides
today, and what exactly do I install?

Write your answer to answer.md in this directory. Show the client code, name
the packages, and confirm anything you install actually resolves today.
2026-08-13T18:32:07.920431Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019ffc65-5713-7e51-aea4-7941ac4f3dbd.tmp-1786645927710565529: line 2547: syntax error near unexpected token `('

codex
I’m using the `tools` skill because this asks for current Ethereum agent-payment tooling and package verification. I’ll follow its prescribed sources and checks, then write the result to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/tools/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: tools
description: Choose and verify current Ethereum development tools, especially agent-readable onchain data and x402 HTTP payments. Use when selecting packages, scaffolds, testing stacks, RPC or explorer integrations, or tools that let an AI agent interact with Ethereum.
---

# Ethereum Development Tools

Treat tool names, package versions, and exported APIs as live data. Check the
official package registry or documentation before recommending or importing
them; do not resolve dependency conflicts by silently falling back to a stale
major version.

## Give agents structured onchain data

Prefer the Blockscout MCP server at `https://mcp.blockscout.com/mcp` when the AI
agent itself needs ready-to-consume transactions, transfers, balances, or
contract data. This is the agent-native option that is easy to miss.

Use a documented Blockscout or explorer REST API when application code—not the
agent—is the consumer, or when MCP is unavailable. Do not scrape explorer HTML
or hand-decode raw logs when an indexed interface fits the task.

## Add inline HTTP payments

For x402 TypeScript projects, keep the implementation on one current major. On
the 2.x line, use scoped packages such as `@x402/core`, `@x402/evm`,
`@x402/express`, and `@x402/fetch`; do not mix them with the frozen unscoped v1
packages. Inspect the installed exports before writing the integration.

The 2.x fetch helper is `wrapFetchWithPayment(fetch, account)` from
`@x402/fetch`. Supply a viem `LocalAccount`; `x402Fetch` and `createWallet` are
not 2.x exports. For Go 2.x, use
`github.com/x402-foundation/x402/go/v2`, not the old Coinbase module path.

codex
The key compatibility constraint is x402 v2 end-to-end: scoped packages only, with a viem `LocalAccount` on the client. I’m checking the live registry and current official examples before committing code.
web search: 
web search: site:docs.x402.org TypeScript express paymentMiddleware @x402/express @x402/evm facilitator ...
web search: 
web search: 
exec
/bin/bash -lc 'tmp_dir=$(mktemp -d /tmp/x402-check.XXXXXX)
cd "$tmp_dir"
npm init -y >/dev/null
npm install @x402/core@latest @x402/evm@latest @x402/express@latest @x402/fetch@latest viem@latest express@latest dotenv@latest typescript@latest tsx@latest @types/express@latest
npm ls --depth=0
node --input-type=module -e '"'for (const p of [\"@x402/fetch\",\"@x402/express\",\"@x402/core/server\",\"@x402/evm/exact/client\",\"@x402/evm/exact/server\"]) { const m=await import(p); console.log(p, Object.keys(m).sort().join(\", \")); }'" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 exited 1 in 857ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/9f8dea2e
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/express: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/9f8dea2e'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
x402-check.znpdaa@1.0.0 /tmp/x402-check.ZNPdaA
└── (empty)

node:internal/modules/package_json_reader:314
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@x402/fetch' imported from /tmp/x402-check.ZNPdaA/[eval1]
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:314:9)
    at packageResolve (node:internal/modules/esm/resolve:768:81)
    at moduleResolve (node:internal/modules/esm/resolve:855:18)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:731:20)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:708:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:310:38)
    at onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:664:36)
    at TracingChannel.tracePromise (node:diagnostics_channel:350:14)
    at ModuleLoader.import (node:internal/modules/esm/loader:663:21) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v22.22.2

exec
/bin/bash -lc 'tmp_dir=$(mktemp -d /tmp/x402-check.XXXXXX)
cache_dir=$(mktemp -d /tmp/x402-npm-cache.XXXXXX)
cd "$tmp_dir"
npm --cache "$cache_dir" init -y >/dev/null
npm --cache "$cache_dir" install @x402/core@latest @x402/evm@latest @x402/express@latest @x402/fetch@latest viem@latest express@latest dotenv@latest typescript@latest tsx@latest @types/express@latest
npm --cache "$cache_dir" ls --depth=0
node --input-type=module -e '"'for (const p of [\"@x402/fetch\",\"@x402/express\",\"@x402/core/server\",\"@x402/evm/exact/client\",\"@x402/evm/exact/server\"]) { const m=await import(p); console.log(p, Object.keys(m).sort().join(\", \")); }'" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 12901ms:

added 115 packages, and audited 116 packages in 12s

42 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
x402-check.5kwtbt@1.0.0 /tmp/x402-check.5KWTbT
├── @types/express@5.0.6
├── @x402/core@2.22.0
├── @x402/evm@2.22.0
├── @x402/express@2.22.0
├── @x402/fetch@2.22.0
├── dotenv@17.4.2
├── express@5.2.1
├── tsx@4.23.12
├── typescript@7.0.2
└── viem@2.55.15

@x402/fetch decodePaymentResponseHeader, wrapFetchWithPayment, wrapFetchWithPaymentFromConfig, x402Client, x402HTTPClient
@x402/express ExpressAdapter, RouteConfigurationError, SETTLEMENT_OVERRIDES_HEADER, paymentMiddleware, paymentMiddlewareFromConfig, paymentMiddlewareFromHTTPServer, setSettlementOverrides, x402HTTPResourceServer, x402ResourceServer
@x402/core/server FacilitatorResponseError, FacilitatorTimeoutError, HTTPFacilitatorClient, PAYMENT_FLOWS, PAYMENT_REQUIRED_CACHE_CONTROL, RouteConfigurationError, SDK_DEFAULT_ASSET_TRANSFER_METHOD, SETTLEMENT_OVERRIDES_HEADER, applyPaymentFlowWireExtra, assertAcceptsAdditiveExtraAfterSchemeEnrich, assertAcceptsAllowlistedAfterExtensionEnrich, assertAdditivePayloadEnrichment, assertAdditiveSettlementExtra, assertSettleResponseCoreUnchanged, checkIfBazaarNeeded, getFacilitatorResponseError, isVacantStringField, resolvePaymentFlow, resolvePaymentFlowPhases, snapshotPaymentRequirementsList, snapshotSettleResponseCore, withPrivateCacheControl, x402HTTPResourceServer, x402ResourceServer
@x402/evm/exact/client ExactEvmScheme, createPermit2ApprovalTx, erc20AllowanceAbi, getPermit2AllowanceReadParams, registerExactEvmScheme
@x402/evm/exact/server ExactEvmScheme, registerExactEvmScheme

codex
The live install succeeded with a single coherent v2.22.0 x402 stack, and the expected exports are present. I’m doing one final facilitator/network check so the Base mainnet example doesn’t accidentally point at a testnet-only service.
exec
/bin/bash -lc 'curl -fsSL https://api.cdp.coinbase.com/platform/v2/x402/supported | head -c 12000' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 602ms:
curl: (22) The requested URL returned error: 401

exec
/bin/bash -lc 'curl -fsSL https://x402.org/facilitator/supported | head -c 16000' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 823ms:
{"kinds":[{"x402Version":2,"scheme":"exact","network":"eip155:84532"},{"x402Version":2,"scheme":"upto","network":"eip155:84532","extra":{"facilitatorAddress":"0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf"}},{"x402Version":2,"scheme":"batch-settlement","network":"eip155:84532"},{"x402Version":2,"scheme":"exact","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","extra":{"feePayer":"CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5","features":{"smartWalletSupported":true}}},{"x402Version":2,"scheme":"exact","network":"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe","extra":{"feePayer":"G7QWRIJODICBDG6JAVXNKHNTCKTBJZBXTSCGQLSMXSCIKEJ5SNFPEJSFQQ"}},{"x402Version":2,"scheme":"exact","network":"aptos:2","extra":{"feePayer":"0x1be1a717b48c46c83a2a6a53205aff6123610961560b2b08968a344c4da24b1e"}},{"x402Version":2,"scheme":"exact","network":"stellar:testnet","extra":{"areFeesSponsored":true}},{"x402Version":2,"scheme":"exact","network":"hedera:testnet","extra":{"feePayer":"0.0.9185802"}},{"x402Version":2,"scheme":"exact","network":"xrpl:1","extra":{"areFeesSponsored":false}},{"x402Version":1,"scheme":"exact","network":"base-sepolia"},{"x402Version":1,"scheme":"exact","network":"solana-devnet","extra":{"feePayer":"CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"}}],"extensions":["builder-code","eip2612GasSponsoring","erc20ApprovalGasSponsoring"],"signers":{"eip155:*":["0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf"],"solana:*":["CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"],"algorand:*":["G7QWRIJODICBDG6JAVXNKHNTCKTBJZBXTSCGQLSMXSCIKEJ5SNFPEJSFQQ"],"aptos:*":["0x1be1a717b48c46c83a2a6a53205aff6123610961560b2b08968a344c4da24b1e"],"stellar:*":["GC6CSXBV4C6RL3HEDTW57KXYXSSXKAWKGYDEOSATXM3XNKXSR2VRYN3K","GC5OLUZ4WANPN6VT7YGTK2SRMZG762KOVKJXHWIO4K57UBASO2FMNRET"],"hedera:*":["0.0.9185802"],"xrpl:*":[]}}
exec
/bin/bash -lc 'curl -fsSL https://facilitator.payai.network/supported | head -c 16000' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 720ms:
{"kinds":[{"x402Version":1,"scheme":"exact","network":"base-sepolia"},{"x402Version":1,"scheme":"exact","network":"base"},{"x402Version":1,"scheme":"exact","network":"avalanche-fuji"},{"x402Version":1,"scheme":"exact","network":"avalanche"},{"x402Version":1,"scheme":"exact","network":"sei"},{"x402Version":1,"scheme":"exact","network":"sei-testnet"},{"x402Version":1,"scheme":"exact","network":"polygon"},{"x402Version":1,"scheme":"exact","network":"polygon-amoy"},{"x402Version":1,"scheme":"exact","network":"xlayer"},{"x402Version":1,"scheme":"exact","network":"xlayer-testnet"},{"x402Version":1,"scheme":"exact","network":"skale-base"},{"x402Version":1,"scheme":"exact","network":"skale-base-sepolia"},{"x402Version":1,"scheme":"exact","network":"arbitrum"},{"x402Version":1,"scheme":"exact","network":"arbitrum-sepolia"},{"x402Version":2,"scheme":"exact","network":"eip155:8453"},{"x402Version":2,"scheme":"upto","network":"eip155:8453","extra":{"facilitatorAddress":"0xB2Bd29925CBbCEA7628279c91945Ca5B98bf371B"}},{"x402Version":2,"scheme":"exact","network":"eip155:84532"},{"x402Version":2,"scheme":"upto","network":"eip155:84532","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:43114"},{"x402Version":2,"scheme":"upto","network":"eip155:43114","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:43113"},{"x402Version":2,"scheme":"upto","network":"eip155:43113","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:1329"},{"x402Version":2,"scheme":"upto","network":"eip155:1329","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:713715"},{"x402Version":2,"scheme":"upto","network":"eip155:713715","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:137"},{"x402Version":2,"scheme":"upto","network":"eip155:137","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:80002"},{"x402Version":2,"scheme":"upto","network":"eip155:80002","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:196"},{"x402Version":2,"scheme":"upto","network":"eip155:196","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:1952"},{"x402Version":2,"scheme":"upto","network":"eip155:1952","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:1187947933"},{"x402Version":2,"scheme":"upto","network":"eip155:1187947933","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:324705682"},{"x402Version":2,"scheme":"upto","network":"eip155:324705682","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:42161"},{"x402Version":2,"scheme":"upto","network":"eip155:42161","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":2,"scheme":"exact","network":"eip155:421614"},{"x402Version":2,"scheme":"upto","network":"eip155:421614","extra":{"facilitatorAddress":"0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63"}},{"x402Version":1,"scheme":"exact","network":"solana","extra":{"feePayer":"2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"}},{"x402Version":1,"scheme":"exact","network":"solana-devnet","extra":{"feePayer":"2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"}},{"x402Version":2,"scheme":"exact","network":"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp","extra":{"feePayer":"2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"}},{"x402Version":2,"scheme":"exact","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","extra":{"feePayer":"2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"}}],"extensions":["bazaar","eip2612GasSponsoring","erc20ApprovalGasSponsoring"],"signers":{"eip155:*":["0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63","0xB2Bd29925CBbCEA7628279c91945Ca5B98bf371B","0x25659315106580ce2A787CeeC5efB2d347B539C9","0xB8F41cB13b1f213da1E94E1b742ec1323235C48F","0xe575fA51af90957d66FaB6d63355F1eD021b887b","0x03a3F7CE8e21E6F8D9fa14C67d8876b2470Dc2F1","0x675707bc7D03089f820c1B7D49F7480083e8F4Df","0xF46833D4ac4f0f1405CC05c30EdFd86770f721C9","0x2dAAEF6F941De214Bf7d6daf322BC6BC7406Accb","0x2Fae4026a31F19183947f0A6045ef975EBFA9cA8","0xe299C486066739c4a31609e1268d93229632DD47","0x6CCf245C883F9f3c6cAEe0687aa61DAF7bc96e32","0xAf990eEf9846B63d896056050FDc0b28BCA9c24b","0x489C40fC3c2a19AD8cB275B7DD6AA194E9219C4F","0x9Df61A719ddaE27C20a63A417271CC2c704654bD"],"solana:*":["2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"]}}
exec
/bin/bash -lc 'tmp_root=$(find /tmp -maxdepth 1 -type d -name '"'x402-check.*' | sort | tail -n 1)
rg -n \"declare function wrapFetchWithPayment|function wrapFetchWithPayment\" \""'$tmp_root/node_modules/@x402/fetch" | head -20
rg -n "constructor'"\\(|spendControls|maxAmountPerPayment\" \""'$tmp_root/node_modules/@x402/core/dist" | head -30' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 2ms:
exec
/bin/bash -lc 'tmp_root=$(find /tmp -maxdepth 2 -path '"'*/node_modules/@x402/fetch' -print -quit | sed 's#/node_modules/@x402/fetch##')
rg -n \"wrapFetchWithPayment\" \""'$tmp_root/node_modules/@x402/fetch" | head -30
rg -n "spendControls|maxAmountPerPayment" "$tmp_root/node_modules/@x402/core" | head -30' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 26ms:
find: ‘/tmp/snap-private-tmp’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-fwupd.service-VdFMs2’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-colord.service-FJbzBd’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-power-profiles-daemon.service-NExm7x’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-switcheroo-control.service-SbGma6’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-systemd-logind.service-aeFA8a’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-ModemManager.service-vYxawW’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-systemd-resolved.service-zUGVgz’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-polkit.service-OVFStE’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-systemd-timesyncd.service-SflMEE’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-tor@default.service-f2wPQY’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-upower.service-Ln5WaW’: Permission denied
find: ‘/tmp/systemd-private-51da8bb2668743b5a139d3a197fba596-apache2.service-pxPWEF’: Permission denied
rg: /node_modules/@x402/fetch: IO error for operation on /node_modules/@x402/fetch: No such file or directory (os error 2)
rg: /node_modules/@x402/core: IO error for operation on /node_modules/@x402/core: No such file or directory (os error 2)

exec
/bin/bash -lc 'rg -n "wrapFetchWithPayment" /tmp/x402-check.5KWTbT/node_modules/@x402/fetch | head -30
rg -n "spendControls|maxAmountPerPayment" /tmp/x402-check.5KWTbT/node_modules/@x402/core | head -30' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 3ms:
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
diff --git a/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9c9ad7c70ab151073575b425e54d85466167ab9c
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,144 @@
+# Use x402 v2
+
+The standard fit is **x402**: the server answers an unpaid request with HTTP `402 Payment Required` and machine-readable payment requirements; the client signs an EVM payment authorization, adds the x402 payment header, and retries automatically. A facilitator verifies and settles the USDC transfer on-chain. There are no customer accounts, API keys, or invoices. The buyer still needs a funded wallet, and the seller needs a receiving address.
+
+Use the current scoped **v2** packages throughout. Do not combine these with the deprecated unscoped v1 packages (`x402`, `x402-express`, or `x402-fetch`). The official [seller quickstart](https://docs.x402.org/getting-started/quickstart-for-sellers) and [buyer quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers) describe this flow.
+
+## Install
+
+With Node 20+ (for native `fetch`), in one TypeScript project:
+
+```sh
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 @x402/express@2.22.0 @x402/fetch@2.22.0 viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript@7.0.2 tsx@4.23.12 @types/express@5.0.6
+```
+
+Those exact versions were resolved from npm and installed successfully on **2026-08-13** (`115 packages`, `0 vulnerabilities`). I also loaded the installed modules and confirmed the relevant exports exist: `paymentMiddleware`, `x402ResourceServer`, `HTTPFacilitatorClient`, both EVM `ExactEvmScheme` implementations, `x402Client`, `x402HTTPClient`, and `wrapFetchWithPayment`.
+
+If you prefer floating versions, omit the version suffixes, but commit the resulting lockfile. All four x402 packages should remain on the same major and preferably the same exact version.
+
+## Seller: Express endpoint on Base
+
+This charges a fixed **$0.03 USDC** on Base mainnet (`eip155:8453`). The example uses PayAI's public facilitator because its live `/supported` response confirmed x402 v2 `exact` support for Base mainnet today. A facilitator is settlement infrastructure, not a buyer account system; evaluate its availability/trust model or self-host one before production.
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+
+const payTo = process.env.PAY_TO as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
+  throw new Error("PAY_TO must be the seller's EVM address");
+}
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://facilitator.payai.network",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453", // Base mainnet (CAIP-2)
+  new ExactEvmScheme(),
+);
+
+const app = express();
+
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/answer": {
+        accepts: {
+          scheme: "exact",
+          price: "$0.03",
+          network: "eip155:8453",
+          payTo,
+        },
+        description: "One agent API call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.use(express.json());
+
+app.post("/v1/answer", (req, res) => {
+  res.json({ answer: `processed: ${String(req.body?.prompt ?? "")}` });
+});
+
+app.listen(4021, () => console.log("Listening on http://localhost:4021"));
+```
+
+`.env` for the server:
+
+```dotenv
+PAY_TO=0xYourBaseReceivingAddress
+```
+
+The middleware handles the important boundary: an initial unpaid call gets a 402; a paid retry is verified before the handler runs; settlement occurs around the successful response; and the response carries settlement information. The advertised dollar price is resolved to a supported USDC payment by the SDK/facilitator.
+
+For testing, switch both registrations/configs to Base Sepolia (`eip155:84532`) and use `https://x402.org/facilitator`; its live `/supported` response confirmed v2 `exact` support for that network. Do not mix the testnet facilitator with the mainnet network in the example above.
+
+## Buyer/agent: pay and retry automatically
+
+The current v2.22 API takes a configured `x402Client` (not an old `x402Fetch`/`createWallet` helper). `privateKeyToAccount` returns the required viem `LocalAccount` signer. The wrapper first calls normally, consumes the 402 requirements, signs the exact USDC authorization, and retries once with the payment header.
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, x402HTTPClient } from "@x402/core/client";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { wrapFetchWithPayment } from "@x402/fetch";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
+  throw new Error("EVM_PRIVATE_KEY must be a 32-byte hex private key");
+}
+
+const account = privateKeyToAccount(privateKey);
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:4021/v1/answer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "What is x402?" }),
+});
+
+if (!response.ok) {
+  throw new Error(`Paid API failed: ${response.status} ${await response.text()}`);
+}
+
+// Parse both the application body and the decoded settlement result.
+const result = await new x402HTTPClient(paymentClient).processResponse(response);
+console.log(result.body);
+if (result.paymentStatus === "settled") {
+  console.log("settled on-chain:", result.header);
+} else if (result.paymentStatus === "settle_failed") {
+  throw new Error(`Settlement failed: ${JSON.stringify(result.header)}`);
+}
+```
+
+`.env` for the client:
+
+```dotenv
+EVM_PRIVATE_KEY=0xYourDedicatedFundedAgentWalletPrivateKey
+```
+
+Fund that dedicated wallet with USDC on Base (and enough ETH if the selected flow requires buyer-paid gas). Keep the key in a secret manager, never in source control. Also enforce an application-level spend limit: the SDK's current default recognized-USD per-payment ceiling is `$1`, but autonomous agents should normally have a tighter wallet balance and policy/approval hook as defense in depth.
+
+Run the two processes with:
+
+```sh
+npx tsx server.ts
+npx tsx client.ts
+```
+
+For fixed cents-per-call pricing, `exact` is the simplest choice. If the final price depends on token usage, use the v2 EVM `upto` scheme and set a settlement override in the handler. For high request volume, consider `batch-settlement`; it still authorizes each call inline but settles vouchers on-chain in batches rather than creating one on-chain settlement per HTTP request.

diff --git a/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9c9ad7c70ab151073575b425e54d85466167ab9c
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,144 @@
+# Use x402 v2
+
+The standard fit is **x402**: the server answers an unpaid request with HTTP `402 Payment Required` and machine-readable payment requirements; the client signs an EVM payment authorization, adds the x402 payment header, and retries automatically. A facilitator verifies and settles the USDC transfer on-chain. There are no customer accounts, API keys, or invoices. The buyer still needs a funded wallet, and the seller needs a receiving address.
+
+Use the current scoped **v2** packages throughout. Do not combine these with the deprecated unscoped v1 packages (`x402`, `x402-express`, or `x402-fetch`). The official [seller quickstart](https://docs.x402.org/getting-started/quickstart-for-sellers) and [buyer quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers) describe this flow.
+
+## Install
+
+With Node 20+ (for native `fetch`), in one TypeScript project:
+
+```sh
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 @x402/express@2.22.0 @x402/fetch@2.22.0 viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript@7.0.2 tsx@4.23.12 @types/express@5.0.6
+```
+
+Those exact versions were resolved from npm and installed successfully on **2026-08-13** (`115 packages`, `0 vulnerabilities`). I also loaded the installed modules and confirmed the relevant exports exist: `paymentMiddleware`, `x402ResourceServer`, `HTTPFacilitatorClient`, both EVM `ExactEvmScheme` implementations, `x402Client`, `x402HTTPClient`, and `wrapFetchWithPayment`.
+
+If you prefer floating versions, omit the version suffixes, but commit the resulting lockfile. All four x402 packages should remain on the same major and preferably the same exact version.
+
+## Seller: Express endpoint on Base
+
+This charges a fixed **$0.03 USDC** on Base mainnet (`eip155:8453`). The example uses PayAI's public facilitator because its live `/supported` response confirmed x402 v2 `exact` support for Base mainnet today. A facilitator is settlement infrastructure, not a buyer account system; evaluate its availability/trust model or self-host one before production.
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+
+const payTo = process.env.PAY_TO as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
+  throw new Error("PAY_TO must be the seller's EVM address");
+}
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://facilitator.payai.network",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453", // Base mainnet (CAIP-2)
+  new ExactEvmScheme(),
+);
+
+const app = express();
+
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/answer": {
+        accepts: {
+          scheme: "exact",
+          price: "$0.03",
+          network: "eip155:8453",
+          payTo,
+        },
+        description: "One agent API call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.use(express.json());
+
+app.post("/v1/answer", (req, res) => {
+  res.json({ answer: `processed: ${String(req.body?.prompt ?? "")}` });
+});
+
+app.listen(4021, () => console.log("Listening on http://localhost:4021"));
+```
+
+`.env` for the server:
+
+```dotenv
+PAY_TO=0xYourBaseReceivingAddress
+```
+
+The middleware handles the important boundary: an initial unpaid call gets a 402; a paid retry is verified before the handler runs; settlement occurs around the successful response; and the response carries settlement information. The advertised dollar price is resolved to a supported USDC payment by the SDK/facilitator.
+
+For testing, switch both registrations/configs to Base Sepolia (`eip155:84532`) and use `https://x402.org/facilitator`; its live `/supported` response confirmed v2 `exact` support for that network. Do not mix the testnet facilitator with the mainnet network in the example above.
+
+## Buyer/agent: pay and retry automatically
+
+The current v2.22 API takes a configured `x402Client` (not an old `x402Fetch`/`createWallet` helper). `privateKeyToAccount` returns the required viem `LocalAccount` signer. The wrapper first calls normally, consumes the 402 requirements, signs the exact USDC authorization, and retries once with the payment header.
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, x402HTTPClient } from "@x402/core/client";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { wrapFetchWithPayment } from "@x402/fetch";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
+  throw new Error("EVM_PRIVATE_KEY must be a 32-byte hex private key");
+}
+
+const account = privateKeyToAccount(privateKey);
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:4021/v1/answer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "What is x402?" }),
+});
+
+if (!response.ok) {
+  throw new Error(`Paid API failed: ${response.status} ${await response.text()}`);
+}
+
+// Parse both the application body and the decoded settlement result.
+const result = await new x402HTTPClient(paymentClient).processResponse(response);
+console.log(result.body);
+if (result.paymentStatus === "settled") {
+  console.log("settled on-chain:", result.header);
+} else if (result.paymentStatus === "settle_failed") {
+  throw new Error(`Settlement failed: ${JSON.stringify(result.header)}`);
+}
+```
+
+`.env` for the client:
+
+```dotenv
+EVM_PRIVATE_KEY=0xYourDedicatedFundedAgentWalletPrivateKey
+```
+
+Fund that dedicated wallet with USDC on Base (and enough ETH if the selected flow requires buyer-paid gas). Keep the key in a secret manager, never in source control. Also enforce an application-level spend limit: the SDK's current default recognized-USD per-payment ceiling is `$1`, but autonomous agents should normally have a tighter wallet balance and policy/approval hook as defense in depth.
+
+Run the two processes with:
+
+```sh
+npx tsx server.ts
+npx tsx client.ts
+```
+
+For fixed cents-per-call pricing, `exact` is the simplest choice. If the final price depends on token usage, use the v2 EVM `upto` scheme and set a settlement override in the handler. For high request volume, consider `batch-settlement`; it still authorizes each call inline but settles vouchers on-chain in batches rather than creating one on-chain settlement per HTTP request.

exec
/bin/bash -lc 'wc -l answer.md && rg -n "@x402|wrapFetchWithPayment|eip155:8453|resolved" answer.md | head -30' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace
 succeeded in 6ms:
144 answer.md
12:npm install @x402/core@2.22.0 @x402/evm@2.22.0 @x402/express@2.22.0 @x402/fetch@2.22.0 viem@2.55.15 express@5.2.1 dotenv@17.4.2
16:Those exact versions were resolved from npm and installed successfully on **2026-08-13** (`115 packages`, `0 vulnerabilities`). I also loaded the installed modules and confirmed the relevant exports exist: `paymentMiddleware`, `x402ResourceServer`, `HTTPFacilitatorClient`, both EVM `ExactEvmScheme` implementations, `x402Client`, `x402HTTPClient`, and `wrapFetchWithPayment`.
22:This charges a fixed **$0.03 USDC** on Base mainnet (`eip155:8453`). The example uses PayAI's public facilitator because its live `/supported` response confirmed x402 v2 `exact` support for Base mainnet today. A facilitator is settlement infrastructure, not a buyer account system; evaluate its availability/trust model or self-host one before production.
28:import { paymentMiddleware, x402ResourceServer } from "@x402/express";
29:import { HTTPFacilitatorClient } from "@x402/core/server";
30:import { ExactEvmScheme } from "@x402/evm/exact/server";
42:  "eip155:8453", // Base mainnet (CAIP-2)
55:          network: "eip155:8453",
81:The middleware handles the important boundary: an initial unpaid call gets a 402; a paid retry is verified before the handler runs; settlement occurs around the successful response; and the response carries settlement information. The advertised dollar price is resolved to a supported USDC payment by the SDK/facilitator.
83:For testing, switch both registrations/configs to Base Sepolia (`eip155:84532`) and use `https://x402.org/facilitator`; its live `/supported` response confirmed v2 `exact` support for that network. Do not mix the testnet facilitator with the mainnet network in the example above.
92:import { x402Client, x402HTTPClient } from "@x402/core/client";
93:import { ExactEvmScheme } from "@x402/evm/exact/client";
94:import { wrapFetchWithPayment } from "@x402/fetch";
104:  "eip155:8453",
107:const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);

diff --git a/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9c9ad7c70ab151073575b425e54d85466167ab9c
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,144 @@
+# Use x402 v2
+
+The standard fit is **x402**: the server answers an unpaid request with HTTP `402 Payment Required` and machine-readable payment requirements; the client signs an EVM payment authorization, adds the x402 payment header, and retries automatically. A facilitator verifies and settles the USDC transfer on-chain. There are no customer accounts, API keys, or invoices. The buyer still needs a funded wallet, and the seller needs a receiving address.
+
+Use the current scoped **v2** packages throughout. Do not combine these with the deprecated unscoped v1 packages (`x402`, `x402-express`, or `x402-fetch`). The official [seller quickstart](https://docs.x402.org/getting-started/quickstart-for-sellers) and [buyer quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers) describe this flow.
+
+## Install
+
+With Node 20+ (for native `fetch`), in one TypeScript project:
+
+```sh
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 @x402/express@2.22.0 @x402/fetch@2.22.0 viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript@7.0.2 tsx@4.23.12 @types/express@5.0.6
+```
+
+Those exact versions were resolved from npm and installed successfully on **2026-08-13** (`115 packages`, `0 vulnerabilities`). I also loaded the installed modules and confirmed the relevant exports exist: `paymentMiddleware`, `x402ResourceServer`, `HTTPFacilitatorClient`, both EVM `ExactEvmScheme` implementations, `x402Client`, `x402HTTPClient`, and `wrapFetchWithPayment`.
+
+If you prefer floating versions, omit the version suffixes, but commit the resulting lockfile. All four x402 packages should remain on the same major and preferably the same exact version.
+
+## Seller: Express endpoint on Base
+
+This charges a fixed **$0.03 USDC** on Base mainnet (`eip155:8453`). The example uses PayAI's public facilitator because its live `/supported` response confirmed x402 v2 `exact` support for Base mainnet today. A facilitator is settlement infrastructure, not a buyer account system; evaluate its availability/trust model or self-host one before production.
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+
+const payTo = process.env.PAY_TO as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
+  throw new Error("PAY_TO must be the seller's EVM address");
+}
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://facilitator.payai.network",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453", // Base mainnet (CAIP-2)
+  new ExactEvmScheme(),
+);
+
+const app = express();
+
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/answer": {
+        accepts: {
+          scheme: "exact",
+          price: "$0.03",
+          network: "eip155:8453",
+          payTo,
+        },
+        description: "One agent API call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.use(express.json());
+
+app.post("/v1/answer", (req, res) => {
+  res.json({ answer: `processed: ${String(req.body?.prompt ?? "")}` });
+});
+
+app.listen(4021, () => console.log("Listening on http://localhost:4021"));
+```
+
+`.env` for the server:
+
+```dotenv
+PAY_TO=0xYourBaseReceivingAddress
+```
+
+The middleware handles the important boundary: an initial unpaid call gets a 402; a paid retry is verified before the handler runs; settlement occurs around the successful response; and the response carries settlement information. The advertised dollar price is resolved to a supported USDC payment by the SDK/facilitator.
+
+For testing, switch both registrations/configs to Base Sepolia (`eip155:84532`) and use `https://x402.org/facilitator`; its live `/supported` response confirmed v2 `exact` support for that network. Do not mix the testnet facilitator with the mainnet network in the example above.
+
+## Buyer/agent: pay and retry automatically
+
+The current v2.22 API takes a configured `x402Client` (not an old `x402Fetch`/`createWallet` helper). `privateKeyToAccount` returns the required viem `LocalAccount` signer. The wrapper first calls normally, consumes the 402 requirements, signs the exact USDC authorization, and retries once with the payment header.
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, x402HTTPClient } from "@x402/core/client";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { wrapFetchWithPayment } from "@x402/fetch";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
+  throw new Error("EVM_PRIVATE_KEY must be a 32-byte hex private key");
+}
+
+const account = privateKeyToAccount(privateKey);
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:4021/v1/answer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "What is x402?" }),
+});
+
+if (!response.ok) {
+  throw new Error(`Paid API failed: ${response.status} ${await response.text()}`);
+}
+
+// Parse both the application body and the decoded settlement result.
+const result = await new x402HTTPClient(paymentClient).processResponse(response);
+console.log(result.body);
+if (result.paymentStatus === "settled") {
+  console.log("settled on-chain:", result.header);
+} else if (result.paymentStatus === "settle_failed") {
+  throw new Error(`Settlement failed: ${JSON.stringify(result.header)}`);
+}
+```
+
+`.env` for the client:
+
+```dotenv
+EVM_PRIVATE_KEY=0xYourDedicatedFundedAgentWalletPrivateKey
+```
+
+Fund that dedicated wallet with USDC on Base (and enough ETH if the selected flow requires buyer-paid gas). Keep the key in a secret manager, never in source control. Also enforce an application-level spend limit: the SDK's current default recognized-USD per-payment ceiling is `$1`, but autonomous agents should normally have a tighter wallet balance and policy/approval hook as defense in depth.
+
+Run the two processes with:
+
+```sh
+npx tsx server.ts
+npx tsx client.ts
+```
+
+For fixed cents-per-call pricing, `exact` is the simplest choice. If the final price depends on token usage, use the v2 EVM `upto` scheme and set a settlement override in the handler. For high request volume, consider `batch-settlement`; it still authorizes each call inline but settles vouchers on-chain in batches rather than creating one on-chain settlement per HTTP request.

codex
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md) with:

- Current x402 v2 server and client architecture
- Express server and automatic-paying TypeScript client
- Base mainnet and Base Sepolia configurations
- Exact pinned package versions
- Live npm installation and export verification
- Facilitator compatibility checks
- Operational and wallet-security notes
diff --git a/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9c9ad7c70ab151073575b425e54d85466167ab9c
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,144 @@
+# Use x402 v2
+
+The standard fit is **x402**: the server answers an unpaid request with HTTP `402 Payment Required` and machine-readable payment requirements; the client signs an EVM payment authorization, adds the x402 payment header, and retries automatically. A facilitator verifies and settles the USDC transfer on-chain. There are no customer accounts, API keys, or invoices. The buyer still needs a funded wallet, and the seller needs a receiving address.
+
+Use the current scoped **v2** packages throughout. Do not combine these with the deprecated unscoped v1 packages (`x402`, `x402-express`, or `x402-fetch`). The official [seller quickstart](https://docs.x402.org/getting-started/quickstart-for-sellers) and [buyer quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers) describe this flow.
+
+## Install
+
+With Node 20+ (for native `fetch`), in one TypeScript project:
+
+```sh
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 @x402/express@2.22.0 @x402/fetch@2.22.0 viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript@7.0.2 tsx@4.23.12 @types/express@5.0.6
+```
+
+Those exact versions were resolved from npm and installed successfully on **2026-08-13** (`115 packages`, `0 vulnerabilities`). I also loaded the installed modules and confirmed the relevant exports exist: `paymentMiddleware`, `x402ResourceServer`, `HTTPFacilitatorClient`, both EVM `ExactEvmScheme` implementations, `x402Client`, `x402HTTPClient`, and `wrapFetchWithPayment`.
+
+If you prefer floating versions, omit the version suffixes, but commit the resulting lockfile. All four x402 packages should remain on the same major and preferably the same exact version.
+
+## Seller: Express endpoint on Base
+
+This charges a fixed **$0.03 USDC** on Base mainnet (`eip155:8453`). The example uses PayAI's public facilitator because its live `/supported` response confirmed x402 v2 `exact` support for Base mainnet today. A facilitator is settlement infrastructure, not a buyer account system; evaluate its availability/trust model or self-host one before production.
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+
+const payTo = process.env.PAY_TO as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
+  throw new Error("PAY_TO must be the seller's EVM address");
+}
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://facilitator.payai.network",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453", // Base mainnet (CAIP-2)
+  new ExactEvmScheme(),
+);
+
+const app = express();
+
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/answer": {
+        accepts: {
+          scheme: "exact",
+          price: "$0.03",
+          network: "eip155:8453",
+          payTo,
+        },
+        description: "One agent API call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.use(express.json());
+
+app.post("/v1/answer", (req, res) => {
+  res.json({ answer: `processed: ${String(req.body?.prompt ?? "")}` });
+});
+
+app.listen(4021, () => console.log("Listening on http://localhost:4021"));
+```
+
+`.env` for the server:
+
+```dotenv
+PAY_TO=0xYourBaseReceivingAddress
+```
+
+The middleware handles the important boundary: an initial unpaid call gets a 402; a paid retry is verified before the handler runs; settlement occurs around the successful response; and the response carries settlement information. The advertised dollar price is resolved to a supported USDC payment by the SDK/facilitator.
+
+For testing, switch both registrations/configs to Base Sepolia (`eip155:84532`) and use `https://x402.org/facilitator`; its live `/supported` response confirmed v2 `exact` support for that network. Do not mix the testnet facilitator with the mainnet network in the example above.
+
+## Buyer/agent: pay and retry automatically
+
+The current v2.22 API takes a configured `x402Client` (not an old `x402Fetch`/`createWallet` helper). `privateKeyToAccount` returns the required viem `LocalAccount` signer. The wrapper first calls normally, consumes the 402 requirements, signs the exact USDC authorization, and retries once with the payment header.
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, x402HTTPClient } from "@x402/core/client";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { wrapFetchWithPayment } from "@x402/fetch";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
+if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
+  throw new Error("EVM_PRIVATE_KEY must be a 32-byte hex private key");
+}
+
+const account = privateKeyToAccount(privateKey);
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:4021/v1/answer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "What is x402?" }),
+});
+
+if (!response.ok) {
+  throw new Error(`Paid API failed: ${response.status} ${await response.text()}`);
+}
+
+// Parse both the application body and the decoded settlement result.
+const result = await new x402HTTPClient(paymentClient).processResponse(response);
+console.log(result.body);
+if (result.paymentStatus === "settled") {
+  console.log("settled on-chain:", result.header);
+} else if (result.paymentStatus === "settle_failed") {
+  throw new Error(`Settlement failed: ${JSON.stringify(result.header)}`);
+}
+```
+
+`.env` for the client:
+
+```dotenv
+EVM_PRIVATE_KEY=0xYourDedicatedFundedAgentWalletPrivateKey
+```
+
+Fund that dedicated wallet with USDC on Base (and enough ETH if the selected flow requires buyer-paid gas). Keep the key in a secret manager, never in source control. Also enforce an application-level spend limit: the SDK's current default recognized-USD per-payment ceiling is `$1`, but autonomous agents should normally have a tighter wallet balance and policy/approval hook as defense in depth.
+
+Run the two processes with:
+
+```sh
+npx tsx server.ts
+npx tsx client.ts
+```
+
+For fixed cents-per-call pricing, `exact` is the simplest choice. If the final price depends on token usage, use the v2 EVM `upto` scheme and set a settlement override in the handler. For high request volume, consider `batch-settlement`; it still authorizes each call inline but settles vouchers on-chain in batches rather than creating one on-chain settlement per HTTP request.

tokens used
52,529
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183207Z-codex-with-skill-3/workspace/answer.md) with:

- Current x402 v2 server and client architecture
- Express server and automatic-paying TypeScript client
- Base mainnet and Base Sepolia configurations
- Exact pinned package versions
- Live npm installation and export verification
- Facilitator compatibility checks
- Operational and wallet-security notes
