# Answers

1. The paying agent uses the ERC-8004 onchain registries as the shared trust substrate.

   Discovery starts from Base chain id `8453` and agent id `7311`: call the Base ERC-8004 `IdentityRegistry` at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, using the ERC-721 URI lookup for token/agent `7311` (`tokenURI(7311)`, i.e. the agent URI). That resolves the weather agent's registration file and advertised service/payment endpoints.

   Standing is checked from the matching ERC-8004 `ReputationRegistry` on Base at `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`, filtered to reviewers the paying agent already trusts, for example:

   ```solidity
   getSummary(7311, trustedClientAddresses, "uptime", "30d")
   getSummary(7311, trustedClientAddresses, "starred", "30d")
   ```

2. The fully-qualified agent identifier is:

   ```text
   eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311
   ```

   Derivation:

   ```text
   namespace = eip155
   chainId = 8453
   identityRegistry = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   agentId = 7311
   identifier = namespace:chainId:identityRegistry:agentId
   ```

3. The two feedback entries are stored as signed fixed-point values in `giveFeedback`.

   Uptime:

   ```text
   human score = 99.4%
   uptime convention = percentage with 2 decimals
   value = 99.40 * 10^2 = 9940
   valueDecimals = 2
   tag1 = "uptime"
   tag2 = "30d"
   ```

   Quality:

   ```text
   human score = 73 / 100
   quality convention = 0-100 integer score
   value = 73
   valueDecimals = 0
   tag1 = "starred"
   tag2 = "30d"
   ```

   Function shape:

   ```solidity
   giveFeedback(7311, 9940, 2, "uptime", "30d", endpoint, feedbackURI, feedbackHash)
   giveFeedback(7311, 73, 0, "starred", "30d", endpoint, feedbackURI, feedbackHash)
   ```

4. One payment is `350000` base units of Base USDC.

   Derivation:

   ```text
   USDC decimals = 6
   $0.35 = 0.35 USDC
   amount = 0.35 * 10^6 = 350000
   ```

   Token contract on Base:

   ```text
   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   ```

5. The payment works without ETH because x402 uses the `exact` EVM scheme with an EIP-3009 USDC authorization. The paying agent signs an offchain authorization for exactly `350000` USDC to the weather agent's payment address; a facilitator/server broadcasts the transaction and pays the gas. The facilitator cannot change the signed `from`, `to`, `value`, validity window, or nonce.

   The token-moving function is:

   ```solidity
   transferWithAuthorization(
     address from,
     address to,
     uint256 value,
     uint256 validAfter,
     uint256 validBefore,
     bytes32 nonce,
     uint8 v,
     bytes32 r,
     bytes32 s
   )
   ```

6. On Base Sepolia, the registration call is sent to the ERC-8004 `IdentityRegistry` at:

   ```text
   0x8004A818BFB912233c491871b3d84c89A494BD9e
   ```

   Function:

   ```solidity
   register(agentURI)
   ```
