# Post-mortem: 0xB2 deposited 15,000 USDC and received 0 shares

## Short answer

This is a **bug in our contract**, not a mistake by the depositor. 0xB2 was hit by
the classic **ERC-4626 first-depositor / inflation ("donation") attack**. 0xA1
deliberately engineered it: the 1-unit deposit and the 20,000 USDC raw transfer
were the setup, the 15,000 USDC deposit was the victim, and the redeem was the
payout.

---

## Exactly what happened, step by step

Work in USDC base units (USDC has **6 decimals**, so 1 USDC = 1e6 units).

Our mint formula is:

```
shares = assets * totalShares / totalAssets
```

where `totalAssets` is *the USDC balance the vault currently holds* — i.e. it is
read from `USDC.balanceOf(address(this))`, not from internal accounting. That is
the root cause. Solidity integer division truncates toward zero; there is no
rounding, and no check that the result is non-zero.

**09:12 — 0xA1 deposits 1 unit (0.000001 USDC).**
Share supply is 0, so the bootstrap branch runs: one share per unit deposited.

```
totalShares = 1
totalAssets = 1            (1 unit of USDC)
price per share = 1 unit
```

**09:13 — 0xA1 sends 20,000 USDC directly to the vault address.**
This is a plain `USDC.transfer(vault, 20_000e6)`. It never enters our code, so it
mints nothing — but because `totalAssets` is just `balanceOf(this)`, the vault's
asset count jumps while the share supply stays at 1.

```
totalShares = 1
totalAssets = 20,000,000,001 units
price per share = 20,000.000001 USDC
```

0xA1 has not lost the 20,000: it is now backing their single share. This is the
"inflation" step — the share price was inflated to a value larger than the
victim's entire deposit.

**09:41 — 0xB2 deposits 15,000 USDC (15,000,000,000 units).**

```
shares = 15,000,000,000 * 1 / 20,000,000,001
       = 0.74999999...   →  truncates to 0
```

The function does not revert, because nothing in it says it should. The USDC
transfer-in succeeded, `_mint(0xB2, 0)` is a legal no-op, and the transaction
returns success. 0xB2's 15,000 USDC is now vault assets backing 0xA1's share.
**The rounding loss was not a few wei — it was 100% of the deposit**, because the
price of a single share had been inflated above the deposit size.

```
totalShares = 1        (still only 0xA1's)
totalAssets = 35,000,000,001 units
```

**09:44 — 0xA1 redeems its 1 share.**

```
payout = 1 * 35,000,000,001 / 1 = 35,000.000001 USDC
```

0xA1 put in 20,000.000001 and took out 35,000.000001 — a clean **15,000 USDC
profit**, exactly 0xB2's deposit. The vault is empty and totalShares is 0.

## Why no alarm fired

Three independent defects lined up, and each one alone would have stopped this:

1. **`totalAssets` is `balanceOf(this)`.** Any unsolicited token transfer changes
   the exchange rate. The vault has no way to distinguish "assets deposited
   through `deposit()`" from "assets shoved at the address."
2. **No zero-share guard.** `deposit()` happily mints 0 shares and keeps the
   money. A depositor receiving nothing must be a revert, always.
3. **No virtual offset / no seeded supply.** With `totalShares == 1`, the price
   per share can be pushed arbitrarily high with one donation. The granularity of
   a share is the granularity of the accounting, and one share was worth 20,000
   USDC.

Note also that USDC's 6 decimals make this *much* cheaper than on an 18-decimal
asset: the attacker only had to front 20,000 real USDC, and the "dust" deposit
was 1e-6 USDC rather than 1e-18.

## Is this a depositor mistake?

No. 0xB2 called a public function with a sane amount, the transaction succeeded,
and they had no reasonable way to detect the state they were walking into —
the donation landed 28 minutes earlier and the victim's wallet/UI would have
shown a normal-looking vault. 0xB2 could in principle have simulated the call and
noticed the zero return value, but a vault that silently confiscates a correct
deposit is broken on its own terms. Liability sits with us.

Standard ERC-4626 practice (and OpenZeppelin's implementation since v5) defends
against precisely this; we shipped a hand-rolled mint formula without it.

---

## What we ship

### 1. Stop the bleeding now

The vault is empty (supply 0), so nothing is at risk *right now*, but the exact
same setup can be replayed the moment someone deposits. **Pause deposits
immediately** and redeploy; do not try to patch around it while it's live. If the
vault is not pausable/upgradeable, publish a do-not-use notice and migrate.
Make 0xB2 whole out of treasury — the loss is ours.

### 2. Rebuild on OpenZeppelin's ERC4626 with a decimals offset

Do not hand-roll the conversion math. This keeps us fully ERC-4626 compatible —
the offset is an implementation detail, and `convertToShares`/`previewDeposit`
stay spec-correct.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20}   from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20}  from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UsdcVault is ERC4626 {
    using SafeERC20 for IERC20;

    error ZeroShares();
    error ZeroAssets();
    error BelowMinimumDeposit(uint256 sent, uint256 required);

    /// 10 USDC. Makes a dust-deposit bootstrap impossible and is
    /// irrelevant to real users.
    uint256 public constant MIN_DEPOSIT = 10e6;

    constructor(IERC20 usdc) ERC20("Vault USDC", "vUSDC") ERC4626(usdc) {}

    /// Virtual shares/assets. totalAssets() is treated as (real + 1) and
    /// totalSupply() as (real + 10**offset), so a donation of D inflates the
    /// price by at most a factor bounded by D / 10**offset. With offset 6 the
    /// attacker must donate ~1e6x the victim's deposit to round them to zero,
    /// and every cent of it is redistributed to the victim — the attack costs
    /// more than it earns.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        returns (uint256 shares)
    {
        if (assets < MIN_DEPOSIT) revert BelowMinimumDeposit(assets, MIN_DEPOSIT);
        shares = super.deposit(assets, receiver);
        if (shares == 0) revert ZeroShares();   // belt and braces
    }

    function mint(uint256 shares, address receiver)
        public
        override
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        assets = super.mint(shares, receiver);
        if (assets < MIN_DEPOSIT) revert BelowMinimumDeposit(assets, MIN_DEPOSIT);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAssets();
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        assets = super.redeem(shares, receiver, owner);
        if (assets == 0) revert ZeroAssets();
    }
}
```

What each piece buys us:

| Change | Stops |
|---|---|
| `_decimalsOffset() = 6` (virtual shares/assets) | The inflation itself. Donations get shared with depositors instead of concentrating in the attacker's share. |
| Revert on `shares == 0` / `assets == 0` | The silent confiscation. Even in an unforeseen rounding edge case, the victim's tx reverts and their money stays home. |
| `MIN_DEPOSIT` | The 1-unit bootstrap that makes the share unit coarse in the first place. |
| OZ `ERC4626` rounding (`_convertToShares` floor on deposit, ceil on withdraw) | Rounding dust always accruing to the vault, never to the caller. |
| `SafeERC20` | USDC is upgradeable and blocklist-capable; use safe wrappers for all transfers. |

### 3. Seed the vault at deployment (do this in the deploy script, same tx batch)

Even with the offset, remove the empty-vault state entirely: as part of
deployment, deposit a small amount (e.g. 1,000 USDC) from the protocol treasury
and send those shares to a burn address / leave them permanently locked. Dead
shares mean there is never a `totalSupply == 0` window for anyone to bootstrap
into. Belt, braces, and a second pair of braces — the cost is 1,000 USDC of
permanently locked liquidity.

### 4. Optional, if we ever want donations to be impossible rather than merely unprofitable

Track deposited assets in a storage variable and have `totalAssets()` return that
instead of `balanceOf(this)`, with an explicit permissioned `sweep()`/`harvest()`
for yield and stray tokens. This fully decouples the share price from raw
transfers. It is more code and more invariants to maintain, so I'd ship the
offset + dead shares first; add internal accounting when we start taking real
yield, since at that point we need a controlled way to book gains anyway.

### 5. Tests that must exist before redeploy

- Replay this exact sequence (1 unit → donate 20,000 → deposit 15,000) and assert
  the 15,000 deposit either reverts or mints shares redeemable for ~15,000.
- Fuzz `deposit` across the full uint range against arbitrary prior donations and
  assert `previewDeposit(a) == 0 ⇒ deposit(a) reverts`.
- Invariant: for any sequence of deposits/donations/redeems, no user can redeem
  for more than they deposited plus their pro-rata share of donations.
- Round-trip invariant: `redeem(deposit(x)) <= x` (never favours the user) and
  loses at most 1 unit.

---

## One-line summary for support

> A share-price manipulation attack, not user error: the attacker made the vault
> hold 20,000 USDC against a single share, so 0xB2's 15,000 USDC divided down to
> zero shares and our contract minted nothing instead of reverting. We're
> reimbursing 0xB2, pausing the vault, and redeploying on OpenZeppelin's ERC-4626
> with virtual-share protection, a zero-share revert, and a seeded initial
> deposit.
