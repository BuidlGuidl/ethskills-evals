# Agent-to-agent weather purchase: answers

## 1. Discovery + trust check

Infrastructure: **ERC-8004** (onchain agent identity/reputation standard). No shared directory is needed because the registry is a public contract that neither party runs.

- **Discover.** Look up the **IdentityRegistry** on Base (chain 8453): **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**.
  - Each agent is an ERC-721 token. agentId 7311 = tokenId 7311.
  - `tokenURI(7311)` (the agentURI) points to a registration JSON. That JSON lists the services (A2A/MCP endpoints), `x402Support: true` and `active: true`.
  - To find weather agents without already knowing the id, read the `Registered` events, or query an indexer over them such as a Graph subgraph.
  - Check the domain: `https://<endpoint-domain>/.well-known/agent-registration.json` must contain `agentId: 7311`, `agentRegistry: eip155:8453:0x8004A169…a432`, and the owner. That owner must equal `ownerOf(7311)`. This proves whoever controls the endpoint also controls the identity.
- **Check standing.** Call the **ReputationRegistry** on Base, `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`:
  `getSummary(7311, trustedClients, "uptime", "30days")` and `getSummary(7311, trustedClients, "quality", "30days")` → `(count, value, decimals)`.
  - Score = `value / 10^decimals`. Compare it to a threshold, e.g. uptime > 99, quality > 85.
  - `trustedClients` filters feedback down to reviewers you trust. This guards against Sybil attacks (one party posting fake reviews from many addresses).
  - The ValidationRegistry can add independent checks: stake-secured, zkML or TEE validators giving a 0–100 score.

## 2. Fully-qualified identifier

`agentRegistry` = `eip155:{chainId}:{IdentityRegistry}`, with chainId = 8453 (Base, where the agent was registered). `agentId` = 7311.

**`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`**

(agentRegistry `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, agentId `7311`)

The chainId is always the chain where the agent was registered (8453), not the caller's chain. So a caller on Arbitrum, mainnet, or anywhere else uses the same string.

## 3. Feedback encoding

Feedback is stored as a signed fixed-point number: `int128 value` + `uint8 valueDecimals`. The real score = value / 10^valueDecimals.

| Metric | Derivation | value | valueDecimals | tag1 | tag2 |
|---|---|---|---|---|---|
| Uptime 99.4% | 99.4 = 994 / 10^1 | **994** | **1** | `"uptime"` | `"30days"` |
| Quality 73/100 | 73 = 73 / 10^0 | **73** | **0** | `"quality"` | `"30days"` |

Calls:
```solidity
reputationRegistry.giveFeedback(7311, 994, 1, "uptime",  "30days", endpoint, feedbackURI, feedbackHash);
reputationRegistry.giveFeedback(7311, 73,  0, "quality", "30days", endpoint, feedbackURI, feedbackHash);
```
(For uptime, `9940, 2` is numerically equal: 9940/100 = 99.40. `994, 1` is the minimal exact form.)

## 4. Wire amount + token

USDC has 6 decimals, so $0.35 × 10^6 = **`"350000"`**. The amount is sent in base units as a string, e.g. in the x402 payment requirements/payload:

```json
{ "scheme": "exact", "network": "eip155:8453",
  "amount": "350000",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }
```

Token: **USDC on Base, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**.

## 5. Paying with no ETH

**x402** (payments over HTTP status 402) + **EIP-3009** (signed transfer authorizations):

1. The agent does `GET /forecast` and gets back `402 Payment Required` with the requirements above.
2. The agent signs an EIP-712 typed-data message **offchain**. Signing costs no gas. The message is a `TransferWithAuthorization` with `from` = payer, `to` = weather agent, `value` = 350000, `validAfter`, `validBefore` and a random 32-byte `nonce`.
3. It retries the request with that signature in the `PAYMENT-SIGNATURE` header.
4. The resource server or its **facilitator** checks the signature, balance and deadline, then submits the onchain transaction and **pays the gas itself** (≈$0.001 on Base).

The function that moves the tokens is **`transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`** on the USDC contract. The random nonce makes replays impossible, and the `validBefore` deadline limits how long the authorization stays usable. The server returns `200 OK` plus a `PAYMENT-RESPONSE` header containing the settlement tx hash, which the payer can later cite as proof of payment in its feedback.

## 6. Base Sepolia registration target

The ERC-8004 testnet deployment uses a different address from mainnet. The IdentityRegistry on Base Sepolia (chainId 84532) is:

**`0x8004A818BFB912233c491871b3d84c89A494BD9e`**

`register(agentURI, metadata)` is sent there. The test agent's identifier becomes `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:<agentId>`. For the rest of the rehearsal, feedback goes to the testnet ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`, and payment uses Base Sepolia USDC, not the mainnet contracts.
