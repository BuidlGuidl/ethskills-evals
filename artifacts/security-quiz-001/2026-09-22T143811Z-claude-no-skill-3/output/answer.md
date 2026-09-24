# Post-mortem: 0xB2's 15,000 USDC deposit minted zero shares

## Short answer

This is the ERC-4626 **inflation ("donation" / first-depositor) attack**. It is a bug in
our contract, not a mistake by the depositor. 0xA1 deliberately engineered it: they seeded
the vault with 1 unit to own the entire share supply, donated 20,000 USDC directly to the
vault address to inflate the price of that single share above 0xB2's whole deposit, and
then redeemed. Because our mint formula rounds down and we never check the result, 0xB2's
deposit rounded to **0 shares and still succeeded**.

The fix we ship is OpenZeppelin's **virtual shares / virtual assets offset** (the standard,
fully ERC-4626-compatible mitigation), plus a hard `require(shares > 0)` in `deposit` and
`require(assets > 0)` in `redeem`, plus a seeded/burned initial deposit at deployment.

---

## Exactly what happened, step by step

Our minting rule is

```
shares = assets * totalShares / totalAssets        // totalAssets = USDC balanceOf(vault)
shares = assets                                    // if totalShares == 0
```

Two properties of that rule are what got exploited:

1. `totalAssets` is read as the vault's **live USDC balance**, so anyone can increase it with
   a plain ERC-20 `transfer` — no call into our code, no share minted. The share price
   (`totalAssets / totalShares`) is therefore attacker-controlled.
2. Integer division **truncates toward zero**, and we never check the truncated result.

Walking the trace:

**09:12 — 0xA1 deposits 1 unit.** Supply is 0, so the first-depositor branch runs:
`totalShares = 1`, `totalAssets = 1` (i.e. 0.000001 USDC). One share now represents the
entire vault, and one share is *indivisible* — there is no smaller unit of ownership.

**09:13 — 0xA1 transfers 20,000 USDC directly to the vault.** No shares are minted; the
supply is still 1. But `totalAssets` is now `20_000.000001e6 = 20,000,000,001` units. The
price of that single share jumped from 0.000001 USDC to 20,000.000001 USDC. This is the
"inflation" step. The 20,000 USDC is not a gift — 0xA1 still owns 100% of the shares, so it
is fully redeemable by them. It is working capital for the attack, and it sets the size of
the deposit the attack can swallow.

**09:41 — 0xB2 deposits 15,000 USDC.** The vault computes:

```
shares = 15_000_000_000 * 1 / 20_000_000_001
       = 0.7499999999625  →  truncated to 0
```

0xB2 bought 0.75 of a share, but shares have no fractional part, so the division floors to
zero. The contract transferred 15,000 USDC in via `transferFrom`, minted `0`, emitted a
`Deposit` event for 0 shares, and returned normally. **Nothing in the code objects to
minting zero.** That is the defect: the transaction succeeded while delivering nothing.
The 15,000 USDC landed in `totalAssets`, which is to say it landed in the pro-rata claim of
the only shareholder — 0xA1.

**09:44 — 0xA1 redeems its 1 share.** It is 1 of 1 shares, so it pays out
`1 * 35_000.000001e6 / 1` = the entire balance, 35,000.000001 USDC. 0xA1 put in
20,000.000001 and took out 35,000.000001: a clean 15,000 USDC profit, exactly 0xB2's
deposit. The vault is empty and 0xB2's balance reads 0.

Note the generality: with a supply of 1 share, *any* deposit smaller than the current
`totalAssets` rounds to zero. 0xA1 chose a 20,000 donation to be sure it covered a deposit
of 0xB2's size; they could have front-run 0xB2's pending deposit in the mempool and sized
the donation to it precisely. Even a deposit larger than the donation is harmed — a 30,000
deposit into that state mints 1 share and then owns only half of 50,000, losing 5,000.
Rounding-to-zero is just the worst case of a continuous loss.

## Is this our bug or the depositor's mistake?

**Ours.** Three independent reasons:

- A deposit that takes the user's assets and mints nothing must never succeed. Silently
  accepting value and issuing zero claim is a correctness failure regardless of who the
  counterparty is; no amount of user caution makes a zero-mint acceptable behaviour.
- The vulnerable state was reachable permissionlessly and cheaply (1 unit of USDC). A
  contract that lets an attacker put it into a state where honest deposits are confiscated
  is not safe to deploy, whatever the depositor does.
- This is a known, documented class of bug with a known mitigation shipped in
  OpenZeppelin's `ERC4626` since v4.9. Not adopting it is our omission.

0xB2 does share a lesser, separate failing: ERC-4626 provides slippage protection via
`previewDeposit`, and a router/frontend should have simulated the call and required a
minimum share output. Had they done so the transaction would have reverted and they'd have
kept their money. But that is defence-in-depth on top of a contract that should not have
been exploitable in the first place. It is not a defence for us, and we should not present
it to them as one. We should make them whole.

Also worth stating plainly: our `totalAssets` design — reading the live token balance —
is what made the share price manipulable. That is *permitted* by ERC-4626 and is what OZ
does too; it only becomes dangerous when combined with an unbounded price ratio at tiny
supply.

## The fix

### 1. Virtual shares and virtual assets (the core mitigation, ERC-4626-compatible)

Inherit OpenZeppelin's `ERC4626` and override `_decimalsOffset()`. The conversion becomes:

```solidity
shares = assets * (totalSupply() + 10**_decimalsOffset()) / (totalAssets() + 1)
assets = shares * (totalAssets() + 1) / (totalSupply() + 10**_decimalsOffset())
```

The vault behaves as if it always holds 1 virtual asset owned by `10**offset` virtual
shares held by no one. Two effects:

- The share price can never be undefined or unboundedly large at low supply; the empty
  vault starts at a fixed, sane rate of `10**offset` shares per asset.
- A donation no longer steals value, it *dilutes the attacker*. The virtual shares absorb a
  share of every donation, and that share is unrecoverable, so the attack costs the attacker
  money.

Concretely, re-running last night's trace with `_decimalsOffset() = 3`:

- 0xA1 deposits 1 unit → `1 * (0 + 1000) / (0 + 1)` = **1000 shares**.
- 0xA1 donates 20,000 USDC. `totalAssets` = 20,000.000001.
- 0xB2 deposits 15,000 → `15e9 * (1000 + 1000) / (20_000_000_001 + 1)` = **1499 shares**,
  not 0.
- Final state: 35,000.000001 USDC, 2499 real shares. 0xB2 redeems 1499/2499 ≈ **20,993
  USDC** on a 15,000 deposit; 0xA1 redeems 1000/2499 ≈ **14,006** after putting in 20,000.
  **The attacker loses ~5,994 USDC to the victim.** The attack is not merely blunted, it is
  inverted.

Choose the offset deliberately. It multiplies share supply by `10**offset`, and it raises
the attacker's required donation by roughly the same factor for any given rounding loss, so
larger is safer but eats headroom in `uint256` and changes the share/asset decimal
relationship. For a 6-decimal USDC vault, **offset 6 or 8** is a good target (share token
reports 12 or 14 decimals), keeping totals far below overflow while making a profitable
donation attack cost more than any plausible deposit it could capture. Confirm the exact
value with a fuzz test over deposit sizes and donation sizes asserting the attacker's PnL
is never positive.

Rounding direction must be preserved: deposits/mints round **down** shares to the user,
withdrawals/redeems round **up** the shares burned — always in the vault's favour. OZ's
`Math.mulDiv` with an explicit `Rounding` argument handles this; do not hand-roll it.

### 2. Reject zero-output operations

Independent of the offset, these invariants should be enforced explicitly, because a
rounding loss of 100% is categorically different from a rounding loss of 1 wei:

```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
    shares = previewDeposit(assets);
    require(shares > 0, "ZeroShares");
    ...
}
function redeem(uint256 shares, address receiver, address owner) public override returns (uint256 assets) {
    assets = previewRedeem(shares);
    require(assets > 0, "ZeroAssets");
    ...
}
```

This is ERC-4626-compatible: the spec explicitly allows `deposit` to revert, and
`previewDeposit`/`maxDeposit` continue to report truthfully. It converts any remaining
edge case from a silent confiscation into a revert — the failure mode 0xB2 should have got.

### 3. Seed the vault at deployment

In the constructor (or an atomic deploy script), deposit a small amount from the deployer
and send those shares to `address(0)` or a burn address. A permanently non-zero supply and
non-zero assets means the fragile "first depositor" branch is never reachable by an
attacker. This is belt-and-braces on top of (1) — cheap, and it removes a whole state from
the reachable set. Do it atomically with deployment so no one can front-run the seed.

### 4. Tests to add before redeploy

- Replay the exact 0xA1/0xB2 sequence; assert 0xB2 receives non-zero shares and can redeem
  at least ~99.9% of their deposit, and that 0xA1's PnL is negative.
- Fuzz: for all `(seed, donation, victimDeposit)`, attacker profit ≤ 0 and no deposit above
  `maxDeposit`'s floor ever mints 0.
- Invariant: sum of `previewRedeem(balanceOf(u))` over all holders ≤ `totalAssets()`
  (rounding always favours the vault).
- Direct-donation test: an unsolicited `transfer` to the vault never lets any single holder
  redeem more than their pre-donation claim plus their pro-rata slice.

### 5. Operationally, now

Pause/withdraw-only the deployed vault, redeploy with the fix, and reimburse 0xB2 the
15,000 USDC from treasury. 0xA1's address and the trace should be preserved for the
incident write-up; the 15,000 was taken by an exploit our code permitted, so treat recovery
from 0xA1 as a separate, optional legal track and not as a precondition for making 0xB2
whole.

## What *not* to do

- **Don't track assets in an internal accounting variable instead of `balanceOf`** as the
  primary fix. It does stop donations from moving the price, but it breaks yield that arrives
  as a direct transfer (rebasing/airdropped rewards), strands donated tokens, and still leaves
  the tiny-supply rounding cliff on the very first deposits. The virtual-offset approach is the
  one the ecosystem has converged on.
- **Don't just add a minimum deposit size.** It raises the attacker's cost linearly while
  they can inflate the price without bound; it narrows the window rather than closing it,
  and it degrades UX.
- **Don't rely on frontend slippage checks alone.** They protect users of *our* frontend and
  nobody integrating the vault directly — and ERC-4626 vaults exist to be integrated.
