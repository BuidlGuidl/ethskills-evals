# Save Any Token Vault Notes

Each vault holds exactly one ERC-20 asset and issues transferable receipt shares. A depositor's claim is pro-rata:

```text
claimAssets = shares * (vaultAssetBalance + 1) / (totalReceiptSupply + 1e9)
```

The `+1` virtual asset and `+1e9` virtual shares are part of the share math. They keep the first-depositor path from using a fragile "empty vault = 1:1" special case, which reduces donation/inflation attacks where someone sends assets directly to the vault before a real deposit. The receipt token uses the underlying token's decimals plus 9 display decimals when the underlying reports decimals.

Yield is just an increase in the vault's underlying token balance. When the keeper transfers more of the same token into the vault, `totalAssets()` rises while receipt supply stays fixed, so every share converts into more underlying on `redeem` or `withdraw`.

Operators listing a token should get these things right:

- List the canonical Ethereum mainnet token address, not a wrapper, bridged alias, proxy imposter, or upgrade target by mistake.
- Prefer plain ERC-20s with stable balances. Fee-on-transfer deposits are rejected, and outbound transfer fees would still make users receive less than the vault debits. Rebasing, reflection, blacklistable, pausable, upgradeable, ERC-777-style callback, or otherwise non-standard tokens need explicit risk review before promotion.
- The keeper must only send the same underlying token to the matching vault. Sending the wrong token does not increase depositor claims and may strand assets.
- Direct transfers of the correct underlying are accepted as yield/donations. They benefit current share holders and do not mint new receipt tokens.
- UI and operations should display the vault address, underlying asset address, receipt token address, and current conversion rate. Receipt token names are generic, so addresses are the source of truth.
- There is no admin rescue, pause, or token migration path in these contracts. That keeps custody rules simple, but it means a bad listing cannot be fixed inside the vault.

