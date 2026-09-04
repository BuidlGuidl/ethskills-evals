OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019ffc63-6d46-7063-8463-61cf1252f0a5
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
2026-08-13T18:30:02.526191Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019ffc63-6d46-7063-8463-61cf1252f0a5.tmp-1786645802320003708: line 2547: syntax error near unexpected token `('

codex
I’m using the `tools` skill because this is specifically about current agent-readable Ethereum tooling and x402 payments. I’ll follow it, verify package resolution live, and write the result to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/tools/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
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
The key compatibility constraint is keeping the whole integration on x402’s scoped 2.x packages; I’m now checking registry versions and the actual exported APIs before drafting either side.
exec
/bin/bash -lc 'npm view @x402/core version && npm view @x402/evm version && npm view @x402/express version && npm view @x402/fetch version && npm view viem version && npm view express version && npm view dotenv version' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 exited 1 in 670ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/e0143a8a
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/@x402%2fcore: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/e0143a8a'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm notice
npm notice New major version of npm available! 10.9.7 -> 12.0.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
npm notice To update run: npm install -g npm@12.0.2
npm notice
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

exec
/bin/bash -lc 'npm_config_cache=/tmp/tools-quiz-npm-cache npm view @x402/core version && npm_config_cache=/tmp/tools-quiz-npm-cache npm view @x402/evm version && npm_config_cache=/tmp/tools-quiz-npm-cache npm view @x402/express version && npm_config_cache=/tmp/tools-quiz-npm-cache npm view @x402/fetch version && npm_config_cache=/tmp/tools-quiz-npm-cache npm view viem version && npm_config_cache=/tmp/tools-quiz-npm-cache npm view express version && npm_config_cache=/tmp/tools-quiz-npm-cache npm view dotenv version' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 3662ms:
2.22.0
2.22.0
2.22.0
2.22.0
2.55.15
5.2.1
17.4.2

exec
/bin/bash -lc 'mkdir -p /tmp/tools-quiz-x402 && cd /tmp/tools-quiz-x402 && npm_config_cache=/tmp/tools-quiz-npm-cache npm pack @x402/express@2.22.0 @x402/fetch@2.22.0 @x402/evm@2.22.0 @x402/core@2.22.0 --silent' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 2234ms:
x402-express-2.22.0.tgz
x402-fetch-2.22.0.tgz
x402-evm-2.22.0.tgz
x402-core-2.22.0.tgz

exec
/bin/bash -lc 'for f in /tmp/tools-quiz-x402/*.tgz; do d=${f%.tgz}; mkdir -p "$d"; tar -xzf "$f" -C "$d"; done
rg -n "paymentMiddleware|wrapFetchWithPayment|registerExactEvmScheme|facilitator|payTo|price|network" /tmp/tools-quiz-x402/*/package/README.md /tmp/tools-quiz-x402/*/package/dist/types 2>/dev/null | head -240' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 56ms:
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:14:import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:22:const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:25:      network: "eip155:8453", // Base Mainnet
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:41:### `wrapFetchWithPayment(fetch, client)`
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:50:### `wrapFetchWithPaymentFromConfig(fetch, config)`
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:59:    - `network`: Network identifier (e.g., 'eip155:8453', 'solana:mainnet', 'eip155:*' for wildcards)
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:78:import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:88:const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:91:      network: "eip155:*", // Support all EVM chains
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:123:import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:140:const fetchWithPayment = wrapFetchWithPayment(fetch, client);
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:146:import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:150:const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:154:      network: "eip155:8453", // Base Sepolia
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:159:      network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana devnet
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:169:import { wrapFetchWithPaymentFromConfig, type SelectPaymentRequirements } from "@x402/fetch";
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:186:const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md:189:      network: "eip155:8453",
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:3:Core implementation of the x402 payment protocol for TypeScript/JavaScript applications. Provides transport-agnostic client, server and facilitator components.
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:59:// Connect to facilitator
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:60:const facilitatorClient = new HTTPFacilitatorClient({
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:61:  url: 'https://x402.org/facilitator',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:65:const resourceServer = new x402ResourceServer(facilitatorClient)
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:68:// Initialize (fetches supported kinds from facilitator)
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:76:      network: 'eip155:8453',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:77:      payTo: '0xYourAddress',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:78:      price: '$0.01',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:92:import { x402Facilitator } from '@x402/core/facilitator';
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:93:import { registerExactEvmScheme } from '@x402/evm/exact/facilitator';
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:95:const facilitator = new x402Facilitator();
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:98:registerExactEvmScheme(facilitator, {
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:100:  networks: 'eip155:84532',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:104:const verifyResult = await facilitator.verify(paymentPayload, paymentRequirements);
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:108:  const settleResult = await facilitator.settle(paymentPayload, paymentRequirements);
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:123:      network: 'eip155:8453',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:124:      payTo: '0xAddress',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:125:      price: '$0.01',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:136:        network: 'eip155:8453',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:137:        payTo: evmAddress,
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:138:        price: '$0.05',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:142:        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:143:        payTo: svmAddress,
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:144:        price: '$0.05',
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:158:    { network: 'eip155:8453', client: new ExactEvmScheme(evmSigner) },
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:159:    { network: 'solana:mainnet', client: new ExactSvmScheme(svmSigner) },
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:162:    // Filter by max price
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:175:    console.log('Creating payment for:', ctx.selectedRequirements.network);
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:200:facilitator
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:228:Register handlers for network families using wildcards:
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:231:// All EVM networks
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:234:// Specific network takes precedence
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:245:  network: Network;
/tmp/tools-quiz-x402/x402-core-2.22.0/package/README.md:248:  payTo: string;
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:15:import { paymentMiddleware, x402ResourceServer } from "@x402/express";
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:21:const facilitatorClient = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:22:const resourceServer = new x402ResourceServer(facilitatorClient)
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:27:  paymentMiddleware(
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:32:          price: "$0.10",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:33:          network: "eip155:84532",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:34:          payTo: "0xYourAddress",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:53:The `paymentMiddleware` function accepts the following parameters:
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:56:paymentMiddleware(
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:71:5. **`syncFacilitatorOnStart`** (optional): Whether to sync with facilitator on startup (defaults to true)
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:95:function paymentMiddleware(
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:115:Routes are passed as the first parameter to `paymentMiddleware`:
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:122:      price: "$0.10",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:123:      network: "eip155:84532",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:124:      payTo: "0xYourAddress",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:131:app.use(paymentMiddleware(routes, resourceServer));
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:155:app.use(paymentMiddleware(routes, resourceServer, paywallConfig));
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:175:app.use(paymentMiddleware(routes, resourceServer, paywallConfig, customPaywallProvider));
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:180:**For advanced configuration** (builder pattern, network-specific bundles, custom handlers), see the [@x402/paywall README](../paywall/README.md).
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:188:  paymentMiddleware(
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:193:          price: "$1.00",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:194:          network: "eip155:8453",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:195:          payTo: "0xYourAddress",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:202:          price: "$0.50",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:203:          network: "eip155:84532",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:204:          payTo: "0xYourAddress",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:217:If you need to use a custom facilitator server, configure it when creating the x402ResourceServer:
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:225:  url: "https://your-facilitator.com",
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:235:app.use(paymentMiddleware(routes, resourceServer, paywallConfig));
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:249:import { paymentMiddleware } from "x402-express";
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:252:  paymentMiddleware(
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:253:    payTo, // First param was payTo address
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:255:    facilitator, // Third param was facilitator config
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:264:import { paymentMiddleware, x402ResourceServer } from "@x402/express";
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:268:const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:269:const resourceServer = new x402ResourceServer(facilitator)
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:273:  paymentMiddleware(
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:274:    routes, // First param is routes (payTo is part of route config)
/tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md:281:Note: The `payTo` address is now specified within each route configuration rather than as a separate parameter.
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:23:**V2 Protocol Support** - Modern x402 protocol with CAIP-2 network identifiers
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:31:- `ExactEvmFacilitator` - V2 facilitator for payment verification and settlement
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:32:- `toFacilitatorEvmSigner(wallet)` - Converts viem wallets to facilitator signers
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:33:- `FacilitatorEvmSigner` - TypeScript type for facilitator signers
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:40:**V1 Protocol Support** - Legacy x402 protocol with simple network names
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:44:- `ExactEvmFacilitatorV1` - V1 facilitator implementation  
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:45:- `NETWORKS` - Array of all supported V1 network names
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:100:// Per-network explicit registration
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:123:    { network: "eip155:*", client: new ExactEvmClient(signer) },
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:124:    { network: "base-sepolia", client: new ExactEvmClientV1(signer), x402Version: 1 }
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:137:- Any `eip155:<chainId>` network
/tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md:148:For the current list of chains with default assets configured, see [Default Assets for Dollar-String Pricing](../../../../docs/core-concepts/network-and-token-support.mdx#default-assets-for-dollar-string-pricing) in the x402 docs. To add default asset support for a new chain, see [Adding Support for New Networks](../../../../docs/core-concepts/network-and-token-support.mdx#adding-support-for-new-networks).

exec
/bin/bash -lc "sed -n '1,90p' /tmp/tools-quiz-x402/x402-express-2.22.0/package/README.md
sed -n '110,150p' /tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md
sed -n '1,115p' /tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md
sed -n '80,135p' /tmp/tools-quiz-x402/x402-evm-2.22.0/package/README.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# `@x402/express` [![npm version](https://img.shields.io/npm/v/%40x402%2Fexpress.svg)](https://www.npmjs.com/package/@x402/express)

Express middleware integration for the x402 Payment Protocol. This package provides a simple middleware function for adding x402 payment requirements to your Express.js applications.

## Installation

```bash
pnpm install @x402/express
```

## Quick Start

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme());

// Apply the payment middleware with your configuration
app.use(
  paymentMiddleware(
    {
      "GET /protected-route": {
        accepts: {
          scheme: "exact",
          price: "$0.10",
          network: "eip155:84532",
          payTo: "0xYourAddress",
        },
        description: "Access to premium content",
      },
    },
    resourceServer,
  ),
);

// Implement your protected route
app.get("/protected-route", (req, res) => {
  res.json({ message: "This content is behind a paywall" });
});

app.listen(3000);
```

## Configuration

The `paymentMiddleware` function accepts the following parameters:

```typescript
paymentMiddleware(
  routes: RoutesConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean
)
```

### Parameters

1. **`routes`** (required): Route configurations for protected endpoints
2. **`server`** (required): Pre-configured x402ResourceServer instance
3. **`paywallConfig`** (optional): Configuration for the built-in paywall UI
4. **`paywall`** (optional): Custom paywall provider
5. **`syncFacilitatorOnStart`** (optional): Whether to sync with facilitator on startup (defaults to true)

See the sections below for detailed configuration options.

## API Reference

### ExpressAdapter

The `ExpressAdapter` class implements the `HTTPAdapter` interface from `@x402/core`, providing Express-specific request handling:

```typescript
class ExpressAdapter implements HTTPAdapter {
  getHeader(name: string): string | undefined;
  getMethod(): string;
  getPath(): string;
  getUrl(): string;
  getAcceptHeader(): string;
  getUserAgent(): string;
}
```
    
    console.log("Response data:", data);
  })
  .catch(error => {
    console.error(error);
  });
```

### Using Builder Pattern

For more control, you can use the builder pattern to register multiple schemes:

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

// Create signers
const evmSigner = privateKeyToAccount("0xYourPrivateKey");
const svmSigner = await createKeyPairSignerFromBytes(base58.decode("YourSvmPrivateKey"));

// Build client with multiple schemes
const client = new x402Client()
  .register("eip155:*", new ExactEvmScheme(evmSigner))
  .register("solana:*", new ExactSvmScheme(svmSigner));

// Wrap fetch with the client
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
```

### Multi-Chain Support

```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { ExactSvmScheme } from "@x402/svm";

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
# `@x402/fetch` [![npm version](https://img.shields.io/npm/v/%40x402%2Ffetch.svg)](https://www.npmjs.com/package/@x402/fetch)

A utility package that extends the native `fetch` API to automatically handle 402 Payment Required responses using the x402 payment protocol v2. This package enables seamless integration of payment functionality into your applications when making HTTP requests.

## Installation

```bash
pnpm install @x402/fetch
```

## Quick Start

```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

// Create an account
const account = privateKeyToAccount("0xYourPrivateKey");

// Wrap the fetch function with payment handling
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453", // Base Mainnet
      client: new ExactEvmScheme(account),
    },
  ],
});

// Make a request that may require payment
const response = await fetchWithPayment("https://api.example.com/paid-endpoint", {
  method: "GET",
});

const data = await response.json();
```

## API

### `wrapFetchWithPayment(fetch, client)`

Wraps the native fetch API to handle 402 Payment Required responses automatically.

#### Parameters

- `fetch`: The fetch function to wrap (typically `globalThis.fetch`)
- `client`: An x402Client instance with registered payment schemes

### `wrapFetchWithPaymentFromConfig(fetch, config)`

Convenience wrapper that creates an x402Client from a configuration object.

#### Parameters

- `fetch`: The fetch function to wrap (typically `globalThis.fetch`)
- `config`: Configuration object with the following properties:
  - `schemes`: Array of scheme registrations, each containing:
    - `network`: Network identifier (e.g., 'eip155:8453', 'solana:mainnet', 'eip155:*' for wildcards)
    - `client`: The scheme client implementation (e.g., `ExactEvmScheme`, `ExactSvmScheme`)
    - `x402Version`: Optional protocol version (defaults to 2, set to 1 for legacy support)
  - `paymentRequirementsSelector`: Optional function to select payment requirements from multiple options

#### Returns

A wrapped fetch function that automatically handles 402 responses by:
1. Making the initial request
2. If a 402 response is received, parsing the payment requirements
3. Creating a payment header using the configured scheme client
4. Retrying the request with the payment header

## Examples

### Basic Usage with EVM

```typescript
import { config } from "dotenv";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme } from "@x402/evm";

config();

const { EVM_PRIVATE_KEY, API_URL } = process.env;

const account = privateKeyToAccount(EVM_PRIVATE_KEY as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:*", // Support all EVM chains
      client: new ExactEvmScheme(account),
    },
  ],
});

// Make a request to a paid API endpoint
fetchWithPayment(API_URL, {
  method: "GET",
})
  .then(async response => {
    const data = await response.json();
    
    // Optionally decode the payment response header
    const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
    if (paymentResponse) {
      const decoded = decodePaymentResponseHeader(paymentResponse);
      console.log("Payment details:", decoded);
    }
    
    console.log("Response data:", data);
  })
  .catch(error => {
    console.error(error);
  });
```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmClient } from "@x402/evm";
import { ExactEvmClientV1 } from "@x402/evm/v1";

const client = new x402Client()
  .register("eip155:*", new ExactEvmClient(signer))
  .registerSchemeV1("base-sepolia", new ExactEvmClientV1(signer))
  .registerSchemeV1("base", new ExactEvmClientV1(signer));
```

### Extension RPC Configuration (Optional)

`ExactEvmClient` only requires signer support for `address` + `signTypedData`.
Permit2 extension enrichment (EIP-2612 / ERC-20 approval gas sponsoring) can
optionally use explicit RPC config when signer read/fee helpers are unavailable.

No chain-default RPC fallback is applied by the SDK.

```typescript
// Per-network explicit registration
const client = new x402Client()
  .register("eip155:137", new ExactEvmClient(signer, { rpcUrl: polygonRpcUrl }))
  .register("eip155:8453", new ExactEvmClient(signer, { rpcUrl: baseRpcUrl }));

// Wildcard registration with chain-id keyed config map
const wildcardClient = new x402Client().register(
  "eip155:*",
  new ExactEvmClient(signer, {
    137: { rpcUrl: polygonRpcUrl },
    8453: { rpcUrl: baseRpcUrl },
  }),
);
```

### 2. Using Config (Flexible)

```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmClient } from "@x402/evm";

const client = x402Client.fromConfig({
  schemes: [
    { network: "eip155:*", client: new ExactEvmClient(signer) },
    { network: "base-sepolia", client: new ExactEvmClientV1(signer), x402Version: 1 }
  ],
  policies: [myCustomPolicy]
});
```

## Supported Networks

**V2 Networks** (via CAIP-2):
- `eip155:1` - Ethereum Mainnet
- `eip155:8453` - Base Mainnet  
- `eip155:84532` - Base Sepolia

exec
/bin/bash -lc 'find /tmp/tools-quiz-x402/x402-fetch-2.22.0/package -maxdepth 3 -type f | sort | head -60
rg -n "declare.*wrapFetchWithPayment|function wrapFetchWithPayment|export.*wrapFetch" /tmp/tools-quiz-x402/x402-fetch-2.22.0/package' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/README.md
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.d.ts
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.js
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.js.map
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.d.mts
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.mjs
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.mjs.map
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/package.json
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.d.ts:42:declare function wrapFetchWithPayment(fetch: typeof globalThis.fetch, client: x402Client | x402HTTPClient): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.d.ts:50:declare function wrapFetchWithPaymentFromConfig(fetch: typeof globalThis.fetch, config: x402ClientConfig): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.d.ts:52:export { wrapFetchWithPayment, wrapFetchWithPaymentFromConfig };
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.js:33:function wrapFetchWithPayment(fetch, client) {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.js:117:function wrapFetchWithPaymentFromConfig(fetch, config) {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/cjs/index.js.map:1:{"version":3,"sources":["../../src/index.ts"],"sourcesContent":["import { x402Client, x402ClientConfig, x402HTTPClient } from \"@x402/core/client\";\nimport { type PaymentRequired } from \"@x402/core/types\";\n\n/**\n * Enables the payment of APIs using the x402 payment protocol v2.\n *\n * This function wraps the native fetch API to automatically handle 402 Payment Required responses\n * by creating and sending payment headers. It will:\n * 1. Make the initial request\n * 2. If a 402 response is received, parse the payment requirements\n * 3. Create a payment header using the configured x402HTTPClient\n * 4. Retry the request with the payment header\n *\n * @param fetch - The fetch function to wrap (typically globalThis.fetch)\n * @param client - Configured x402Client or x402HTTPClient instance for handling payments\n * @returns A wrapped fetch function that handles 402 responses automatically\n *\n * @example\n * ```typescript\n * import { wrapFetchWithPayment, x402Client } from '@x402/fetch';\n * import { ExactEvmScheme } from '@x402/evm';\n * import { ExactSvmScheme } from '@x402/svm';\n *\n * const client = new x402Client()\n *   .register('eip155:8453', new ExactEvmScheme(evmSigner))\n *   .register('solana:mainnet', new ExactSvmScheme(svmSigner))\n *   .register('eip155:1', new ExactEvmScheme(evmSigner), 1); // v1 protocol\n *\n * const fetchWithPay = wrapFetchWithPayment(fetch, client);\n *\n * // Make a request that may require payment\n * const response = await fetchWithPay('https://api.example.com/paid-endpoint');\n * ```\n *\n * @throws {Error} If no schemes are provided\n * @throws {Error} If the request configuration is missing\n * @throws {Error} If a payment has already been attempted for this request\n * @throws {Error} If there's an error creating the payment header\n */\nexport function wrapFetchWithPayment(\n  fetch: typeof globalThis.fetch,\n  client: x402Client | x402HTTPClient,\n) {\n  const httpClient = client instanceof x402HTTPClient ? client : new x402HTTPClient(client);\n\n  return async (input: RequestInfo | URL, init?: RequestInit) => {\n    const request = new Request(input, init);\n    const clonedRequest = request.clone();\n\n    const response = await fetch(request);\n\n    if (response.status !== 402) {\n      return response;\n    }\n\n    // Parse payment requirements from response\n    let paymentRequired: PaymentRequired;\n    try {\n      // Create getHeader function for case-insensitive header lookup\n      const getHeader = (name: string) => response.headers.get(name);\n\n      // Try to get from headers first (v2), then from body (v1)\n      let body: PaymentRequired | undefined;\n      try {\n        const responseText = await response.text();\n        if (responseText) {\n          body = JSON.parse(responseText) as PaymentRequired;\n        }\n      } catch {\n        // Ignore JSON parse errors - might be header-only response\n      }\n\n      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);\n    } catch (error) {\n      throw new Error(\n        `Failed to parse payment requirements: ${error instanceof Error ? error.message : \"Unknown error\"}`,\n      );\n    }\n\n    // Run payment required hooks\n    const hookHeaders = await httpClient.handlePaymentRequired(paymentRequired);\n    if (hookHeaders) {\n      const hookRequest = clonedRequest.clone();\n      for (const [key, value] of Object.entries(hookHeaders)) {\n        hookRequest.headers.set(key, value);\n      }\n      const hookResponse = await fetch(hookRequest);\n      if (hookResponse.status !== 402) {\n        return hookResponse; // Hook succeeded\n      }\n      // Hook's retry got 402, fall through to payment\n    }\n\n    // Create payment payload (copy extensions from PaymentRequired)\n    let paymentPayload;\n    try {\n      paymentPayload = await client.createPaymentPayload(paymentRequired);\n    } catch (error) {\n      throw new Error(\n        `Failed to create payment payload: ${error instanceof Error ? error.message : \"Unknown error\"}`,\n      );\n    }\n\n    // Encode payment header\n    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);\n\n    // Check if this is already a retry to prevent infinite loops\n    if (clonedRequest.headers.has(\"PAYMENT-SIGNATURE\") || clonedRequest.headers.has(\"X-PAYMENT\")) {\n      throw new Error(\"Payment already attempted\");\n    }\n\n    // Add payment headers to cloned request\n    for (const [key, value] of Object.entries(paymentHeaders)) {\n      clonedRequest.headers.set(key, value);\n    }\n    clonedRequest.headers.set(\n      \"Access-Control-Expose-Headers\",\n      \"PAYMENT-RESPONSE,X-PAYMENT-RESPONSE\",\n    );\n\n    // Retry the request with payment\n    const secondResponse = await fetch(clonedRequest.clone());\n\n    // Fire payment response hooks and handle recovery\n    const result = await httpClient.processPaymentResult(\n      paymentPayload,\n      name => secondResponse.headers.get(name),\n      secondResponse.status,\n    );\n\n    if (result.recovered) {\n      // Hook fixed state — retry with fresh payload (bounded to one recovery)\n      const freshPayload = await client.createPaymentPayload(paymentRequired);\n      const retryHeaders = httpClient.encodePaymentSignatureHeader(freshPayload);\n      const retryRequest = clonedRequest;\n      for (const [k, v] of Object.entries(retryHeaders)) {\n        retryRequest.headers.set(k, v);\n      }\n      retryRequest.headers.set(\n        \"Access-Control-Expose-Headers\",\n        \"PAYMENT-RESPONSE,X-PAYMENT-RESPONSE\",\n      );\n      const retryResponse = await fetch(retryRequest);\n      // Fire hooks on retry response — no further recovery to prevent loops\n      await httpClient.processPaymentResult(\n        freshPayload,\n        name => retryResponse.headers.get(name),\n        retryResponse.status,\n      );\n      return retryResponse;\n    }\n\n    return secondResponse;\n  };\n}\n\n/**\n * Creates a payment-enabled fetch function from a configuration object.\n *\n * @param fetch - The fetch function to wrap (typically globalThis.fetch)\n * @param config - Configuration options including scheme registrations and selectors\n * @returns A wrapped fetch function that handles 402 responses automatically\n */\nexport function wrapFetchWithPaymentFromConfig(\n  fetch: typeof globalThis.fetch,\n  config: x402ClientConfig,\n) {\n  const client = x402Client.fromConfig(config);\n  return wrapFetchWithPayment(fetch, client);\n}\n\n// Re-export types and utilities for convenience\nexport { x402Client, x402HTTPClient } from \"@x402/core/client\";\nexport type { HTTPResourceResponse } from \"@x402/core/client\";\nexport type {\n  PaymentPolicy,\n  SchemeRegistration,\n  SelectPaymentRequirements,\n  x402ClientConfig,\n} from \"@x402/core/client\";\nexport { decodePaymentResponseHeader } from \"@x402/core/http\";\nexport type {\n  Network,\n  PaymentPayload,\n  PaymentRequired,\n  PaymentRequirements,\n  SchemeNetworkClient,\n} from \"@x402/core/types\";\n"],"mappings":";;;;;;;;;;;;;;;;;;;;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA,oBAA6D;AA4K7D,IAAAA,iBAA2C;AAQ3C,kBAA4C;AA7IrC,SAAS,qBACd,OACA,QACA;AACA,QAAM,aAAa,kBAAkB,+BAAiB,SAAS,IAAI,6BAAe,MAAM;AAExF,SAAO,OAAO,OAA0B,SAAuB;AAC7D,UAAM,UAAU,IAAI,QAAQ,OAAO,IAAI;AACvC,UAAM,gBAAgB,QAAQ,MAAM;AAEpC,UAAM,WAAW,MAAM,MAAM,OAAO;AAEpC,QAAI,SAAS,WAAW,KAAK;AAC3B,aAAO;AAAA,IACT;AAGA,QAAI;AACJ,QAAI;AAEF,YAAM,YAAY,CAAC,SAAiB,SAAS,QAAQ,IAAI,IAAI;AAG7D,UAAI;AACJ,UAAI;AACF,cAAM,eAAe,MAAM,SAAS,KAAK;AACzC,YAAI,cAAc;AAChB,iBAAO,KAAK,MAAM,YAAY;AAAA,QAChC;AAAA,MACF,QAAQ;AAAA,MAER;AAEA,wBAAkB,WAAW,2BAA2B,WAAW,IAAI;AAAA,IACzE,SAAS,OAAO;AACd,YAAM,IAAI;AAAA,QACR,yCAAyC,iBAAiB,QAAQ,MAAM,UAAU,eAAe;AAAA,MACnG;AAAA,IACF;AAGA,UAAM,cAAc,MAAM,WAAW,sBAAsB,eAAe;AAC1E,QAAI,aAAa;AACf,YAAM,cAAc,cAAc,MAAM;AACxC,iBAAW,CAAC,KAAK,KAAK,KAAK,OAAO,QAAQ,WAAW,GAAG;AACtD,oBAAY,QAAQ,IAAI,KAAK,KAAK;AAAA,MACpC;AACA,YAAM,eAAe,MAAM,MAAM,WAAW;AAC5C,UAAI,aAAa,WAAW,KAAK;AAC/B,eAAO;AAAA,MACT;AAAA,IAEF;AAGA,QAAI;AACJ,QAAI;AACF,uBAAiB,MAAM,OAAO,qBAAqB,eAAe;AAAA,IACpE,SAAS,OAAO;AACd,YAAM,IAAI;AAAA,QACR,qCAAqC,iBAAiB,QAAQ,MAAM,UAAU,eAAe;AAAA,MAC/F;AAAA,IACF;AAGA,UAAM,iBAAiB,WAAW,6BAA6B,cAAc;AAG7E,QAAI,cAAc,QAAQ,IAAI,mBAAmB,KAAK,cAAc,QAAQ,IAAI,WAAW,GAAG;AAC5F,YAAM,IAAI,MAAM,2BAA2B;AAAA,IAC7C;AAGA,eAAW,CAAC,KAAK,KAAK,KAAK,OAAO,QAAQ,cAAc,GAAG;AACzD,oBAAc,QAAQ,IAAI,KAAK,KAAK;AAAA,IACtC;AACA,kBAAc,QAAQ;AAAA,MACpB;AAAA,MACA;AAAA,IACF;AAGA,UAAM,iBAAiB,MAAM,MAAM,cAAc,MAAM,CAAC;AAGxD,UAAM,SAAS,MAAM,WAAW;AAAA,MAC9B;AAAA,MACA,UAAQ,eAAe,QAAQ,IAAI,IAAI;AAAA,MACvC,eAAe;AAAA,IACjB;AAEA,QAAI,OAAO,WAAW;AAEpB,YAAM,eAAe,MAAM,OAAO,qBAAqB,eAAe;AACtE,YAAM,eAAe,WAAW,6BAA6B,YAAY;AACzE,YAAM,eAAe;AACrB,iBAAW,CAAC,GAAG,CAAC,KAAK,OAAO,QAAQ,YAAY,GAAG;AACjD,qBAAa,QAAQ,IAAI,GAAG,CAAC;AAAA,MAC/B;AACA,mBAAa,QAAQ;AAAA,QACnB;AAAA,QACA;AAAA,MACF;AACA,YAAM,gBAAgB,MAAM,MAAM,YAAY;AAE9C,YAAM,WAAW;AAAA,QACf;AAAA,QACA,UAAQ,cAAc,QAAQ,IAAI,IAAI;AAAA,QACtC,cAAc;AAAA,MAChB;AACA,aAAO;AAAA,IACT;AAEA,WAAO;AAAA,EACT;AACF;AASO,SAAS,+BACd,OACA,QACA;AACA,QAAM,SAAS,yBAAW,WAAW,MAAM;AAC3C,SAAO,qBAAqB,OAAO,MAAM;AAC3C;","names":["import_client"]}
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.mjs:5:function wrapFetchWithPayment(fetch, client) {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.mjs:89:function wrapFetchWithPaymentFromConfig(fetch, config) {
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.mjs.map:1:{"version":3,"sources":["../../src/index.ts"],"sourcesContent":["import { x402Client, x402ClientConfig, x402HTTPClient } from \"@x402/core/client\";\nimport { type PaymentRequired } from \"@x402/core/types\";\n\n/**\n * Enables the payment of APIs using the x402 payment protocol v2.\n *\n * This function wraps the native fetch API to automatically handle 402 Payment Required responses\n * by creating and sending payment headers. It will:\n * 1. Make the initial request\n * 2. If a 402 response is received, parse the payment requirements\n * 3. Create a payment header using the configured x402HTTPClient\n * 4. Retry the request with the payment header\n *\n * @param fetch - The fetch function to wrap (typically globalThis.fetch)\n * @param client - Configured x402Client or x402HTTPClient instance for handling payments\n * @returns A wrapped fetch function that handles 402 responses automatically\n *\n * @example\n * ```typescript\n * import { wrapFetchWithPayment, x402Client } from '@x402/fetch';\n * import { ExactEvmScheme } from '@x402/evm';\n * import { ExactSvmScheme } from '@x402/svm';\n *\n * const client = new x402Client()\n *   .register('eip155:8453', new ExactEvmScheme(evmSigner))\n *   .register('solana:mainnet', new ExactSvmScheme(svmSigner))\n *   .register('eip155:1', new ExactEvmScheme(evmSigner), 1); // v1 protocol\n *\n * const fetchWithPay = wrapFetchWithPayment(fetch, client);\n *\n * // Make a request that may require payment\n * const response = await fetchWithPay('https://api.example.com/paid-endpoint');\n * ```\n *\n * @throws {Error} If no schemes are provided\n * @throws {Error} If the request configuration is missing\n * @throws {Error} If a payment has already been attempted for this request\n * @throws {Error} If there's an error creating the payment header\n */\nexport function wrapFetchWithPayment(\n  fetch: typeof globalThis.fetch,\n  client: x402Client | x402HTTPClient,\n) {\n  const httpClient = client instanceof x402HTTPClient ? client : new x402HTTPClient(client);\n\n  return async (input: RequestInfo | URL, init?: RequestInit) => {\n    const request = new Request(input, init);\n    const clonedRequest = request.clone();\n\n    const response = await fetch(request);\n\n    if (response.status !== 402) {\n      return response;\n    }\n\n    // Parse payment requirements from response\n    let paymentRequired: PaymentRequired;\n    try {\n      // Create getHeader function for case-insensitive header lookup\n      const getHeader = (name: string) => response.headers.get(name);\n\n      // Try to get from headers first (v2), then from body (v1)\n      let body: PaymentRequired | undefined;\n      try {\n        const responseText = await response.text();\n        if (responseText) {\n          body = JSON.parse(responseText) as PaymentRequired;\n        }\n      } catch {\n        // Ignore JSON parse errors - might be header-only response\n      }\n\n      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);\n    } catch (error) {\n      throw new Error(\n        `Failed to parse payment requirements: ${error instanceof Error ? error.message : \"Unknown error\"}`,\n      );\n    }\n\n    // Run payment required hooks\n    const hookHeaders = await httpClient.handlePaymentRequired(paymentRequired);\n    if (hookHeaders) {\n      const hookRequest = clonedRequest.clone();\n      for (const [key, value] of Object.entries(hookHeaders)) {\n        hookRequest.headers.set(key, value);\n      }\n      const hookResponse = await fetch(hookRequest);\n      if (hookResponse.status !== 402) {\n        return hookResponse; // Hook succeeded\n      }\n      // Hook's retry got 402, fall through to payment\n    }\n\n    // Create payment payload (copy extensions from PaymentRequired)\n    let paymentPayload;\n    try {\n      paymentPayload = await client.createPaymentPayload(paymentRequired);\n    } catch (error) {\n      throw new Error(\n        `Failed to create payment payload: ${error instanceof Error ? error.message : \"Unknown error\"}`,\n      );\n    }\n\n    // Encode payment header\n    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);\n\n    // Check if this is already a retry to prevent infinite loops\n    if (clonedRequest.headers.has(\"PAYMENT-SIGNATURE\") || clonedRequest.headers.has(\"X-PAYMENT\")) {\n      throw new Error(\"Payment already attempted\");\n    }\n\n    // Add payment headers to cloned request\n    for (const [key, value] of Object.entries(paymentHeaders)) {\n      clonedRequest.headers.set(key, value);\n    }\n    clonedRequest.headers.set(\n      \"Access-Control-Expose-Headers\",\n      \"PAYMENT-RESPONSE,X-PAYMENT-RESPONSE\",\n    );\n\n    // Retry the request with payment\n    const secondResponse = await fetch(clonedRequest.clone());\n\n    // Fire payment response hooks and handle recovery\n    const result = await httpClient.processPaymentResult(\n      paymentPayload,\n      name => secondResponse.headers.get(name),\n      secondResponse.status,\n    );\n\n    if (result.recovered) {\n      // Hook fixed state — retry with fresh payload (bounded to one recovery)\n      const freshPayload = await client.createPaymentPayload(paymentRequired);\n      const retryHeaders = httpClient.encodePaymentSignatureHeader(freshPayload);\n      const retryRequest = clonedRequest;\n      for (const [k, v] of Object.entries(retryHeaders)) {\n        retryRequest.headers.set(k, v);\n      }\n      retryRequest.headers.set(\n        \"Access-Control-Expose-Headers\",\n        \"PAYMENT-RESPONSE,X-PAYMENT-RESPONSE\",\n      );\n      const retryResponse = await fetch(retryRequest);\n      // Fire hooks on retry response — no further recovery to prevent loops\n      await httpClient.processPaymentResult(\n        freshPayload,\n        name => retryResponse.headers.get(name),\n        retryResponse.status,\n      );\n      return retryResponse;\n    }\n\n    return secondResponse;\n  };\n}\n\n/**\n * Creates a payment-enabled fetch function from a configuration object.\n *\n * @param fetch - The fetch function to wrap (typically globalThis.fetch)\n * @param config - Configuration options including scheme registrations and selectors\n * @returns A wrapped fetch function that handles 402 responses automatically\n */\nexport function wrapFetchWithPaymentFromConfig(\n  fetch: typeof globalThis.fetch,\n  config: x402ClientConfig,\n) {\n  const client = x402Client.fromConfig(config);\n  return wrapFetchWithPayment(fetch, client);\n}\n\n// Re-export types and utilities for convenience\nexport { x402Client, x402HTTPClient } from \"@x402/core/client\";\nexport type { HTTPResourceResponse } from \"@x402/core/client\";\nexport type {\n  PaymentPolicy,\n  SchemeRegistration,\n  SelectPaymentRequirements,\n  x402ClientConfig,\n} from \"@x402/core/client\";\nexport { decodePaymentResponseHeader } from \"@x402/core/http\";\nexport type {\n  Network,\n  PaymentPayload,\n  PaymentRequired,\n  PaymentRequirements,\n  SchemeNetworkClient,\n} from \"@x402/core/types\";\n"],"mappings":";AAAA,SAAS,YAA8B,sBAAsB;AA4K7D,SAAS,cAAAA,aAAY,kBAAAC,uBAAsB;AAQ3C,SAAS,mCAAmC;AA7IrC,SAAS,qBACd,OACA,QACA;AACA,QAAM,aAAa,kBAAkB,iBAAiB,SAAS,IAAI,eAAe,MAAM;AAExF,SAAO,OAAO,OAA0B,SAAuB;AAC7D,UAAM,UAAU,IAAI,QAAQ,OAAO,IAAI;AACvC,UAAM,gBAAgB,QAAQ,MAAM;AAEpC,UAAM,WAAW,MAAM,MAAM,OAAO;AAEpC,QAAI,SAAS,WAAW,KAAK;AAC3B,aAAO;AAAA,IACT;AAGA,QAAI;AACJ,QAAI;AAEF,YAAM,YAAY,CAAC,SAAiB,SAAS,QAAQ,IAAI,IAAI;AAG7D,UAAI;AACJ,UAAI;AACF,cAAM,eAAe,MAAM,SAAS,KAAK;AACzC,YAAI,cAAc;AAChB,iBAAO,KAAK,MAAM,YAAY;AAAA,QAChC;AAAA,MACF,QAAQ;AAAA,MAER;AAEA,wBAAkB,WAAW,2BAA2B,WAAW,IAAI;AAAA,IACzE,SAAS,OAAO;AACd,YAAM,IAAI;AAAA,QACR,yCAAyC,iBAAiB,QAAQ,MAAM,UAAU,eAAe;AAAA,MACnG;AAAA,IACF;AAGA,UAAM,cAAc,MAAM,WAAW,sBAAsB,eAAe;AAC1E,QAAI,aAAa;AACf,YAAM,cAAc,cAAc,MAAM;AACxC,iBAAW,CAAC,KAAK,KAAK,KAAK,OAAO,QAAQ,WAAW,GAAG;AACtD,oBAAY,QAAQ,IAAI,KAAK,KAAK;AAAA,MACpC;AACA,YAAM,eAAe,MAAM,MAAM,WAAW;AAC5C,UAAI,aAAa,WAAW,KAAK;AAC/B,eAAO;AAAA,MACT;AAAA,IAEF;AAGA,QAAI;AACJ,QAAI;AACF,uBAAiB,MAAM,OAAO,qBAAqB,eAAe;AAAA,IACpE,SAAS,OAAO;AACd,YAAM,IAAI;AAAA,QACR,qCAAqC,iBAAiB,QAAQ,MAAM,UAAU,eAAe;AAAA,MAC/F;AAAA,IACF;AAGA,UAAM,iBAAiB,WAAW,6BAA6B,cAAc;AAG7E,QAAI,cAAc,QAAQ,IAAI,mBAAmB,KAAK,cAAc,QAAQ,IAAI,WAAW,GAAG;AAC5F,YAAM,IAAI,MAAM,2BAA2B;AAAA,IAC7C;AAGA,eAAW,CAAC,KAAK,KAAK,KAAK,OAAO,QAAQ,cAAc,GAAG;AACzD,oBAAc,QAAQ,IAAI,KAAK,KAAK;AAAA,IACtC;AACA,kBAAc,QAAQ;AAAA,MACpB;AAAA,MACA;AAAA,IACF;AAGA,UAAM,iBAAiB,MAAM,MAAM,cAAc,MAAM,CAAC;AAGxD,UAAM,SAAS,MAAM,WAAW;AAAA,MAC9B;AAAA,MACA,UAAQ,eAAe,QAAQ,IAAI,IAAI;AAAA,MACvC,eAAe;AAAA,IACjB;AAEA,QAAI,OAAO,WAAW;AAEpB,YAAM,eAAe,MAAM,OAAO,qBAAqB,eAAe;AACtE,YAAM,eAAe,WAAW,6BAA6B,YAAY;AACzE,YAAM,eAAe;AACrB,iBAAW,CAAC,GAAG,CAAC,KAAK,OAAO,QAAQ,YAAY,GAAG;AACjD,qBAAa,QAAQ,IAAI,GAAG,CAAC;AAAA,MAC/B;AACA,mBAAa,QAAQ;AAAA,QACnB;AAAA,QACA;AAAA,MACF;AACA,YAAM,gBAAgB,MAAM,MAAM,YAAY;AAE9C,YAAM,WAAW;AAAA,QACf;AAAA,QACA,UAAQ,cAAc,QAAQ,IAAI,IAAI;AAAA,QACtC,cAAc;AAAA,MAChB;AACA,aAAO;AAAA,IACT;AAEA,WAAO;AAAA,EACT;AACF;AASO,SAAS,+BACd,OACA,QACA;AACA,QAAM,SAAS,WAAW,WAAW,MAAM;AAC3C,SAAO,qBAAqB,OAAO,MAAM;AAC3C;","names":["x402Client","x402HTTPClient"]}
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.d.mts:42:declare function wrapFetchWithPayment(fetch: typeof globalThis.fetch, client: x402Client | x402HTTPClient): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.d.mts:50:declare function wrapFetchWithPaymentFromConfig(fetch: typeof globalThis.fetch, config: x402ClientConfig): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/tmp/tools-quiz-x402/x402-fetch-2.22.0/package/dist/esm/index.d.mts:52:export { wrapFetchWithPayment, wrapFetchWithPaymentFromConfig };

exec
/bin/bash -lc "npm_config_cache=/tmp/tools-quiz-npm-cache npm install --prefix /tmp/tools-quiz-install --no-save @x402/core@2.22.0 @x402/evm@2.22.0 @x402/express@2.22.0 @x402/fetch@2.22.0 viem@2.55.15 express@5.2.1 dotenv@17.4.2 && node --input-type=module -e \"import('/tmp/tools-quiz-install/node_modules/@x402/fetch/dist/esm/index.mjs').then(m => console.log('fetch exports:', Object.keys(m).filter(k => /wrapFetch|x402Client/.test(k)).join(', ')))\" && node --input-type=module -e \"import('/tmp/tools-quiz-install/node_modules/@x402/express/dist/esm/index.mjs').then(m => console.log('express exports:', Object.keys(m).filter(k => /paymentMiddleware|x402ResourceServer/.test(k)).join(', ')))\"" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 7377ms:

added 99 packages in 7s

42 packages are looking for funding
  run `npm fund` for details
fetch exports: wrapFetchWithPayment, wrapFetchWithPaymentFromConfig, x402Client
express exports: paymentMiddleware, paymentMiddlewareFromConfig, paymentMiddlewareFromHTTPServer, x402ResourceServer

codex
The live check succeeded: the current scoped release is `2.22.0` across all four x402 packages, it installed cleanly with the current `viem`, and the expected middleware/client exports are present. I’m writing a pinned, copyable Base mainnet example and separating payer versus recipient secrets.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
diff --git a/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..efa6a6381b82f20936114f43db6b793b0485d16e
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,134 @@
+# Inline agent payments: x402
+
+The standard fit is **x402 v2**: the API first returns HTTP `402 Payment Required` with machine-readable payment requirements; the client signs an authorization, adds it to the request, and retries automatically. The resource server asks a facilitator to verify and settle the payment on-chain. There are no customer accounts, API keys, or invoices.
+
+For Base mainnet, use CAIP-2 network ID `eip155:8453`. A dollar-string price such as `"$0.03"` uses the network's configured dollar-denominated asset (normally USDC). Base Sepolia is `eip155:84532` for testing.
+
+## Install
+
+Keep every x402 package on the same 2.x version; do not combine these with the old unscoped `x402-*` v1 packages.
+
+```bash
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 \
+  @x402/express@2.22.0 @x402/fetch@2.22.0 \
+  viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript tsx @types/express
+```
+
+`@x402/express`, `@x402/core`, and `@x402/evm` are used by the server. `@x402/fetch`, `@x402/evm`, and `viem` are used by the client. In separate server/client projects, install only the relevant subset.
+
+## Server
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+
+const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;
+if (!payTo) throw new Error("PAY_TO_ADDRESS is required");
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://x402.org/facilitator",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453",
+  new ExactEvmScheme(),
+);
+
+const app = express();
+app.use(express.json());
+
+// Put this before the protected route.
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/infer": {
+        accepts: {
+          scheme: "exact",
+          network: "eip155:8453",
+          price: "$0.03",
+          payTo,
+        },
+        description: "One inference call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.post("/v1/infer", async (req, res) => {
+  // Payment has been verified/settled before this handler runs.
+  res.json({ answer: `processed: ${String(req.body.prompt)}` });
+});
+
+app.listen(3000, () => console.log("listening on http://localhost:3000"));
+```
+
+Server environment:
+
+```dotenv
+PAY_TO_ADDRESS=0xYourBaseRecipientAddress
+```
+
+The recipient is only an address; the server does not need its private key. The facilitator handles verification and submission. Before production, confirm the chosen facilitator's supported networks/assets, availability, authentication policy, fees, and trust model; self-host or choose another facilitator if those guarantees do not fit.
+
+## TypeScript client
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.PAYER_PRIVATE_KEY as `0x${string}`;
+if (!privateKey) throw new Error("PAYER_PRIVATE_KEY is required");
+
+// This wallet must hold enough USDC on Base to pay, plus any requirements
+// imposed by the selected payment mechanism/facilitator.
+const account = privateKeyToAccount(privateKey);
+
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:3000/v1/infer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "Give me one useful fact." }),
+});
+
+if (!response.ok) {
+  throw new Error(`API failed: ${response.status} ${await response.text()}`);
+}
+
+console.log(await response.json());
+```
+
+Client environment:
+
+```dotenv
+PAYER_PRIVATE_KEY=0xYourDedicatedPayerWalletPrivateKey
+```
+
+`wrapFetchWithPayment` performs the complete HTTP exchange: initial call, parsing the `402`, signing the advertised exact-payment authorization, adding the v2 payment header, and retrying once. Use a dedicated low-balance wallet or a managed signer in production; never ship this private key to browser code or commit it.
+
+An equivalent shorter client setup is `wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] })`.
+
+## Resolution check
+
+Checked against the npm registry on **2026-08-13**. These versions resolved and installed together successfully:
+
+- `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/fetch`: `2.22.0`
+- `viem`: `2.55.15`
+- `express`: `5.2.1`
+- `dotenv`: `17.4.2`
+
+I also inspected the installed exports: `@x402/fetch` exports `x402Client`, `wrapFetchWithPayment`, and `wrapFetchWithPaymentFromConfig`; `@x402/express` exports `paymentMiddleware` and `x402ResourceServer`. That matters because older examples using unscoped packages, `x402Fetch`, or `createWallet` are v1/stale and should not be copied into a v2 project.

diff --git a/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..efa6a6381b82f20936114f43db6b793b0485d16e
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,134 @@
+# Inline agent payments: x402
+
+The standard fit is **x402 v2**: the API first returns HTTP `402 Payment Required` with machine-readable payment requirements; the client signs an authorization, adds it to the request, and retries automatically. The resource server asks a facilitator to verify and settle the payment on-chain. There are no customer accounts, API keys, or invoices.
+
+For Base mainnet, use CAIP-2 network ID `eip155:8453`. A dollar-string price such as `"$0.03"` uses the network's configured dollar-denominated asset (normally USDC). Base Sepolia is `eip155:84532` for testing.
+
+## Install
+
+Keep every x402 package on the same 2.x version; do not combine these with the old unscoped `x402-*` v1 packages.
+
+```bash
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 \
+  @x402/express@2.22.0 @x402/fetch@2.22.0 \
+  viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript tsx @types/express
+```
+
+`@x402/express`, `@x402/core`, and `@x402/evm` are used by the server. `@x402/fetch`, `@x402/evm`, and `viem` are used by the client. In separate server/client projects, install only the relevant subset.
+
+## Server
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+
+const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;
+if (!payTo) throw new Error("PAY_TO_ADDRESS is required");
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://x402.org/facilitator",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453",
+  new ExactEvmScheme(),
+);
+
+const app = express();
+app.use(express.json());
+
+// Put this before the protected route.
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/infer": {
+        accepts: {
+          scheme: "exact",
+          network: "eip155:8453",
+          price: "$0.03",
+          payTo,
+        },
+        description: "One inference call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.post("/v1/infer", async (req, res) => {
+  // Payment has been verified/settled before this handler runs.
+  res.json({ answer: `processed: ${String(req.body.prompt)}` });
+});
+
+app.listen(3000, () => console.log("listening on http://localhost:3000"));
+```
+
+Server environment:
+
+```dotenv
+PAY_TO_ADDRESS=0xYourBaseRecipientAddress
+```
+
+The recipient is only an address; the server does not need its private key. The facilitator handles verification and submission. Before production, confirm the chosen facilitator's supported networks/assets, availability, authentication policy, fees, and trust model; self-host or choose another facilitator if those guarantees do not fit.
+
+## TypeScript client
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.PAYER_PRIVATE_KEY as `0x${string}`;
+if (!privateKey) throw new Error("PAYER_PRIVATE_KEY is required");
+
+// This wallet must hold enough USDC on Base to pay, plus any requirements
+// imposed by the selected payment mechanism/facilitator.
+const account = privateKeyToAccount(privateKey);
+
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:3000/v1/infer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "Give me one useful fact." }),
+});
+
+if (!response.ok) {
+  throw new Error(`API failed: ${response.status} ${await response.text()}`);
+}
+
+console.log(await response.json());
+```
+
+Client environment:
+
+```dotenv
+PAYER_PRIVATE_KEY=0xYourDedicatedPayerWalletPrivateKey
+```
+
+`wrapFetchWithPayment` performs the complete HTTP exchange: initial call, parsing the `402`, signing the advertised exact-payment authorization, adding the v2 payment header, and retrying once. Use a dedicated low-balance wallet or a managed signer in production; never ship this private key to browser code or commit it.
+
+An equivalent shorter client setup is `wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] })`.
+
+## Resolution check
+
+Checked against the npm registry on **2026-08-13**. These versions resolved and installed together successfully:
+
+- `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/fetch`: `2.22.0`
+- `viem`: `2.55.15`
+- `express`: `5.2.1`
+- `dotenv`: `17.4.2`
+
+I also inspected the installed exports: `@x402/fetch` exports `x402Client`, `wrapFetchWithPayment`, and `wrapFetchWithPaymentFromConfig`; `@x402/express` exports `paymentMiddleware` and `x402ResourceServer`. That matters because older examples using unscoped packages, `x402Fetch`, or `createWallet` are v1/stale and should not be copied into a v2 project.

2026-08-13T18:31:47.214769Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 94 column 5
exec
/bin/bash -lc 'test -s answer.md && rg -n "x402Client|paymentMiddleware|eip155:8453|Resolution check" answer.md && wc -l answer.md' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
5:For Base mainnet, use CAIP-2 network ID `eip155:8453`. A dollar-string price such as `"$0.03"` uses the network's configured dollar-denominated asset (normally USDC). Base Sepolia is `eip155:84532` for testing.
28:import { paymentMiddleware, x402ResourceServer } from "@x402/express";
38:  "eip155:8453",
47:  paymentMiddleware(
52:          network: "eip155:8453",
85:import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
96:const paymentClient = new x402Client().register(
97:  "eip155:8453",
123:An equivalent shorter client setup is `wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] })`.
125:## Resolution check
134:I also inspected the installed exports: `@x402/fetch` exports `x402Client`, `wrapFetchWithPayment`, and `wrapFetchWithPaymentFromConfig`; `@x402/express` exports `paymentMiddleware` and `x402ResourceServer`. That matters because older examples using unscoped packages, `x402Fetch`, or `createWallet` are v1/stale and should not be copied into a v2 project.
134 answer.md

diff --git a/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..efa6a6381b82f20936114f43db6b793b0485d16e
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,134 @@
+# Inline agent payments: x402
+
+The standard fit is **x402 v2**: the API first returns HTTP `402 Payment Required` with machine-readable payment requirements; the client signs an authorization, adds it to the request, and retries automatically. The resource server asks a facilitator to verify and settle the payment on-chain. There are no customer accounts, API keys, or invoices.
+
+For Base mainnet, use CAIP-2 network ID `eip155:8453`. A dollar-string price such as `"$0.03"` uses the network's configured dollar-denominated asset (normally USDC). Base Sepolia is `eip155:84532` for testing.
+
+## Install
+
+Keep every x402 package on the same 2.x version; do not combine these with the old unscoped `x402-*` v1 packages.
+
+```bash
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 \
+  @x402/express@2.22.0 @x402/fetch@2.22.0 \
+  viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript tsx @types/express
+```
+
+`@x402/express`, `@x402/core`, and `@x402/evm` are used by the server. `@x402/fetch`, `@x402/evm`, and `viem` are used by the client. In separate server/client projects, install only the relevant subset.
+
+## Server
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+
+const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;
+if (!payTo) throw new Error("PAY_TO_ADDRESS is required");
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://x402.org/facilitator",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453",
+  new ExactEvmScheme(),
+);
+
+const app = express();
+app.use(express.json());
+
+// Put this before the protected route.
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/infer": {
+        accepts: {
+          scheme: "exact",
+          network: "eip155:8453",
+          price: "$0.03",
+          payTo,
+        },
+        description: "One inference call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.post("/v1/infer", async (req, res) => {
+  // Payment has been verified/settled before this handler runs.
+  res.json({ answer: `processed: ${String(req.body.prompt)}` });
+});
+
+app.listen(3000, () => console.log("listening on http://localhost:3000"));
+```
+
+Server environment:
+
+```dotenv
+PAY_TO_ADDRESS=0xYourBaseRecipientAddress
+```
+
+The recipient is only an address; the server does not need its private key. The facilitator handles verification and submission. Before production, confirm the chosen facilitator's supported networks/assets, availability, authentication policy, fees, and trust model; self-host or choose another facilitator if those guarantees do not fit.
+
+## TypeScript client
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.PAYER_PRIVATE_KEY as `0x${string}`;
+if (!privateKey) throw new Error("PAYER_PRIVATE_KEY is required");
+
+// This wallet must hold enough USDC on Base to pay, plus any requirements
+// imposed by the selected payment mechanism/facilitator.
+const account = privateKeyToAccount(privateKey);
+
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:3000/v1/infer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "Give me one useful fact." }),
+});
+
+if (!response.ok) {
+  throw new Error(`API failed: ${response.status} ${await response.text()}`);
+}
+
+console.log(await response.json());
+```
+
+Client environment:
+
+```dotenv
+PAYER_PRIVATE_KEY=0xYourDedicatedPayerWalletPrivateKey
+```
+
+`wrapFetchWithPayment` performs the complete HTTP exchange: initial call, parsing the `402`, signing the advertised exact-payment authorization, adding the v2 payment header, and retrying once. Use a dedicated low-balance wallet or a managed signer in production; never ship this private key to browser code or commit it.
+
+An equivalent shorter client setup is `wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] })`.
+
+## Resolution check
+
+Checked against the npm registry on **2026-08-13**. These versions resolved and installed together successfully:
+
+- `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/fetch`: `2.22.0`
+- `viem`: `2.55.15`
+- `express`: `5.2.1`
+- `dotenv`: `17.4.2`
+
+I also inspected the installed exports: `@x402/fetch` exports `x402Client`, `wrapFetchWithPayment`, and `wrapFetchWithPaymentFromConfig`; `@x402/express` exports `paymentMiddleware` and `x402ResourceServer`. That matters because older examples using unscoped packages, `x402Fetch`, or `createWallet` are v1/stale and should not be copied into a v2 project.

codex
Completed [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md) with server/client x402 v2 code, exact package versions, Base configuration, security notes, and live npm resolution confirmation.
diff --git a/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..efa6a6381b82f20936114f43db6b793b0485d16e
--- /dev/null
+++ b/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,134 @@
+# Inline agent payments: x402
+
+The standard fit is **x402 v2**: the API first returns HTTP `402 Payment Required` with machine-readable payment requirements; the client signs an authorization, adds it to the request, and retries automatically. The resource server asks a facilitator to verify and settle the payment on-chain. There are no customer accounts, API keys, or invoices.
+
+For Base mainnet, use CAIP-2 network ID `eip155:8453`. A dollar-string price such as `"$0.03"` uses the network's configured dollar-denominated asset (normally USDC). Base Sepolia is `eip155:84532` for testing.
+
+## Install
+
+Keep every x402 package on the same 2.x version; do not combine these with the old unscoped `x402-*` v1 packages.
+
+```bash
+npm install @x402/core@2.22.0 @x402/evm@2.22.0 \
+  @x402/express@2.22.0 @x402/fetch@2.22.0 \
+  viem@2.55.15 express@5.2.1 dotenv@17.4.2
+npm install -D typescript tsx @types/express
+```
+
+`@x402/express`, `@x402/core`, and `@x402/evm` are used by the server. `@x402/fetch`, `@x402/evm`, and `viem` are used by the client. In separate server/client projects, install only the relevant subset.
+
+## Server
+
+```ts
+// server.ts
+import "dotenv/config";
+import express from "express";
+import { HTTPFacilitatorClient } from "@x402/core/server";
+import { ExactEvmScheme } from "@x402/evm/exact/server";
+import { paymentMiddleware, x402ResourceServer } from "@x402/express";
+
+const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;
+if (!payTo) throw new Error("PAY_TO_ADDRESS is required");
+
+const facilitator = new HTTPFacilitatorClient({
+  url: "https://x402.org/facilitator",
+});
+
+const resourceServer = new x402ResourceServer(facilitator).register(
+  "eip155:8453",
+  new ExactEvmScheme(),
+);
+
+const app = express();
+app.use(express.json());
+
+// Put this before the protected route.
+app.use(
+  paymentMiddleware(
+    {
+      "POST /v1/infer": {
+        accepts: {
+          scheme: "exact",
+          network: "eip155:8453",
+          price: "$0.03",
+          payTo,
+        },
+        description: "One inference call",
+        mimeType: "application/json",
+      },
+    },
+    resourceServer,
+  ),
+);
+
+app.post("/v1/infer", async (req, res) => {
+  // Payment has been verified/settled before this handler runs.
+  res.json({ answer: `processed: ${String(req.body.prompt)}` });
+});
+
+app.listen(3000, () => console.log("listening on http://localhost:3000"));
+```
+
+Server environment:
+
+```dotenv
+PAY_TO_ADDRESS=0xYourBaseRecipientAddress
+```
+
+The recipient is only an address; the server does not need its private key. The facilitator handles verification and submission. Before production, confirm the chosen facilitator's supported networks/assets, availability, authentication policy, fees, and trust model; self-host or choose another facilitator if those guarantees do not fit.
+
+## TypeScript client
+
+```ts
+// client.ts
+import "dotenv/config";
+import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
+import { ExactEvmScheme } from "@x402/evm/exact/client";
+import { privateKeyToAccount } from "viem/accounts";
+
+const privateKey = process.env.PAYER_PRIVATE_KEY as `0x${string}`;
+if (!privateKey) throw new Error("PAYER_PRIVATE_KEY is required");
+
+// This wallet must hold enough USDC on Base to pay, plus any requirements
+// imposed by the selected payment mechanism/facilitator.
+const account = privateKeyToAccount(privateKey);
+
+const paymentClient = new x402Client().register(
+  "eip155:8453",
+  new ExactEvmScheme(account),
+);
+const fetchWithPayment = wrapFetchWithPayment(fetch, paymentClient);
+
+const response = await fetchWithPayment("http://localhost:3000/v1/infer", {
+  method: "POST",
+  headers: { "content-type": "application/json" },
+  body: JSON.stringify({ prompt: "Give me one useful fact." }),
+});
+
+if (!response.ok) {
+  throw new Error(`API failed: ${response.status} ${await response.text()}`);
+}
+
+console.log(await response.json());
+```
+
+Client environment:
+
+```dotenv
+PAYER_PRIVATE_KEY=0xYourDedicatedPayerWalletPrivateKey
+```
+
+`wrapFetchWithPayment` performs the complete HTTP exchange: initial call, parsing the `402`, signing the advertised exact-payment authorization, adding the v2 payment header, and retrying once. Use a dedicated low-balance wallet or a managed signer in production; never ship this private key to browser code or commit it.
+
+An equivalent shorter client setup is `wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] })`.
+
+## Resolution check
+
+Checked against the npm registry on **2026-08-13**. These versions resolved and installed together successfully:
+
+- `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/fetch`: `2.22.0`
+- `viem`: `2.55.15`
+- `express`: `5.2.1`
+- `dotenv`: `17.4.2`
+
+I also inspected the installed exports: `@x402/fetch` exports `x402Client`, `wrapFetchWithPayment`, and `wrapFetchWithPaymentFromConfig`; `@x402/express` exports `paymentMiddleware` and `x402ResourceServer`. That matters because older examples using unscoped packages, `x402Fetch`, or `createWallet` are v1/stale and should not be copied into a v2 project.

tokens used
34,923
Completed [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-001/2026-08-13T183002Z-codex-with-skill-2/workspace/answer.md) with server/client x402 v2 code, exact package versions, Base configuration, security notes, and live npm resolution confirmation.
