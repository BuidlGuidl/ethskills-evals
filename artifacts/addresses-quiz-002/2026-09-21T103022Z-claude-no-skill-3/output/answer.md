# Can we reuse mainnet Uniswap v4 addresses on Base and Arbitrum?

## Short answer

**No. The plan is not safe.** Uniswap v4 core contracts (PoolManager, PositionManager,
UniversalRouter, Quoter, StateView) are at **different addresses on each chain**.
We need per-chain config, keyed by chain ID.

## Why the "CREATE2 = same address everywhere" idea is wrong

- CREATE2 gives the same address only if **all three inputs match**: the deployer
  address, the salt, and the exact init code (bytecode + constructor args).
- CREATE2 makes same-address deploys *possible*. It does not *make them happen*.
  Uniswap did not deploy v4 that way across chains:
  - The mainnet PoolManager `0x000000000004444c5dc75cB358380D2e3dE08A90` is a
    vanity address (leading zeros, `4444`) found by searching for a salt for one
    specific mainnet deployment.
  - Constructor args differ per chain (e.g. owner/admin, WETH address used by the
    periphery contracts), so the init code differs. That alone changes the address.
  - Uniswap's own deployment docs list a separate address table per chain.
- **Some** contracts really are the same everywhere (e.g. **Permit2** at
  `0x000000000022D473030F116dDEE9F6B43aC78BA3`). That is probably where the belief
  comes from. It does not apply to v4.

## What goes wrong if we ship it

On Base/Arbitrum, the mainnet PoolManager address is either:
1. **empty (no code)** — calls to an address with no code often *succeed silently*
   in the EVM and return nothing. Low-level calls / token transfers can "work" with
   no effect, or decoding fails with confusing errors. Users could approve or send
   tokens to a useless address; or
2. **someone else's contract** — anyone can deploy something at an unused address on
   another chain if they can reproduce the deployer+salt+init code, or it may simply
   be a different contract. Sending approvals or funds there is a direct loss risk.

Either way: broken swaps at best, lost user funds at worst.

## What to use instead (Uniswap v4 official deployments)

| Contract        | Ethereum (1)                                 | Base (8453)                                  | Arbitrum One (42161)                         |
|-----------------|----------------------------------------------|----------------------------------------------|----------------------------------------------|
| PoolManager     | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| UniversalRouter | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |
| Quoter          | `0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203` | `0x0d5e0f971ed27fbff6c2837bf31316121532048d` | `0x3972c00f7ed4885e145823eb7c655375d275a1c5` |
| StateView       | `0x7ffe42c4a5deea5b0fec41c94c136cf115597227` | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| Permit2 (same)  | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same                                         | same                                         |

**Before shipping, verify each one** (these are from Uniswap's published deployment
list; don't trust any single source, including this file, for money-moving config):
- Cross-check against the official page: https://docs.uniswap.org/contracts/v4/deployments
- Open each on the chain's explorer (basescan.org, arbiscan.io): verified source,
  correct contract name, real v4 activity.
- On-chain check in CI/startup: `eth_getCode(addr) != "0x"` on each chain.

## Other per-chain things that also change (easy to miss)

- **Token addresses**: USDC, WETH, etc. differ per chain (e.g. native USDC on Base
  and Arbitrum ≠ mainnet USDC). Pool keys include token addresses, so...
- **Pool IDs** differ: a PoolKey = (currency0, currency1, fee, tickSpacing, hooks).
  Different token addresses → different pools/IDs. Liquidity per pool also differs;
  the pool you use on mainnet may not exist or may be thin on L2s.
- **Hook contracts**: if we use hooks, they must be deployed on each chain; v4 hook
  permissions are encoded in the hook address bits, so we must mine a valid address
  per chain too.
- **RPC, chain ID, block explorer, gas settings** — all per chain.

## Recommended change (minimal)

One config map keyed by chain ID, and fail closed on unknown chains:

```ts
const UNISWAP_V4 = {
  1:     { poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90", /* ... */ },
  8453:  { poolManager: "0x498581fF718922c3f8e6A244956aF099B2652b2b", /* ... */ },
  42161: { poolManager: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32", /* ... */ },
} as const;

export function v4Addresses(chainId: number) {
  const a = UNISWAP_V4[chainId as keyof typeof UNISWAP_V4];
  if (!a) throw new Error(`Uniswap v4 not configured for chain ${chainId}`);
  return a;
}
```

Plus: a test/startup check that each configured address has code on its chain, and a
small test swap on each chain (testnet or tiny amount) before launch.

## Open question

- The task says "the PoolManager **we deployed against**". If that means our own
  PoolManager deployment (not Uniswap's canonical `0x0000…4444`), then there is no
  public address to look up for Base/Arbitrum — we'd have to deploy there ourselves,
  or switch to Uniswap's canonical deployments above (usually better: that's where
  the liquidity is).
