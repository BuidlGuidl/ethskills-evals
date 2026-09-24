# Save Any Token Vault Notes

Each vault has one immutable ERC-20 asset and issues transferable receipt shares. A depositor's current claim is:

```text
assets = shares * (vault_asset_balance + 1) / (total_receipt_supply + 1e9)
```

rounded down. Deposits use the inverse calculation, rounded down, after measuring the vault's actual balance increase. Withdrawals that request an exact asset amount round shares up so remaining holders are not diluted.

The `+1` virtual asset and `+1e9` virtual shares make first-deposit and donation-rounding attacks much less attractive. Keeper transfers do not call a vault function: when more underlying tokens arrive, `vault_asset_balance` rises, so every receipt share's claim rises pro rata.

Operator checklist:

- List the exact ERC-20 contract address; a vault is permanent and the factory allows one vault per asset.
- The keeper must send yield to the vault address for that same asset. Sending the wrong token, sending to the factory, or sending to a receipt-token address will not credit depositors.
- Treat unusual tokens carefully. Fee-on-transfer tokens are credited on deposit by the net amount received, but withdrawals may also pay transfer fees before reaching the user. Rebasing, pausable, blacklistable, upgradeable, non-standard, or malicious tokens can change redemption behavior or block exits.
- Run keeper transfers only after confirming the vault address from `vaultFor(asset)` or the `VaultCreated` event.
- User interfaces should quote with `previewDeposit`, `previewWithdraw`, and `previewRedeem`, and pass `minShares` or `minAssets` when callers need protection from rounding or balance changes between quote and execution.

