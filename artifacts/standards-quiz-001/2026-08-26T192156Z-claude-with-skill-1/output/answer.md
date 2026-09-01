# Agent-to-agent weather API: discovery, trust, payment, rating

## 1. Discovery and standing check

No shared directory is needed because identity and reputation both live onchain, in the
ERC-8004 registry pair.

**Discovery.** The weather agent registered itself by calling `register()` on the
**IdentityRegistry** — an ERC-721 contract — on Base:

```
0x8004A169FB4a3325136EB29fA0ceB6D2e539a432   (IdentityRegistry, Base / all mainnets)
```

That mint gave it tokenId `7311`. The paying agent calls `tokenURI(7311)` on that contract to
get the `agentURI`, and resolves it (`ipfs://`, `https://`, or a base64 `data:` URI) to the
registration file. The file carries `name`, `description`, a `services` array (the A2A card / MCP
endpoint to actually call), `x402Support`, `active`, and a `registrations` array of
`{agentId, agentRegistry}` pairs. Nothing has to be trusted in advance: the ERC-721 is the
directory.

**Endpoint binding — the step to not skip.** The registration file advertises a service endpoint,
and the paying agent must confirm the domain serving that endpoint is the one the onchain agent
controls. Two cases:

- the agentURI file is served from the same domain as the endpoints → control is already proven
  there, and that is what the caller relies on;
- otherwise, that domain must serve `https://{endpoint-domain}/.well-known/agent-registration.json`
  containing a `registrations` entry whose `agentRegistry` and `agentId` match the onchain agent
  (`0x8004A169…` / `7311`). An A2A `agent-card.json` is a different document and does **not**
  establish this binding.

**Standing.** Reputation is client-attested and lives in the **ReputationRegistry**:

```
0x8004BAa17C55a88189AE136b182e5fdA19dE9b63   (ReputationRegistry, Base / all mainnets)
```

The paying agent calls `getSummary(agentId, clientAddresses, tag1, tag2)` with
`agentId = 7311`, passing a `clientAddresses` list of clients it independently has reason to
trust, and optionally filtering by tag. Filtering matters: an unfiltered aggregate over every
address that ever left feedback is Sybil bait, since anyone can post. The registry does block
the one obvious self-dealing case — it rejects feedback from the agent's own owner and its
operators — so an agent cannot rate itself.

## 2. Fully-qualified identifier

Chain-scoped, so it means the same thing to a caller on any chain:

```
agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId:       7311
```

`eip155:8453` is the CAIP-2 chain id for Base mainnet, followed by the IdentityRegistry address
and the tokenId the registry assigned at `register()`. A caller on Ethereum, Arbitrum or anywhere
else uses that exact pair — the registry address is identical across mainnets, so the
`eip155:8453` prefix is what disambiguates *which* deployment holds token 7311.

## 3. Feedback values after the 30-day engagement

Both go in via `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI,
feedbackHash)` from the paying agent's own address. Values are fixed point: the stored integer is
the score scaled by `10^valueDecimals`.

**Uptime, 99.4%** — two decimal places of precision, so 99.4 × 10² = 9940:

```
value = 9940, valueDecimals = 2
```

**Quality, 73 out of 100** — an integer score, no scaling, 73 × 10⁰ = 73:

```
value = 73, valueDecimals = 0
```

Two separate feedback entries, distinguished by their tags — not one blended number.

## 4. Amount on the wire

x402 amounts are expressed in **token base units**, never as a decimal string. USDC has 6
decimals, so 0.35 × 10⁶:

```
amount = "350000"
```

Paid in native USDC on Base:

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

Not `0.35`, and not an 18-decimal figure like `350000000000000000`. Two lookalikes to avoid on a
Base route: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` is USDC on Ethereum mainnet, and
`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` is the bridged USDbC on Base.

## 5. Paying with zero ETH

The flow is x402: the paying agent `GET`s the forecast endpoint, gets back `402` with a
`PAYMENT-REQUIRED` header stating `350000` of `0x8335…2913` on Base, signs, and retries with a
`PAYMENT-SIGNATURE` header; the server verifies and settles and returns `200` plus
`PAYMENT-RESPONSE`.

What makes it work without ETH is that **USDC implements EIP-3009**. The paying agent signs a
`transferWithAuthorization` authorization **offchain** — a typed-data signature over
(from, to, value, validAfter, validBefore, nonce). Signing costs nothing and needs no gas. The
authorization is carried in the HTTP header, and the resource server — or, more usually, the
facilitator it delegates verify/settle to (Coinbase runs a public one; anyone can run their own) —
submits it onchain and pays the ETH gas itself, recovering its cost from the payment. This also
means the resource server never has to run a node or hold gas of its own if it uses a facilitator.

The function that ultimately moves the tokens:

```
transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
```

on the USDC contract. Not an ERC-4337 bundler, not an unnamed "relayer", and not ERC-2612
`permit` followed by `transferFrom` — the gasless leg here is EIP-3009.

## 6. Base Sepolia rehearsal

The testnet registries are a **different pair** of addresses — the mainnet ones have no code on
Base Sepolia, so a `register()` sent to `0x8004A169…` there reverts. The throwaway agent's
registration call goes to:

```
0x8004A818BFB912233c491871b3d84c89A494BD9e   (IdentityRegistry, testnets incl. Base Sepolia)
```

and its rehearsal feedback would go to the testnet ReputationRegistry at
`0x8004B663056A597Dffe9eCcC1965A193B7388713`. The rest of the flow is unchanged, other than the
chain-scoped identifier becoming `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e` and
the USDC contract being the Base Sepolia test token rather than `0x8335…2913`.

## One caveat worth stating

The registries are live and in production use, but the EIP itself is still Draft, and both
contracts are ERC-1967 proxies — if a function signature ever surprises you, read the
implementation slot rather than assuming the ABI is frozen.
