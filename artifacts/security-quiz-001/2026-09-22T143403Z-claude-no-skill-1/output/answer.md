# Post-mortem: depositor received 0 shares (ERC-4626 inflation / donation attack)

## Short answer

This is a bug in our contract, not a mistake by 0xB2. 0xB2 did nothing unusual — they
called `deposit` with a normal 15,000 USDC amount, and the contract accepted their money
and minted them nothing. 0xA1 executed the textbook ERC-4626 **first-depositor inflation
attack** (a.k.a. donation / share-price rounding attack). The root cause is two design
choices in combination:

1. `totalAssets` is read as the vault's live `USDC.balanceOf(vault)`, so anyone can move
   the share price by sending tokens directly to the vault address.
2. Share minting divides with integer truncation and there is no lower bound — no virtual
   shares/assets offset, and no check that the computed share amount is non-zero.

## Exactly what happened, step by step

Let `S` = total share supply and `A` = USDC the vault holds. The mint rule is

```
shares = assets * S / A          (A measured before the deposit is credited)
S == 0  ->  shares = assets      (first depositor, 1 share per unit)
```

All arithmetic below is in USDC base units (6 decimals), and `/` is EVM integer division,
which **truncates toward zero**.

**09:12 — 0xA1 deposits 1 unit.**
`S == 0`, so the first-depositor branch runs: 0xA1 gets 1 share.
State: `S = 1`, `A = 1`. Share price: 1 unit per share.

**09:13 — 0xA1 sends 20,000 USDC directly to the vault address.**
This is a plain `USDC.transfer(vault, 20_000e6)`. It never enters our code — there is no
callback, no hook, nothing to reject it. But because `totalAssets()` is
`USDC.balanceOf(address(this))`, the vault's accounting silently absorbs it.
State: `S = 1`, `A = 20,000.000001e6 = 20_000_000_001`.
Share price is now **20,000.000001 USDC per share**. This is the "inflation" step: the
attacker donated real money to make a single share absurdly expensive.

Note that 0xA1 lost nothing by doing this: they still hold 100% of the share supply, so
the donated 20,000 is still fully redeemable by them. The donation is a loan to
themselves, posted as bait.

**09:41 — 0xB2 deposits 15,000 USDC.**

```
shares = 15_000_000_000 * 1 / 20_000_000_001
       = 15_000_000_000 / 20_000_000_001
       = 0        (true value ≈ 0.7499999..., truncated to 0)
```

0xB2's deposit is **smaller than the price of one share**, so the pro-rata formula
computes a fractional share, and integer division floors it to zero. Nothing reverts:
the `transferFrom` succeeds, the USDC arrives, `_mint(0xB2, 0)` is a legal no-op, and the
transaction returns success. The vault's balance grows by 15,000 USDC while the share
supply stays at 1 — all of which is owned by 0xA1.
State: `S = 1`, `A = 35,000.000001e6`.

That is the whole answer to "how did a successful deposit mint zero": **truncation with
no zero-shares guard, on top of a share price the attacker set arbitrarily high via a
direct token transfer.**

**09:44 — 0xA1 redeems its 1 share.**

```
assets = 1 * 35_000_000_001 / 1 = 35_000_000_001 = 35,000.000001 USDC
```

0xA1 put in 0.000001 + 20,000 and takes out 35,000.000001 — a profit of exactly 0xB2's
15,000 USDC. `S` returns to 0, `A` to 0, and the vault is empty.

## Is this a bug in our contract or a depositor mistake?

**Ours.** Concretely:

- 0xB2 had no way to protect themselves at the contract level. There was no slippage
  parameter, no `minSharesOut`, and `previewDeposit(15_000e6)` — had they called it —
  would have honestly returned 0 while the contract still happily accepted the deposit.
  A vault must never take assets and mint nothing.
- The attack window is not exotic. It exists for *every* vault at deployment and again any
  time the supply drops to zero, and it is cheap: the attacker's capital is fully
  recoverable, so the only cost is gas and the risk of being front-run by an honest
  depositor.
- "Donating" tokens to a contract is not a violation of any rule. Any ERC-20 holder can
  `transfer` to any address. A contract whose accounting can be steered by unsolicited
  transfers is a contract with an unsafe accounting model.
- ERC-4626 is explicit that `deposit` should revert if the deposit cannot be performed —
  minting zero for a non-zero deposit is exactly that case.

One clarifying note on scope: this also means any deposit whose value rounds below one
share loses value even absent an attacker, e.g. a dust deposit into a vault that has
legitimately appreciated. The zero-shares case is just the extreme end of a general
rounding-against-the-depositor problem.

## The fix

Ship all four; they are layered defenses, and the first is the one that actually removes
the attack.

### 1. Virtual shares and virtual assets (the real fix) — keeps us ERC-4626 compatible

Adopt OpenZeppelin's `ERC4626` with a non-zero `_decimalsOffset()`. The conversion
becomes:

```
shares = assets * (totalSupply + 10**offset) / (totalAssets + 1)
assets = shares * (totalAssets + 1) / (totalSupply + 10**offset)
```

The vault behaves as if it always holds `10**offset` invisible shares backed by 1 virtual
asset unit. Two consequences:

- The supply is never truly zero, so the "first depositor sets the price" branch
  disappears entirely. There is no special case left to exploit.
- Any donation is now shared with the virtual shares, so the attacker cannot keep their
  own donation. Inflating the price by a factor of `k` requires donating roughly `k`
  times more than the attacker can recover, and the rounding loss they can inflict on a
  victim is bounded by roughly `victim_deposit / 10**offset`.

Numerically, with `offset = 0` the same attack sequence gives 0xB2
`15_000e6 * 2 / (20_000.000001e6 + 1) = 1` share of 3 total, so 0xA1 redeems ~11,666 USDC
on 20,000 staked — the attacker loses ~8,333 to make 0xB2 lose ~3,333. It is already
unprofitable. With **`offset = 6`** (our recommendation for 6-decimal USDC: share
decimals become 12, and 1e6 virtual shares back 1 virtual asset unit) the attacker's
required donation scales by 1e6 and their loss dwarfs any victim's by the same factor.
The attack is dead, not merely discouraged.

This is the canonical mitigation described in EIP-4626's security-considerations section
and in OZ's ERC-4626 docs, and it is fully spec-compliant: `convertTo*`, `preview*`,
`max*` all stay consistent, and the extra share decimals are exactly what the standard
permits a vault to choose.

### 2. Revert when a deposit would mint zero shares

```solidity
uint256 shares = previewDeposit(assets);
if (shares == 0) revert ZeroShares();
```

Cheap, and it converts any residual rounding edge into a failed transaction instead of a
silent loss. Mirror it on withdraw/redeem (`assets == 0` on a non-zero share burn).
Reverting here is consistent with EIP-4626, which requires `deposit` to revert if it
cannot mint.

### 3. Round in the vault's favor, consistently

Deposits/mints must round shares **down** and required assets **up**; withdrawals must
round shares to burn **up** and assets out **down**. Use `Math.mulDiv` with an explicit
`Rounding` argument everywhere rather than bare `*` and `/` — the standard's preview
functions have directional requirements, and a single mis-rounded path reopens a
value-extraction vector even with virtual shares in place.

### 4. Slippage protection on the router/periphery

Expose `deposit(assets, receiver, minSharesOut)` and `redeem(shares, receiver,
minAssetsOut)` as *additional* functions on a router or as overloads — keep the
two-argument spec signatures untouched so 4626 integrators still work. This protects
depositors from ordinary front-running and share-price movement between simulation and
inclusion, which fix #1 does not address.

### Deliberately *not* the fix

- **Tracking `totalAssets` in a storage variable instead of `balanceOf`.** It does block
  donations, but it silently discards any yield, airdrop, or direct transfer the vault
  legitimately receives, and it diverges from what most 4626 integrators expect
  `totalAssets()` to mean. Use virtual shares; if we later want donation-resistant
  accounting for other reasons, that is a separate, deliberate design decision.
- **Seeding the vault with a "dead shares" deposit at deployment** (deposit a small amount
  and burn the shares to `address(0)`). This is a reasonable belt-and-braces measure and
  we can do it on top, but alone it only raises the attacker's cost linearly and depends
  on the deployment transaction being atomic with the seeding. It is not a substitute
  for #1.

## Remediation for the live vault

The deployed vault is exploitable right now and holds user funds, so this is not a
next-sprint item:

1. Pause deposits immediately.
2. Deploy the fixed implementation (upgrade if the vault is behind a proxy; otherwise
   deploy a new vault and migrate), with the seeding deposit performed atomically in the
   same transaction as initialization.
3. Make 0xB2 whole — their 15,000 USDC was lost to a defect in our code, not to their own
   error.
4. Add regression tests that replay this exact sequence (first depositor of 1 unit,
   direct transfer of a large amount, second deposit) and assert the second depositor's
   shares are non-zero and their redeemable value is within rounding dust of their
   deposit — plus a fuzz test asserting `previewRedeem(previewDeposit(x)) <= x` and that
   no deposit sequence lets an early depositor end up with more than they put in.
