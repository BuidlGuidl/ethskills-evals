1. The paying agent uses the ERC-8004 onchain registry system, not a private or pre-trusted directory.

   Discovery is a lookup in the ERC-8004 Identity Registry on Base:

   - Base chain id: `8453`
   - identity registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - weather agent id: `7311`
   - lookup target: `agentId = 7311`

   The caller reads the agent's registration URI and service endpoints from the Identity Registry, then checks standing through the ERC-8004 Reputation Registry:

   - reputation registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
   - standing function:

   ```solidity
   getSummary(
     7311,
     trustedClientAddresses,
     "uptime",
     "30days"
   )
   ```

   and similarly:

   ```solidity
   getSummary(
     7311,
     trustedClientAddresses,
     "quality",
     "30days"
   )
   ```

2. The weather agent is identified by its registry plus its ERC-721 token id:

   - `agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`
   - `agentId = 7311`

   Fully qualified reference as the field tuple:

   ```text
   (agentRegistry, agentId) =
   ("eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", 7311)
   ```

3. Feedback scores are fixed-point values stored as `value` plus `valueDecimals`.

   Uptime:

   - measured uptime: `99.4%`
   - store one decimal place, so `valueDecimals = 1`
   - arithmetic: `99.4 * 10^1 = 994`
   - stored fields:

   ```text
   value = 994
   valueDecimals = 1
   tag1 = "uptime"
   tag2 = "30days"
   ```

   Quality:

   - measured quality: `73 / 100`
   - whole-number score, so `valueDecimals = 0`
   - arithmetic: `73 * 10^0 = 73`
   - stored fields:

   ```text
   value = 73
   valueDecimals = 0
   tag1 = "quality"
   tag2 = "30days"
   ```

   The feedback calls are:

   ```solidity
   giveFeedback(
     7311,
     994,
     1,
     "uptime",
     "30days",
     endpoint,
     feedbackURI,
     feedbackHash
   )
   ```

   ```solidity
   giveFeedback(
     7311,
     73,
     0,
     "quality",
     "30days",
     endpoint,
     feedbackURI,
     feedbackHash
   )
   ```

4. USDC has 6 decimal places, so a `$0.35` payment is encoded in base units:

   - arithmetic: `0.35 * 10^6 = 350000`
   - amount on the wire: `"350000"`
   - network: `eip155:8453`
   - token contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

5. The payment is possible without ETH because the paying agent signs an offchain EIP-3009 authorization for USDC, and the x402 facilitator/resource-server side submits the settlement transaction and pays the gas.

   The token-moving function is:

   ```solidity
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

   For this call, `value = 350000` and the token contract is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

6. On Base Sepolia, registration is sent to the ERC-8004 Identity Registry testnet deployment:

   - Base Sepolia chain id: `84532`
   - function:

   ```solidity
   register(agentURI, metadata)
   ```

   or:

   ```solidity
   register(agentURI)
   ```

   - registration contract address:

   ```text
   0x8004A818BFB912233c491871b3d84c89A494BD9e
   ```
