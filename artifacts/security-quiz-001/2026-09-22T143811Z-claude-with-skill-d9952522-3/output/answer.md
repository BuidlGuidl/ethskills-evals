# Post-mortem: 0xB2 deposited 15,000 USDC and received 0 shares

## Short answer

This is a bug in our contract, not a mistake by the depositor. 0xA1 ran the
classic ERC-4626 **first-depositor / donation (share inflation) attack**. The
share price is computed from `USDC the vault currently holds` — i.e. the raw
token balance — which anyone can inflate with a plain ERC-20 transfer that our
code never sees. Combined with integer division truncating toward zero and a
missing `shares > 0` check, 0xB2's entire deposit rounded down to zero shares
and was absorbed by 0xA1's single share.

## Exactly what happened, step by step

All amounts in USDC base units (6 decimals), so 1 USDC = 1,000,000 units.

**09:12 — bootstrap the share price at its minimum.**
`totalShares == 0`, so the empty-vault path mints 1:1.

```
A1 deposits           1 unit
totalShares         = 1
totalAssets         = 1        (vault USDC balance)
price               = 1 unit per share
```

The attacker now owns 100% of a supply of exactly one indivisible share. That
single share is the whole attack: because shares have no sub-unit, every other
depositor's entitlement has to be expressed as an integer multiple of it.

**09:13 — inflate the price by donation.**
A raw `USDC.transfer(vault, 20_000e6)`. No call into our contract, so no
`deposit`, no mint, no event, no accounting hook — and that is the point.
`totalAssets` is read as `USDC.balanceOf(address(this))`, so the donation
silently lands in the denominator:

```
totalShares         = 1                    (unchanged)
totalAssets         = 20,000,000,001       (1 + 20,000e6)
price               = 20,000.000001 USDC per share
```

The attacker "lost" 20,000 USDC in the sense that it is now backing their own
share — they still own 100% of the supply, so they can redeem it all back. The
donation costs them nothing as long as they redeem before anyone else can gain
a claim on it.

**09:41 — the victim deposit truncates to zero.**

```
shares = assets * totalShares / totalAssets
       = 15,000,000,000 * 1 / 20,000,000,001
       = 0.74999...  ->  0     (Solidity integer division floors)
```

Solidity has no fractional integers; `0.749` becomes `0`. The contract then:

1. pulled 15,000 USDC via `transferFrom` — the transfer succeeded;
2. minted `0` shares — minting zero is a valid no-op, not a revert;
3. returned success, because nothing in the function asserted `shares > 0`.

From the EVM's point of view every operation completed normally. That is why
the explorer shows a successful transaction: **"succeeded" means no opcode
reverted, not "the depositor got what they paid for."** The 15,000 USDC is now
sitting in the vault backing a supply of one share that belongs entirely to
0xA1.

```
totalShares         = 1        (0xA1: 1, 0xB2: 0)
totalAssets         = 35,000,000,001
```

**09:44 — the attacker redeems.**
Pro-rata payout on the only outstanding share:

```
payout = 1 * 35,000,000,001 / 1 = 35,000,000,001 units
       = 35,000.000001 USDC
```

Profit = 35,000.000001 − 20,000.000001 (deposit + donation) = **15,000 USDC**,
exactly 0xB2's deposit. Vault empty, 0xB2 holds a zero balance.

### The general shape

Any depositor of `assets < totalAssets / totalShares` — here, anything under
20,000.000001 USDC — mints zero shares and donates their money to existing
holders. The attacker sizes the donation to the deposits they expect to
intercept. Even a deposit *above* the threshold is robbed: 25,000 USDC would
mint `25,000e6 / 20,000.000001e6 = 1` share, so the victim gets a 50% claim on
a pool they funded 55% of — the rounding loss is simply partial rather than
total. Front-running makes this reliable: the attacker watches the mempool for
a pending `deposit`, and bundles steps 1–2 ahead of it and step 4 behind it.

## Is this our bug or the depositor's mistake?

**Ours, on three independent counts.** 0xB2 did nothing unusual — they called
a public `deposit` with a sane amount and got a successful receipt.

1. **`totalAssets` is derived from an attacker-writable value.** Share price
   depends on `balanceOf(vault)`, which any address can increase with a bare
   ERC-20 transfer. Any accounting input that an unprivileged third party can
   move for free is not a trustworthy input. The 1:1 empty-vault special case
   makes it worse by letting an attacker start the supply at 1 wei-share, the
   value that maximizes rounding error.

2. **We round in the attacker's favour with no floor.** `deposit` must round
   shares *down* (that part is correct and required), but a vault must then
   refuse to proceed when the rounded result is zero. We had no such check.

3. **It violates ERC-4626 as well as common sense.** The spec requires
   `deposit` to revert if all of `assets` cannot be deposited — accepting the
   assets while issuing nothing is precisely that case. It also requires
   `previewDeposit` to be a faithful preview; a preview returning 0 followed by
   a successful transfer of 15,000 USDC is not a vault any integrator can
   safely route into.

The fact that it is a well-known, named, documented attack class with standard
mitigations in every major vault library removes any argument that this was
unforeseeable.

## What we ship

Stay on ERC-4626; the standard is fine, our implementation was not. Replace the
hand-rolled math with OpenZeppelin's `ERC4626` and layer the defences:

### 1. Virtual assets and shares (the primary fix)

OpenZeppelin v5's `ERC4626` offsets the conversion with virtual balances:

```solidity
contract UsdcVault is ERC4626 {
    constructor(IERC20 usdc) ERC20("USDC Vault", "vUSDC") ERC4626(usdc) {}

    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;   // 1 USDC unit -> 1e6 shares; vault token has 12 decimals
    }
}
```

Conversions become
`shares = assets * (totalSupply + 10**offset) / (totalAssets + 1)`,
so the vault behaves as if it always holds one virtual asset backed by `10**6`
virtual shares owned by nobody. Two things follow:

- **The empty-vault special case disappears.** There is no state in which
  `totalSupply == 0` requires different math, so the attacker can never
  bootstrap a supply of exactly 1 share.
- **Donations become a loss, not a lever.** Re-running the attack: 0xA1's
  1-unit deposit now mints ~1e6 shares instead of 1. After the 20,000 USDC
  donation, 0xB2's 15,000 USDC still mints ~1.5e6 shares, giving 0xB2 ~60% of
  the 35,000 USDC pool (~21,000 USDC) and 0xA1 ~40% (~14,000 USDC) against
  20,000 USDC committed. The attacker loses ~6,000 USDC subsidising the victim.
  The offset scales the attacker's required donation by `10**offset` while the
  victim's rounding loss shrinks by the same factor — with offset 6, stealing
  meaningfully would cost orders of magnitude more than the theft.

### 2. Revert on zero shares

Cheap, independent of the maths, and turns any residual rounding edge into a
failed transaction instead of a silent loss:

```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256) {
    uint256 shares = previewDeposit(assets);
    require(shares != 0, "zero shares");
    _deposit(_msgSender(), receiver, assets, shares);
    return shares;
}
```

Also enforce the mirror on the exit path (`redeem` must not burn shares for
zero assets), and expose a `minSharesOut` slippage parameter on the deposit
entry point so integrators can bound their own rounding/front-running exposure.

### 3. Seed the vault at deployment

In the same transaction as deployment (or via a deploy script that cannot be
front-run in between), deposit a small amount — e.g. 10 USDC — and send those
shares to `address(0)` or keep them permanently in the treasury. This removes
the empty-vault state from the live contract entirely. Belt-and-braces on top
of the offset, not a substitute for it: dead shares alone can still be diluted
by a large enough donation.

### 4. Optional: internal asset accounting

If we later add strategies or want donations to be a non-event, track
`totalAssets` in a storage variable updated by our own deposit/withdraw/harvest
paths rather than reading `balanceOf`. Donated tokens then sit unattributed
until an explicit `sync()`/`skim()` we control. This is a larger change; the
offset plus zero-share check already closes the reported bug, so ship those
first.

### Tests to add before redeploy

- Reproduce the exact incident sequence (1 unit deposit → 20,000 donation →
  15,000 deposit → redeem) and assert 0xB2 can withdraw ≥ 99.9% of their
  deposit and 0xA1 ends up down.
- Fuzz `deposit(x)` over the full `uint256` range against arbitrary prior
  donations; invariant: a depositor's redeemable value is never less than
  their deposit minus one wei of rounding, and `shares == 0` always reverts.
- Invariant: `sum(previewRedeem(balanceOf(u))) <= totalAssets()` across all
  holders, under interleaved deposits, donations and redemptions.
- Round-trip test at the extremes: 1 unit and `type(uint128).max`.

## Remediation for the incident itself

Pause deposits now. 0xB2's 15,000 USDC is a recoverable loss on our side —
the funds left with 0xA1, so make 0xB2 whole from treasury and pursue 0xA1
separately. Check the explorer for any other deposit that minted zero shares
before 09:44, and for the same pattern on any other vault we deployed from this
codebase.
