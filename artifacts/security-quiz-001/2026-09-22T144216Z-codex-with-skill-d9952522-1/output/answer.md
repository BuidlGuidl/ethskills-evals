0xB2 was hit by a first-depositor donation/inflation attack.

The key detail is that the vault uses the vault's live USDC balance as
`totalAssets`, including USDC sent directly to the vault outside the deposit
function. The attack sequence made one existing share represent an enormous
amount of USDC before 0xB2 deposited.

Step by step, in USDC base units:

1. 0xA1 deposits `1` base unit, i.e. `0.000001 USDC`.
   Since `totalShares == 0`, the vault mints one share per unit deposited.

   Result:

   - assets held: `1`
   - total shares: `1`
   - 0xA1 shares: `1`

2. 0xA1 transfers `20,000 USDC` directly to the vault address.
   This is not a deposit, so no new shares are minted.

   `20,000 USDC = 20,000,000,000` base units.

   Result:

   - assets held: `20,000,000,001`
   - total shares: `1`
   - 0xA1 shares: `1`

3. 0xB2 deposits `15,000 USDC`.

   `15,000 USDC = 15,000,000,000` base units.

   The vault calculates shares as:

   ```solidity
   shares = assets * totalShares / totalAssets;
   ```

   So 0xB2's share amount is:

   ```text
   15,000,000,000 * 1 / 20,000,000,001 = 0
   ```

   Solidity integer division rounds down, so the fractional share is truncated
   to zero. The USDC transfer still succeeds, and because the contract does not
   reject a zero-share mint, the deposit transaction succeeds while crediting
   0xB2 with no shares.

   After 0xB2's deposit:

   - assets held: `35,000,000,001`
   - total shares: `1`
   - 0xB2 shares: `0`

4. 0xA1 redeems its one share.

   Since that one share is now 100% of the share supply, it receives 100% of
   the vault assets:

   ```text
   35,000,000,001 base units = 35,000.000001 USDC
   ```

This is a bug in the vault, not a depositor mistake. Direct ERC-20 transfers
to a vault address are always possible, so a vault must not let a donation
manipulate the share price so severely that later deposits can be rounded to
zero while still accepting the assets.

The fix should be ERC-4626-compatible: use the standard ERC-4626 accounting
model with virtual assets and virtual shares, preferably by inheriting from a
well-reviewed implementation such as OpenZeppelin `ERC4626` with a share
decimal offset. The conversion should be based on a formula of this shape:

```solidity
shares = assets.mulDiv(
    totalSupply() + virtualShares,
    totalAssets() + virtualAssets,
    Math.Rounding.Floor
);
```

with matching logic for asset conversion on redemption.

OpenZeppelin's ERC-4626 mitigation effectively uses a virtual asset and extra
virtual share precision, so the first depositor cannot cheaply create a
dangerous exchange rate. A direct donation then benefits all shares, including
the virtual shares, instead of letting one real share capture the entire
rounding surface. That makes this attack uneconomic and prevents ordinary
deposits from minting zero shares under attacker-controlled inflation.

As an additional guardrail, the deposit path should reject `shares == 0`.
That protects users from accidental zero-share deposits and is consistent with
ERC-4626 behavior because a deposit that cannot mint any shares should not be
accepted. The primary fix, though, is the virtual asset/share offset; merely
reverting on zero shares avoids this exact loss but still leaves the vault's
empty-state exchange rate manipulable and vulnerable to denial of service.
