This is a vault bug, not a depositor mistake.

The failure mode is the classic ERC-4626 "donation" or "inflation" attack against an empty or nearly-empty vault, combined with integer truncation.

## What happened

Let:

- `totalShares` = current vault share supply
- `totalAssets` = current USDC balance of the vault
- deposit minting formula = `assets * totalShares / totalAssets`, rounded down

### 1. 0xA1 seeded the vault at an extremely low share supply

At 09:12, the vault was empty, so the special-case path applied:

- 0xA1 deposited `1` base unit of USDC = `0.000001 USDC`
- because `totalShares == 0`, they received `1` share

State after that:

- `totalShares = 1`
- `totalAssets = 1`
- 1 share is worth `0.000001 USDC`

### 2. 0xA1 donated assets directly to the vault

At 09:13, 0xA1 transferred `20,000 USDC` directly to the vault address, without calling `deposit`.

That changes `totalAssets`, but not `totalShares`:

- `totalShares = 1`
- `totalAssets = 20,000.000001 USDC`

So now the single existing share represents the entire vault.

### 3. 0xB2 deposited when the price per share was enormous

At 09:41, 0xB2 deposited `15,000 USDC`.

Using the vault's mint formula at the time of deposit:

`shares = assets * totalShares / totalAssets`

So:

`shares = 15,000 * 1 / 20,000.000001`

In base units:

`shares = 15,000,000,000 * 1 / 20,000,000,001`

This is less than `1`, so with Solidity integer division rounding down:

`shares = 0`

That is exactly why 0xB2 got zero shares.

The transaction still succeeded because the vault apparently allows:

- taking custody of the assets first, and/or
- finalizing the deposit even when the computed share amount is `0`

No arithmetic exception occurs here. The result is a valid integer result: zero.

### 4. 0xA1 then redeemed the only share in existence

After 0xB2's deposit, the vault held:

- initial seed: `0.000001 USDC`
- donation: `20,000 USDC`
- 0xB2 deposit: `15,000 USDC`

Total:

- `35,000.000001 USDC`

But share supply was still:

- `1`

because 0xB2 minted `0`.

So when 0xA1 redeemed its `1` share, it owned `100%` of the share supply and received the entire vault balance:

- `35,000.000001 USDC`

## Why this is a contract bug

0xB2 did not misuse the vault in any special way. They called `deposit` normally. A correct ERC-4626 vault must not silently accept assets and mint zero shares.

The immediate cause is:

1. the vault uses the live token balance as `totalAssets`, so unsolicited ERC-20 transfers reprice shares
2. the vault rounds share minting down
3. the vault does not revert when the computed share amount is zero

That combination lets an attacker set an arbitrarily bad exchange rate for the next depositor and cause their deposit to round down to zero.

So this is a protocol design bug in the vault, not a user mistake by 0xB2.

## What to ship

Ship an ERC-4626-compatible fix that makes this attack impossible in practice:

1. Revert if a deposit would mint zero shares.
2. Add virtual shares and virtual assets to the conversion math, as used by hardened ERC-4626 implementations.

### Minimum safety check

On `deposit`, compute shares first and revert unless `shares > 0`.

That prevents the exact "assets taken, zero shares minted" failure.

### Robust ERC-4626 fix

Use ERC-4626-style conversion with offsets, for example:

- `convertToShares(assets) = assets * (totalSupply + VIRTUAL_SHARES) / (totalAssets + VIRTUAL_ASSETS)`
- `convertToAssets(shares) = shares * (totalAssets + VIRTUAL_ASSETS) / (totalSupply + VIRTUAL_SHARES)`

with small nonzero constants such as:

- `VIRTUAL_ASSETS = 1`
- `VIRTUAL_SHARES = 10^offset` for a chosen share-decimal offset

This preserves ERC-4626 behavior while preventing a tiny initial deposit plus external donation from making the next honest deposit round to zero.

## Bottom line

0xB2 received zero shares because the vault valued shares using the vault's current USDC balance, which had been inflated by 0xA1's direct token transfer, and then rounded `15,000 * 1 / 20,000.000001` down to `0`.

That is a vault bug. The depositor made a normal deposit and the contract should have reverted rather than accept funds for zero shares.

The fix is to keep ERC-4626 semantics but harden the math: revert on zero-share mints and use virtual-share/virtual-asset offsets in the conversion functions so donation-based inflation cannot create this trap.
