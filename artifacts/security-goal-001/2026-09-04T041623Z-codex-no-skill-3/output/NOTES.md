# Token Vault Notes

## Depositor claim mechanics

Each vault holds exactly one ERC-20 asset and mints a transferable receipt token ("shares").

- A depositor's claim on the underlying is:
  `holderShares / totalShareSupply * vaultAssetBalance`
- `vaultAssetBalance` is the live ERC-20 balance of the vault contract, not a separately tracked accounting number.
- If the keeper sends more of the same underlying token into the vault, `vaultAssetBalance` increases while `totalShareSupply` stays flat, so every existing share becomes redeemable for more underlying.
- Deposits mint shares against the vault balance that existed before the deposit landed.
- Withdrawals and redemptions burn shares against the vault's current live balance.

This means yield distribution is automatic: no rebasing share token, no per-user bookkeeping, and no explicit "harvest" step inside the vault.

## Listing and keeper requirements

The contracts are permissionless, but operators still need to choose sane assets and run the keeper correctly.

- Only list vanilla ERC-20s whose balances behave predictably.
- Avoid fee-on-transfer, rebasing, ERC-777 style hook-heavy, or otherwise non-standard tokens, because the vault share math assumes `balanceOf(vault)` is the source of truth for claims.
- Use the same underlying token for deposits, withdrawals, and keeper top-ups. Sending any other asset to the vault strands it.
- The first lister for an asset chooses the vault receipt `name` and `symbol`, because the factory enforces one vault per underlying token.
- The keeper must only transfer net new yield into the vault. If it accidentally pulls funds back out elsewhere, holder claims are diluted immediately because the vault balance falls.
- Keeper operations do not call a special vault method; they simply transfer the underlying token to the vault address.
- Before listing on mainnet, verify the underlying token's `decimals`, transfer semantics, and whether it can blacklist, pause, seize, or otherwise interfere with custody.
