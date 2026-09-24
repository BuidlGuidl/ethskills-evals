1. The paying agent uses the onchain ERC-8004 registries instead of a
   pre-trusted directory. Discovery starts from the ERC-8004 Identity Registry
   on Base:

   - Base chain id: `8453`
   - Weather agent id: `7311`
   - Identity Registry address called for discovery:
     `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Discovery lookup function:
     `tokenURI(7311)`

   The returned agent registration data gives the advertised weather service
   endpoint. Before paying, the caller checks standing in the ERC-8004
   Reputation Registry on Base:

   - Reputation Registry address:
     `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
   - Reputation read function:
     `getSummary(7311, trustedClientAddresses, tag1, tag2)`

   For example, it can evaluate recent uptime with
   `getSummary(7311, trustedClientAddresses, "uptime", "30days")` and recent
   quality with
   `getSummary(7311, trustedClientAddresses, "quality", "30days")`.

2. The fully-qualified identifier is the ERC-8004 agent registry identifier
   plus the ERC-721 token id:

   - `agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`
   - `agentId = 7311`

   So callers should refer to the weather agent as:

   `agentRegistry:eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 agentId:7311`

3. ERC-8004 reputation values are stored as signed fixed-point fields:
   `value / 10^valueDecimals`.

   For 99.4% uptime over 30 days:

   - Arithmetic: `99.4 = 994 / 10^1`
   - `value = 994`
   - `valueDecimals = 1`
   - `tag1 = "uptime"`
   - `tag2 = "30days"`

   For quality score 73 out of 100:

   - Arithmetic: `73 = 73 / 10^0`
   - `value = 73`
   - `valueDecimals = 0`
   - `tag1 = "quality"`
   - `tag2 = "30days"`

   The feedback write function is `giveFeedback(...)` on the Reputation
   Registry, with those fixed-point fields and tags.

4. USDC uses 6 decimals, so one `$0.35` payment is encoded as:

   - Arithmetic: `0.35 * 10^6 = 350000`
   - x402 amount value: `"350000"`
   - Network: `eip155:8453`
   - USDC token contract on Base:
     `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

5. The paying agent can pay without ETH because it does not need to submit an
   ETH-funded transaction itself. It signs an EIP-3009 USDC transfer
   authorization as part of the x402 payment flow; the weather service or its
   facilitator verifies the authorization and submits the settlement
   transaction, paying the gas.

   The function that ultimately moves the USDC is:

   `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`

6. On Base Sepolia, the rehearsal registration call goes to the ERC-8004
   Identity Registry for that test network:

   - Base Sepolia chain id: `84532`
   - Registration function: `register(...)`
   - Registration contract address:
     `0x8004A818BFB912233c491871b3d84c89A494BD9e`
