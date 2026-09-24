# Incident explanation

0xB2 lost their USDC because the vault was vulnerable to the classic ERC-4626 inflation/donation attack, and the deposit path allowed a successful deposit that minted zero shares.

The important detail is that USDC has 6 decimals, so the amounts in the formula are atomic USDC units:

- `0xA1` deposits `1` unit, i.e. `0.000001 USDC`.
- Because share supply was zero, the vault minted `1` share.
- The vault now has `totalShares = 1` and `totalAssets = 1`.
- `0xA1` then directly transfers `20,000 USDC` to the vault address.
- That is `20,000,000,000` more USDC units.
- The vault now has `totalShares = 1` and `totalAssets = 20,000,000,001`.

That plain ERC-20 transfer was not a deposit, so no new shares were minted. It was a donation to the vault. Since `0xA1` owned the only share, the donation made that single share represent all `20,000.000001 USDC` in the vault.

Then `0xB2` deposited `15,000 USDC`, i.e. `15,000,000,000` units. The vault's mint formula was:

```text
shares = assets * totalShares / currentVaultUSDC
```

If the implementation calculated shares before pulling `0xB2`'s USDC, the denominator was the donated balance:

```text
shares = 15,000,000,000 * 1 / 20,000,000,001
shares = 0
```

If the implementation first pulled `0xB2`'s USDC and then looked at the vault's current balance, the denominator was even larger:

```text
shares = 15,000,000,000 * 1 / 35,000,000,001
shares = 0
```

Solidity integer division rounds down. The mathematically fair result was less than one smallest share unit, so it became exactly zero. The deposit still succeeded because the contract did not reject `shares == 0`. The USDC transfer happened, but the depositor received no accounting claim on the vault.

After `0xB2`'s deposit, the vault held:

```text
20,000.000001 USDC + 15,000 USDC = 35,000.000001 USDC
```

The share supply was still `1`, and `0xA1` still owned that one share. When `0xA1` redeemed it, they owned 100% of the share supply and received 100% of the assets: `35,000.000001 USDC`.

# Bug or depositor mistake?

This is a contract bug, not a depositor mistake.

The depositor called the intended `deposit` function and the transaction succeeded. A vault must not accept assets while minting zero shares unless the caller explicitly requested behavior that can do that, which they did not here. ERC-4626 conversions commonly round down, but the implementation still has to protect users from pathological zero-share deposits and donation-inflated exchange rates.

The root problem is that the initial share supply was too small and the vault used its raw token balance as `totalAssets`. A direct token transfer can therefore manipulate the asset/share exchange rate without minting shares. With only one share outstanding, the attacker made the price of one share larger than the victim's whole deposit, causing the victim's minted share amount to round down to zero.

# Fix to ship

Ship an ERC-4626-compatible implementation that rejects zero-share deposits and uses the standard ERC-4626 conversion model with inflation protection.

At minimum, `deposit` and `mint` must check the result and revert if the user would receive zero shares:

```solidity
uint256 shares = previewDeposit(assets);
if (shares == 0) revert ZeroShares();
```

Also expose/use the ERC-4626 slippage-safe pattern: callers should be able to require a minimum number of shares, or use a router/wrapper that checks `shares >= minShares`. That prevents successful deposits when the exchange rate has been moved against the depositor.

The stronger fix is to add the OpenZeppelin-style ERC-4626 inflation defense: virtual shares/assets, usually combined with extra share precision. Conceptually:

```text
shares = assets * (totalSupply + virtualShares) / (totalAssets + virtualAssets)
```

This keeps the vault ERC-4626 compatible while making first-deposit donation attacks uneconomical and preventing tiny initial supply from letting an attacker force later deposits to round to zero. Direct token transfers may still increase `totalAssets`, as ERC-4626 permits, but they should not let an attacker steal later deposits through zero-share minting.
