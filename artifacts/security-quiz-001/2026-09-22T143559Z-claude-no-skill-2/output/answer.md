# Post-mortem: 0xB2's deposit minted zero shares

## Short version

This is the **ERC-4626 first-depositor / share-inflation ("donation") attack**. It is a
bug in our contract, not a mistake by the depositor. 0xA1 seeded the vault with a
1-unit deposit so that `totalShares == 1`, then inflated the vault's asset balance with
a direct ERC-20 transfer that our contract never observed as a deposit. That made one
share worth ~20,000 USDC. 0xB2's 15,000 USDC was then worth *less than one share*, and
integer division truncated their mint to zero. Our `deposit` happily minted 0 and kept
the money.

## Step-by-step replay of the numbers

Mint rule, as implemented:

```
sharesOut = assets * totalShares / vaultAssetBalance      // integer division
sharesOut = assets                                        // if totalShares == 0
```

| t | actor | action | totalShares | vault USDC balance | price per share |
|---|-------|--------|-------------|--------------------|-----------------|
| 09:12 | 0xA1 | `deposit(1)` (bootstrap branch) | 1 | 0.000001 | 0.000001 |
| 09:13 | 0xA1 | raw ERC-20 transfer of 20,000 | 1 | 20,000.000001 | **20,000.000001** |
| 09:41 | 0xB2 | `deposit(15,000)` | 1 | 35,000.000001 | — |
| 09:44 | 0xA1 | `redeem(1)` | 0 | 0 | — |

The mint at 09:41:

```
sharesOut = 15,000_000000 * 1 / 20,000_000001
          = 15,000,000,000 / 20,000,000,001
          = 0.749999...  ->  0   (floor)
```

Solidity integer division truncates toward zero, so `sharesOut == 0`. Nothing in the
function rejected that: the USDC `transferFrom` succeeded, `_mint(0xB2, 0)` is a
perfectly legal no-op, and the transaction returned success. 0xB2 paid 15,000 USDC for
nothing.

(The same result holds if the balance is read *after* the pull-in —
`15,000e6 * 1 / 35,000.000001e6` also floors to 0. The bug does not depend on the exact
read ordering.)

The redemption at 09:44 then paid out pro rata over the *whole* balance, including
0xB2's stranded deposit:

```
assetsOut = 1 * 35,000.000001 / 1 = 35,000.000001
```

0xA1's cost was 20,000.000001 USDC of "donation" plus gas; their take was 35,000.000001.
**Net profit: 14,999.999999 USDC — exactly 0xB2's deposit, minus the dust.** The donation
is not a gift; it is recoverable collateral for the attack, because the attacker owns
100% of the share supply while it sits there.

## Why this is our bug, not the depositor's mistake

Three independent defects in our contract, each of which alone would have stopped this:

1. **We use `IERC20(asset).balanceOf(address(this))` as `totalAssets`.** That makes the
   exchange rate a function of an attacker-controlled quantity. Anyone can push USDC to
   an address; there is no way to refuse an incoming ERC-20 transfer. Any accounting that
   trusts `balanceOf` is trusting the whole world to write to our storage.
2. **We mint with no lower bound and no zero-check.** A function that takes 15,000 USDC
   and gives back zero of anything must not be allowed to return success.
3. **The bootstrap branch has no share-precision floor.** One share for one unit means
   the share is as coarse as the asset, so one whole share can be made arbitrarily
   valuable and the truncation window becomes enormous.

0xB2 did nothing unusual. They called the documented entry point with a normal amount.
There was no slippage parameter for them to set, because we never gave them one — and
even a careful integrator using `previewDeposit` would have been told `0` only if they
thought to check, and could still be front-run by the donation in the same block. A
vault must be safe against this by construction; "the depositor should have simulated
first" is not a control we can rely on. This is squarely CWE-682 (incorrect calculation)
plus missing input/output validation, and it is a known, documented ERC-4626 hazard.

## What we ship

All three of the following, and all three are ERC-4626 compatible. The canonical fix is
OpenZeppelin's `ERC4626` with a decimals offset (virtual shares + virtual assets), which
is what the spec's own security section points at.

### 1. Virtual shares and virtual assets (the real fix)

Add a constant offset to both sides of the ratio so an empty vault behaves as if it
already held a tiny, unownable position:

```solidity
uint8 private constant _DECIMALS_OFFSET = 6;   // for a 6-decimal asset like USDC

function _convertToShares(uint256 assets, Math.Rounding rounding)
    internal view override returns (uint256)
{
    return assets.mulDiv(
        totalSupply() + 10 ** _DECIMALS_OFFSET,   // virtual shares
        totalAssets() + 1,                        // virtual assets
        rounding
    );
}
```

This does not prevent the donation — nothing can — it makes it **unprofitable**, which
is the right goal. Rerunning the exact attack with `offset = 6`:

- 0xA1 deposits 1 unit → `1 * (0 + 1e6) / (0 + 1)` = **1,000,000 shares**.
- 0xA1 donates 20,000 USDC. Share supply unchanged.
- 0xB2 deposits 15,000 →
  `15,000e6 * (1e6 + 1e6) / (20,000.000001e6 + 1)` ≈ **1,499,999 shares** — not zero.
- Supply ≈ 2,499,999; 0xB2 owns ~60% of 35,000.000001 ≈ **21,000 USDC**, 0xA1 ≈ 14,000.

0xA1 spent 20,000 to extract 14,000: a 6,000 USDC loss. The attacker's donation is now
shared with the victim in proportion to the virtual offset, so the larger the offset the
worse the attack gets for the attacker. `offset = 6` (shares get 12 decimals against a
6-decimal asset) puts the attacker at a permanent loss for any realistic victim size.

### 2. Internal asset accounting instead of `balanceOf`

Track deposits in storage and override `totalAssets()` to return the tracked figure, so
a raw transfer cannot move the exchange rate at all:

```solidity
uint256 private _totalAssets;

function totalAssets() public view override returns (uint256) {
    return _totalAssets;   // NOT asset.balanceOf(address(this))
}
```

increment on deposit/mint, decrement on withdraw/redeem, from the *actual* delta
transferred. Donated USDC then just sits there, inert, until a privileged `sweep()`
either returns it or deliberately books it as yield. Note this is slightly opinionated:
it means the vault does not auto-compound airdropped yield, so if any strategy of ours
expects to receive rewards by direct transfer, route those through an explicit
`harvest()` that updates `_totalAssets`.

### 3. Revert on a zero-share mint, and add slippage bounds

Cheap, absolute backstop for every remaining rounding edge:

```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256) {
    uint256 shares = previewDeposit(assets);
    if (shares == 0) revert ZeroSharesMinted();
    _deposit(_msgSender(), receiver, assets, shares);
    return shares;
}
```

and expose the standard router-style bounded variants (`depositMin(assets, receiver,
minSharesOut)` / `redeemMin(...)`) so integrators can pin an acceptable rate. Both are
allowed alongside the ERC-4626 surface — the spec permits reverts on deposit and permits
extra functions; it only requires that `previewDeposit` agrees with what `deposit`
actually mints, which all of the above preserve. Mirror it on the way out: revert if
`redeem` would pay out zero assets.

### 4. Seed the vault at deployment (belt and braces)

In the same transaction as the deploy, deposit a small amount (e.g. 1 USDC = 1e6 units)
and send those shares to `address(0)` or lock them in the vault. A non-zero, unownable
share supply from block one means the "first depositor" branch is never reachable by an
attacker. Atomicity matters: do this inside the constructor or a deploy script that
cannot be front-run between deploy and seed.

## Rounding direction, while we are in here

Every conversion must round in the vault's favour, never the user's:

- `deposit` / `mint` → shares out rounded **down**, assets in rounded **up**.
- `withdraw` / `redeem` → assets out rounded **down**, shares burned rounded **up**.

Our current code rounds shares down already (that is part of how we got here), but the
redeem path should be audited for the same discipline so dust cannot be farmed in the
opposite direction.

## Immediate operational steps

1. **Pause deposits** on the live vault now. The exploit is repeatable against every
   subsequent depositor while the share supply is small.
2. The vault is empty and 0xB2 is out 15,000 USDC — that is a treasury/insurance
   decision, not a code one, but make it before redeploying.
3. Deploy the fixed vault with the offset, internal accounting, zero-share revert, and
   an atomic deploy-time seed. Migrate remaining users.
4. Add regression tests that replay this exact sequence: bootstrap with 1 unit, donate
   20,000, deposit 15,000 — and assert the deposit either mints a fair share count or
   reverts, never succeeds with zero. Add a fuzz test asserting
   `previewDeposit(x) > 0 for all x >= 1` and that a donor can never end a
   donate-then-redeem round trip with more assets than they started with.
