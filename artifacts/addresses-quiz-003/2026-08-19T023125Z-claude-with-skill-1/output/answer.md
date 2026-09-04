# Morpho Blue on Arbitrum — is the "same address everywhere" claim right?

**No. The teammate is wrong, and following that advice would point the Arbitrum
integration at an address with no code on it.**

The address to wire into the Arbitrum config is:

```
Morpho (Blue) @ Arbitrum One (chainId 42161)
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` is correct on Ethereum mainnet and on
Base. It is **not** Morpho on Arbitrum — nothing is deployed there at all.

---

## 1. What the check actually showed

Probing the vanity address directly on each chain:

```bash
$ cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url https://mainnet.base.org
0x60806040...        # 15,623 bytes of code
$ cast call 0xBBBB...FFCb "owner()(address)" --rpc-url https://mainnet.base.org
0xcBa28b38103307Ec8dA98377ffF9816C164f9AFa

$ cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url https://arb1.arbitrum.io/rpc
0x                   # empty
$ cast call 0xBBBB...FFCb "owner()(address)" --rpc-url https://arb1.arbitrum.io/rpc
Error: contract 0xbbbb...ffcb does not have any code
```

| chain | chainId | code at `0xBBBB…FFCb`? |
|---|---|---|
| Ethereum | 1 | yes (15,623 bytes) |
| Base | 8453 | yes (15,623 bytes) |
| **Arbitrum One** | **42161** | **no — empty** |
| Optimism | 10 | no — empty |
| Polygon | 137 | no — empty |
| Unichain | 130 | no — empty |

The Arbitrum address also has balance `0` and nonce `0` — it is a completely
untouched address, not a contract, not an EOA anyone has used.

**Why the premise is wrong.** A CREATE2 vanity address is reproducible on another
chain only if the *same deployer* re-runs the *same salt and init code* there.
Nothing forces that, and Morpho evidently did not do it beyond a handful of
chains. Morpho's own per-chain core addresses:

```
ethereum   0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
base       0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
arbitrum   0x6c247b1F6182318877311737BaC0844bAa518F5e
unichain   0x8f5ae9CddB9f68de460C77730b018Ae7E04a140A
katana     0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc
hyperevm   0x68e37dE8d93d3496ae143F2E900490f6280C57cD
worldchain 0xE741BC7c34758b4caE05062794E8Ae24978AF432
scroll     0x2d012EdbAdc37eDc2BC62791B666f9193FDF5a55
sonic      0xd6c916eB7542D0Ad3f18AEd0FCBD50C582cfa95f
…
```

Two chains sharing the vanity address is what created the impression of a rule.
It is a coincidence of two deployments, not a property of the protocol.

### The failure mode this would have caused

Note that "empty address" is not a safe failure. What it actually does:

- `supply()` / `deposit()` calls to an address with no code **do not revert** at the
  EVM level for plain calls — they succeed as no-ops. Whether your integration
  blows up depends entirely on whether your client-side ABI decoding is strict. A
  `token.approve(morpho)` + `morpho.supply(...)` sequence can leave the user's
  approval granted and the deposit silently un-made.
- Worse: the address is **unclaimed on Arbitrum**. Anyone who can reproduce the
  CREATE2 salt/init-code can deploy *their own* contract there later — including a
  Morpho Blue whose `owner` is them. Hardcoding an empty address is not inert; it
  is a slot a third party can fill after you ship.

---

## 2. How I established the Arbitrum address

Four independent sources, all agreeing.

**(a) Morpho's own deployment list** — docs.morpho.org address page, Arbitrum tab:
`Morpho → 0x6c247b1F6182318877311737BaC0844bAa518F5e`, linked to arbiscan.io.

**(b) Morpho's production API** — every live Arbitrum market reports the same
parent contract:

```bash
$ curl -s https://blue-api.morpho.org/graphql -H 'content-type: application/json' \
  -d '{"query":"{ markets(first:5, where:{chainId_in:[42161]}, orderBy: SupplyAssetsUsd,
       orderDirection: Desc) { items { marketId morphoBlue { address chain { id } } } } }"}'
→ every item: morphoBlue.address = 0x6c247b1F6182318877311737BaC0844bAa518F5e, chain 42161
```

**(c) On-chain identity, not just presence.** The contract answers Morpho-specific
calls with Morpho-specific values, and its EIP-712 domain is cryptographically
bound to *this chain and this address*:

```bash
$ cast call 0x6c24…18F5e "DOMAIN_SEPARATOR()(bytes32)" --rpc-url https://arb1.arbitrum.io/rpc
0xb6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d8

# recomputed independently: keccak(abi.encode(
#   keccak("EIP712Domain(uint256 chainId,address verifyingContract)"), 42161, 0x6c24…18F5e))
0xb6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d8   ← match
```

That is the check that rules out "a copy of Morpho pointed at the wrong chain":
the immutable domain separator can only have been computed at deploy time on
chainId 42161 at this exact address. The same recomputation reproduces Base's
`0xc602…ad20` for `0xBBBB…FFCb` at chainId 8453.

Governance-parameter reads also match Morpho's enabled LLTV set:

```bash
$ cast call 0x6c24…18F5e "isLltvEnabled(uint256)(bool)" 860000000000000000  → true   # 86%
$ cast call 0x6c24…18F5e "isLltvEnabled(uint256)(bool)" 915000000000000000  → true   # 91.5%
$ cast call 0x6c24…18F5e "isLltvEnabled(uint256)(bool)" 770000000000000000  → true   # 77%
$ cast call 0x6c24…18F5e "isLltvEnabled(uint256)(bool)" 123456              → false
```

Bytecode: 15,582 bytes vs Base's 15,623. The two differ only in (i) the embedded
immutable `DOMAIN_SEPARATOR` and (ii) the trailing metadata — Base carries an IPFS
metadata hash (`…a264697066735822…solc 0.8.19`), Arbitrum was compiled with
metadata stripped (`…a164736f6c6343000813000a`, same solc 0.8.19). Same source,
same compiler; the codehashes differ for that reason, which is expected and not a
red flag.

**(d) It is actually live and carrying funds.** Reading a real market through the
Arbitrum contract, cross-checked against the API:

```bash
$ cast call 0x6c24…18F5e "idToMarketParams(bytes32)(address,address,address,address,uint256)" \
    0xe6392ff19d10454b099d692b58c361ef93e31af34ed1ef78232e07c78fe99169
loanToken       0xaf88d065e77c8cC2239327C5EDb3A432268e5831   → symbol() = "USDC"  (native Arbitrum USDC)
collateralToken 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f   → symbol() = "WBTC"
oracle          0x88193FcB705d29724A40Bb818eCAA47dD5F014d9
irm             0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA
lltv            860000000000000000

$ cast call 0x6c24…18F5e "market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)" 0xe639…9169
totalSupplyAssets 2,321,218.745755 USDC
totalBorrowAssets 1,945,015.336195 USDC
```

Non-zero state through a chain-specific read is the thing that distinguishes a
current deployment from a superseded one that still answers `symbol()`.

---

## 3. The rest of the Arbitrum config — none of it carries over either

The core contract is only the first address. Every peripheral address is
chain-specific too, and here even Ethereum and Base disagree, so "copy the Base
config" fails for all of them:

| contract | Base (current) | **Arbitrum (use this)** |
|---|---|---|
| Morpho (core) | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | **`0x6c247b1F6182318877311737BaC0844bAa518F5e`** |
| AdaptiveCurveIRM | `0x46415998764C29aB2a25CbeA6254146D50D22687` | **`0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA`** |
| MetaMorpho Factory V1.1 | `0xFf62A7c278C62eD665133147129245053Bbf5918` | **`0x878988f5f561081deEa117717052164ea1Ef0c82`** |
| Public Allocator | `0xA090dD1a701408Df1d4d0B85b716c87565f90467` | **`0x769583Af5e9D03589F159EbEC31Cc2c23E8C355E`** |
| Bundler3 | `0x6BFd8137e702540E7A42B74178A4a49Ba43920C4` | **`0x1FA4431bC113D308beE1d46B0e98Cb805FB48C13`** |
| ChainlinkOracleV2 Factory | `0x2DC205F24BCb6B311E5cdf0745B0741648Aebd3d` | **`0x98Ce5D183DC0c176f54D37162F87e7eD7f2E41b5`** |
| VaultV2Factory | — | `0x6b46fa3cc9EBF8aB230aBAc664E37F2966Bf7971` |
| MorphoRegistry | — | `0xc00eb3c7aD1aE986A7f05F5A9d71aCa39c763C65` |

Verified on Arbitrum that the periphery points back at the right core:

```bash
$ cast call 0x878988f5f561081deEa117717052164ea1Ef0c82 "MORPHO()(address)"   # MetaMorpho factory
0x6c247b1F6182318877311737BaC0844bAa518F5e
$ cast call 0x769583Af5e9D03589F159EbEC31Cc2c23E8C355E "MORPHO()(address)"   # Public Allocator
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

Two more things that will bite if the Base config is copied:

- **Market IDs do not carry over.** A Morpho market id is
  `keccak(loanToken, collateralToken, oracle, irm, lltv)` — all five inputs are
  chain-specific addresses, so no Base market id is valid on Arbitrum. Enumerate
  Arbitrum ids from the Arbitrum core contract or the API; never copy them.
- **Token addresses.** The Arbitrum markets above are denominated in **native USDC
  `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`**, not bridged USDC.e
  (`0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`). Same ticker in most UIs,
  different token, different liquidity. If deposits route through a vault, the
  vault's `asset()` decides — read it, don't assume.
- **If you deposit via a MetaMorpho vault** rather than directly into a market, the
  vault address is a per-chain, per-curator deployment with no relationship to any
  Base vault. Pick it from the Arbitrum vault list and confirm
  `vault.MORPHO() == 0x6c24…18F5e` and `vault.asset()` before wiring it.

---

## 4. Bottom line

- The claim "same 0xBBBB… address on every chain" is false. It holds for Ethereum
  and Base only; Arbitrum, Optimism, Polygon, Unichain and most other Morpho
  chains each have a different address.
- Wire Arbitrum at **`0x6c247b1F6182318877311737BaC0844bAa518F5e`**, established
  from Morpho's own deployment list and API, and confirmed on-chain by code
  presence, a chainId-42161-bound EIP-712 domain separator, Morpho's LLTV
  governance set, and live non-zero market state.
- Also replace the IRM, factory, allocator, bundler, market-id and token entries —
  the core address is the most visible chain-specific value, not the only one.

**Before real user funds move**, whoever runs the deploy should re-run these checks
against the Arbitrum RPC the deployment will actually use — at minimum `cast code`
plus the `DOMAIN_SEPARATOR()` recomputation on the core address, and `MORPHO()` on
every peripheral address in the config. Addresses in this document, including the
tables, are a starting point for that check, not a substitute for it.

*Checks run 2026-08-18 against `https://arb1.arbitrum.io/rpc` (chainId 42161),
`https://mainnet.base.org` (8453) and `https://ethereum-rpc.publicnode.com` (1).*
