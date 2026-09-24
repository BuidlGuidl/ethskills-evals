# forecast.example.com service design

`forecast.example.com` is an autonomous-agent weather forecast seller. It exposes a machine-readable service endpoint, charges exactly $0.35 USDC per forecast call on Base, and relies on public onchain identity and reputation rather than private accounts, API keys, invoices, subscriptions, or an operator-owned catalog.

## Requirements mapping

| Requirement | Design choice |
| --- | --- |
| Unknown agents can discover the service without human docs or our own catalog | Register the service in ERC-8004 IdentityRegistry on Base. Publish the ERC-8004 `agentURI`, `/.well-known/agent-registration.json`, `/.well-known/agent-card.json`, and `/.well-known/openapi.json`. Agents can discover by reading registry events or third-party indexes of those events. |
| Unknown agents can judge trust | Agents query ERC-8004 ReputationRegistry summaries for this `agentId`, endpoint, and tags before calling. The domain publishes the registry binding so agents can verify that the advertised endpoint and onchain identity match. |
| $0.35 per call, no accounts or balances held by us | Protect `GET /api/forecast` with x402 exact-payment middleware. Each request requires a fresh USDC payment authorization. The server never opens an account record and never holds prepaid funds. |
| Caller has USDC but no ETH | x402 on Base settles native USDC using EIP-3009 `transferWithAuthorization`. The caller signs a USDC authorization and the facilitator submits the settlement transaction, so the caller does not need ETH for gas. |
| Caller can leave a rating after the call | The response includes the ERC-8004 reputation target. `POST /api/feedback/prepare` returns calldata for `ReputationRegistry.giveFeedback(...)` so the caller can submit feedback directly, or through any ERC-4337/paymaster/relayer flow it already trusts. |
| No human step | All discovery files are JSON, payment negotiation is HTTP 402, settlement is facilitator-driven, forecasts are returned as JSON, and feedback is machine-prepared. |

## Architecture

```text
Client agent
  |
  | 1. Discover/query trust
  v
Base ERC-8004 IdentityRegistry + ReputationRegistry
  |
  | 2. Fetch machine-readable metadata
  v
https://forecast.example.com/.well-known/*
  |
  | 3. GET /api/forecast?lat=...&lon=...
  v
forecast.example.com HTTP server
  |
  | 4. 402 x402 challenge if unpaid
  v
Client signs USDC EIP-3009 authorization
  |
  | 5. Retry with payment header
  v
x402 middleware -> facilitator -> Base USDC transferWithAuthorization
  |
  | 6. Forecast JSON + settlement metadata
  v
Client optionally posts ERC-8004 feedback onchain
```

## Onchain dependencies

| Dependency | Chain | Address | Purpose |
| --- | --- | --- | --- |
| ERC-8004 IdentityRegistry | Base, `eip155:8453` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Owns the service's agent identity NFT and points to the `agentURI` registration document. |
| ERC-8004 ReputationRegistry | Base, `eip155:8453` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Stores caller feedback for the service. Agents query this before buying and submit feedback after a call. |
| Native USDC | Base, `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | The payment token. It has 6 decimals; $0.35 is `350000` base units. |
| EIP-3009 on USDC | Base | Same USDC contract | Lets the caller authorize `transferWithAuthorization` by signature so the x402 facilitator can settle without the caller holding ETH. |
| Optional ERC-4337/paymaster or relayer | Base | Caller choice | Used by callers that also want to post feedback without ETH. The service does not require a proprietary relayer. |

Constants used by the service:

```text
network: eip155:8453
price: $0.35
usdcBaseUnits: 350000
payTo: FORECAST_USDC_RECEIVER
agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId: FORECAST_AGENT_ID
```

## Offchain dependencies

| Dependency | Purpose | Trust assumption |
| --- | --- | --- |
| `forecast.example.com` HTTPS hosting | Serves discovery documents and the forecast API. | TLS/domain control binds the endpoint to the ERC-8004 identity via `/.well-known/agent-registration.json`. |
| x402 middleware packages | Produce 402 challenges, verify payment headers, and settle payments through a facilitator. | Middleware must enforce exact route, amount, token, network, recipient, and replay protections. |
| x402 facilitator | Verifies payment signatures and submits Base settlement transactions. | Facilitator does not custody caller funds; it relays signed EIP-3009 authorizations. Use a public facilitator or run an independent one for availability. |
| Base RPC access | Used by the facilitator for settlement and by agents for ERC-8004 and USDC state. | Agents should use their own RPCs for independent verification. |
| Weather data provider | Supplies forecast data in production. | The current `server.ts` includes a deterministic provider stub behind `buildForecast`; production should replace only that function with a provider such as NOAA/NWS, Meteomatics, Open-Meteo, or a proprietary model. |
| IPFS or HTTPS static hosting for `agentURI` | Hosts the ERC-8004 registration JSON. | IPFS is preferred for stable content addressing; HTTPS is acceptable if agents also verify domain ownership. |
| Third-party ERC-8004 indexers, such as The Graph | Optional fast discovery. | Not required for correctness; agents can read registry events directly. |

## What to publish

Publish these documents at `https://forecast.example.com`:

1. `/.well-known/agent-card.json`
   Machine-readable service card. It describes the forecast endpoint, x402 support, payment asset, price, network, response schema, and reputation registry location.

2. `/.well-known/agent-registration.json`
   Domain-to-agent binding:

   ```json
   {
     "agentId": "FORECAST_AGENT_ID",
     "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
     "owner": "FORECAST_OPERATOR_ADDRESS",
     "agentURI": "ipfs://CID_OR_HTTPS_URL"
   }
   ```

3. `/.well-known/openapi.json`
   Machine-readable API schema for `GET /api/forecast` and `POST /api/feedback/prepare`.

4. `/registration.json`
   The ERC-8004 `agentURI` body. For production, pin the same JSON to IPFS and use the resulting `ipfs://...` URI in the registry.

5. DNS and TLS records for `forecast.example.com`.
   Agents should fetch metadata over HTTPS and compare it with the registry.

## What to register

Before autonomous agents can find the service:

1. Choose an operator wallet and payment receiver address.
2. Deploy the server with:

   ```text
   FORECAST_BASE_URL=https://forecast.example.com
   FORECAST_USDC_RECEIVER=0x...
   FORECAST_OPERATOR_ADDRESS=0x...
   FORECAST_AGENT_ID=<empty until registered>
   X402_FACILITATOR_URL=https://facilitator.openx402.ai
   ```

3. Publish `/registration.json`, preferably also pinned on IPFS.
4. Call `IdentityRegistry.register(agentURI, metadata)` on Base at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
5. Set `FORECAST_AGENT_ID` to the returned ERC-721 token id and redeploy so the well-known files expose the final binding.
6. Ensure third-party indexers can see the registry transaction. No owned catalog is required; agents can discover by indexing ERC-8004 directly.

## Request flow

1. Client discovers candidates by querying ERC-8004 registrations for active weather/forecast services.
2. Client fetches `/.well-known/agent-registration.json` and checks:
   - `agentRegistry` matches Base ERC-8004 IdentityRegistry.
   - `agentId` matches the registry token.
   - The registry `agentURI` matches the published registration document.
   - The service endpoint domain matches the fetched domain.
3. Client queries ReputationRegistry summaries for tags such as `quality/forecast`, `accuracy/forecast`, and `settlement/x402`.
4. Client calls `GET /api/forecast?lat=40.7128&lon=-74.0060&days=5`.
5. Server returns x402 `402 Payment Required` if no valid payment is present.
6. Client signs an EIP-3009 USDC authorization for `350000` units to `FORECAST_USDC_RECEIVER` on Base and retries.
7. x402 middleware verifies and settles via the facilitator.
8. Server returns forecast JSON and reputation metadata.
9. Client rates by preparing calldata at `POST /api/feedback/prepare` and submitting it to the ERC-8004 ReputationRegistry with its own gas strategy.

## Security and correctness notes

- The x402 route config must pin amount, token, network, recipient, scheme, and route.
- The forecast route is idempotent for the same query; paid retries should not produce conflicting semantic results.
- Do not accept API keys or account identifiers; payment receipt is the authorization boundary.
- The service must not relay feedback itself as the only path, because that would let the seller censor negative feedback. The helper endpoint only prepares calldata.
- Agents should treat reputation as filterable by feedback author sets. ERC-8004 anti-Sybil strength comes from the caller's trust policy over raters, not from raw averages alone.
- Production deployment should run at least two facilitators or one self-hosted facilitator plus a public fallback for availability. Whichever facilitator is configured must advertise `scheme=exact` on `network=eip155:8453`; the server fails closed if it does not.
