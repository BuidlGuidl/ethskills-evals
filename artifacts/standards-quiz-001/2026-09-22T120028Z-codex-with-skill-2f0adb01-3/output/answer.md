# Answer

1. The paying agent uses ERC-8004 as the shared onchain discovery and trust layer.

   Discovery on Base calls the ERC-8004 Identity Registry:

   - Network: Base mainnet = `eip155:8453`
   - Agent id: `7311`
   - Identity Registry contract: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Lookup function: `tokenURI(7311)` to resolve the weather agent's registration data and service endpoint.

   Before paying, it checks reputation on the ERC-8004 Reputation Registry:

   - Reputation Registry contract: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
   - Summary function: `getSummary(7311, trustedClientAddresses, tag1, tag2)`
   - Raw feedback function: `readAllFeedback(7311, trustedClientAddresses, tag1, tag2, includeRevoked)`

2. The fully-qualified weather-agent identifier is:

   ```text
   agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   agentId       = 7311
   ```

   The chain-qualified registry is Base mainnet (`8453`) plus the Identity Registry address, so callers on any other chain still refer to this same pair.

3. ERC-8004 reputation values are signed fixed-point fields:

   ```text
   stored score = value / 10^valueDecimals
   ```

   For 30-day uptime:

   ```text
   99.4 = 994 / 10^1

   agentId       = 7311
   value         = 994
   valueDecimals = 1
   tag1          = "uptime"
   tag2          = "30days"
   function      = giveFeedback(7311, 994, 1, "uptime", "30days", endpoint, feedbackURI, feedbackHash)
   ```

   For 30-day quality:

   ```text
   73 = 73 / 10^0

   agentId       = 7311
   value         = 73
   valueDecimals = 0
   tag1          = "quality"
   tag2          = "30days"
   function      = giveFeedback(7311, 73, 0, "quality", "30days", endpoint, feedbackURI, feedbackHash)
   ```

4. USDC has 6 decimal places, so the x402 amount for one `$0.35` call is:

   ```text
   0.35 USDC * 10^6 = 350000

   network = eip155:8453
   amount  = "350000"
   asset   = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   ```

5. The payment works without ETH because the paying agent signs an offchain EIP-3009 authorization for the exact USDC transfer. The server or facilitator submits the settlement transaction and pays the gas, while the signed authorization fixes the payer, receiver, amount, validity window, and nonce.

   The token-moving function is:

   ```text
   transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
   ```

   For this payment, `value = 350000` on the Base USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

6. On Base Sepolia, registration is sent to the ERC-8004 Identity Registry on chain `84532`:

   ```text
   network  = eip155:84532
   function = register(...)
   contract = 0x8004A818BFB912233c491871b3d84c89A494BD9e
   ```
