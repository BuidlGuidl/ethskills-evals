# Notes

## Claim accounting

Each vault holds one ERC-20 asset and mints a transferable receipt token as shares.

- On the first deposit, shares are minted 1:1 with assets deposited.
- After that, new shares are minted at the current exchange rate:

```text
shares minted = assets deposited * totalShareSupply / totalAssetsBeforeDeposit
```

- A holder's claim at any moment is:

```text
claimable assets = holderShares * currentVaultAssets / totalShareSupply
```

When the keeper transfers more of the same underlying token into the vault, `currentVaultAssets` rises while `totalShareSupply` stays fixed. That means every existing share is worth more underlying, which is how yield is distributed pro-rata.

Withdrawals support both directions:

- `redeem(shares)` burns an exact share amount and returns the corresponding assets at the current exchange rate.
- `withdraw(assets)` burns enough shares, rounded up, to pull out an exact asset amount.

## Operator requirements

This design is intentionally simple and depends on the operator and keeper using it correctly.

- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer, rebasing, or otherwise non-standard tokens will break the accounting assumptions.
- Do not send keeper yield into a vault before the first real depositor has minted shares. If assets arrive before any shares exist, deposits are blocked to prevent the first depositor from capturing that pre-funded balance.
- The keeper must only transfer the same underlying token that the vault was created for.
- Yield should be transferred directly to the vault address. No special harvest call is required; the vault uses its token balance as source of truth.
- Since listing is permissionless, operational monitoring matters: confirm the token address is correct, the vault exists for that exact asset, and the keeper is pointed at the right vault before sending funds.
