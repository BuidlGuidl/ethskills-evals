# Morpho Blue on Arbitrum: which address?

## Short answer

**The teammate is wrong.** Morpho Blue is **not** at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` on Arbitrum. That vanity address is only used on Ethereum mainnet and Base. Chains added later (Arbitrum, Optimism, Polygon, etc.) got their own addresses, each different.

**Address for the Arbitrum config (chain ID 42161):**

```
MORPHO_BLUE = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

## How I checked (live on-chain, 2026-09-21)

I called public RPCs (`https://arb1.arbitrum.io/rpc`, `https://mainnet.base.org`):

| Check | Result |
|---|---|
| `eth_chainId` on the Arbitrum RPC | `0xa4b1` = 42161, so it's really Arbitrum One |
| `eth_getCode(0xBBBB…FFCb)` on **Arbitrum** | `0x`, **no contract there** |
| `eth_getCode(0xBBBB…FFCb)` on Base | Morpho Blue bytecode (as you'd expect) |
| `eth_getCode(0x6c24…8F5e)` on **Arbitrum** | Contract present. Its opening function list matches the Base Morpho bytecode (`setOwner` `0x13af4035`, `0x151c1ade`, …) |
| `eth_getCode(0x6c24…8F5e)` on Base | `0x` (it's an Arbitrum-only address) |
| `owner()` on Arbitrum `0x6c24…` | `0xfd358f49678bd408fbce0cf6bb9dfa5857d5d9b2` (Base's owner is `0xcba2…9afa`, so each chain has its own owner) |
| `DOMAIN_SEPARATOR()` | Different on each chain, as expected: it includes the chain ID and the contract address |

The bytecode isn't byte-for-byte the same as Base's: it's about 41 bytes longer overall, with 139 differing hex characters. That comes from the chain-specific built-in values and the compiler metadata. The function layout is the same Morpho Blue contract.

## Why the teammate's advice is dangerous

- Right now `0xBBBB…FFCb` on Arbitrum is an **empty account**. On most chains, a call to an address with no code **succeeds silently**. An ERC-20 `transfer`/`approve` sent there, or a low-level call, won't fail. User funds could be sent into a void. Worse, whoever later manages to deploy code at that address would control anything that was approved to it.
- "Same address everywhere via CREATE2" only holds if the same deployer, salt and init code were used on every chain. Morpho didn't do that for its later chains. Never assume it; check it.

## Before going live

1. Cross-check `0x6c247b1F6182318877311737BaC0844bAa518F5e` against Morpho's official addresses page (docs.morpho.org → Addresses) and Arbiscan's verified source ("Morpho"). I confirmed it on-chain above but didn't pull the docs page in this session.
2. Also look up the **Arbitrum-specific** addresses of everything else the integration uses (Bundler, IRM such as AdaptiveCurveIrm, oracles, MetaMorpho vaults/factory, market IDs). Don't copy any of them from Base. Market IDs depend on the loan/collateral token addresses, which are also different on Arbitrum.
3. Store addresses per chain ID in config, e.g. `{8453: 0xBBBB…FFCb, 42161: 0x6c24…8F5e}`. Add a startup check that `extcodesize(address) > 0` and that `owner()` or another known getter returns what you expect.
