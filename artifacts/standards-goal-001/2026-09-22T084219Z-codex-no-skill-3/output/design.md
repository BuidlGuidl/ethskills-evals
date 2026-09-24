# forecast.example.com Service Design

`forecast.example.com` is a machine-native HTTP service that sells one weather forecast per request for `0.35` USDC on Base. It does not create accounts, issue API keys, keep prepaid balances, or invoice anyone later. A caller discovers the service through a public ERC-8004 identity, pays through x402, receives the forecast, and can then write feedback to the ERC-8004 reputation registry.

## Protocol Stack

- Discovery and trust: ERC-8004 identity and reputation registries. The service mints an agent identity whose `agentURI` resolves to `https://forecast.example.com/.well-known/agent-registration.json` or an equivalent `ipfs://` URI. That registration file advertises the forecast endpoint, the A2A agent card, OpenAPI metadata, x402 support, and the reputation registry.
- Payment: x402 v2 over HTTP. The paid endpoint returns `402 Payment Required` with a base64 `PAYMENT-REQUIRED` header. The caller retries with a base64 `PAYMENT-SIGNATURE` header containing an x402 `PaymentPayload`.
- Settlement: x402 `exact` on Base mainnet, network `eip155:8453`, asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` native USDC, amount `350000` atomic units. The EVM exact scheme uses EIP-3009 `transferWithAuthorization`, so the caller signs a USDC authorization offchain and does not need ETH.
- Reputation: after a paid call, the caller submits ERC-8004 `ReputationRegistry.giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. Other agents can read or index that registry before choosing the service.

## Request Flow

1. A new client agent finds the service by scanning public ERC-8004 `Registered` events or an independent indexer over those events. This is not a catalog controlled by `forecast.example.com`.
2. The client resolves the agent URI and reads the registration file. It sees the forecast endpoint, x402 price, payment asset, Base network, and reputation registry coordinates.
3. The client checks trust signals by reading ERC-8004 reputation feedback for this `agentId`, optionally filtering by reviewers it already trusts.
4. The client calls `POST /v1/forecast` with a JSON location request and no payment.
5. The server validates the forecast request before charging. If the request is valid, it returns `402` with a `PAYMENT-REQUIRED` header advertising one acceptable payment: x402 v2 `exact`, `eip155:8453`, native Base USDC, `350000`, `payTo`.
6. The client signs the EIP-3009 USDC authorization and retries with `PAYMENT-SIGNATURE`.
7. The server locally checks that the signed payload is for the exact resource URL, amount, asset, network, and recipient. It then calls the configured x402 facilitator `/verify`.
8. Only after `/verify` succeeds does the server fetch the weather forecast from the upstream weather provider.
9. If forecast generation succeeds, the server calls facilitator `/settle`. If settlement succeeds, it returns `200` with the forecast body and a `PAYMENT-RESPONSE` header containing the settlement transaction hash. If settlement fails, no forecast is returned.
10. The response includes feedback instructions. The caller can request `POST /v1/feedback` to get concrete ERC-8004 transaction calldata, then submit it through its own wallet, EIP-7702/4337 flow, or a paymaster/bundler so no human approval is needed.

## Onchain Dependencies

- Base mainnet `eip155:8453`: execution layer where USDC settlement happens.
- Native USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals.
- USDC EIP-3009 support: allows `transferWithAuthorization` so the buyer signs a token authorization and a facilitator pays gas for settlement.
- x402 facilitator signer: submits Base transactions for `/settle`. It needs Base gas funding or a paymaster arrangement, but it never receives client custody beyond the signed exact authorization.
- ERC-8004 Identity Registry: holds the agent NFT identity and the `agentURI`.
- ERC-8004 Reputation Registry: stores caller feedback for the agent.
- Agent owner wallet: owns the ERC-8004 identity and sets `agentWallet` to the same recipient wallet used as x402 `payTo`.
- Optional feedback gas sponsor: an EIP-7702 or ERC-4337 paymaster/bundler that lets reviewers submit `giveFeedback` without holding ETH.

## Offchain Dependencies

- DNS and HTTPS for `forecast.example.com`.
- This HTTP server (`server.ts`) serving discovery metadata, the paid forecast endpoint, and feedback preparation.
- x402 facilitator HTTP API with `/verify`, `/settle`, and `/supported`.
- Base RPC used by the facilitator and by agents/indexers that verify settlement and reputation.
- Weather provider API. The implementation defaults to Open-Meteo forecast and geocoding endpoints; production can replace these through `WEATHER_API_URL` and `GEOCODING_API_URL`.
- Durable publication for the ERC-8004 registration file. HTTPS is supported, but publishing the same JSON to IPFS is preferable for content addressing and independent indexing.
- Independent ERC-8004/x402 indexers, subgraphs, or crawlers. They are optional convenience layers; the source of truth remains the public registries and HTTPS/IPFS metadata.

## What Must Be Published

- `https://forecast.example.com/.well-known/agent-registration.json`: ERC-8004 registration file.
- `https://forecast.example.com/.well-known/agent-card.json`: A2A-compatible machine card describing the forecast skill and payment terms.
- `https://forecast.example.com/openapi.json`: OpenAPI description for direct tool use.
- `https://forecast.example.com/discovery/resources`: x402 resource listing for crawlers and independent bazaars.
- Optional IPFS copy of the registration file and feedback evidence files. If an IPFS URI is used as `agentURI`, the HTTPS well-known file should contain the same registration data for domain verification.

## What Must Be Registered

1. Deploy or choose the public ERC-8004 Identity Registry and Reputation Registry on the target chain.
2. Call `IdentityRegistry.register(agentURI)` with the HTTPS or IPFS registration URI.
3. Record the returned `agentId` and configure `ERC8004_AGENT_ID`.
4. Call `setAgentWallet(agentId, payTo, deadline, signature)` so the onchain identity points to the wallet receiving x402 USDC.
5. If the primary `agentURI` is IPFS, keep `/.well-known/agent-registration.json` on the service domain with a matching `registrations` entry so agents can verify domain control.
6. Optionally submit the x402 resource listing to independent bazaars/indexers. This is not required for discovery, because ERC-8004 event scanning is sufficient.

## Server Configuration

- `PUBLIC_BASE_URL`: public origin, default `https://forecast.example.com`.
- `PORT`: HTTP port, default `3000`.
- `PAY_TO`: Base wallet that receives USDC.
- `FACILITATOR_URL`: x402 facilitator origin, default `http://127.0.0.1:4022`.
- `FACILITATOR_API_KEY`: optional bearer token for the facilitator.
- `ERC8004_AGENT_ID`: registered agent token id.
- `ERC8004_IDENTITY_REGISTRY`: Identity Registry contract address.
- `ERC8004_REPUTATION_REGISTRY`: Reputation Registry contract address.
- `FEEDBACK_PAYMASTER_URL`: paymaster/bundler endpoint advertised for gasless feedback.
- `WEATHER_API_URL` and `GEOCODING_API_URL`: upstream forecast and geocoding providers.

## Trust Boundaries

The client does not need to trust local docs or a private marketplace. It can independently verify the onchain identity, compare the domain-published registration file to the registered `agentURI`, inspect historical feedback in the public reputation registry, and verify each payment transaction on Base. The server trusts the facilitator for payment validation and settlement broadcasting; to reduce that trust, run a self-hosted facilitator and expose its `/supported` metadata. The weather provider is an offchain dependency, so high-assurance buyers should rely on reputation, independent validation, or redundant forecast providers for quality judgments.

## References

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- x402 v2 specification: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- x402 HTTP transport: https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
- Circle native USDC on Base: https://www.circle.com/blog/usdc-now-available-natively-on-base
