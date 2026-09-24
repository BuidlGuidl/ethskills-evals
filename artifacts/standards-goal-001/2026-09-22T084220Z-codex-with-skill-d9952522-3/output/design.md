# forecast.example.com service design

## Goal

`forecast.example.com` is an autonomous-agent weather forecast API. The paid
resource is `GET /forecast`, priced at `0.35` USDC per call on Base. USDC has 6
decimals, so the x402 amount is `350000` atomic units.

The service uses deployed public standards rather than private accounts, API
keys, invoices, balances, or a provider-owned catalog:

- ERC-8004 for agent identity, endpoint discovery, and caller-attested
  reputation.
- x402 v2 for HTTP 402 pay-per-call billing.
- EIP-3009, via native USDC on Base, so a caller with USDC but no ETH can pay.
- EIP-7702-compatible gas sponsorship for optional feedback submission by
  callers that also have no ETH for the ERC-8004 feedback transaction.

## Architecture

The service process in `server.ts` exposes:

- `GET /forecast?lat={number}&lon={number}&days={1..7}`: paid forecast JSON.
- `GET /.well-known/agent-registration.json`: ERC-8004 registration metadata
  binding `forecast.example.com` to the onchain agent id.
- `GET /.well-known/agent-card.json`: A2A-style machine-readable capability
  card pointing agents to the paid endpoint.
- `GET /openapi.json`: machine-readable endpoint schema.
- `GET /health`: unauthenticated liveness check.

The paid route flow is:

1. Caller requests `/forecast` without payment.
2. Server validates query parameters before charging. Invalid requests return
   `400` and never ask for payment.
3. Server returns `402 Payment Required` with a base64 JSON `PAYMENT-REQUIRED`
   header containing x402 v2 `PaymentRequired`.
4. Caller chooses the Base USDC `exact` option and signs an EIP-3009
   `transferWithAuthorization` payload. The caller does not need ETH.
5. Caller retries the same URL with `PAYMENT-SIGNATURE` containing the base64
   JSON x402 `PaymentPayload`.
6. Server posts `{ x402Version, paymentPayload, paymentRequirements }` to the
   configured facilitator `/verify`.
7. If verification is valid, server fetches forecast data from the weather
   provider.
8. Server posts the same envelope to facilitator `/settle`. The facilitator
   submits the Base USDC EIP-3009 transfer and pays gas.
9. Server returns `200` forecast JSON with a base64 JSON `PAYMENT-RESPONSE`
   header containing the settlement result.
10. Response body includes ERC-8004 feedback instructions so the caller can
    submit a rating without a human in the loop.

The service intentionally settles only per request. It has no customer account
database, no API keys, no subscriptions, no invoices, and no prepaid balances
custodied by the service.

## Onchain dependencies

Base mainnet:

- Chain: `eip155:8453`.
- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Payment mechanism: USDC EIP-3009 `transferWithAuthorization`.

ERC-8004 registries on mainnets:

- IdentityRegistry:
  `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- ReputationRegistry:
  `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`.

The service owner registers the agent with the IdentityRegistry. The assigned
ERC-721 token id is the `agentId`; the service must not invent one. The onchain
agent reference for this deployment is:

```text
agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId:       <token id returned by register()>
```

After a paid call, the caller can rate the service by calling
`ReputationRegistry.giveFeedback(agentId, value, valueDecimals, tag1, tag2,
endpoint, feedbackURI, feedbackHash)`. The server suggests tags such as
`forecast.quality` and `forecast.v1`, but the caller chooses the value and
evidence URI/hash. Clients should read reputation through
`getSummary(agentId, clientAddresses, tag1, tag2)` using client addresses they
trust; unfiltered reputation is Sybil-prone.

If the caller has no ETH but wants to post feedback, a gas sponsor can submit an
EIP-7702 smart-EOA operation authorized by the caller. The registry call is made
from the caller's address, so ERC-8004 still sees the actual client as
`msg.sender`; the service must not post feedback for itself.

## Offchain dependencies

- DNS and TLS for `https://forecast.example.com`.
- This HTTP service, with stable canonical URL generation from `BASE_URL`.
- x402 facilitator with `/supported`, `/verify`, and `/settle` support for
  `{ x402Version: 2, scheme: "exact", network: "eip155:8453" }`.
- Base RPC access used by the facilitator for simulation and transaction
  submission.
- Open-Meteo forecast API by default. It has no API key dependency; production
  can replace it by setting `WEATHER_PROVIDER_URL` if a different machine API is
  preferred.
- Durable publication of the ERC-8004 `agentURI`, preferably pinned IPFS plus an
  HTTPS mirror. The server also publishes the same registration document at the
  well-known URL for endpoint-domain binding.

## What must be published

Publish these machine-readable documents:

1. ERC-8004 registration JSON as the token URI, for example
   `ipfs://<cid>/agent-registration.json`. It must include:
   - `type:
     "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"`.
   - service name, description, image/icon URL.
   - `services` entries for the A2A card and the paid x402 endpoint.
   - `x402Support` describing exact/Base/native USDC/amount `350000`.
   - `registrations` containing the assigned `agentId` and Base
     IdentityRegistry CAIP-10-style reference.
   - supported trust/reputation registry information.
2. `https://forecast.example.com/.well-known/agent-registration.json`.
   This binds the endpoint domain to the same ERC-8004 registration. If the
   `agentURI` itself is served from `forecast.example.com`, this is still useful
   for clients that start from the endpoint URL.
3. `https://forecast.example.com/.well-known/agent-card.json`, pointing to
   `/forecast`, the x402 payment details, and the ERC-8004 identity.
4. `https://forecast.example.com/openapi.json`, so agents can construct valid
   paid calls before spending money.

Optional discovery mirrors such as x402 bazaars can index these resources, but
the trust root is ERC-8004 plus the endpoint-domain binding above, not a catalog
owned by the service.

## What must be registered before discovery works

1. Choose a Base recipient wallet for revenue and configure it as `PAY_TO`.
2. Publish the registration JSON to a durable URI.
3. Call `IdentityRegistry.register(agentURI, ...)` on Base mainnet at
   `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
4. Record the assigned token id as `ERC8004_AGENT_ID` in the service
   environment and republish the registration JSON with the concrete
   `registrations` entry.
5. Serve `/.well-known/agent-registration.json` from
   `forecast.example.com` with the same `agentId` and `agentRegistry`.
6. Confirm the configured facilitator's `/supported` response includes x402 v2
   `exact` on `eip155:8453` before accepting paid traffic.

Once those are live, an unknown client agent can discover the service through
ERC-8004, verify that the endpoint domain is bound to the onchain identity,
inspect trusted third-party feedback in the ReputationRegistry, read the
machine endpoint schema, pay exactly one call through x402, and leave its own
rating afterward.
