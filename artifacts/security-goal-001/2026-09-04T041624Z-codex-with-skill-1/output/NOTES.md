# SaveToken Vault Notes

## Depositor claim mechanics

Each vault holds exactly one ERC-20 asset and issues an ERC-20 receipt token via `ERC4626`. A depositor's claim is always pro-rata:

`claimableAssets = holderShares * totalAssets / totalShareSupply`

In practice:

- `totalAssets` is the vault's current onchain balance of the underlying token.
- `totalShareSupply` is the receipt token total supply.
- `previewRedeem(shares)` and `previewWithdraw(assets)` expose the same claim math onchain.
- When the keeper transfers more underlying tokens into the vault, `totalAssets` goes up while share supply stays flat. That raises the assets-per-share exchange rate for every holder.

OpenZeppelin's `ERC4626` implementation includes virtual shares/assets in its conversion math, which hardens the empty-vault state against first-depositor donation attacks better than a naive `assets * supply / totalAssets` formula.

## Listing and keeper operator requirements

Listing is permissionless, but a useful listing still depends on the operator making correct choices:

- List only standard ERC-20s that do not charge transfer fees, do not rebase unexpectedly, and behave predictably on `transfer` and `transferFrom`.
- Share metadata is chosen at vault creation time. Use a clear name and symbol because they become the transferable receipt token users see elsewhere.
- Run the keeper so that yield is sent by transferring the underlying token directly into the vault address. No privileged function call is needed.
- Fund yield in the same token as the vault asset. Sending any other token is just an accidental donation with no effect on vault accounting.
- Monitor keeper transfers and token behavior. If the underlying token changes semantics or starts charging fees, deposits and withdrawals will revert by design rather than silently mispricing shares.

## Operational model

- There is one vault per listed asset in the factory registry.
- There are no post-deploy admin powers over user funds in this implementation.
- Deposits, withdrawals, and share transfers remain open at all times; there is no lockup logic in the contracts.
