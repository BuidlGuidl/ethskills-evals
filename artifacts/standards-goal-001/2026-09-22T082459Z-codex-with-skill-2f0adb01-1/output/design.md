# forecast.example.com service design

## Goal

`forecast.example.com` sells machine-readable weather forecasts to autonomous
agents for exactly $0.35 per HTTP call. Payment settles in USDC on Base. There
are no accounts, API keys, subscriptions, invoices, or prepaid balances.

The service is designed around three open systems:

- ERC-8004 for agent identity and reputation.
- x402 for HTTP-native `402 Payment Required` flows.
- EIP-3009 USDC authorizations so a caller with USDC but no ETH can pay.

## Architecture

The public service has four surfaces:

- `GET /.well-known/agent-card.json`: unpaid machine-readable service card.
- `GET /.well-known/agent-registration.json`: unpaid domain-to-ERC-8004 proof.
- `GET /.well-known/x402.json`: unpaid payment manifest for the paid route.
- `GET /api/forecast?lat=...&lon=...&timezone=...`: paid forecast endpoint.

The paid route is protected by x402 middleware. An unpaid client receives HTTP
402 with payment requirements. A paying client signs the USDC authorization and
retries the same request with the x402 payment header. The server verifies the
payment through a facilitator, runs the forecast request, and settles the USDC
transfer after the handler succeeds.

The forecast data source in `server.ts` is Open-Meteo. Production deployments
can replace that with NOAA, a commercial weather vendor, or a fused forecast
pipeline as long as the endpoint contract and price stay the same.

## Onchain dependencies

- Base chain: settlement network `eip155:8453`.
- Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals.
- USDC `transferWithAuthorization`: EIP-3009 gasless token authorization used by
  x402's EVM exact scheme. The caller signs with USDC only; it does not need ETH.
- ERC-8004 IdentityRegistry on Base:
  `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- ERC-8004 ReputationRegistry on Base:
  `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`.
- Service receiving wallet: configured as `FORECAST_PAY_TO`. It receives
  `350000` atomic USDC per successful forecast call.
- Gas payer: the x402 facilitator or self-hosted settlement service submits the
  Base transaction and must hold ETH for gas. The caller does not.

## Offchain dependencies

- DNS and HTTPS for `forecast.example.com`.
- The deployed `server.ts` HTTP service.
- x402 packages: `@x402/express`, `@x402/core`, and `@x402/evm`.
- x402 facilitator: default `https://facilitator.monexprotocol.org`, or a
  self-hosted/onboarded facilitator configured with `X402_FACILITATOR_URL`.
  The facilitator must advertise `exact` on `eip155:8453` from `/supported`.
- Weather provider: Open-Meteo in this implementation.
- Optional independent indexers: agents may use The Graph, chain RPC logs, or
  any third-party ERC-8004 indexer to find registrations. Discovery must not
  depend on a catalog operated by forecast.example.com.
- Optional IPFS pinning: publish the ERC-8004 registration document to IPFS so
  the identity URI remains available independently of the service domain.

## Discovery and trust

Before the service can be found, the operator must register it in ERC-8004:

1. Publish the registration document. The same JSON is served by
   `GET /registration.json`; production should also pin it to IPFS.
2. Call `IdentityRegistry.register(agentURI, metadata)` on Base, where
   `agentURI` is the IPFS URI or HTTPS URI for the registration document.
3. Record the returned ERC-721 token id as `ERC8004_AGENT_ID`.
4. Serve `/.well-known/agent-registration.json` containing:
   - `agentId`
   - `agentRegistry: eip155:8453:0x8004A169...`
   - `owner`
   - `agentURI`
5. Keep the ERC-8004 registration JSON active and pointing at:
   - `https://forecast.example.com/.well-known/agent-card.json`
   - `https://forecast.example.com/.well-known/x402.json`
   - `https://forecast.example.com/api/forecast`

A new client agent can discover the service by reading ERC-8004 registrations
from Base or an independent indexer, filtering for weather forecast services,
then resolving the service card. It can trust-check by:

- verifying the domain file agrees with the onchain `agentId` and owner;
- reading ReputationRegistry summaries for the agent id;
- filtering feedback to raters it trusts;
- checking `quality`, `uptime`, and `settlement` tags for the endpoint.

## Payment flow

1. Client requests `GET /api/forecast?lat=40.7128&lon=-74.0060`.
2. Server returns HTTP 402 with x402 requirements:
   - scheme: `exact`
   - network: `eip155:8453`
   - asset: Base USDC
   - amount: `350000`
   - payTo: `FORECAST_PAY_TO`
3. Client signs an EIP-3009 authorization for USDC. No ETH is required.
4. Client retries the request with the x402 payment header.
5. Server verifies through the facilitator.
6. Server fetches and returns the forecast.
7. x402 settles the USDC transfer on Base and returns settlement metadata.

The server never creates an account for the caller and never holds a customer
balance. Payment is per successful call.

## Rating flow

The forecast response includes the ERC-8004 reputation target:

- registry: `eip155:8453:0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- agent id: `ERC8004_AGENT_ID`
- endpoint: `https://forecast.example.com/api/forecast`
- suggested tags: `quality:forecast`, `uptime:30days`, `settlement:x402`

After the call, the caller may call `ReputationRegistry.giveFeedback` itself.
For example, a quality score of 92/100 can be submitted as value `92`,
decimals `0`, tag1 `quality`, tag2 `forecast`, endpoint
`https://forecast.example.com/api/forecast`, with optional metadata pointing to
the payment transaction or a signed evaluation artifact. Other agents can query
and filter these ratings before choosing the service.

## What must be published

- DNS A/AAAA/CNAME records for `forecast.example.com`.
- TLS certificate for `forecast.example.com`.
- `/.well-known/agent-card.json`.
- `/.well-known/agent-registration.json`.
- `/.well-known/x402.json`.
- `/registration.json` over HTTPS.
- The same registration JSON pinned to IPFS, recommended for durable ERC-8004
  `agentURI`.
- Public uptime/status metadata if operators want reputation raters to verify
  availability independently.

## What must be registered before discovery

- ERC-8004 IdentityRegistry registration on Base, using the published
  registration JSON URI.
- The returned token id in deployment configuration as `ERC8004_AGENT_ID`.
- The domain verification file at
  `https://forecast.example.com/.well-known/agent-registration.json`.
- Initial reputation can only come from external callers or validators. The
  operator should not rely on self-ratings; clients should filter by trusted
  rater addresses.

## Server configuration

Required:

- `FORECAST_PAY_TO`: EVM address receiving Base USDC.

Recommended:

- `BASE_URL=https://forecast.example.com`
- `ERC8004_AGENT_ID=<token id returned by IdentityRegistry.register>`
- `ERC8004_OWNER=<owner address of the ERC-8004 identity>`
- `ERC8004_AGENT_URI=ipfs://<cid>` or the HTTPS registration URL
- `X402_FACILITATOR_URL=https://facilitator.monexprotocol.org` or a
  self-hosted/onboarded URL that supports `exact` on `eip155:8453`
- `PORT=3000`
