This is a contract bug, not a depositor mistake.

The vault was vulnerable to the ERC-4626 empty-vault donation/inflation attack:

1. At `09:12`, `0xA1` deposited `1` base unit of USDC (`0.000001 USDC`).
   Because `totalShares == 0`, the vault used its special case and minted `1` share.
   State after this step:
   - `totalAssets = 1`
   - `totalShares = 1`
   - `0xA1` owns `100%` of the shares

2. At `09:13`, `0xA1` transferred `20,000 USDC` directly to the vault address.
   This did not mint any new shares, but it increased `totalAssets` as seen by the vault balance.
   State after this step:
   - `totalAssets = 20,000,000001` USDC units
   - `totalShares = 1`
   - each share now claims essentially `20,000.000001 USDC`

3. At `09:41`, `0xB2` deposited `15,000 USDC`.
   The mint formula was:

   ```text
   shares = assets * totalShares / totalAssets
   ```

   Plugging in the values just before `0xB2`'s deposit:

   ```text
   shares = 15,000 USDC * 1 share / 20,000.000001 USDC
          = 0.749999999... shares
   ```

   Shares are integers, so the vault rounded down to:

   ```text
   shares = 0
   ```

   Since the implementation did not reject zero-share mints, the transaction succeeded, `0xB2`'s USDC was transferred in, and `0xB2` received no ownership in return.

4. After `0xB2`'s deposit, the vault held `35,000.000001 USDC` and still had only `1` share outstanding, all owned by `0xA1`.
   When `0xA1` redeemed that `1` share at `09:44`, they were entitled to `100%` of vault assets, so they withdrew the full `35,000.000001 USDC`.

Why this happened:

- The contract priced new shares from `balanceOf(vault)` / `totalShares`.
- A plain ERC-20 transfer can increase `totalAssets` without increasing `totalShares`.
- In a nearly empty vault, that lets the first shareholder donate assets, move the price per share arbitrarily high, and force later small-enough deposits to round to zero.

So `0xB2` did not make an unusual mistake. Sending `15,000 USDC` to `deposit` and expecting shares is normal behavior. The bug is that the vault accepted a deposit that minted `0` shares under a manipulable exchange rate.

What to ship:

Use the standard ERC-4626 mitigation: virtual shares and virtual assets in the conversion math, rather than the raw:

```text
assets * totalSupply / totalAssets
```

In practice, use OpenZeppelin ERC-4626's defended conversion approach, e.g. conceptually:

```text
shares = assets.mulDiv(totalSupply + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS, rounding)
assets = shares.mulDiv(totalAssets + VIRTUAL_ASSETS, totalSupply + VIRTUAL_SHARES, rounding)
```

with a decimals offset so the vault starts with meaningful virtual precision. This keeps the vault ERC-4626 compatible and makes direct donations unable to create the catastrophic empty-vault exchange-rate spike seen here.

Also add a guard that reverts if a deposit would mint `0` shares. That is good hygiene, but by itself it is not the full fix:

- without virtual assets/shares, an attacker can still grief or front-run small depositors into reverts;
- with the virtual offset, the vault becomes robust against this inflation attack while remaining ERC-4626 compatible.

Recommended outcome:

- Replace the hand-rolled vault math with OpenZeppelin `ERC4626`'s protected conversion logic, or implement the same virtual-share/virtual-asset defense exactly.
- Ensure `deposit`/`mint` revert on zero-share results.
- Add tests for:
  - first depositor followed by direct donation;
  - small subsequent deposits;
  - `previewDeposit` and `deposit` consistency after donations;
  - redeem/withdraw behavior around rounding edges.

Root cause summary:

`0xA1` exploited a vault-design flaw. The direct transfer was allowed by ERC-20 semantics, but the loss occurred because the contract treated donated assets as immediately backing the existing shares and allowed a later deposit to succeed even when integer rounding produced `0` new shares.
