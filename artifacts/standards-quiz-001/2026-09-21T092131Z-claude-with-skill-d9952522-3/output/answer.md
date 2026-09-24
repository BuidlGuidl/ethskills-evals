# Answers

## 1. Discovery and trust check

Standard: **ERC-8004**, onchain agent identity and reputation. Neither side has to trust a directory run by the other, because the registry is a public contract.

- **Discovery lookup:** the ERC-8004 **IdentityRegistry** (an ERC-721 contract) on Base mainnet, at
  **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`** (the mainnet address, same on every mainnet).
  - Call `tokenURI(7311)` to get the agentURI. It points to the registration file (`ipfs://`, `https://`, or `data:`), which lists the name, `services` (endpoints such as A2A or MCP), `x402Support`, `active`, and `registrations: [{agentId: 7311, agentRegistry: "eip155:8453:0x8004A169…a432"}]`.
  - Call `ownerOf(7311)` to get the controlling address.
  - Check that the endpoint's domain is bound to the agent. Either the agentURI file is served from that same domain, or `https://{endpoint-domain}/.well-known/agent-registration.json` has a `registrations` entry matching `agentRegistry` and agentId 7311. If neither holds, don't trust the endpoint.
- **Standing:** ERC-8004 **ReputationRegistry** on Base, `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`. Call `getSummary(7311, clientAddresses, tag1, tag2)` with `clientAddresses` limited to raters the payer already trusts. Unfiltered totals are easy to game with fake raters (a Sybil attack). The registry rejects feedback from the agent's own owner and operators, so the agent can't rate itself.

## 2. Fully qualified identifier

It is a chain-scoped registry (CAIP-10 style: `eip155:<chainId>:<address>`, where Base chainId = 8453) plus the tokenId:

- `agentRegistry`: **`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**
- `agentId`: **`7311`** (the ERC-721 tokenId the registry assigned when `register()` was called)

A caller on any chain uses this same pair. The chain ID 8453 in the identifier pins it to Base.

## 3. Feedback values

`giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` takes fixed-point numbers: real value = `value / 10^valueDecimals`.

- **Uptime 99.4%:** `value = 994`, `valueDecimals = 1` (994 / 10¹ = 99.4). This must be posted by the paying agent, not by the weather agent's owner or operator.
- **Quality 73/100:** `value = 73`, `valueDecimals = 0` (73 / 10⁰ = 73).

`tag1` and `tag2` label which metric each entry is (for example uptime vs quality, and a 30-day period).

## 4. Amount on the wire and token

USDC has 6 decimals: 0.35 × 10⁶ = **`350000`**. This goes in the x402 payment requirements `amount` in token base units, never `0.35` and never an 18-decimal figure.

Token: native USDC on Base, **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`** (not the bridged USDbC and not mainnet USDC).

## 5. Paying with no ETH

The flow is x402: `GET` returns `402` with `PAYMENT-REQUIRED`, the client signs, retries with `PAYMENT-SIGNATURE`, and gets `200` with `PAYMENT-RESPONSE`.

USDC implements **EIP-3009**. The payer only signs an EIP-712 message offchain (from, to, value = 350000, validAfter, validBefore, nonce), which costs no gas. The resource server or its facilitator (a service that checks and submits payments) sends it onchain and pays the gas. The function that moves the tokens is **`transferWithAuthorization`** on the USDC contract. This is not ERC-4337, and it is not permit followed by `transferFrom`.

## 6. Base Sepolia rehearsal

The testnets use a different pair of addresses, and the mainnet addresses have no code on Base Sepolia. `register()` goes to the testnet IdentityRegistry:

**`0x8004A818BFB912233c491871b3d84c89A494BD9e`**

(The testnet ReputationRegistry is `0x8004B663056A597Dffe9eCcC1965A193B7388713`. The throwaway agent's `agentRegistry` would be `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`, with whatever tokenId the testnet registry assigns.)
