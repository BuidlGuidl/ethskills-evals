# Incident analysis

`0xB2` got `0` shares because the vault priced its deposit against the vault's **current USDC balance**, which already included `0xA1`'s unsolicited `20,000 USDC` transfer, and then rounded the share mint **down**.

## Step by step

Initial state:

- Vault assets: `0`
- Vault shares: `0`

### 1. `0xA1` seeds the vault with the smallest possible deposit

`0xA1` calls `deposit(1)`, meaning `1` USDC base unit = `0.000001 USDC`.

Because `totalShares == 0`, your special case mints `1` share per unit deposited:

- Assets in vault: `1`
- Total shares: `1`
- `0xA1` shares: `1`

### 2. `0xA1` donates `20,000 USDC` directly to the vault

This is a plain ERC-20 transfer, so the vault code does not run, but the vault's token balance changes.

- Assets in vault: `20,000.000001 USDC`
- Total shares: `1`
- `0xA1` still owns `100%` of shares

Economically, that single share now claims the entire vault.

### 3. `0xB2` deposits `15,000 USDC`

Your mint formula is:

`shares = assets * totalShares / vaultBalance`

At that moment:

- `assets = 15,000 USDC`
- `totalShares = 1`
- `vaultBalance = 20,000.000001 USDC`

So:

`shares = 15,000 * 1 / 20,000.000001 = 0.749999999...`

Because Solidity integer division rounds down, the result is:

`shares = 0`

So the transaction succeeds, transfers in `15,000 USDC`, and mints no shares.

After that deposit:

- Assets in vault: `35,000.000001 USDC`
- Total shares: `1`
- `0xA1` still owns the only share
- `0xB2` owns `0` shares

### 4. `0xA1` redeems its `1` share

Redeem pays the holder's pro-rata share of vault assets. Since `0xA1` owns `1 / 1` shares, it receives the entire vault:

- Payout: `35,000.000001 USDC`

That includes:

- its original dust deposit,
- its `20,000 USDC` donation,
- all `15,000 USDC` deposited by `0xB2`.

## Is this a user mistake or a contract bug?

It is a **contract bug**.

`0xB2` did not misuse the interface in any special way; they called `deposit`, the vault accepted their assets, and the vault itself decided to mint `0` shares without reverting. A compliant vault must not silently accept assets for zero shares.

The direct token transfer from `0xA1` was allowed ERC-20 behavior, and ERC-4626 vaults are expected to be robust to changes in `totalAssets()` caused by donations. The bug is that your conversion logic makes the exchange rate manipulable when supply is tiny, and your `deposit` path permits zero-share mints due to rounding down.

This is the standard ERC-4626 **inflation attack** / **donation attack**.

## Why it happened

Two design choices combined badly:

1. Share pricing used the live token balance, so unsolicited donations immediately changed the exchange rate.
2. Deposit minting rounded down and did not revert when the rounded result was zero.

With only `1` share outstanding, an attacker could make each new share expensive enough that a normal-sized deposit computed to less than `1` share and therefore rounded to `0`.

## What to ship

Ship the standard ERC-4626 mitigation: **virtual shares and virtual assets** in the conversion functions, and keep the ERC-4626 rounding rules.

Use conversions equivalent to:

- `convertToShares(assets) = assets * (totalSupply + VIRTUAL_SHARES) / (totalAssets + VIRTUAL_ASSETS)`
- `convertToAssets(shares) = shares * (totalAssets + VIRTUAL_ASSETS) / (totalSupply + VIRTUAL_SHARES)`

with non-zero constants, commonly chosen so the initial exchange rate is safe and precise.

This prevents a tiny initial depositor from making later deposits round to zero via donation, because the attacker no longer controls the full price curve with a single real share.

Also make `deposit` / `mint` revert if the computed shares or assets are zero when the caller supplied a non-zero amount. That is still ERC-4626 compatible and prevents silent loss from rounding.

## Bottom line

`0xB2` lost funds because the vault was exploitable, not because they made a user error. The precise failure was:

- attacker mints `1` real share cheaply,
- attacker donates assets to inflate assets-per-share,
- victim deposit computes to `< 1` share,
- integer rounding floors that to `0`,
- victim's assets stay in the vault,
- attacker redeems the only share and drains everything.

The fix is to harden the ERC-4626 math with virtual offsets and reject zero-share deposits.
