This is a contract bug, not a user mistake.

The vault was vulnerable to the standard ERC-4626 inflation/donation attack:

1. `0xA1` deposited `1` USDC base unit.
   With `totalShares == 0`, your rule gives the first depositor `1` share per unit deposited, so:
   - assets in vault = `1`
   - total shares = `1`
   - `0xA1` owns `100%` of the shares

2. `0xA1` then sent `20,000 USDC` directly to the vault address.
   That was a plain ERC-20 transfer, so it increased the vault's USDC balance but did not mint any shares.
   After that:
   - assets in vault = `20,000.000001 USDC`
   - total shares = `1`
   - `0xA1` still owns `100%` of the shares

   So the share price was now:
   - `1 share = 20,000.000001 USDC`

3. When `0xB2` deposited `15,000 USDC`, the vault minted shares using:

   ```text
   shares = assets * totalShares / vaultAssets
   ```

   Plugging in the numbers in USDC base units:

   ```text
   assets      = 15,000,000000
   totalShares = 1
   vaultAssets = 20,000,000001

   shares = floor(15,000,000000 * 1 / 20,000,000001)
          = floor(0.7499999999625...)
          = 0
   ```

   Solidity integer division truncates toward zero, so `0xB2` was entitled to `0` shares under your formula.

4. Because the deposit path did not revert when `shares == 0`, the transaction still succeeded:
   - USDC was transferred from `0xB2` into the vault
   - `0xB2` received `0` shares
   - total shares stayed `1`

   At that point the vault held:
   - `20,000.000001 + 15,000 = 35,000.000001 USDC`
   - total shares still `1`

5. `0xA1` then redeemed its single share.
   Since it owned `1 / 1 = 100%` of the shares, it correctly received `100%` of the assets:
   - `35,000.000001 USDC`

Why `0xB2` ended up with zero shares while the deposit succeeded

- The donation changed the exchange rate without changing `totalShares`.
- Your share-minting formula rounds down.
- The post-donation price of one share was greater than `0xB2`'s deposit.
- The contract accepted an asset deposit even when the computed share output was zero.

This was not a mistake by `0xB2`.

`0xB2` used the public `deposit` entrypoint exactly as intended. A correct ERC-4626-style vault must not allow an attacker to donate assets and thereby force later depositors into a successful zero-share deposit. The loss was caused by the vault's accounting design.

What to ship

Ship the standard ERC-4626 inflation-attack mitigation: virtual shares and virtual assets in the conversion math, as used by modern OpenZeppelin ERC-4626.

Conceptually:

```solidity
shares = assets.mulDiv(
    totalSupply() + VIRTUAL_SHARES,
    totalAssets() + VIRTUAL_ASSETS,
    Math.Rounding.Down
);
```

and the inverse for assets-per-share conversions.

Typical form:

```solidity
// Example shape, matching the OZ defense
convertToShares(assets) =
    assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(), totalAssets() + 1, Math.Rounding.Down);

convertToAssets(shares) =
    shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), Math.Rounding.Down);
```

Why this fixes the attack:

- The attacker no longer starts from a state where `1` real share owns effectively all future donations.
- Part of any donation is absorbed by the virtual offset instead of fully accruing to the attacker.
- Manipulating the exchange rate enough to zero out a victim's deposit becomes prohibitively expensive.
- This remains ERC-4626 compatible because the vault still exposes the standard `deposit`, `mint`, `withdraw`, `redeem`, `convertToShares`, `convertToAssets`, `preview*`, and `totalAssets` behavior.

Recommended hardening

Also make `deposit` and `mint` revert if the computed output is zero.

That does not solve the inflation attack by itself, but it prevents the worst possible UX failure mode: taking assets and minting no shares. The virtual-offset fix is the real economic defense; the zero-output revert is a necessary guardrail.

Bottom line

- `0xA1` executed an inflation/donation attack.
- `0xB2` lost funds because the vault accepted a deposit whose rounded-down share result was zero.
- The root cause is the vault contract's share-accounting logic, not depositor error.
- The correct ERC-4626-compatible fix is to adopt virtual shares/assets conversion math, and additionally revert zero-share deposits.
