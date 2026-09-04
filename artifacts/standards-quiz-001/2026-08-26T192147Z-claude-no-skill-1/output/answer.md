# Trustless agent-to-agent purchase on Base

## 1. Discovery and trust check with no shared directory

Discovery does not go through a directory service at all — it goes through an
ERC-8004 **Identity Registry**, which is an **ERC-721 contract deployed as a
per-chain singleton**. Every registered agent is an NFT: the `agentId` is the
ERC-721 `tokenId`, and the token URI (`agentURI`) resolves to the agent's
registration file (name, description, pricing, and an `endpoints` list holding
its A2A card / MCP endpoint / wallets / ENS name, plus an `x402Support` flag).
So "finding" the weather agent is an ordinary ERC-721 read that any node,
indexer, or NFT-aware app can perform permissionlessly — no account, no API
key, no mutual directory.

On **Base (chain id 8453)** that contract is:

```
IdentityRegistry (Base)   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
```

The lookup is `tokenURI(7311)` (equivalently `agentURI`) on that address, then
fetch and parse the returned registration file to get the service endpoint.
Integrity is anchored on-chain: the file is reachable only via the URI the NFT
owner set, and a domain in `endpoints` can be additionally proved by serving
`/.well-known/agent-registration.json` with a `registrations` entry whose
`agentRegistry` + `agentId` match the on-chain pair — so a squatter cannot
claim someone else's domain.

Standing is then read from the companion **Reputation Registry** singleton on
the same chain:

```
ReputationRegistry (Base) 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
```

The paying agent calls `getSummary(agentId, clientAddresses, tag1, tag2)` for
an aggregate (e.g. all feedback tagged `uptime`), or
`readAllFeedback(...)` / `readFeedback(agentId, clientAddress, feedbackIndex)`
for the individual entries. Because feedback is stored in contract storage and
not just in events, the check is a plain `eth_call` and can even be done from
inside another contract. Two properties make the score meaningful without a
trusted intermediary: feedback can only be given by an address that is *not*
the agent's owner or operator, and each entry can carry a `feedbackURI` whose
off-chain JSON holds an x402 `proofOfPayment` (chainId + txHash) — so a reader
can verify the reviewer actually paid before weighting the review.

Trust is tiered: reputation is the cheap tier used here for a $0.35 call. For
higher stakes the same identity supports stake-secured re-execution, zkML
proofs, or TEE attestation.

## 2. Fully-qualified identifier

An agent is globally identified by the pair *(agentRegistry, agentId)*, where
`agentRegistry` is the colon-separated string
`{namespace}:{chainId}:{identityRegistry}`:

- `namespace` = `eip155` (EVM chain family)
- `chainId` = `8453` (Base mainnet)
- `identityRegistry` = `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

Giving:

```
agentRegistry : eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId       : 7311
```

commonly written as the single string

```
eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/7311
```

The bare `7311` is meaningless on its own — ids are assigned incrementally
per registry, so agent 7311 exists on many chains. Prefixing the namespace,
chain id and registry address is what makes it resolvable by a caller running
anywhere, including a non-EVM caller.

## 3. Storing the two scores

Feedback is a signed fixed-point number: an `int128 value` plus a `uint8
valueDecimals` (0–18), meaning the human value is `value / 10**valueDecimals`.
Each metric is its own `giveFeedback` call, distinguished by `tag1`.

**Uptime, 99.4%** — a percentage with one fractional digit; percentages are
carried at 2 decimals, so scale by 10²:

    99.4 × 10² = 9940

```
tag1          = "uptime"
value         = 9940
valueDecimals = 2
```

(9940 / 10² = 99.40%.)

**Quality, 73 out of 100** — already a whole number on a 0–100 scale, so no
scaling is needed:

    73 × 10⁰ = 73

```
tag1          = "starred"     // the 0-100 quality-rating tag
value         = 73
valueDecimals = 0
```

Both go to `giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals,
string tag1, string tag2, string endpoint, string feedbackURI, bytes32
feedbackHash)` on the Base Reputation Registry with `agentId = 7311`. Only
`value` and `valueDecimals` are mandatory; `tag2` can hold the window (e.g.
`"month"` for the 30-day engagement), and `feedbackURI` can point at an IPFS
JSON carrying the x402 proof of payment (with `feedbackHash = bytes32(0)`,
since IPFS is content-addressed). The registry stores `value`,
`valueDecimals`, `tag1`, `tag2`, `isRevoked` and a per-client `feedbackIndex`;
`endpoint`, `feedbackURI` and `feedbackHash` are only emitted.

Note the two scores are **not** averaged into one number. They stay separate,
tagged rows, so a later reader can ask for `uptime` alone and compare it
against other agents' `uptime` on the same scale.

## 4. Wire amount for $0.35

USDC has **6 decimals**, and x402 quotes amounts as a decimal string in atomic
units:

    0.35 USDC × 10⁶ = 350000

```
amount = "350000"     // string, atomic units, not 0.35 and not 350000000000000000
asset  = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   // native USDC on Base
network = "eip155:8453"                                // CAIP-2 id for Base
scheme  = "exact"
```

`350000` appears twice and must match in both places: as `amount` in the
payment requirements the server returns with its HTTP 402, and as
`authorization.value` inside the signed payment payload the client sends back.
The `exact` scheme means exactly that value — a mismatch is rejected at
verification rather than being treated as a partial payment. Using the
18-decimal figure would overpay by 10¹²×; the token is not an 18-decimal ERC-20.

## 5. Paying with zero ETH

Nothing about the payment requires the payer to hold ETH, because the payer
never broadcasts a transaction. The flow separates *authorizing* a transfer
from *submitting* it:

1. The paying agent requests the forecast; the server answers **HTTP 402
   Payment Required** with the accepted requirements (scheme `exact`, network
   `eip155:8453`, `amount` `"350000"`, `asset` USDC, `payTo`).
2. The paying agent signs an **EIP-712 typed-data message** off-chain — an
   `EIP-3009` `TransferWithAuthorization` struct binding `from`, `to`,
   `value = 350000`, `validAfter`, `validBefore`, and a random 32-byte
   `nonce`. Signing costs no gas and touches no chain.
3. It retries the request carrying that signature plus the authorization
   fields in the payment header.
4. A **facilitator** verifies the signature, balance, amount and validity
   window (simulating the call first), then **broadcasts the transaction and
   pays the ETH gas itself**. It is only a broadcaster: the amount and the
   destination are fixed inside the signed message, so the facilitator cannot
   redirect or inflate the payment.
5. The 200 response comes back with settlement details (tx hash), which
   doubles as the `proofOfPayment` recorded with the later feedback.

The function that ultimately moves the tokens, called by the facilitator on
the USDC contract itself:

```solidity
transferWithAuthorization(
    address from, address to, uint256 value,
    uint256 validAfter, uint256 validBefore, bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
)
```

USDC implements EIP-3009 natively, which is why this is the simplest and
recommended path. The random `nonce` (not a sequential counter) is burned on
use, so the authorization is one-shot and cannot be replayed. Had the token
lacked EIP-3009, the fallback would be a Permit2 signature via a proxy — but
that needs a prior `approve`, which is exactly the step an ETH-less agent
cannot perform unaided.

## 6. Base Sepolia rehearsal

Testnets use a different deterministic address from mainnets. On **Base
Sepolia (chain id 84532)** the registration call — `register(string agentURI,
MetadataEntry[] metadata)`, or its `register(string agentURI)` /
`register()` overloads — is sent to:

```
IdentityRegistry (Base Sepolia)   0x8004A818BFB912233c491871b3d84c89A494BD9e
```

with the matching reputation contract for rehearsing step 3 at:

```
ReputationRegistry (Base Sepolia) 0x8004B663056A597Dffe9eCcC1965A193B7388713
```

`register` mints the ERC-721 and returns the incrementally assigned
`agentId`, so the throwaway agent's fully-qualified identifier during the
rehearsal is `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e` plus
whatever id it is minted. Note the mainnet address
(`0x8004A169…`) will not work here, and vice versa — the mainnet and testnet
deployments are two distinct vanity addresses, both sharing the `0x8004`
prefix. The x402 side rehearses on `eip155:84532` against Base Sepolia's test
USDC, with `amount` still `"350000"`.
