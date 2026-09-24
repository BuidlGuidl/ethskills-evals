# forecast.example.com service design

`forecast.example.com` is an autonomous-agent HTTP service that sells one weather forecast per paid call. Each call costs `350000` base units of native USDC on Base, which is `$0.35` with USDC's 6 decimals.

The service deliberately does not create user accounts, issue API keys, invoice customers, or hold customer balances. Discovery, trust, payment, settlement, and reputation are all mediated by open standards and public infrastructure.

## Architecture

The service has four public HTTP surfaces:

- `GET /.well-known/agent-registration.json` publishes the ERC-8004 registration document for this agent.
- `GET /.well-known/agent-card.json` publishes a machine-readable service card for client agents.
- `GET /forecast?lat={lat}&lon={lon}` is the paid weather endpoint.
- `GET /feedback-template` returns the ERC-8004 `giveFeedback` transaction shape that a caller can submit after a completed call.

The call flow is:

1. A client agent discovers this service by reading ERC-8004 `IdentityRegistry` registrations on Base and resolving this agent's `agentURI`.
2. The `agentURI` resolves to `https://forecast.example.com/.well-known/agent-registration.json`.
3. The client confirms that the advertised endpoint domain is bound to the same agent by reading the same well-known registration document on `forecast.example.com`.
4. The client reads the agent's prior reputation from the ERC-8004 `ReputationRegistry`, filtered to feedback authors it trusts.
5. The client calls `GET /forecast`.
6. If no valid payment is attached, the server returns HTTP `402` with an x402 payment requirement for `350000` USDC on Base.
7. The client signs an x402-compatible USDC authorization and retries the same request with the payment header.
8. The server asks an x402 facilitator to verify the payment, then settle it.
9. After settlement succeeds, the server returns the forecast plus payment, agent, and feedback metadata.
10. The caller can submit `giveFeedback` directly to the ERC-8004 `ReputationRegistry`; no human or service-operated review database is required.

## Onchain dependencies

### Base

All paid calls settle on Base mainnet:

- Chain ID: `8453`
- CAIP-2 chain ID: `eip155:8453`
- Network name in x402 payment requirements: `base`

### Native USDC on Base

The payment asset is native USDC on Base:

- Token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Decimals: `6`
- Per-call amount: `350000`

USDC supports EIP-3009 `transferWithAuthorization`, which lets the caller sign a transfer authorization offchain. The facilitator or another submitter pays the gas, so a caller that holds USDC but no ETH can still pay.

The service must not use Ethereum mainnet USDC (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`) or bridged USDbC (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) for this route.

### ERC-8004 Identity Registry

The service is registered as an ERC-8004 agent on Base:

- IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Registry chain: `eip155:8453`

Before the service can be found, the operator must call `register()` on the IdentityRegistry with:

- `agentURI`: `https://forecast.example.com/.well-known/agent-registration.json`

The assigned ERC-721 token ID is the service's `agentId`. It is not chosen by the service. After registration, set these environment variables in the server:

- `FORECAST_AGENT_ID`
- `FORECAST_AGENT_REGISTRY=eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

The registration document must include the returned `agentId` and registry address in its `registrations` array.

### ERC-8004 Reputation Registry

Reputation is written by callers, not by the service:

- ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- Registry chain: `eip155:8453`

After a forecast call, the caller can post:

```text
giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)
```

Suggested tags:

- `tag1`: `weather-forecast`
- `tag2`: `paid-x402`

Suggested values:

- Forecast quality: `0` to `100`, `valueDecimals=0`
- Availability or latency metrics can use fixed-point decimals, for example `9977` with `valueDecimals=2` for `99.77%`

Client agents should read reputation with `getSummary(agentId, clientAddresses, tag1, tag2)` and choose `clientAddresses` they already trust. Unfiltered totals are not enough because open reputation is vulnerable to Sybil feedback.

## Offchain dependencies

### DNS and HTTPS

The service must control and serve HTTPS for:

- `https://forecast.example.com`
- `https://forecast.example.com/.well-known/agent-registration.json`
- `https://forecast.example.com/.well-known/agent-card.json`

The well-known registration document binds the endpoint domain to the ERC-8004 agent. This binding matters even if another copy of the registration document is published to IPFS, because callers need to know that the HTTP endpoint they are about to pay is controlled by the registered agent.

### Base RPC or indexer access

Client agents need access to Base through their own RPC provider, indexer, or light-client stack so they can discover `IdentityRegistry` entries and read `ReputationRegistry` summaries. This is not a service-owned catalog: any compatible Base data source can expose the same public registry state.

### x402 facilitator

The server uses x402's HTTP `402` payment flow:

- Initial request: no payment header
- Server response: `402 Payment Required` with a machine-readable payment requirement
- Retry request: client includes the x402 payment header
- Server action: call facilitator `/verify`, then `/settle`
- Success response: `200 OK` with `PAYMENT-RESPONSE`

The facilitator verifies and submits the EIP-3009 USDC authorization, so the resource server does not need to run a Base node, manage relayer gas, or custody caller funds.

The server is configured with:

- `X402_FACILITATOR_URL`
- `FORECAST_PAY_TO`

`FORECAST_PAY_TO` is the service's Base address that receives USDC.

### Weather data provider

The sample server includes a deterministic forecast generator so it can run without a proprietary upstream. A production deployment can replace `buildForecast()` with an offchain provider such as a commercial weather API or a public meteorological feed. If a provider is used, publish its identity, freshness guarantees, and failure behavior in the ERC-8004 registration metadata so client agents can price trust correctly.

## What must be published

Publish at `https://forecast.example.com/.well-known/agent-registration.json`:

- ERC-8004 registration document
- `type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"`
- Agent name and description
- Forecast service endpoint
- x402 support metadata
- Active status
- `registrations` containing the Base IdentityRegistry and assigned `agentId`
- Supported trust/reputation tags

Publish at `https://forecast.example.com/.well-known/agent-card.json`:

- Service name
- Machine-readable forecast endpoint
- Price and token details
- Payment network
- Reputation registry details
- Feedback endpoint or template endpoint

Register before public use:

1. Call ERC-8004 `IdentityRegistry.register()` on Base with the registration URL as `agentURI`.
2. Record the returned token ID as `FORECAST_AGENT_ID`.
3. Deploy the HTTP server with that ID in both well-known documents.
4. Confirm `/.well-known/agent-registration.json` is served from the same endpoint domain advertised in the registration.

No service-owned catalog is required. A new client can discover the agent from ERC-8004 registry events or registry reads, inspect the registration URI, verify domain binding through the well-known file, evaluate caller-attested reputation onchain, pay with x402, and leave feedback onchain.
