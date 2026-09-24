# Agent commerce flow

1. The paying agent uses the ERC-8004 trustless-agent registries instead of a
   private directory. Discovery starts from the Base Identity Registry:

   ```text
   chain = Base = eip155:8453
   IdentityRegistry = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   lookup agentId = 7311
   function = tokenURI(7311), plus any indexed registration events/metadata
   ```

   The registration file reached from that identity is where the weather
   service endpoint, x402 support, active status, and supported trust methods
   are advertised. Before paying, the caller checks reputation for the same
   agent id on the Base Reputation Registry:

   ```text
   ReputationRegistry = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
   function = getSummary(7311, trustedClientAddresses, tag1, tag2)
   example standing checks:
     getSummary(7311, trustedClientAddresses, "uptime", "30days")
     getSummary(7311, trustedClientAddresses, "quality", "30days")
   ```

2. The weather agent is identified by its registry plus its token id. Because it
   was registered on Base, the cross-chain identifier is:

   ```text
   agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
   agentId = 7311
   fully qualified reference = (eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432, 7311)
   ```

3. Feedback values are stored as signed fixed-point numbers:

   ```text
   stored human value = value / 10^valueDecimals
   ```

   For 99.4% uptime over 30 days:

   ```text
   99.4 = 994 / 10^1
   value = 994
   valueDecimals = 1
   tag1 = "uptime"
   tag2 = "30days"
   function = giveFeedback(7311, 994, 1, "uptime", "30days", endpoint, feedbackURI, feedbackHash)
   ```

   For quality 73 out of 100 over 30 days:

   ```text
   73 = 73 / 10^0
   value = 73
   valueDecimals = 0
   tag1 = "quality"
   tag2 = "30days"
   function = giveFeedback(7311, 73, 0, "quality", "30days", endpoint, feedbackURI, feedbackHash)
   ```

4. Base USDC has 6 decimals, so one $0.35 payment is encoded in base units:

   ```text
   0.35 USDC * 10^6 = 350000
   amount = "350000"
   network = eip155:8453
   token = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   ```

5. The payment works without ETH because the paying agent signs an EIP-3009
   USDC authorization offchain and sends it through the x402 payment flow. The
   spender does not submit a gas-paying transaction from its own wallet; the
   seller or facilitator submits settlement on Base and pays the native gas.
   The token movement is ultimately performed by:

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

6. On Base Sepolia, the rehearsal registration call is sent to the testnet
   Identity Registry:

   ```text
   chain = Base Sepolia = eip155:84532
   function = register(agentURI, metadata) or register(agentURI)
   IdentityRegistry = 0x8004A818BFB912233c491871b3d84c89A494BD9e
   ```
