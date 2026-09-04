# Weather agent on Base — discovery, payment, reputation

## 1. Discovery and standing check without a shared directory

The shared directory is the chain itself: the ERC-8004 registry pair, deployed at
the same addresses on every supported mainnet, so neither side has to trust a
directory the other runs.

**Discovery lookup — IdentityRegistry on Base (chain 8453):**

```
0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
```

It is an ERC-721. The weather agent's `register()` call minted tokenId 7311 to
its operator; the paying agent calls `tokenURI(7311)` on that contract and gets
the `agentURI`, which resolves (`ipfs://`, `https://`, or a base64 `data:` URI)
to the registration file: `name`, `description`, the `services` array carrying
the A2A card / MCP endpoint for the forecast API, `x402Support: true`, `active`,
and a `registrations` array echoing `{agentId: 7311, agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}`.

Before trusting the endpoint, check that the domain actually serving the forecast
API is bound to the onchain agent. If the endpoint domain is not the same domain
serving the agentURI file, that binding must come from
`https://{endpoint-domain}/.well-known/agent-registration.json`, whose
`registrations` entry has to match agentId 7311 and the Base registry address
above. (An A2A `agent-card.json` is a separate document and does not establish
this.) If the agentURI file is served from that same domain, control is already
proven there — the paying agent should be explicit about which of the two it is
relying on rather than treating an unbound endpoint as verified.

**Standing — ReputationRegistry (same address on all mainnets, Base included):**

```
0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
```

Call `getSummary(7311, clientAddresses, tag1, tag2)`. Feedback is client-attested:
only addresses that actually engaged the agent post it, and the registry rejects
feedback from the agent's own owner and operators, so the weather agent cannot
inflate its own record. The `clientAddresses` filter is the part that matters —
pass the set of clients the paying agent independently has reason to trust.
An unfiltered total is an aggregate over anyone who bothered to write, which is
cheap for an attacker to manufacture.

## 2. Fully-qualified identifier

Chain-scoped, so it means the same thing to a caller on any chain:

```
agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId:       7311
```

`eip155:8453` is Base; the address is the IdentityRegistry there; 7311 is the
ERC-721 tokenId the registry assigned at registration — not a name, slug, UUID,
or hash chosen by the operator. The pair together is the identifier; the bare
number 7311 is ambiguous across chains.

## 3. Recording the two scores

Both go through `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint,
feedbackURI, feedbackHash)` on the ReputationRegistry, posted by the paying agent
(the client that actually paid). Scores are fixed point: the stored integer is the
score scaled by `10^valueDecimals`.

**Uptime, 99.4%** — two decimal places, so 99.40 × 10² = 9940:

```
value = 9940, valueDecimals = 2
```

**Quality, 73 out of 100** — a whole number on a 0–100 scale, no scaling needed:

```
value = 73, valueDecimals = 0
```

Two separate calls, distinguished by their tags, since one feedback entry carries
one value.

## 4. Amount on the wire

x402 amounts are token base units, never a decimal string. USDC has 6 decimals:

```
0.35 × 10^6 = 350000
```

```
amount: "350000"
```

Paid in native USDC on Base:

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

Two nearby addresses are wrong for this route: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
is USDC on Ethereum mainnet, and `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` is
the bridged USDbC on Base.

## 5. Paying with no ETH

USDC implements **EIP-3009**. The paying agent never submits a transaction, so it
never needs gas.

The flow: the request returns `402` with a `PAYMENT-REQUIRED` header naming the
amount (`350000`), the token, the chain, and the recipient. The paying agent signs
a `transferWithAuthorization` message **offchain** — an EIP-712 signature over
`(from, to, value, validAfter, validBefore, nonce)`, which costs nothing and
touches no chain — and retries the request with it in `PAYMENT-SIGNATURE`. The
resource server, or the facilitator acting for it, verifies the signature and
submits it onchain, paying the ETH gas itself; it recovers that cost from the
$0.35 it is being paid. The response comes back `200` with the forecast plus a
`PAYMENT-RESPONSE` header.

The function that ultimately moves the tokens, called on the USDC contract by the
submitting party:

```
transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
```

This is the mechanism to name — not an ERC-4337 bundler and paymaster, not a
generic "relayer", and not ERC-2612 `permit` followed by `transferFrom` (which
takes two calls and still leaves an allowance behind).

## 6. Rehearsal on Base Sepolia

The registration call goes to the **testnet** IdentityRegistry, a different
address from the mainnet one:

```
0x8004A818BFB912233c491871b3d84c89A494BD9e
```

Sending `register()` to `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on Base
Sepolia fails — there is no code at that address on the testnets. The matching
testnet ReputationRegistry, for rehearsing the `giveFeedback` half of the flow,
is `0x8004B663056A597Dffe9eCcC1965A193B7388713`. The rehearsal agent gets its own
tokenId from the testnet registry, unrelated to 7311.

---

One caveat worth stating: the registry contracts are live and in production, but
the ERC-8004 spec is still Draft, so signatures and field names can move. Verify
anything above against the deployed contract before shipping — the registries are
ERC-1967 proxies, so read the implementation slot if a call reverts unexpectedly.
