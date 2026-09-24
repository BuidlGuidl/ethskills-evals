# Morpho Blue on Arbitrum: which address?

## Short answer

**The teammate is wrong.** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` is Morpho Blue's address on Ethereum mainnet and Base only. It is **not** the same on every chain. On Arbitrum One, that address has **no contract code**. Nothing is deployed there.

**Arbitrum config value:**

```
MORPHO_BLUE (Arbitrum One, chainId 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

## Why "vanity CREATE2 = same everywhere" doesn't hold

- A CREATE2 address comes from three inputs: the deployer, the salt, and the init code hash. You get the same address on two chains only if the same deployer uses the same salt and the same init code on both. Morpho did not do that for Arbitrum. The Arbitrum deployment used a different deployer/process, so it has a different address.
- A vanity-looking address proves nothing about other chains. When an address is empty on some chain, anyone who can meet those three inputs there could deploy code to it later, possibly malicious code. Sending user funds to an unverified address on a new chain is how funds get lost or stolen.
- Even on a chain where the address is empty, a call can silently "succeed", because calls to an address with no code don't revert at the EVM level. Some integration paths could then fail quietly instead of reverting.

## How I established it (checked 2026-09-21)

1. **On-chain code check (`eth_getCode`) against public RPCs:**

   | Address | Base (`mainnet.base.org`) | Arbitrum (`arb1.arbitrum.io/rpc`, chainId `0xa4b1` = 42161) |
   |---|---|---|
   | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | Morpho bytecode (~15.6 KB) | **`0x` (empty, no contract)** |
   | `0x6c247b1F6182318877311737BaC0844bAa518F5e` | `0x` (empty) | Morpho bytecode (~15.6 KB) |

   Both bytecodes start with the same function selector table (`0x13af4035` = `setOwner(address)`, then `0x151c1ade`, …), so it's the same Morpho Blue contract.

2. **Checked the contract's own identity (`DOMAIN_SEPARATOR`).** Morpho Blue computes this value as `keccak256(abi.encode(keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"), chainid, address(this)))`. It is tied to the chain and to the contract's own address. I recomputed it locally with `cast` and compared it with what each contract returns:
   - Arbitrum `0x6c24…8F5e`, chain 42161 → expected `0xb6174fc6…31e0d8`. On-chain value: **match**.
   - Base `0xBBBB…EFFCb`, chain 8453 → expected `0xc6022463…aead20`. On-chain value: **match**.

   So the Arbitrum contract is a Morpho Blue instance that knows it lives on Arbitrum at that address.

3. **Official source:** Morpho's address page (`docs.morpho.org/get-started/resources/addresses/`) lists `Morpho` = `0x6c247b1F6182318877311737BaC0844bAa518F5e` for Arbitrum, with a link to arbiscan. `0xBBBB…EFFCb` is listed for Ethereum and Base.

4. **Side note:** `owner()` differs per chain (Arbitrum `0xfd358f49…d9b2`, Base `0xcba28b38…9afa`). That's more evidence these are separate deployments, not one address replicated across chains.

## Recommendations before routing user funds

- Store the Morpho address **per chainId** in config. Never use one global constant.
- At startup/deploy time, assert `extcodesize(morpho) > 0` and `morpho.DOMAIN_SEPARATOR()` equals the value you compute for `(block.chainid, morpho)`. That catches wrong-chain addresses.
- Look up the other Arbitrum addresses separately: market IDs, IRM (`AdaptiveCurveIrm`), oracles, bundler, and MetaMorpho vaults. They also differ from Base. Loan/collateral token addresses differ too (e.g. USDC on Arbitrum ≠ USDC on Base).
- Do a small test deposit and withdrawal on Arbitrum before opening it to users.
