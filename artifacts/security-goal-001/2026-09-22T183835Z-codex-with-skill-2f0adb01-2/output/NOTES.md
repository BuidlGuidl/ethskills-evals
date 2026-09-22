# Save Any Token Vault Notes

## Depositor Claims

Each vault holds exactly one ERC-20 asset. The receipt token is a transferable share token: a holder's claim is their share balance divided by total shares, applied to the vault's current asset balance.

In code, the read helpers use virtual accounting to make first-deposit donation attacks uneconomical:

```text
shares = assets * (totalSupply + 1) / (totalAssets + 1)
assets = shares * (totalAssets + 1) / (totalSupply + 1)
```

Deposits measure the vault balance before and after `transferFrom`, then mint shares from the amount actually received. That makes deposits safe for tokens that take a transfer fee, although those tokens can still be unpleasant UX. Withdrawals and redemptions burn shares first, then transfer assets out.

Yield is just an increase in `totalAssets`. When the keeper sends more of the underlying token to the vault, no new receipt shares are minted, so every existing share becomes redeemable for more underlying. Very small donations can be partly absorbed by the virtual share/asset offset; for normal deposits this effect is negligible, and it is the cost that blocks inflation attacks.

## Listing And Keeper Operations

The factory is permissionless and creates one canonical vault per asset address. The first lister supplies the receipt token name and symbol, so operators should verify the exact mainnet token address and choose unambiguous metadata such as `Save USDC` / `svUSDC`.

Operators should treat "any ERC-20" as "any token that users understand the risks of":

- Prefer plain, non-rebasing ERC-20s with reliable `balanceOf`, `transfer`, and `transferFrom` behavior.
- Fee-on-transfer tokens work on deposit because the vault mints against actual received assets, but withdrawals may deliver less to users if the token charges fees on outgoing transfers.
- Rebasing, blocklisted, pausable, upgradeable, or otherwise admin-controlled tokens can change user outcomes outside the vault's control.
- Do not run the keeper before a vault has meaningful user deposits. Tokens sent to an empty vault become prior donations and are not fully claimable by the first depositor because of virtual accounting.
- The keeper should transfer only the matching underlying asset directly to that asset's vault. It should not call deposit, mint receipt shares, or send unrelated tokens.
- Frontends and operators should use the preview functions plus the slippage-protected overloads: `deposit(assets, receiver, minShares)`, `withdraw(assets, receiver, owner, maxShares)`, and `redeem(shares, receiver, owner, minAssets)`.

