# forecast.example.com service design

`forecast.example.com` is an autonomous-agent weather API. A caller discovers the agent through a public ERC-8004 identity registration, evaluates public ERC-8004 reputation feedback, calls `GET /forecast`, receives an x402 `402 Payment Required` challenge, signs an EIP-3009 USDC authorization, and retries the same request with `X-PAYMENT`. The server verifies and settles the payment through an x402 facilitator, returns the forecast, and includes the ERC-8004 reputation target so the caller can leave feedback.

## Goals mapped to mechanisms

- Discoverable without our catalog: register the service in the ERC-8004 Identity Registry with an `agentURI` that resolves to `https://forecast.example.com/.well-known/agent-registration.json` or an IPFS copy of the same JSON.
- Machine trust before first contact: the registration file advertises the forecast endpoint, x402 payment terms, the Base wallet that receives USDC, and the ERC-8004 Reputation Registry address where prior callers leave ratings.
- Per-call billing only: every paid call requires a fresh x402 payment payload; there are no accounts, API keys, subscriptions, invoices, or prepaid balances.
- Caller has USDC but no ETH: x402 `exact` on Base USDC uses EIP-3009 `transferWithAuthorization`; the caller signs, and the facilitator pays Base gas to submit the transfer.
- Rating after a call: the response points to `POST /ratings`, which returns machine-readable transaction data for `ReputationRegistry.giveFeedback(...)` on ERC-8004. The feedback file can include the x402 settlement transaction hash as proof of payment.
- No human step: registration, discovery, payment, forecast retrieval, and feedback transaction construction are all machine-readable.

## HTTP surface

- `GET /.well-known/agent-registration.json`: ERC-8004 registration JSON. This is also used for endpoint-domain verification.
- `GET /.well-known/agent-card.json`: A2A-style capability card for agent runtimes.
- `GET /openapi.json`: OpenAPI 3.1 description for tool planners.
- `GET /discovery/resources`: x402 resource listing for clients that already know the domain.
- `GET /x402/payment-requirements`: direct payment terms for the forecast endpoint.
- `GET /forecast?latitude={lat}&longitude={lon}`: paid resource. Without `X-PAYMENT`, returns HTTP 402 and x402 requirements. With a valid payment, settles and returns the forecast.
- `POST /ratings`: validates a 0-100 score and returns the ERC-8004 reputation registry call ABI/arguments.

## Payment architecture

The price is `350000` atomic USDC, because USDC has 6 decimals and the call costs `$0.35`.

The x402 payment requirement is:

- scheme: `exact`
- network: `base`
- chain id: `8453` (`eip155:8453`)
- asset: Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- payTo: `PAY_TO`
- maxAmountRequired: `350000`
- extra: `assetTransferMethod=eip3009`, `name=USD Coin`, `version=2`

The server does not take custody. It sends the client payment payload and payment requirements to an x402 facilitator:

1. `POST {X402_FACILITATOR_URL}/verify`
2. `POST {X402_FACILITATOR_URL}/settle`

The facilitator checks the signature, amount, token, recipient, validity window, balance, and transaction simulation, then broadcasts `USDC.transferWithAuthorization(...)` on Base. The caller only signs; it does not need ETH.

## Reputation architecture

The service is registered as an ERC-8004 agent. Callers rate it by calling:

```text
ReputationRegistry.giveFeedback(
  agentId,
  value,          // 0-100 score
  valueDecimals, // default 0
  "starred",
  "forecast",
  "https://forecast.example.com/forecast",
  feedbackURI,
  feedbackHash
)
```

`feedbackURI` should be an IPFS URI when possible. The optional feedback JSON should include the x402 settlement transaction hash, payer address, forecast endpoint, timestamp, and any machine evaluation notes. Agents choosing providers read ERC-8004 feedback directly or through independent indexers; they do not need to trust a rating list operated by `forecast.example.com`.

If the rating agent has no ETH, it can submit the transaction through a Base account-abstraction paymaster or bundler that accepts USDC/sponsorship. `POST /ratings` returns the target chain, registry address, ABI, and arguments so this can be automated.

## Onchain dependencies

- Base mainnet, chain id `8453`.
- Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, including EIP-3009 `transferWithAuthorization`.
- An x402-compatible facilitator wallet/service able to verify and settle Base USDC `exact` payments.
- ERC-8004 Identity Registry singleton for the chain where the agent is registered.
- ERC-8004 Reputation Registry initialized for that Identity Registry.
- Optional Base paymaster/bundler for gas-sponsored feedback transactions.

## Offchain dependencies

- DNS and HTTPS for `forecast.example.com`.
- This HTTP service, running `server.ts`.
- `X402_FACILITATOR_URL`, a facilitator HTTP API exposing `/verify` and `/settle`.
- Weather data provider. The implementation defaults to Open-Meteo at `https://api.open-meteo.com/v1/forecast`.
- IPFS or another content-addressed store for durable copies of the agent registration and detailed feedback files.
- Optional independent ERC-8004/x402 indexers so clients can query reputation and payment history efficiently.

## What to publish

Publish these over HTTPS at `forecast.example.com`:

- `/.well-known/agent-registration.json`
- `/.well-known/agent-card.json`
- `/openapi.json`
- `/discovery/resources`

Also publish an immutable IPFS copy of the ERC-8004 registration JSON and use that IPFS URI as `agentURI` if maximum durability is preferred. If `agentURI` is IPFS, keep the HTTPS well-known file live so clients can verify that the domain is controlled by the same registered agent.

## What to register before discovery works

1. Choose the owner wallet and payment wallet.
2. Register the agent in the ERC-8004 Identity Registry with `register(agentURI)`.
3. Set or verify the ERC-8004 `agentWallet` metadata to the same address used as `PAY_TO`, using the registry wallet-control flow.
4. Configure the service with:
   - `PAY_TO`
   - `X402_FACILITATOR_URL`
   - `ERC8004_AGENT_REGISTRY`
   - `ERC8004_AGENT_ID`
   - `ERC8004_REPUTATION_REGISTRY`
   - `PUBLIC_BASE_URL=https://forecast.example.com`
5. Ensure the registration file's `registrations[0].agentRegistry` and `agentId` match the onchain registration.

## Sources

- x402 specification: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v1.md
- x402 exact EVM scheme: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md
- ERC-8004 draft: https://eips.ethereum.org/EIPS/eip-8004
