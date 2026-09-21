# Morpho Blue on Arbitrum — which address?

## Short answer

**Teammate is wrong.** On Arbitrum One there is **no contract** at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`. It is an empty address. Sending user deposits there would call an address with no code. Plain ETH sent there would be stuck for good. An ERC-20 `transferFrom`/`transfer` aimed at it could "succeed" and leave the tokens stranded.

**Address to put in the Arbitrum config:**

```
MORPHO_BLUE_ARBITRUM = 0x6c247b1F6182318877311737BaC0844bAa518F5e   # chainId 42161
```

(Base stays `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`, chainId 8453. Key the config by chain ID. Don't reuse the Base address.)

## Why the teammate's reasoning fails

- A vanity address from CREATE2 (a deploy method where the address is fixed by the deployer, salt and bytecode) only exists on a chain if someone actually ran that deploy there. Nothing puts it on every chain automatically.
- Morpho used the `0xBBBB…` address on Ethereum mainnet and Base. Later chains, Arbitrum included, got ordinary addresses that differ per chain.
- Even on chains where CREATE2 gives the same address, "same address" does not guarantee "same code" or "same deployer". You always have to check each chain.

## How I established it

1. **Reference list.** My vetted address reference (last verified Mar 2026) marks Morpho `0xBBBB…` on Arbitrum as **❌ Not deployed**, despite the vanity address, and points to docs.morpho.org for the real list. That settled the first question but gave no Arbitrum address, so I checked onchain.

2. **Onchain check with `eth_getCode`** (a call that returns a contract's code) against public RPCs (`arb1.arbitrum.io/rpc`, `mainnet.base.org`):

   | Address | Base (8453) | Arbitrum (42161) |
   |---|---|---|
   | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | Morpho bytecode ✅ | `0x` (**empty**) ❌ |
   | `0x6c247b1F6182318877311737BaC0844bAa518F5e` | `0x` (empty) | Morpho bytecode ✅ |

   Confirmed `cast chain-id` = 42161 (Arbitrum One). Block ~507,414,688 at time of check.

3. **Checked it's really Morpho Blue**, not a lookalike:
   - Its function selector table (the list of functions the code exposes) matches the Base Morpho contract. Both bytecodes start identically. The small differences are consistent with immutable values and compiler metadata.
   - `DOMAIN_SEPARATOR()` = `0xb6174fc6…e0d8`. It exactly equals `keccak256(abi.encode(keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"), 42161, 0x6c247b…F5e))`, which is Morpho's signature-domain formula. So this contract is built for chain 42161 at this address.
   - `isIrmEnabled(0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA)` = true (AdaptiveCurveIRM, the standard interest-rate model), and `isLltvEnabled(0.86e18)` = true (the 86% loan-to-value tier).
   - 253 `CreateMarket` events, so it's a live deployment in active use.
   - `owner()` = `0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2` on Arbitrum vs `0xcBa28b38…9AFa` on Base. Different owners on each chain, which is one more reason not to assume the deployments are interchangeable.

4. **Official source.** docs.morpho.org/get-started/resources/addresses lists `0x6c247b1F6182318877311737BaC0844bAa518F5e` as Morpho on Arbitrum.

## Before routing funds

- Don't copy the Base config across chains. Look up **every** Morpho-related address for Arbitrum separately: the core contract, the IRM, oracles, the MetaMorpho/vault factory, bundler/adapters, and each market ID (market IDs hash in token and oracle addresses, so they differ per chain).
- Add a startup check in the deploy script: `require(address(morpho).code.length > 0)` and `block.chainid == 42161`. Also check `DOMAIN_SEPARATOR()` against the expected value.
- Do a small test deposit and withdrawal on Arbitrum before opening it to users.
