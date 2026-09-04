The loss was caused by an ERC-4626 inflation attack triggered by a direct token donation to the vault.

Reasoning

1. At `09:12`, `0xA1` deposited `1` base unit of USDC.
   USDC has 6 decimals, so this was `0.000001 USDC`.
   Because `totalShares == 0`, your vault minted `1` share per unit deposited, so:
   - vault assets = `1`
   - total shares = `1`
   - `0xA1` owns `1/1` of the vault

2. At `09:13`, `0xA1` sent `20,000 USDC` directly to the vault address.
   This was not a `deposit`, so no new shares were minted.
   The vault now held:
   - prior assets: `1`
   - donated assets: `20,000 * 10^6 = 20,000,000,000`
   - total assets seen by the vault math: `20,000,000,001`
   - total shares still: `1`

3. At `09:41`, `0xB2` deposited `15,000 USDC`.
   In base units that is `15,000 * 10^6 = 15,000,000,000`.
   Your mint formula is:

   ```text
   shares = assets * totalShares / vaultBalance
   ```

   Substituting the live state at the time of the deposit:

   ```text
   shares = 15,000,000,000 * 1 / 20,000,000,001
          = 0.74999999996...
   ```

   Solidity integer division rounds down, so the vault minted:

   ```text
   shares = 0
   ```

4. The transaction still succeeded because nothing in the described logic required `shares > 0`.
   So the contract accepted `0xB2`'s USDC, updated the vault's token balance, and minted zero shares.
   After that deposit:
   - vault assets = `35,000,000,001`
   - total shares = still `1`
   - `0xB2` owns `0` shares
   - `0xA1` still owns `100%` of the shares

5. At `09:44`, `0xA1` redeemed its `1` share.
   Redemption is pro rata, and `0xA1` owned `1 / 1` shares, so it received the entire vault balance:
   - `35,000,000,001` base units
   - `35,000.000001 USDC`

Why `0xB2` got zero shares

`0xB2` got zero shares because your share-conversion formula uses the vault's current token balance as the denominator, and direct token transfers can increase that balance without increasing `totalShares`. Once `0xA1` donated enough USDC, the exchange rate became so expensive that `0xB2`'s deposit no longer bought even one whole share. Since Solidity rounds down, the result became zero instead of a fractional share.

Bug or user mistake

This is a contract bug, not a depositor mistake.

`0xB2` used the vault exactly as intended by calling `deposit(15,000 USDC)`. An ERC-4626-style vault must not silently accept assets and mint zero shares because someone previously transferred tokens directly to the vault. The depositor did not misuse the contract; the contract's accounting is manipulable by donations and does not defend against rounding-to-zero deposits.

What to ship

Ship the standard ERC-4626 inflation-attack mitigation: virtual shares and virtual assets in the conversion functions, instead of pricing shares directly from the raw live balance alone.

Conceptually:

```solidity
shares = assets.mulDiv(
    totalSupply() + VIRTUAL_SHARES,
    totalAssets() + VIRTUAL_ASSETS,
    Math.Rounding.Down
);
```

and the inverse conversion should use the same offset model.

This keeps the vault ERC-4626 compatible because ERC-4626 defines conversion behavior in terms of `convertToShares`, `convertToAssets`, `previewDeposit`, `previewMint`, and related functions; it does not require the vulnerable raw-balance formula. In practice, the safest path is to use OpenZeppelin's ERC-4626 implementation with its virtual-offset defense.

Also add an explicit revert if a deposit would mint zero shares, for example:

```solidity
require(previewDeposit(assets) != 0, "ZERO_SHARES");
```

That revert is important, but it is not sufficient by itself. Reverting on zero shares prevents silent loss for the current depositor, but without the virtual offset the vault still remains griefable and manipulable by donations. The full fix is:

1. Use ERC-4626 conversion math with virtual assets and virtual shares.
2. Revert if a deposit or mint would produce zero shares.

Bottom line

`0xA1` exploited a known vault-inflation design flaw:
small initial deposit -> large direct donation -> victim deposit rounds to zero shares -> attacker redeems all assets.

So the incident was caused by a bug in the vault's share-accounting design. The correct remediation is to adopt the standard ERC-4626 virtual-offset defense and reject zero-share deposits.
