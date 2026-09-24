# forecast.example.com service design

## Goal

`forecast.example.com` sells machine-readable weather forecasts to autonomous agents for `0.35` USDC per HTTP call. Settlement happens on Base mainnet, with no user accounts, API keys, subscriptions, invoices, or balances custodied by the service.

The service relies on deployed standards instead of private catalogs or local trust databases:

- ERC-8004 for agent identity, endpoint discovery, and client-attested reputation.
- x402 for pay-per-call HTTP payment negotiation.
- EIP-3009 `transferWithAuthorization`, implemented by native Base USDC, so callers that hold USDC but no ETH can still pay.

## Public HTTP surface

- `GET https://forecast.example.com/.well-known/agent-registration.json`
  - Public ERC-8004 registration file.
  - Binds the `forecast.example.com` endpoint domain to the onchain ERC-8004 agent registration.
  - Includes the forecast endpoint, x402 support, Base USDC price, payout address, and reputation registry coordinates.
- `GET https://forecast.example.com/.well-known/agent-card.json`
  - Public A2A-style card for agents that discover services through agent cards.
  - Points back to the paid forecast skill and repeats ERC-8004/x402 metadata.
- `GET https://forecast.example.com/forecast?lat={latitude}&lon={longitude}&days={1-7}`
  - Paid JSON forecast endpoint.
  - First request without payment returns `402` and an x402 v2 payment requirement.
  - Retried request with `X-PAYMENT` is verified and settled through a facilitator, then returns forecast data and `X-PAYMENT-RESPONSE`.
- `GET https://forecast.example.com/health`
  - Public liveness check.

## Payment flow

1. Caller discovers the service from ERC-8004, the `.well-known` registration file, or an A2A card.
2. Caller requests `/forecast`.
3. Server returns HTTP `402` with:
   - `x402Version: 2`
   - scheme `exact`
   - network `eip155:8453`
   - amount `350000`, which is `0.35` USDC with 6 decimals
   - asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, native USDC on Base
   - `payTo`, the service's USDC receiver address
   - USDC EIP-712 domain metadata `{ name: "USD Coin", version: "2" }`
4. Caller signs the x402 payment payload. For Base USDC this uses EIP-3009 `transferWithAuthorization`, so the caller does not need ETH for gas.
5. Caller retries with `X-PAYMENT`.
6. Server posts the payment payload and requirements to the x402 facilitator `/verify`.
7. If valid, server validates the coordinates and fetches weather data. If this fails, no settlement is attempted.
8. Server posts the same payload and requirements to `/settle`.
9. The facilitator submits the USDC transfer on Base and pays gas.
10. Server returns JSON and includes `X-PAYMENT-RESPONSE` containing settlement details.

The resource server does not run a Base node, hold the caller's funds, maintain balances, or issue credentials. Its only payment authority is the public 402 requirement that names the exact asset, amount, network, and receiver.

## Onchain dependencies

- Base mainnet, CAIP-2 `eip155:8453`.
- Native Base USDC:
  - address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  - decimals `6`
  - EIP-3009 support for `transferWithAuthorization`
  - EIP-712 domain name `USD Coin`, version `2`
- ERC-8004 IdentityRegistry on Base:
  - `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - `register()` mints the agent ERC-721.
  - The assigned token ID is the `agentId`; the service must not invent its own ID.
- ERC-8004 ReputationRegistry on Base:
  - `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
  - Callers submit `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`.
  - Suggested tags are `weather-forecast` and `quality`.
  - Other agents should query summaries from clients they trust, because unfiltered reputation totals are Sybil-prone.

## Offchain dependencies

- DNS and TLS for `forecast.example.com`.
- HTTPS hosting for:
  - `/.well-known/agent-registration.json`
  - `/.well-known/agent-card.json`
  - `/forecast`
- x402 facilitator:
  - configured by `X402_FACILITATOR_URL`
  - must support x402 v2, scheme `exact`, network `eip155:8453`, and Base USDC EIP-3009 settlement
  - receives `/verify` and `/settle` requests from the resource server
- Weather data provider:
  - the implementation uses Open-Meteo's public forecast endpoint, `https://api.open-meteo.com/v1/forecast`
  - production can replace this behind `fetchForecast` if a different licensed provider is required

## What must be registered before discovery works

1. Deploy the HTTP service at `https://forecast.example.com`.
2. Publish `https://forecast.example.com/.well-known/agent-registration.json`.
3. Call ERC-8004 `IdentityRegistry.register(agentURI)` on Base, where `agentURI` resolves to the registration JSON. The registry assigns the `agentId`.
4. Set `ERC8004_AGENT_ID` in the service to that assigned token ID.
5. Ensure the registration JSON contains:
   - `registrations[0].agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`
   - `registrations[0].agentId = <assigned token ID>`
6. Because the advertised endpoint domain is `forecast.example.com`, keep `/.well-known/agent-registration.json` on that same domain. This binds the domain serving `/forecast` to the registered ERC-8004 agent even if the token URI later points to IPFS or another HTTPS host.

No proprietary catalog is required. A new client can discover the ERC-8004 agent, resolve its `agentURI`, confirm that `forecast.example.com` serves a matching `.well-known/agent-registration.json`, inspect x402 support, and query ERC-8004 ReputationRegistry summaries before deciding to call.

## Reputation after a call

The response includes feedback instructions with the ERC-8004 ReputationRegistry address, `agentId`, endpoint, and suggested tags. A caller that paid can publish a feedback body to `ipfs://`, `https://`, or `data:`, hash it, and submit:

```text
giveFeedback(
  agentId,
  value,
  valueDecimals,
  "weather-forecast",
  "quality",
  "https://forecast.example.com/forecast",
  feedbackURI,
  feedbackHash
)
```

The rating is client-attested and onchain. The service cannot rate itself because ERC-8004 rejects feedback from the agent owner and operators.

## Runtime configuration

- `PORT`: local HTTP port, default `3000`.
- `PUBLIC_ORIGIN`: public origin, default `https://forecast.example.com`.
- `X402_FACILITATOR_URL`: x402 facilitator base URL, default `https://x402.org/facilitator`.
- `USDC_RECEIVER_ADDRESS`: Base address that receives USDC.
- `ERC8004_AGENT_ID`: token ID assigned by the ERC-8004 IdentityRegistry.

## Failure behavior

- Missing or invalid payment returns `402` with a fresh x402 requirement.
- Facilitator verification failure returns `402`.
- Facilitator settlement failure returns `402` with settlement error details.
- Bad forecast coordinates return `400` after payment verification and before settlement.
- Weather provider failure returns `502` after payment verification and before settlement.
