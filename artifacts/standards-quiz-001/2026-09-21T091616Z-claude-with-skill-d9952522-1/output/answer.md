# Paying an unknown weather agent on Base

## 1. Discovery and standing check

Use **ERC-8004**, the onchain agent identity and reputation standard. It has two registries, and both are deployed at the same addresses on every mainnet, so neither agent has to run a directory the other trusts.

- **Discovery.** Look the agent up in the ERC-8004 **IdentityRegistry**, an ERC-721 contract, on Base at
  **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**.
  - Call `tokenURI(7311)` (the agentURI) to get the agent's registration file. The file declares `type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"` and includes `name`, `description`, the `services` array (endpoints), `x402Support`, `active`, and `registrations: [{agentId: 7311, agentRegistry: "eip155:8453:0x8004A169…a432"}]`.
  - Call `ownerOf(7311)` to see who controls the agent.
  - Check that the endpoint domain is bound to this agent. If the endpoints are on a different domain from the agentURI file, `https://{endpoint-domain}/.well-known/agent-registration.json` must list the same `agentRegistry` and `agentId` (7311). If the same domain serves both, that already proves control.
- **Standing.** Read the ERC-8004 **ReputationRegistry** on Base at `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`:
  - Call `getSummary(7311, clientAddresses, tag1, tag2)`.
  - Filter `clientAddresses` to raters the payer trusts. Unfiltered totals are easy to game with fake raters (a Sybil attack).
  - Feedback always comes from clients. The registry rejects ratings from the agent's owner and operators, so the agent can't rate itself.

## 2. Fully-qualified identifier

The identifier is the registry's chain-scoped address plus the tokenId the registry assigned. Base's chain id is 8453 (CAIP-2 format `eip155:8453`).

- `agentRegistry` = **`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**
- `agentId` = **`7311`**

A caller on any chain uses this same pair, because the chain prefix pins the registry to Base.

## 3. Feedback values

Scores are stored as fixed point: `value / 10^valueDecimals`. They are posted with `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`, where `agentId = 7311`.

- **Uptime 99.4%:** 99.4 has one decimal place, so 99.4 × 10¹ = 994. Store as **`value = 994`, `valueDecimals = 1`**. For example, use `tag1 = "uptime"`.
  - `value = 9940`, `valueDecimals = 2` is the same number, but the 1-decimal form is the minimal exact encoding.
- **Quality 73/100:** 73 is a whole number, so 73 × 10⁰ = 73. Store as **`value = 73`, `valueDecimals = 0`**. For example, use `tag1 = "quality"`.

## 4. Amount on the wire and token

USDC has 6 decimals: $0.35 × 10⁶ = 350,000.

- `amount` = **`"350000"`**, in token base units (never `0.35`, and never an 18-decimal figure).
- The token is native USDC on Base, **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**, network `eip155:8453`.
  - Not mainnet USDC (`0xA0b8…eB48`).
  - Not bridged USDbC (`0xd9aA…b6CA`).

## 5. Paying with no ETH

The API charges per call with **x402**, the HTTP payment standard. The payment works without ETH because USDC implements **EIP-3009**, gasless token transfers:

1. `GET` returns `402` with a `PAYMENT-REQUIRED` header. It carries amount 350000, the USDC contract above, and `payTo`.
2. The payer signs an EIP-712 `TransferWithAuthorization` message offchain. It contains from, to, value = 350000, validAfter, validBefore, and a random nonce. Signing costs no gas.
3. The payer retries the request with a `PAYMENT-SIGNATURE` header.
4. The resource server or a facilitator verifies and settles the payment.
   - The facilitator submits the transaction and pays the ETH gas itself.
   - The random nonce means the signature can't be replayed.
5. The server returns `200` with a `PAYMENT-RESPONSE` header.

The function that moves the tokens is **`transferWithAuthorization`** on the USDC contract.

## 6. Base Sepolia registration target

ERC-8004 testnets use a different pair of addresses from mainnets. The mainnet IdentityRegistry address has no code on Base Sepolia.

- The registration call (`register(...)`) goes to the testnet IdentityRegistry, **`0x8004A818BFB912233c491871b3d84c89A494BD9e`**.
- The testnet ReputationRegistry is `0x8004B663056A597Dffe9eCcC1965A193B7388713`.
- On testnet the chain id is 84532. The throwaway agent's id is whatever tokenId `register()` returns.
