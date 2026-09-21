# Answers

## 1. Discovery and trust check

The shared registry is **ERC-8004**, an onchain standard for agent identity and reputation. Neither agent has to run it or trust the other's directory, because it is a neutral contract deployed at the same address on every mainnet.

- **Discovery:** the lookup goes to the ERC-8004 **IdentityRegistry**, an ERC-721 contract. On Base (chain 8453) it is at
  **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**.
  The payer calls `tokenURI(7311)` (the `agentURI`) and `ownerOf(7311)`. The URI resolves to the registration file, which lists `name`, `services` (endpoints), `x402Support`, `active`, and `registrations: [{agentId: 7311, agentRegistry: "eip155:8453:0x8004A169…a432"}]`.
- **Endpoint binding:** if the endpoint domain differs from the domain hosting the agentURI, the payer fetches `https://{endpoint-domain}/.well-known/agent-registration.json`. It then checks that its `registrations` entry matches agentId 7311 and the registry above. This proves the endpoint belongs to the onchain agent.
- **Standing:** the payer calls `getSummary(7311, clientAddresses, tag1, tag2)` on the ERC-8004 **ReputationRegistry**, Base address `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`. It passes a list of client addresses it trusts, because unfiltered totals can be padded with fake reviewers (Sybil accounts). The registry rejects feedback from the agent's own owner and operators, so the agent cannot rate itself.

## 2. Fully-qualified identifier

The identifier is the registry, scoped to its chain in the `eip155:<chainId>:<address>` format, plus the tokenId the registry assigned:

- `agentRegistry` = **`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**
- `agentId` = **`7311`**

The chain id 8453 (Base) is part of the identifier. So a caller on any chain refers to the same agent, even though the same registry address also exists on other chains.

## 3. Feedback values

Feedback goes through `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. Scores are fixed point: the real score = `value / 10^valueDecimals`.

- **Uptime 99.4%:** 99.4 = 994 / 10^1, so **`value = 994`, `valueDecimals = 1`**. The equivalent `9940` with `valueDecimals = 2` would also decode to 99.4.
- **Quality 73/100:** 73 = 73 / 10^0, so **`value = 73`, `valueDecimals = 0`**.

Both are sent with `agentId = 7311`, from the paying agent's own address. Tags such as `tag1 = "uptime"` and `tag1 = "quality"` keep the two scores apart.

## 4. Wire amount and token

- USDC has 6 decimals, so 0.35 × 10^6 = **`350000`**. The amount goes on the wire in base units, not as `0.35` and not as an 18-decimal figure.
- Token: native USDC on Base, **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**. Mainnet USDC and bridged USDbC are the wrong contracts for this.
- Protocol: **x402**, the HTTP 402 pay-per-call standard. The request flow is:
  1. The payer sends `GET` and receives `402` with a `PAYMENT-REQUIRED` header (amount 350000, asset above, network Base).
  2. The payer signs and retries with a `PAYMENT-SIGNATURE` header.
  3. The server verifies and settles the payment, then returns `200` with a `PAYMENT-RESPONSE` header.

## 5. Paying without ETH

USDC implements **EIP-3009**, a standard for gasless token transfers. The paying agent signs a transfer authorization offchain (EIP-712 typed data). The signature covers:

- `from`, `to`, `value = 350000`
- `validAfter`, `validBefore`
- a one-time `nonce`

Signing costs no gas. The x402 facilitator (or the resource server) submits the signature onchain and pays the gas in ETH. The function that moves the tokens is **`transferWithAuthorization`** on the USDC contract. This does not rely on ERC-4337 bundlers or on permit followed by `transferFrom`.

## 6. Base Sepolia registration address

Testnets use a different address pair from mainnets. The mainnet addresses have no code on Base Sepolia. So `register()` goes to the testnet **IdentityRegistry**:

**`0x8004A818BFB912233c491871b3d84c89A494BD9e`**

The testnet ReputationRegistry, for the rating part of the rehearsal, is `0x8004B663056A597Dffe9eCcC1965A193B7388713`. The throwaway agent's id is the tokenId returned by that `register()` call. It will not be 7311.
