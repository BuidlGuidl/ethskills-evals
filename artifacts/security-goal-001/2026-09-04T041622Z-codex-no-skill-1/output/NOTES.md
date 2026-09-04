# Notes

## Claim math

Each vault holds exactly one ERC-20 asset and the vault share token is itself the depositor receipt token.

- `totalAssets` is the vault's current `asset.balanceOf(vault)`.
- `totalSupply` is the total outstanding receipt-token supply.
- A holder's current claim is `balanceOf(holder) / totalSupply` of the vault's assets.
- In asset terms, the claim is `balanceOf(holder) * totalAssets / totalSupply`, rounded down on preview/redeem paths.
- On the first deposit, shares mint 1:1 with assets.
- After that, deposits mint `assets * totalSupply / totalAssets` shares, so new deposits buy into the current exchange rate.
- When a keeper transfers more underlying into the vault, `totalAssets` rises while `totalSupply` stays fixed. That increases the asset value of every existing share automatically.

## Operator requirements

Listing is permissionless at the factory layer, but operators still need to be disciplined about what they surface to users and what their keeper does.

- Only list plain ERC-20s with standard transfer behavior. Fee-on-transfer tokens are rejected on deposit, and taxed/rebasing/weird callback tokens should be treated as unsupported.
- Use names and symbols that make it obvious the receipt token is a vault share for a specific underlying.
- The keeper should send the same underlying token directly to the vault address. It must not mint or burn shares.
- The keeper must never send the wrong token to a vault. Only the configured underlying affects depositor claims.
- If the operator runs any indexing or frontend layer, it should read the vault's live asset balance and share supply instead of assuming a fixed exchange rate.
- A token can only have one vault in this factory. If multiple wrappers per token are needed later, that would require a different factory design.
