# Save Token Vault Notes

## Depositor claim math

Each vault is both:

- the custody contract for one underlying ERC-20, and
- the transferable receipt token for that vault.

If a vault holds `totalAssets()` underlying tokens and has `totalSupply()` receipt shares outstanding, a holder's gross economic claim is their pro-rata slice:

`holderAssets ~= balanceOf(holder) * totalAssets() / totalSupply()`

In practice, the exact onchain conversion path is the ERC-4626 one:

- deposits use `previewDeposit(assets)` / `deposit(assets, receiver)`
- withdrawals use `previewRedeem(shares)` / `redeem(shares, receiver, owner)`

Yield increases claims because the keeper adds more of the same underlying token to the vault while share supply stays unchanged. That raises `totalAssets() / totalSupply()` for every existing share holder.

This implementation uses OpenZeppelin ERC-4626 virtual assets/shares in the conversion math, which protects the empty-vault edge case from the classic first-depositor donation attack far better than a naive `assets * totalSupply / totalAssets` formula.

## Listing and keeper requirements

Anyone can create a vault for any ERC-20, but economically correct operation still depends on the underlying token behaving like a standard ERC-20.

The lister/operator has to get these points right:

- Only list standard, non-rebasing, non-deflationary tokens. Rebasing tokens and transfer-fee tokens break or distort share accounting.
- Pick share token metadata carefully. The factory takes the receipt token `name` and `symbol` as inputs; users should identify vaults by the factory mapping and underlying asset address, not by ticker text alone.
- Run only one canonical vault per asset. The factory enforces one vault address per underlying token.
- Have the keeper send the exact same underlying token that the vault wraps. Sending the wrong token does nothing for depositors because `totalAssets()` only reads the configured underlying asset balance.
- Keep yield transfers simple. The keeper can either transfer tokens straight to the vault address or call `donate(assets)` after approving the vault.
- Never assume a keeper transfer mints shares. Yield donations intentionally increase assets without increasing share supply.
- Monitor allowances and balances offchain. If the keeper uses `donate`, it needs an allowance and enough balance; if it transfers directly, it needs to target the vault address exactly.
