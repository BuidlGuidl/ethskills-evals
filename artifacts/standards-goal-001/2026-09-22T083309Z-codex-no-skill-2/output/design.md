# forecast.example.com service design

## Goal

`forecast.example.com` sells one weather forecast per HTTP call for 0.35 USDC on Base. The service is meant for autonomous agents, so discovery, payment, fulfillment, and rating must all be machine-readable and executable without accounts, API keys, invoices, manual approval, or a human reading prose documentation.

## Standards used

- **ERC-8004 Trustless Agents** for decentralized discovery and reputation. The service mints an agent identity in the public ERC-8004 Identity Registry and points its `agentURI` at a registration JSON file served by the domain and optionally pinned to IPFS. Other agents can find the service by indexing public registry events or reading the registry directly, not by depending on a catalog controlled by this service.
- **x402 v2** for per-request HTTP payment. The protected forecast route returns `402 Payment Required` with a `PAYMENT-REQUIRED` header. The caller signs an EIP-3009 USDC authorization and retries with `PAYMENT-SIGNATURE`. A facilitator verifies and settles the USDC transfer on Base.
- **ERC-8004 Reputation Registry** for post-call ratings. A caller can publish a `starred` feedback value for this agent id. Other agents can read the public registry state and apply their own trust policy before paying.

Primary references:

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- ERC-8004 contracts and Base addresses: https://github.com/erc-8004/erc-8004-contracts
- x402 v2 spec: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- x402 exact EVM payments: https://github.com/x402-foundation/x402

## Onchain dependencies

### Base mainnet

- CAIP-2 network id: `eip155:8453`
- USDC token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bDa3`
- Price per forecast call: `350000` USDC atomic units, equal to 0.35 USDC with 6 decimals.

USDC on Base supports EIP-3009 `transferWithAuthorization`. The paying agent signs an offchain authorization; the x402 facilitator submits the transaction and pays gas. This is why the caller can hold only USDC and no ETH.

### ERC-8004 registries on Base

- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

The service owner must call:

1. `IdentityRegistry.register("https://forecast.example.com/.well-known/agent-registration.json")`
2. Store the returned `agentId` in server configuration.
3. Optionally call `setAgentWallet(agentId, receivingWallet, deadline, signature)` so the onchain identity advertises the same wallet used in x402 `payTo`.

Ratings are written with:

```solidity
ReputationRegistry.giveFeedback(
  agentId,
  value,          // 0-100
  0,              // valueDecimals
  "starred",
  "forecast",
  "https://forecast.example.com/forecast",
  feedbackURI,
  feedbackHash
)
```

Because rating is a transaction, callers without ETH submit that calldata through any ERC-4337 or EIP-7702 relay/paymaster that sponsors Base gas or charges gas in USDC. The server exposes `/ratings/calldata` so agents can generate the exact transaction data without trusting service-owned infrastructure. If `RATING_RELAY_URL` is configured, `/ratings/relay` can forward the same payload to a gasless relay, but direct submission through an independent relay is preferred for censorship resistance.

## Offchain dependencies

- **DNS and TLS** for `forecast.example.com`. Agents must be able to fetch HTTPS discovery files and the forecast endpoint.
- **ERC-8004-readable RPC or indexer**. Discovering agents only requires public chain data. A caller may use any Base RPC, block explorer, subgraph, or local node.
- **x402 facilitator**. The server defaults to `https://facilitator.openx402.ai`, which exposes `/verify` and `/settle` for Base USDC x402 payments. Production deployments should configure and monitor at least two compatible facilitators or run one internally.
- **Weather data provider**. The implementation calls Open-Meteo by default (`https://api.open-meteo.com/v1/forecast`) for hourly and daily forecast data. The provider can be changed with `WEATHER_API_URL`.
- **Optional IPFS pinning**. The ERC-8004 registration file and richer feedback evidence files should also be pinned to IPFS for content-addressed availability. HTTPS copies remain useful for low-latency agent fetching.
- **Optional gasless rating relay/paymaster**. Required only for callers that want this server to relay ERC-8004 feedback. Otherwise callers use `/ratings/calldata` with their own paymaster.

## Published machine-readable files

Serve these from `forecast.example.com`:

- `/.well-known/agent-registration.json`: ERC-8004 registration file. It includes the service name, description, x402 support, active status, Base `agentRegistry`, `agentId`, payment wallet, and service endpoints.
- `/.well-known/agent-card.json`: A2A-style machine card describing the forecast skill, input schema, output mode, and payment requirements.
- `/.well-known/x402.json`: x402 resource discovery for the paid route.
- `/openapi.json`: OpenAPI document for the forecast, health, discovery, and rating endpoints.

The same registration JSON should be pinned to IPFS. The onchain `agentURI` may point at HTTPS for domain-control proof, IPFS for stronger availability, or HTTPS first with an IPFS mirror listed in the document.

## Request flow

1. A new client discovers the agent by scanning ERC-8004 `Registered` events or reading an independent ERC-8004 index.
2. It fetches the agent registration file from the onchain `agentURI`.
3. It verifies that the file binds back to the same `{ agentRegistry, agentId }` and that `forecast.example.com/.well-known/agent-registration.json` advertises the same registration.
4. It reads ERC-8004 Reputation Registry feedback for the agent id, especially `tag1 = "starred"` and `tag2 = "forecast"`, using reviewer filters it trusts.
5. It calls `GET /forecast?lat=...&lon=...`.
6. If no payment is attached, the server returns `402` with a base64 JSON `PAYMENT-REQUIRED` header. The body contains the same object for clients that cannot read the header.
7. The caller signs an x402 exact EIP-3009 USDC authorization for `350000` units to the configured receiving wallet and retries with `PAYMENT-SIGNATURE`.
8. The server posts the payload and exact payment requirements to the facilitator `/verify`.
9. If valid, the server fetches forecast data.
10. The server posts to facilitator `/settle`, waits for success, and returns the forecast with `PAYMENT-RESPONSE` containing the settlement receipt.
11. The caller posts to `/ratings/calldata` to generate ERC-8004 `giveFeedback` calldata, then submits it through its preferred gasless relay/paymaster. Other agents can immediately incorporate that public feedback once indexed or mined.

## Trust and failure model

- Discovery does not depend on a service-owned catalog. It depends on ERC-8004 registry events and the public `agentURI`.
- Reputation is public and portable, but not automatically Sybil-resistant. Consumers should filter reviewers, require proof-of-payment evidence, or use independent reputation aggregators.
- The x402 facilitator is a payment-critical dependency. It can cause false rejects, delayed settlement, or metadata exposure. The server pins exact payment requirements and rechecks amount, asset, network, and recipient through the facilitator.
- The server only fulfills after settlement success, which avoids giving forecasts for invalid or already-used authorizations.
- In-memory settlement caching in `server.ts` is for duplicate HTTP retries. Production should back it with durable storage keyed by payment payload hash.

