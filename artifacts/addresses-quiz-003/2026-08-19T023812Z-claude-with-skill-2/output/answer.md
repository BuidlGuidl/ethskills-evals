# Is the teammate right? No.

**Short answer:** the vanity-address claim is false for Arbitrum. `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` has **no code at all on Arbitrum One**. Pointing the Arbitrum deployment at it and routing user deposits through it would send funds to an EOA-shaped empty address — and most of the calls would not revert, they would silently succeed or read zero.

Morpho *is* deployed on Arbitrum, just at an ordinary address.

## The address to wire into the config

```
Morpho Blue — Arbitrum One (chainId 42161)
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

*(checksum verified with `cast to-check-sum-address`)*

## How I established it

All checks run 2026-08-19, Arbitrum block 496028307 / Base block 50158982, RPC `https://arb1.arbitrum.io/rpc`.

**1. Disproved the claim directly.**

```
cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url <arbitrum>   -> 0x        (empty)
cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url <base>       -> 0x6080... (15.6 KB)
```

The vanity address is real, but it is only shared by **Ethereum mainnet and Base**. Every other Morpho deployment sits at a different address — from Morpho's own API (`blue-api.morpho.org`, `morphoBlues` query, i.e. the protocol's own deployment registry):

| Chain | chainId | Morpho Blue |
|---|---|---|
| Ethereum | 1 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Base | 8453 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| **Arbitrum One** | **42161** | **`0x6c247b1F6182318877311737BaC0844bAa518F5e`** |
| OP Mainnet | 10 | `0xce95AfbB8EA029495c66020883F87aaE8864AF92` |
| Polygon | 137 | `0x1bF0c2541F820E775182832f06c0B7Fc27A25f67` |
| Unichain | 130 | `0x8f5ae9CddB9f68de460C77730b018Ae7E04a140A` |
| World Chain | 480 | `0xE741BC7c34758b4caE05062794E8Ae24978AF432` |
| HyperEVM | 999 | `0x68e37dE8d93d3496ae143F2E900490f6280C57cD` |

So the "same address everywhere" intuition generalises from a two-chain coincidence. CREATE2 only reproduces an address if deployer, salt *and* init-code all match; a later deployment that changes any of them lands somewhere else, and later chains were plainly deployed by a different path.

**2. Confirmed the Arbitrum address is genuine Morpho Blue, not a lookalike.**

Identity, not just presence:

```
cast call 0x6c247b... "owner()(address)"          -> 0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2
cast call 0x6c247b... "isLltvEnabled(uint256)" 0.86e18 -> true
cast call 0x6c247b... "DOMAIN_SEPARATOR()(bytes32)"-> 0xb6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d8
```

The domain separator is the strongest single signal, because Morpho Blue fixes it at construction as
`keccak256(abi.encode(DOMAIN_TYPEHASH, block.chainid, address(this)))`. Recomputing it locally:

```
keccak(abi.encode(typehash, 42161, 0x6c247b1F...))  == 0xb6174fc6...e0d8   ✅ matches on-chain
keccak(abi.encode(typehash,  8453, 0xBBBBBbbB...))  == 0xc6022463...ad20   ✅ matches Base on-chain
```

That is cryptographic proof the contract at `0x6c247b...` is Morpho Blue code deployed **for chain 42161 at that exact address** — it cannot be a copy of the Base deployment or a replayed artifact. The runtime bytecode is also byte-identical to Base's apart from the embedded immutables (31,166 vs 31,248 hex chars; 139 differing nibbles, all in the domain-separator/constant region).

**3. Confirmed it is live and carrying real state.** e.g. the USDC/WBTC market (`0xe6392ff1…`) returns loan token `0xaf88d065…` (USDC), collateral `0x2f2a2543…` (WBTC), IRM `0x66F30587…`, LLTV 86%, with ~$2.3M supplied and `lastUpdate` within the last day. DefiLlama shows Morpho Blue at ~$23M TVL on Arbitrum.

## Three follow-on traps in this migration

These matter more than the singleton address, because each fails *silently*.

**a) Market IDs do not carry across chains.** If you copy Base market IDs into the Arbitrum config:

```
# Base's flagship USDC/cbBTC market id, queried on Arbitrum:
cast call 0x6c247b... "idToMarketParams(bytes32)" 0x9103c3b4... --rpc-url <arbitrum>
  -> 0x0, 0x0, 0x0, 0x0, 0        # all zeros, no revert
```

A market ID is `keccak256` of the market params, which include chain-specific token/oracle/IRM addresses — so Base IDs are meaningless on Arbitrum. This is the textbook "reads zero without reverting" failure: `supply()` into an uncreated market reverts with a generic error, and read paths just report an empty position. **Re-derive every market ID from Arbitrum params.**

**b) The IRM and oracle addresses are chain-specific too.** Base's AdaptiveCurveIRM `0x46415998764C29aB2a25CbeA6254146D50D22687` has **no code on Arbitrum** and `isIrmEnabled()` returns `false` there. Arbitrum's is `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA`. Oracles are per-market and must come from `idToMarketParams` on Arbitrum.

**c) USDC vs USDC.e.** Arbitrum carries both, and **both report `symbol() == "USDC"`**:

| Address | `symbol()` | `name()` | |
|---|---|---|---|
| `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | USDC | USD Coin | ✅ native, what Morpho's markets use |
| `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | USDC | USD Coin (Arb1) | ❌ bridged USDC.e |

A symbol check will not catch this one. Use the native address above.

## If "user deposits" means a vault, not the singleton

Morpho Blue is the singleton primitive — retail-style deposits normally go through a MetaMorpho vault (ERC-4626), and **vault addresses are per-chain and per-curator; none of your Base vault addresses exist on Arbitrum.** Current Arbitrum USDC vaults, largest first:

| Vault | Address | TVL |
|---|---|---|
| Not Gauntlet [AUSD] | `0x3014ED70B39be395e1a5Eb8ab4c4b8a5378E6522` | ~$4.6M |
| Steakhouse High Yield USDC | `0x5c0C306Aaa9F877de636f4d5822cA9F2E81563BA` | ~$2.0M |
| Gauntlet USDC Core | `0x7e97fa6893871A2751B5fE961978DCCb2c201E65` | ~$1.6M |
| Gauntlet USDC Prime | `0x7c574174DA4b2be3f705c6244B4BfA0815a8B3Ed` | ~$0.5M |

Pick one deliberately and re-verify its `asset()` is `0xaf88d065…` before wiring it.

## Sizing caveat

Morpho on Arbitrum is ~$23M TVL against ~$3.3B on Base — roughly 1/145th the depth. The Base integration's assumptions about market liquidity will not transfer. In particular, the largest Arbitrum market by Morpho's API is USDC/K (Kinto), which on-chain is at **~100% utilization with 1 wei of withdrawable liquidity** — do not treat headline supply figures there as available depth. Size deposit and withdrawal paths against the specific markets you actually route to.

## Re-check before real funds move

Whoever runs this did not watch me check. Before mainnet funds flow, re-verify on an Arbitrum RPC:

- `cast code 0x6c247b1F6182318877311737BaC0844bAa518F5e` is non-empty
- every configured market ID returns non-zero from `idToMarketParams`
- the loan token in each market equals the USDC address in your config
- any vault's `asset()` matches, and it is listed on Morpho's Arbitrum app
