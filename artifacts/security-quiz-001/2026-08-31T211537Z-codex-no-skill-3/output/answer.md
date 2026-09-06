This is a vault bug, not a depositor mistake.

The failure mode is the classic ERC-4626 "inflation" or "donation" attack caused by using the vault's raw token balance as the denominator when converting assets to shares, combined with integer rounding down and no check that a deposit mints at least 1 share.

Reasoning

USDC has 6 decimals, so the on-chain units are:

- `1` = `0.000001 USDC`
- `20,000 USDC` = `20,000,000,000`
- `15,000 USDC` = `15,000,000,000`

State after the first deposit:

- `totalShares = 1`
- vault USDC balance = `1`

Then `0xA1` sends `20,000,000,000` USDC units directly to the vault address. That is a plain ERC-20 transfer, so the vault's balance becomes:

- vault USDC balance = `20,000,000,001`
- `totalShares` is still `1`

Nothing in the share ledger changed, but your mint formula uses the vault's current USDC balance:

`shares = assets * totalShares / vaultBalance`

So when `0xB2` deposits `15,000,000,000` units, the minted shares are:

`shares = 15,000,000,000 * 1 / 20,000,000,001`

Because Solidity integer division rounds down:

`shares = floor(0.7499999999625...) = 0`

So `0xB2` transferred in real USDC, but the vault minted `0` shares. The transaction succeeded because the contract apparently allows a successful deposit even when `shares == 0`.

After that deposit:

- vault USDC balance = `35,000,000,001`
- `totalShares = 1`
- `0xA1` still owns the only share

When `0xA1` redeems that 1 share, redemption is pro rata:

`assetsOut = sharesBurned * vaultBalance / totalShares`

So:

`assetsOut = 1 * 35,000,000,001 / 1 = 35,000,000,001`

That is `35,000.000001 USDC`, which matches the observed outcome.

Why this is your bug

`0xB2` did not make a "wrong" ERC-20 transfer. They called `deposit(15,000 USDC)` and your contract accepted the assets. A vault must not silently take assets and mint zero shares. The direct transfer by `0xA1` was adversarial, but ERC-20 tokens can always be transferred directly to a vault address, so the vault has to be safe in the presence of unsolicited donations.

So the root cause is:

- share pricing depends on `asset.balanceOf(address(this))`, which an attacker can change without calling the vault
- deposit rounding can produce `0`
- deposit does not revert when `0` shares would be minted

That makes this a contract bug exploitable by an attacker, not a user mistake by `0xB2`.

What to ship

Ship both of these changes:

1. Revert any deposit that would mint zero shares.

That is the direct fix for the loss pattern above. If `previewDeposit(assets) == 0`, `deposit` must revert before taking funds or must revert after computing `shares == 0` so the whole transaction rolls back and the token transfer is undone.

In practice:

```solidity
uint256 shares = previewDeposit(assets);
require(shares != 0, "ZERO_SHARES");
```

This remains ERC-4626 compatible. `previewDeposit` can still return `0`; `deposit` is allowed to revert.

2. Add the standard ERC-4626 inflation-attack mitigation: virtual shares and virtual assets, typically with a decimals offset.

Instead of converting with only raw `totalSupply()` and raw `totalAssets()`, use a formula equivalent to OpenZeppelin's hardened ERC-4626 math:

```solidity
shares = assets.mulDiv(
    totalSupply() + 10 ** _decimalsOffset(),
    totalAssets() + 1,
    Math.Rounding.Down
);
```

and the inverse for assets.

This keeps the vault ERC-4626 compatible while making first-deposit / donation manipulation unprofitable or far more expensive, because the attacker no longer gets to own essentially 100% of the share supply after seeding with 1 unit.

Bottom line

- `0xB2` got zero shares because `15,000,000,000 * 1 / 20,000,000,001` rounded down to `0`.
- The deposit succeeded because your contract did not reject zero-share mints.
- The attacker then redeemed the only existing share and legally drained the entire vault balance.
- This is a vault design bug, specifically the ERC-4626 donation/inflation attack surface.
- Minimum safe fix: revert on `shares == 0`.
- Correct ERC-4626 hardening: also add virtual shares/assets with a decimals offset so unsolicited token donations cannot create this near-empty-vault attack window.
