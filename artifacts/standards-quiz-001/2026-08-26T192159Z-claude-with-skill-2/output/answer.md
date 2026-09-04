# Weather agent on Base — discovery, trust, payment, rating

## 1. Discovery and standing check

Neither side needs a shared directory because the directory is a chain. The weather
agent's identity is an ERC-721 token minted by the **ERC-8004 IdentityRegistry**, so
"look up agent 7311" is just an onchain token read against the registry deployed on
Base at:

```
0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
```

The paying agent calls `tokenURI(7311)` there to get the `agentURI`, resolves that
(`ipfs://`, `https://`, or an inline base64 `data:` URI) to the registration file, and
reads `name`, `description`, the `services` array (the A2A card / MCP endpoint it will
actually call), `x402Support`, and `active`.

One check that is easy to skip: the endpoints advertised in `services` must be bound to
the onchain identity. If the domain serving those endpoints is not the same domain
serving the agentURI file, the paying agent fetches
`https://{endpoint-domain}/.well-known/agent-registration.json` and requires a
`registrations` entry whose `agentRegistry` and `agentId` match agent 7311 on Base. If
the agentURI is served from that same domain, control is already proven there and the
extra fetch is unnecessary — but the caller should know which of the two it is relying
on. An A2A agent card is not this document and does not prove the binding.

Standing comes from the **ReputationRegistry**, deployed on Base at:

```
0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
```

The paying agent calls `getSummary(7311, clientAddresses, tag1, tag2)` — passing a list
of client addresses it independently has reason to trust, and filtering by tag for the
dimension it cares about (uptime, quality). Feedback is client-attested: only addresses
that were counterparties can post it, and the registry rejects submissions from the
agent's own owner and operators, so the weather agent cannot rate itself. Reading the
unfiltered aggregate instead of a trusted client set is the Sybil trap — anyone can mint
identities and spray positive feedback, so a raw average means nothing.

Note that the identity and reputation registries are the two live pieces. The
Validation Registry (re-execution, zkML, TEE attestation) is defined by the spec but is
not part of that deployed pair — don't design the trust decision around it without
verifying it exists on Base first.

## 2. Fully-qualified identifier

The agentId alone is ambiguous — token 7311 exists on many chains. Callers address the
agent with the chain-scoped registry plus the token id, which is identical no matter
what chain the caller itself runs on:

```
agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId:       7311
```

`8453` is Base's chain id. The `7311` is the ERC-721 tokenId the registry assigned at
`register()` — not a name, slug, UUID, or hash anyone chose.

## 3. Recording the two scores

Both are posted with `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint,
feedbackURI, feedbackHash)` by the paying agent (the client that actually paid), as two
separate entries with different tags. Values are fixed-point integers: the stored
`value` is the score scaled by `10^valueDecimals`.

**99.4% uptime** — two decimal places of precision, so 99.4 × 10² = 9940:

```
value = 9940
valueDecimals = 2
```

**73 out of 100 quality** — a whole number, no scaling, 73 × 10⁰ = 73:

```
value = 73
valueDecimals = 0
```

Writing `value = 99` and `value = 7300` are the two natural mistakes; the decimals field
is what disambiguates them, and it must match how the value was scaled.

## 4. Wire amount and token

x402 amounts travel in **token base units**, never as a decimal string. USDC has 6
decimals, so:

```
0.35 × 10^6 = 350000
```

```
amount: "350000"
asset:  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   (native USDC on Base)
```

`0.35` and an 18-decimal figure like `350000000000000000` are both wrong. So is pointing
at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (that is Ethereum mainnet USDC) or
`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` (bridged USDbC) — neither is the contract a
Base x402 route settles in.

The flow itself: the paying agent `GET`s the forecast endpoint, gets back `402` with a
`PAYMENT-REQUIRED` header naming the 350000 / USDC-on-Base terms, signs, and retries the
same request with a `PAYMENT-SIGNATURE` header. The server verifies and settles through
a facilitator and returns `200` plus `PAYMENT-RESPONSE`. No account, no API key, no
prior relationship — which is what makes this work for two agents that have never met.

## 5. Paying with zero ETH

USDC implements **EIP-3009**. Instead of sending a transaction, the paying agent signs a
`transferWithAuthorization` message **offchain** — an EIP-712 typed-data signature over
(from, to, value 350000, validAfter, validBefore, nonce). Signing costs no gas because
nothing is broadcast; the signature is what rides in the `PAYMENT-SIGNATURE` header.

The resource server (or the facilitator acting for it) submits that authorization
onchain and pays the ETH gas itself. The token contract recovers the signer from the
signature, checks the nonce and validity window, and moves the USDC from the payer's
balance. So the payer's ETH balance is never touched, and it needs no smart account, no
deployment, and no setup transaction.

The function that ultimately moves the tokens:

```
transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
```

This is a native capability of the USDC contract — not an ERC-4337 bundler and
EntryPoint, not a generic "relayer", and not ERC-2612 `permit` followed by
`transferFrom` (which would need a second transaction and a spender allowance).

## 6. Base Sepolia rehearsal

The registries sit at the same pair of addresses across 40-plus mainnets, but **the
testnet deployments are a different pair** — the mainnet address has no code on Base
Sepolia, so a `register()` call sent there fails or, worse, hits an unrelated address.
The throwaway agent's registration goes to the testnet IdentityRegistry:

```
0x8004A818BFB912233c491871b3d84c89A494BD9e
```

For completeness, the matching testnet ReputationRegistry, for rehearsing the
`giveFeedback` half of the flow, is `0x8004B663056A597Dffe9eCcC1965A193B7388713`.

## Implementation note

Build the client and server against the installed type definitions, not from memory. The
maintained TypeScript packages are the scoped ones — `@x402/core`, `@x402/evm`,
`@x402/fetch`, `@x402/express`, with `@coinbase/x402` for facilitator config; the
unscoped `x402` / `x402-fetch` / `x402-express` names are frozen at 1.2.0. On the 2.x
line the Express middleware takes routes plus a resource server (a single-argument
`paymentMiddleware(config)` is the old v1 shape), and the fetch wrapper takes an x402
client rather than a bare account. `x402Fetch` and `createWallet` are not real exports.

The ERC-8004 contracts are live and in production, but the EIP is still Draft and the
registries are ERC-1967 proxies — if a signature behaves unexpectedly, read the
implementation slot and check the deployed ABI rather than trusting a cached one.
