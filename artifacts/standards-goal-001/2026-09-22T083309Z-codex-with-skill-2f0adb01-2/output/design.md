# forecast.example.com service design

`forecast.example.com` is a machine-to-machine weather forecast API. A forecast call costs exactly 0.35 USDC, paid on Base, with no service account, API key, invoice, subscription, or customer balance.

## Standards used

- ERC-8004 Identity Registry for discovery. The service is an agent identity NFT whose `agentURI` resolves to a registration file advertising endpoints and payment support.
- ERC-8004 Reputation Registry for ratings. Callers write public feedback to the registry after paid calls, and later callers query those records before buying.
- x402 v2 for HTTP-native payment negotiation. The protected forecast endpoint returns HTTP 402 plus a base64 `PAYMENT-REQUIRED` header when no valid payment is attached.
- EIP-3009 `transferWithAuthorization` for Base USDC. The caller signs a one-time USDC authorization, so the caller needs USDC but not ETH.
- ERC-4337 or EIP-7702 plus a USDC paymaster for optional gasless feedback submission when the caller also lacks ETH for the reputation transaction.

## Onchain dependencies

- Base, chain id `8453`, CAIP-2 `eip155:8453`.
- Base USDC token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals.
- ERC-8004 Identity Registry on Base: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- ERC-8004 Reputation Registry on Base: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`.
- Merchant receiving wallet, configured as `PAY_TO_ADDRESS`. This should also be set as the agent wallet metadata on the ERC-8004 identity using the registry's wallet verification flow.
- A registered ERC-8004 `agentId`. Until registration is done the server can run, but the published metadata uses `agentId: 0` as a placeholder and should not be considered discoverable.

## Offchain dependencies

- HTTPS hosting for `https://forecast.example.com`.
- DNS for `forecast.example.com`.
- This HTTP server (`server.ts`).
- An x402 facilitator URL (`X402_FACILITATOR_URL`) that supports `scheme: exact`, `network: eip155:8453`, and EIP-3009 settlement for Base USDC. The server uses `/verify` before doing work and `/settle` before returning the forecast.
- A weather data source (`WEATHER_UPSTREAM_URL`) for production forecasts. The implementation has a deterministic local fallback only so development remains runnable without third-party credentials.
- Optional independent indexing for discovery and trust, such as direct Base RPC log scans, The Graph, or any ERC-8004 explorer. These are not authoritative catalogs; they only index public registry state.
- Optional IPFS or equivalent immutable storage for the ERC-8004 registration JSON and feedback evidence files.
- Optional ERC-4337 bundler/paymaster or EIP-7702-capable wallet/paymaster for callers who want to post feedback while holding USDC but no ETH.

## Discovery and trust flow

1. The service publishes an ERC-8004 registration file at `https://forecast.example.com/agent-registration.json`. In production, pin the same JSON to IPFS and use the IPFS URI as the onchain `agentURI`.
2. Register the agent on the Base ERC-8004 Identity Registry by calling `register(agentURI, metadata)`.
3. Record the returned `agentId` in `ERC8004_AGENT_ID`, republish the registration file, and if the first registration used a temporary URI, call `setAgentURI(agentId, finalURI)`.
4. Publish `https://forecast.example.com/.well-known/agent-registration.json` with the matching `{ agentRegistry, agentId }` so clients can verify that the advertised endpoint domain is controlled by the registered agent.
5. Publish `https://forecast.example.com/.well-known/agent-card.json` and `https://forecast.example.com/openapi.json` so agents can inspect capabilities, parameters, price, payment method, and reputation registry references without human-readable docs.
6. A new client discovers agents by reading ERC-8004 `Registered` or `URIUpdated` events, or by querying an independent indexer over those events. It fetches each `agentURI`, filters for weather forecast services with x402 support, verifies the domain proof, then queries the Reputation Registry.
7. Trust is computed by the buyer, not by this service. The buyer chooses trusted rater addresses or scoring algorithms and reads `getSummary(...)` or raw feedback for tags like `quality:forecast`, `latency:forecast`, and `settlement:x402`.

## Payment flow

1. Client calls `GET /v1/forecast?lat=...&lon=...&days=...`.
2. If no payment is attached, the server responds `402 Payment Required` with `PAYMENT-REQUIRED: base64(json)`. The JSON names `exact` payment on `eip155:8453`, amount `350000`, asset Base USDC, receiver `PAY_TO_ADDRESS`, and `extra.assetTransferMethod: eip3009`.
3. The client signs an EIP-3009 authorization for exactly `350000` USDC to `PAY_TO_ADDRESS`, then retries the same request with `PAYMENT-SIGNATURE: base64(paymentPayload)`.
4. The server checks that the signed payload chose the exact advertised network, asset, amount, and receiver.
5. The server calls facilitator `/verify`. This checks signature, balance, nonce, validity window, and simulates `transferWithAuthorization`.
6. The server obtains the forecast from the configured weather upstream.
7. The server calls facilitator `/settle`. The facilitator pays Base gas and broadcasts the USDC transfer. The buyer spends only USDC.
8. The server returns `200 OK`, the forecast JSON, and `PAYMENT-RESPONSE: base64(settlementResponse)` containing the settlement transaction.

## Ratings after a call

The response body includes machine-readable feedback instructions. A caller rates the service by calling the ERC-8004 Reputation Registry:

```solidity
giveFeedback(
  agentId,
  value,
  valueDecimals,
  tag1,
  tag2,
  "https://forecast.example.com/v1/forecast",
  feedbackURI,
  feedbackHash
)
```

Recommended feedback tags are:

- `quality:forecast` with score `0-100`, decimals `0`.
- `latency:forecast` with milliseconds, decimals `0`.
- `settlement:x402` with score `0-100`, decimals `0`.

For richer evidence, the caller pins a feedback JSON file to IPFS containing the payment transaction, request hash, response hash, observed latency, and score rationale, then passes its URI/hash to `giveFeedback`. The server does not host or approve ratings. If the caller has no ETH, it submits the feedback transaction through an ERC-4337 or EIP-7702 path with a USDC paymaster, or through an independent feedback relayer. That keeps ratings usable by future agents without giving this service censorship control over negative feedback.

## HTTP surface implemented

- `GET /` returns service metadata.
- `GET /healthz` returns operational configuration status.
- `GET /.well-known/agent-card.json` returns the agent card.
- `GET /.well-known/agent-registration.json` returns endpoint-domain proof for ERC-8004.
- `GET /agent-registration.json` returns the ERC-8004 registration file.
- `GET /openapi.json` returns an OpenAPI document.
- `GET /v1/payment-requirements` returns the same x402 requirement object used by the forecast endpoint.
- `GET /v1/reputation` returns onchain feedback instructions.
- `GET /v1/forecast?lat={number}&lon={number}&days={1-10}` is the paid forecast resource.

## Required deployment configuration

- `PUBLIC_ORIGIN=https://forecast.example.com`
- `PAY_TO_ADDRESS=<Base address receiving USDC>`
- `ERC8004_OWNER_ADDRESS=<owner of the ERC-8004 identity>`
- `ERC8004_AGENT_ID=<agentId returned by IdentityRegistry.register>`
- `X402_FACILITATOR_URL=<facilitator base URL>`
- `WEATHER_UPSTREAM_URL=<production forecast provider endpoint>`
- `PORT=3000` or the platform's assigned port

## What must be published

- DNS A/AAAA or CNAME for `forecast.example.com`.
- HTTPS certificate for `forecast.example.com`.
- `https://forecast.example.com/agent-registration.json`.
- `https://forecast.example.com/.well-known/agent-registration.json`.
- `https://forecast.example.com/.well-known/agent-card.json`.
- `https://forecast.example.com/openapi.json`.
- Optional immutable copy of `agent-registration.json` on IPFS, used as the preferred ERC-8004 `agentURI`.
- Optional service icon at `https://forecast.example.com/icon.png`.

## What must be registered before discovery works

1. Register the agent in the ERC-8004 Identity Registry on Base with the registration file URI.
2. Set or verify the ERC-8004 `agentWallet` metadata to `PAY_TO_ADDRESS`.
3. Republish all HTTP metadata with the final `agentId`.
4. Make sure an x402 facilitator used by the service supports Base USDC EIP-3009.
5. Seed no private catalog. Discovery comes from public ERC-8004 registry state and any independent indexer a caller chooses to use.
