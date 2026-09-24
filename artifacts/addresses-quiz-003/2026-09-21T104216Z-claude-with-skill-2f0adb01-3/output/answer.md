# Morpho Blue on Arbitrum — which address?

## Short answer

**The teammate is wrong.** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` has **no code on Arbitrum One**. It's an empty address, so any deposit sent there is lost for good (nothing can ever move it back).

**Put this in the Arbitrum config:**

```
MORPHO_BLUE (Arbitrum One, chainId 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

## Why the teammate's reasoning fails

- A vanity/CREATE2 address only repeats across chains if someone actually deploys it on each chain with the same deployer, salt and bytecode. Nothing makes that happen by itself.
- Morpho used the `0xBBBB…` address only on Ethereum and Base. Newer chains (Arbitrum, Polygon, Unichain, OP, etc.) got **different, ordinary addresses**.
- The same trap exists elsewhere, e.g. Uniswap V4 contracts have a different address on each chain.
- Rule: **never assume an address carries over between chains. Check each chain.**

## How I found the address (4 independent checks)

### 1. Local verified address list (ethskills `addresses` skill, last checked Feb/Mar 2026)
It lists Morpho `0xBBBB…EEFFCb` as ✅ on Base and ❌ **"Not deployed" on Arbitrum**, with the note "despite the vanity CREATE2 address". That backs up the "teammate is wrong" part. The list is older than today (2026-09-21) and gives no Arbitrum address, so I looked up the rest below.

### 2. Onchain: the `0xBBBB…` address is empty on Arbitrum
Checked with `cast`, using two separate Arbitrum RPCs (arb1.arbitrum.io, publicnode). `cast chain-id` returned 42161:

```
cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url <arbitrum>   ->  0x   (no code)
cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url <base>       ->  ~15.6 KB bytecode (live)
```

### 3. Official Morpho sources list `0x6c24…8F5e` for Arbitrum
- On https://docs.morpho.org/get-started/resources/addresses/ the Arbitrum "Morpho" row reads `0x6c247b1F6182318877311737BaC0844bAa518F5e` and links to `arbiscan.io/address/0x6c247b…8F5e`.
- Morpho's API (`api.morpho.org/graphql`) lists Arbitrum One (42161) as a supported chain.

### 4. Onchain: `0x6c24…8F5e` really is Morpho Blue on Arbitrum
| Check | Result |
|---|---|
| `cast code` | ~15.6 KB bytecode present (same on both RPCs) |
| Bytecode vs Base `0xBBBB…` Morpho | ~99.5% the same. The differences fit per-deploy constants and compiler metadata |
| `DOMAIN_SEPARATOR()` | `0xb6174fc6…31e0d8`. This **exactly matches** `keccak256(abi.encode(keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"), 42161, 0x6c247b…8F5e))`, so the contract was built for Arbitrum at this exact address |
| `owner()` | `0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2` |
| `isIrmEnabled(0x0)`, `isLltvEnabled(0.86e18)` | `true`, `true` (Morpho Blue's usual setup) |
| `feeRecipient()` | `0x0` |

The official docs, the matching bytecode and the chain-specific signing-domain value all agree. So this is the address I'd use.

## Before routing user funds (recommended)

1. **Fetch Arbitrum-specific values separately too:** market IDs, oracles, IRM (the interest-rate contract) and any MetaMorpho vaults. The docs list the Arbitrum Adaptive Curve IRM at a different address from Base (a `0x66F3…` address; copy it in full from the docs). Market IDs are a hash of the market settings, including token addresses. Tokens like USDC and WETH have different addresses on Arbitrum, so **no Base market ID will work on Arbitrum.**
2. Key the config by chain ID (e.g. `{8453: 0xBBBB…EEFFCb, 42161: 0x6c24…8F5e}`) and have the app refuse any chain it doesn't know. Don't fall back to a single shared address.
3. Add a startup/CI check: `extcodesize(morpho) > 0` and `DOMAIN_SEPARATOR()` equals the value computed from `(chainId, morpho)`. That catches this exact mistake automatically.
4. Do a small test deposit and withdrawal on Arbitrum before going live.
