# Post-mortem: 0xB2 deposited 15,000 USDC and received 0 shares

## Short answer

This is the **ERC-4626 first-depositor / donation ("inflation") attack**. It is a bug in
our vault, not a mistake by the depositor. 0xA1 deliberately set the share price so high
that 0xB2's mint calculation rounded down to zero, and our contract minted zero shares
without reverting. The fix is a virtual shares/assets offset in the conversion math,
plus a `shares > 0` guard — both of which keep us ERC-4626 compatible.

---

## 1. Exactly how 0xB2 ended up with zero shares

USDC has **6 decimals**, so all figures below are in base units (1 USDC = 1e6).

Our mint formula is

```
sharesMinted = assets * totalShares / totalAssets        // totalAssets = USDC balance of the vault
```

Solidity has no floating point. `/` is **integer division that truncates toward zero**.
There is no rounding, no fractional share, and — critically — no error when the result
is 0. That single property is the whole exploit.

Step by step:

| # | Action | totalAssets (units) | totalShares | Effect |
|---|--------|--------------------|-------------|--------|
| 1 | 0xA1 `deposit(1)` | 1 | 1 | supply was 0, so the bootstrap branch mints 1 share per unit |
| 2 | 0xA1 sends 20,000 USDC **directly** to the vault address | 20,000,000,001 | 1 | plain ERC-20 `transfer` — no vault code runs, no shares minted |
| 3 | 0xB2 `deposit(15,000 USDC)` | see below | 1 | **mints 0 shares** |
| 4 | 0xA1 `redeem(1)` | 35,000,000,001 | 1 | 0xA1 owns 1 of 1 shares = 100% |

The arithmetic at step 3:

```
assets      = 15_000_000_000        (15,000 USDC)
totalShares = 1
totalAssets = 20_000_000_001        (0xA1's 1 unit + the 20,000 USDC donation)

sharesMinted = 15_000_000_000 * 1 / 20_000_000_001
             = 0.749999...          → truncates to 0
```

(If our implementation reads the balance *after* pulling 0xB2's tokens in, the result is
the same: `15_000_000_000 * 1 / 35_000_000_001 = 0`. Either ordering gives zero. The
ordering matters for the general fix, not for this outcome.)

So `deposit` did exactly what it was written to do: it pulled 15,000 USDC via
`transferFrom`, computed 0, called `_mint(0xB2, 0)`, emitted an event, and returned
successfully. Nothing reverted because nothing in the code said "a zero mint is wrong."

Step 4 then pays out the pro-rata slice:

```
assetsOut = 1 share * 35_000_000_001 / 1 share = 35_000_000_001
          = 35,000.000001 USDC
```

0xA1 put in 20,000.000001 USDC and took out 35,000.000001 — a profit of **exactly
15,000 USDC, which is precisely 0xB2's deposit**. The vault is empty and 0xB2's share
balance is legitimately, permanently zero. There is nothing to redeem.

### The key mechanism, stated plainly

The vault derives share price from `token.balanceOf(address(this))`. That number can be
increased by **anyone, at any time, without interacting with our contract**, by sending
a plain ERC-20 transfer. We have no hook on incoming transfers and no way to reject them.
That makes the share price an attacker-controlled input. By donating, 0xA1 inflated the
price of one share to ~20,000 USDC; any deposit smaller than one share's worth rounds to
zero, and everything that rounds away is silently gifted to the existing shareholders —
in this case, the attacker, who was the only shareholder.

---

## 2. Is this our bug or the depositor's mistake?

**Ours.** Three independent defects, all in our code:

1. **Rounding loss is unbounded and silent.** Truncation in a share mint is normal and
   unavoidable — but it must cost the depositor at most 1 unit of dust, not 100% of the
   deposit. Ours can round away the entire amount because the divisor is attacker-set.
2. **No `shares > 0` check.** A deposit that mints nothing is, by any reading, a failed
   deposit. We let it succeed and keep the money.
3. **No protection on the empty-vault state.** A vault with 1 wei of assets and 1 share
   is the maximally fragile configuration for `mulDiv`, and we ship with it reachable by
   the first caller.

0xB2 did nothing unusual: they called `deposit` on a verified mainnet contract with a
normal amount. They had no practical way to detect the manipulation — the donation
landed 28 minutes earlier, and a front-end quote taken before 09:13 would have shown a
sane share count. Even a careful user simulating the call would see it succeed. This
is a known, catalogued vulnerability class (it is why OpenZeppelin added the decimals
offset to `ERC4626` in v5), not an exotic edge case. We owe 0xB2 a remediation.

Note also that had 0xA1 sized the donation a little differently, 0xB2 would have
received 1 share instead of 0 and lost "only" ~50% — so a naive `require(shares > 0)`
alone converts theft into a revert in the extreme case but still leaves a large partial
theft available. The rounding itself has to be made economically irrelevant.

---

## 3. What we ship

### Fix A (primary): virtual shares and virtual assets

Add a constant offset to both sides of the ratio so the vault behaves as if it always
holds a small amount of phantom assets backed by phantom shares. This removes the
`0 / tiny` regime entirely and makes donation attacks lose money.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UsdcVault is ERC4626 {
    constructor(IERC20 usdc) ERC20("USDC Vault", "vUSDC") ERC4626(usdc) {}

    /// Virtual shares/assets offset. Share price starts at 1e6 phantom shares per
    /// phantom asset, so rounding can never hand a meaningful amount to an attacker.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
```

OpenZeppelin v5's `ERC4626` already implements the mitigation; `_decimalsOffset()`
controls its strength. Conceptually the math becomes:

```solidity
shares = assets.mulDiv(totalSupply() + 10 ** _decimalsOffset(),
                       totalAssets() + 1,
                       Math.Rounding.Floor);   // floor on mint — in the vault's favour

assets = shares.mulDiv(totalAssets() + 1,
                       totalSupply() + 10 ** _decimalsOffset(),
                       Math.Rounding.Floor);   // floor on redeem
```

**Directionality matters as much as the offset:** mint must round *down* and withdraw
must round *up* (in shares burned), so every rounding error accrues to the vault, never
to the caller. Getting one of these backwards reintroduces a drain.

Replaying the exact attack with an offset of just `3` (1,000 virtual shares):

- 0xA1 deposits 1 unit → `1 * 1000 / 1` = **1,000 shares**
- 0xA1 donates 20,000 USDC → totalAssets = 20,000.000001
- 0xB2 deposits 15,000 → `15e9 * (1000 + 1000) / (20e9 + 1)` = **1,499 shares** (not zero)
- 0xA1 redeems 1,000 shares → `1000 * 35e9 / (1499 + 1000)` ≈ **10,003 USDC**

0xA1 spent 20,000 to recover ~10,003: the attack now **loses ~10,000 USDC**, and 0xB2
recovers ~14,997 of their 15,000. With our recommended offset of `6`, the attacker would
need to donate on the order of a million times the victim's deposit to move the ratio at
all — categorically uneconomical. The cost is 6 extra decimal places on the share token,
which is invisible to integrators.

### Fix B (defence in depth): reject zero-share mints and zero-asset burns

```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256) {
    require(assets > 0, "Zero assets");
    require(receiver != address(0), "Zero receiver");
    uint256 shares = super.deposit(assets, receiver);
    require(shares > 0, "Zero shares minted");   // never silently swallow a deposit
    return shares;
}

function redeem(uint256 shares, address receiver, address owner)
    public override returns (uint256)
{
    uint256 assets = super.redeem(shares, receiver, owner);
    require(assets > 0, "Zero assets returned");
    return assets;
}
```

This is cheap and turns any residual rounding pathology into a revert — the depositor
keeps their money and retries — rather than a loss. It is a backstop for Fix A, not a
substitute for it.

### Fix C (deployment procedure): seed the vault ourselves

At deploy time, in the **same transaction** as construction, deposit a small amount
(e.g. 1,000 USDC) and send those shares to `address(0)` or to a protocol-owned address
that never redeems. This guarantees the vault is never in the `totalSupply == 0` state
when the first external user arrives, so no attacker ever gets to be the first depositor.
Belt-and-braces with Fix A; it also protects any future vault we fork from this code.

### What we are *not* doing

- **We are not switching to internal `totalAssets` accounting alone.** Tracking a
  `totalAssets` storage variable that only changes in `deposit`/`withdraw` does make
  donations non-creditable, but it breaks the ability to accrue yield by transferring
  tokens in, and it still leaves the `1 share / 1 wei` rounding regime intact on a fresh
  vault. The virtual offset is the standard, ERC-4626-sanctioned answer.
- **We are not adding a minimum deposit size as the primary fix.** It degrades UX, and
  an attacker can donate more to raise the threshold past any fixed minimum.

### ERC-4626 compatibility

All three fixes are compatible. The virtual offset is an internal accounting detail;
`convertToShares`, `convertToAssets`, `previewDeposit`, `previewRedeem`, `maxDeposit`
etc. keep their required semantics and remain consistent with each other. Note one
point of care for integrators: `previewDeposit` reflects the *current* balance, so a
quote is only valid until someone donates — which is exactly why the offset, and not
the preview, is what protects users.

---

## 4. Immediate operational steps

1. **Pause deposits on the live vault now** (or, if there is no pause, publish a warning
   and pull the front end) — the vulnerability is public the moment this trade is seen.
2. **Deploy the fixed vault** with `_decimalsOffset() = 6`, seeded per Fix C, and
   verify the source on Etherscan.
3. **Check for other victims** — scan all `Deposit` events on the old vault for
   `shares == 0` or for a share count wildly below `assets`. 0xB2 may not be alone.
4. **Make 0xB2 whole.** The loss is our defect.
5. **Add regression tests** that replay this exact sequence — 1-unit deposit, direct
   donation, victim deposit — and assert the victim's shares are non-zero and their
   redeemable value is within rounding dust of their deposit. Fuzz the deposit/donation
   sizes (`forge test --fuzz-runs 10000`); this bug is trivially caught by a fuzzer that
   asserts "a depositor can always redeem ≥ deposit − dust."
6. **Run Slither** on the new contract and resolve everything before deploying.

---

## Appendix: the general lesson

> Never derive a price from a value an outsider can change for free.

`token.balanceOf(address(this))` is not vault state — it is a public, permissionlessly
writable number. It belongs in the same category as a DEX spot price: usable as a
signal, never as a sole, unguarded divisor. Whenever a balance you don't control appears
as the denominator of a `mulDiv`, ask what happens when an attacker makes it enormous
and the numerator small.
