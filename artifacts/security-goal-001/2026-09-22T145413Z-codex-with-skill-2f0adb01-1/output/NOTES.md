# Save Any Token Vaults

This project deploys `TokenVaultFactory`, which lets anyone create one canonical
vault for an ERC-20 asset. Each `TokenVault` is also the transferable receipt
token for that asset.

## Claim math

The vault does not track yield separately. A depositor's claim is based on the
vault's current underlying token balance:

```text
claimAssets = userShares * (totalAssets + 1) / (totalShares + 1e6)
```

`totalAssets` is `asset.balanceOf(address(vault))`. If a keeper transfers more
of the same token directly into the vault, `totalAssets` rises while
`totalShares` stays the same, so every receipt token claims more underlying.

Deposits mint shares using the inverse ratio:

```text
sharesMinted = assetsReceived * (totalShares + 1e6) / (totalAssetsBefore + 1)
```

The vault measures `assetsReceived` from the actual balance increase after
`transferFrom`, which avoids over-minting shares for fee-on-transfer tokens.
The `+1` virtual asset and `+1e6` virtual shares make first-deposit/donation
inflation attacks much more expensive.

Withdrawals burn the number of shares needed to receive the requested asset
amount, rounded up. Redeems burn an exact share amount and transfer the
corresponding assets, rounded down.

## Operator notes

- Listing is permissionless, but the listed asset must be the real ERC-20
  contract address for the intended token. There is no registry or admin review.
- The factory only allows one canonical vault per asset address. Receipt token
  name and symbol are chosen by the lister and should be clear enough for
  wallets and indexers.
- The keeper should transfer only the same underlying token to the matching
  vault. Sending the wrong token will not increase depositor claims and may
  strand funds.
- Do not assume 18 decimals. The vault reads the asset decimals when available
  and gives receipts six extra decimals of precision.
- Some ERC-20s are risky or awkward: rebasing tokens, blocklistable tokens,
  pausable tokens, malicious tokens, and tokens with transfer fees can produce a
  user experience that differs from plain ERC-20s. Deposits are protected by
  actual-received accounting, but withdrawals of fee-on-transfer tokens may
  deliver less to the receiver than the vault's gross amount.
- Keepers do not need special permissions. Any account can add yield by sending
  underlying tokens to the vault.
- Before mainnet deployment, run static analysis and fuzz tests against the
  exact deployment bytecode and review any unusual tokens before promoting their
  vaults in the UI.

