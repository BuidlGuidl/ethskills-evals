# Why the dashboard reads 0 VELO

## Cause
`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **Velodrome V1** VELO token on Optimism. Velodrome moved to V2 (mid-2023), with a new VELO token; V1 VELO was migrated 1:1 into V2 VELO. The V1 contract stays deployed and still answers normally:

- `symbol()` → `"VELO"` (so the identity check "passes")
- `balanceOf()` → no revert, just 0 for anyone who migrated or who earns rewards now

All current emissions, LP rewards and locks (veVELO) are in V2 VELO. So the treasury multisig has its VELO in V2, and the explorer shows that token. The dashboard reads the old one. Nothing in your code changed; the protocol did. Classic sign of a superseded deployment: right ABI, right chain, `symbol()` looks fine, balance is 0, no error.

## Evidence (checked on Optimism mainnet RPC, 2026-09-21)
| Check | V1 `0x3c8B…1a05` | V2 `0x9560…88Db` |
|---|---|---|
| `symbol()` | `"VELO"` | `"VELO"` |
| `minter()` | `0x3460Dc71…4102d` (V1 minter) | `0x6dc9E1C0…10982` (V2 minter) |
| Current veVELO `0xFAf8FD17D9840595845582fCB047DF13f006787d`.`token()` | — | returns `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` |

The current voting-escrow (the "locked position" the explorer shows) points to V2 VELO. That shows V2 is the live token.

## Fix
```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO, Optimism
```

## Notes
- **Locked VELO is not included in `balanceOf`.** The locked position is a veVELO NFT at `0xFAf8FD17D9840595845582fCB047DF13f006787d`. To track it, list the NFTs the treasury owns and call `locked(tokenId)` on each (amount + end time). Otherwise the dashboard will under-report even after the fix.
- Any leftover V1 VELO that was never migrated sits at the old address. It's worth one check on the treasury to see if there's anything left to migrate.
- Before trusting this in production, re-check both addresses against Velodrome's official contract list (docs / `velodrome-finance/contracts` repo deployments) and the Optimism explorer.
