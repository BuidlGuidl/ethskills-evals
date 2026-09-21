# Morpho Blue on Arbitrum — which address?

## Short answer

**Teammate is wrong.** Nothing is deployed at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` on Arbitrum. It's an empty address (no code). Sending user funds or calls there would at best revert. At worst, a raw ETH/token transfer would succeed silently and the funds would be stuck at an address nobody controls today.

**Arbitrum config should use:**

```
MORPHO_BLUE (Arbitrum One, chainId 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

Base stays `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`.

## Why the teammate's reasoning fails

- A vanity/CREATE2 address only repeats across chains if someone actually deploys it on each chain, with the same deployer, salt and init code. Nothing forces that to happen.
- Morpho used the `0xBBBB…` address only on Ethereum and Base. On later chains, including Arbitrum, it's deployed at a normal per-chain address.
- "Same address everywhere" is a guess, not a check. Addresses have to be looked up for each chain.

## How I established it (3 independent checks)

### 1. Onchain: is there any code there? (`eth_getCode`, 2026-09-21)

| Address | Arbitrum (arb1.arbitrum.io) | Base (mainnet.base.org) |
|---|---|---|
| `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | `0x` (**empty, no contract**) | Morpho bytecode |
| `0x6c247b1F6182318877311737BaC0844bAa518F5e` | Morpho bytecode | `0x` (empty) |

RPC reported chain ID `42161`, so this is Arbitrum One.

### 2. Onchain: is it really the same Morpho code?

I fetched the runtime bytecode (the deployed program) of Arbitrum `0x6c24…8F5e` and Base `0xBBBB…EFFCb` and compared them byte by byte. There were only two kinds of difference:
- **`DOMAIN_SEPARATOR` immutable (a value baked into the code at deploy time, used for signature checks)**, which is expected to differ. I recomputed it with `cast`:
  `keccak256(abi.encode(keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"), chainId, address))`
  - Arbitrum (42161, `0x6c24…`) → `0xb6174fc6…4231e0d8`, which matches both the bytecode and the `DOMAIN_SEPARATOR()` call.
  - Base (8453, `0xBBBB…`) → `0xc6022463…78eaad20`, which also matches.
- **Compiler metadata trailer** at the end of the code: non-executable, different build settings.

All other bytes, meaning all the program logic, are identical. The Arbitrum contract is the same Morpho Blue code, tied to its own address and chain.

Other calls:
- `owner()` on Arbitrum = `0xfd358f49678bd408fbce0cf6bb9dfa5857d5d9b2` (Base owner is `0xcba28b38…9afa`, different as expected).
- `feeRecipient()` = zero on both.

### 3. Official source

Morpho docs (https://docs.morpho.org/get-started/resources/addresses/) list:
- Arbitrum: `0x6c247b1F6182318877311737BaC0844bAa518F5e`
- Base: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`

These match the onchain results.

Note: my local address reference (last checked Feb/Mar 2026) said "Morpho NOT on Arbitrum". That was right about the `0xBBBB…` address and is now out of date about Morpho overall. That's another reason to check onchain and in the docs before launch instead of trusting a stored list.

## Before routing user funds

1. Put addresses in a per-chain config map. Never share one constant across chains.
2. Add a startup/deploy check: `extcodesize(morpho) > 0` and `DOMAIN_SEPARATOR()` equals the expected value for the chain ID. That catches wrong-chain or wrong-address mistakes.
3. Market IDs, oracles, IRMs (interest-rate models) and MetaMorpho vaults are also **per chain**. Look up the Arbitrum markets you plan to use. Don't reuse Base market IDs or params.
4. Asset addresses differ too, e.g. Arbitrum native USDC = `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (Base USDC is `0x8335…2913`).
5. Do a small test supply/withdraw on Arbitrum before opening the integration to users.
