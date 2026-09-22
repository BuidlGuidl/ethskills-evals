# Save Any Token Vault Notes

## Depositor claims

Each vault is also the ERC-20 receipt token for one underlying ERC-20. A holder's claim is pro-rata:

```text
holder assets ~= holder shares * vault underlying balance / total shares
```

The implementation uses virtual reserves in the conversion math:

```text
shares out = assets in * (totalSupply + 1,000,000) / (totalAssets + 1)
assets out = shares in * (totalAssets + 1) / (totalSupply + 1,000,000)
```

Rounding favors the vault: deposits and redemptions round down, while exact-asset withdrawals round up the shares burned. The virtual reserves reduce first-depositor donation/inflation attacks and explain why tiny deposits can round to zero and revert.

Yield is simply additional underlying tokens in the vault. When a keeper transfers more of the underlying token to the vault, `totalAssets` rises while `totalSupply` stays fixed, so each receipt token converts into more underlying.

Deposits measure the actual balance increase after `transferFrom`, so fee-on-transfer tokens only mint shares for the amount the vault actually received. Withdrawals send the requested gross amount out of the vault; if the token charges an outgoing transfer fee, the receiver may receive less.

## Operator checklist

Listing is permissionless through `VaultFactory.createVault(asset)`, and the factory keeps one canonical vault for each asset. Operators should use `vaultForAsset(asset)` instead of deploying ad hoc duplicates, otherwise receipt-token liquidity and keeper payments fragment.

Before promoting or keeping a market, operators should verify the token's behavior: real ERC-20 transfer/transferFrom semantics, decimals and metadata sanity, whether transfers charge fees, whether balances rebase, whether the token can pause/blacklist the vault, and whether upgrades or admin controls can change those rules. The contracts do not whitelist or normalize hostile tokens.

The keeper should transfer only the same underlying token to that token's vault, and it should confirm the vault address from the factory before sending funds. Sending yield before any real depositor exists can subsidize the first depositor, so production operations should either wait for nonzero receipt supply or intentionally seed the vault.

Because deposits and withdrawals are always open, keeper accounting should tolerate users entering and leaving around a yield transfer. The yield belongs to whoever holds receipt tokens when the underlying arrives in the vault.
