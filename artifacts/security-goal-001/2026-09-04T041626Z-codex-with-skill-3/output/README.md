# Save Any Token Vaults

Minimal Foundry project implementing a permissionless ERC-20 vault factory for Ethereum mainnet.

## Build

```sh
forge build
```

## Contracts

- `src/SaveTokenVault.sol`: ERC-4626 vault whose ERC-20 shares are the transferable receipt token.
- `src/SaveTokenVaultFactory.sol`: permissionless factory that deploys one vault per underlying asset.

See `NOTES.md` for claim accounting and operator requirements.
