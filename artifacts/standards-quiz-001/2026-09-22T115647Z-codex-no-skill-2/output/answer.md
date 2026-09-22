# Answer

1. The paying agent uses ERC-8004's onchain registries as the shared trust anchor, rather than a private directory. On Base, discovery starts from the ERC-8004 Identity Registry:

   ```text
   namespace = eip155
   chainId = 8453
   identityRegistry = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   agentId = 7311

   discovery call:
   tokenURI(7311)
   sent to 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   ```

   That returns the weather agent's registration URI, where its service endpoints and payment support are advertised. Before paying, the caller checks standing through the ERC-8004 Reputation Registry on Base:

   ```text
   reputationRegistry = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

   standing functions:
   getSummary(7311, clientAddresses, tag1, tag2)
   readAllFeedback(7311, clientAddresses, tag1, tag2, includeRevoked)
   ```

2. The weather agent's chain-independent ERC-8004 identifier is the pair:

   ```text
   agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   agentId = 7311
   ```

   Written inline:

   ```text
   eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 / 7311
   ```

3. ERC-8004 feedback stores a signed fixed-point number as:

   ```text
   value / 10^valueDecimals
   ```

   For 99.4% uptime, using the percent scale for uptime feedback:

   ```text
   tag1 = uptime
   99.4% = 99.40
   99.40 * 10^2 = 9940

   value = 9940
   valueDecimals = 2
   ```

   For a quality score of 73 out of 100:

   ```text
   tag1 = starred
   73 / 100 = 73
   73 * 10^0 = 73

   value = 73
   valueDecimals = 0
   ```

   Each score is written with:

   ```text
   giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)
   ```

4. USDC has 6 decimal places, so one $0.35 payment is:

   ```text
   0.35 USDC * 10^6 = 350000

   maxAmountRequired = "350000"
   authorization.value = "350000"
   ```

   The Base USDC token contract is:

   ```text
   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   ```

5. The paying agent can pay without ETH because x402's EVM exact scheme uses an EIP-3009 USDC authorization. The agent signs the payment authorization offchain; a server or facilitator submits the onchain transaction and pays the gas.

   The token-moving call is:

   ```text
   transferWithAuthorization(
     from,
     to,
     value,
     validAfter,
     validBefore,
     nonce,
     v,
     r,
     s
   )
   ```

6. On Base Sepolia, the registration call is sent to the ERC-8004 Identity Registry at:

   ```text
   chainId = 84532
   register(...)
   to = 0x8004A818BFB912233c491871b3d84c89A494BD9e
   ```
