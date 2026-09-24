# Post-mortem: 0xB2 deposited 15,000 USDC and received 0 shares

## Short version

This is the classic **ERC-4626 first-depositor / share-inflation (donation) attack**.
It is a **bug in our contract**, not a mistake by the depositor. 0xA1 seeded the
vault with 1 wei-unit of USDC to take the entire share supply, then *donated*
20,000 USDC directly to the vault address to inflate the price of that single
share above 0xB2's whole deposit. 0xB2's mint then floor-rounded to zero, and
the deposit became a pure gift to 0xA1.

The fix is OpenZeppelin's `ERC4626` with a non-zero `_decimalsOffset()`
(virtual shares/assets), plus a zero-share revert and a slippage-checked
deposit wrapper. All of that is ERC-4626 compatible.

---

## 1. Exactly what happened, in base units

USDC has 6 decimals, so everything below is in base units (1 USDC = 1,000,000 units).

The mint formula is

```
sharesMinted = assets * totalShares / totalAssets        // totalAssets = USDC balance of the vault
sharesMinted = assets                                    // special case when totalShares == 0
```

Solidity integer division truncates toward zero. That truncation is the whole exploit.

| # | Event | totalShares | vault USDC balance | price of 1 share |
|---|-------|------------:|-------------------:|-----------------:|
| 0 | start | 0 | 0 | — |
| 1 | 0xA1 `deposit(1)` — empty-vault path mints 1:1 | **1** | 1 | 1 unit |
| 2 | 0xA1 sends 20,000 USDC by plain `transfer` | 1 | **20,000,000,001** | **20,000.000001 USDC** |
| 3 | 0xB2 `deposit(15,000 USDC)` | 1 | 35,000,000,001 | — |
| 4 | 0xA1 `redeem(1)` | 0 | 0 | — |

**Step 2 is the load-bearing one.** `totalAssets` is read as
`USDC.balanceOf(address(this))`. That is a number *anybody* can increase without
touching our code. A bare ERC-20 `transfer` moves the balance; there is no
callback, no hook, no function of ours executes. Our contract has no way to
distinguish "assets that were deposited and are backed by shares" from "assets
that were shoved in from outside", because it never records the former — it
re-derives it from the balance every time. After the donation, one share is
backed by 20,000.000001 USDC while only 1 unit was ever paid for it.

**Step 3, the mint:**

```
sharesMinted = 15,000,000,000 * 1 / 20,000,000,001
             = 0.74999999996...  →  0   (floor)
```

The result is genuinely zero. Nothing reverts because nothing in the code says
it should: `transferFrom` of 15,000 USDC succeeds, `_mint(0xB2, 0)` is a
perfectly legal no-op, the function returns `0`, and the transaction emits a
`Deposit` event and succeeds. 0xB2's 15,000 USDC is now sitting in the vault
backing 0xA1's single share.

(Ordering detail worth noting: it doesn't matter here whether the denominator is
read before or after pulling 0xB2's tokens. Before → `15e9 * 1 / 20,000,000,001 = 0`.
After → `15e9 * 1 / 35,000,000,001 = 0`. Both floor to zero. Reading it *after*
would be a second, independent bug — see §4.4.)

**Step 4, the payout:** 0xA1 still holds share #1, and it is still 100% of the
supply.

```
assetsOut = 1 * 35,000,000,001 / 1 = 35,000,000,001 units = 35,000.000001 USDC
```

0xA1 put in 1 unit + 20,000 USDC = 20,000.000001 USDC and took out
35,000.000001 USDC. **Profit: exactly 15,000 USDC — 0xB2's entire deposit.**
The donation was never lost; it was recoverable collateral for the attack,
because 0xA1 owned every share that could claim it.

The general break-even: after inflating the share price to `P`, the attacker
steals `deposit mod P` from every victim and needs `donation < victim deposit`
to profit. Here 0xB2 would have had to deposit **more than 20,000.000001 USDC**
to receive even one share, and at 20,001 USDC they'd have received 1 share and
still lost ~50% to 0xA1 on redemption. There was no deposit size at which 0xB2
came out whole.

## 2. Is it a bug in our contract or a depositor mistake?

**Our contract's bug, unambiguously.** Three independent reasons:

1. **0xB2 had no way to protect themselves.** The ERC-4626 `deposit(assets, receiver)`
   signature has no `minSharesOut` argument. A correct integrator can call
   `previewDeposit` first, but the state it previews can be changed by anyone
   before the deposit lands — a single donation in the mempool is enough to
   sandwich them. Asking depositors to defend against this is asking them to do
   something the standard interface does not let them do.
2. **It wasn't even a sandwich.** The donation landed at 09:13 and 0xB2 deposited
   at 09:41 — 28 minutes later. The vault sat in a publicly poisoned state and
   silently confiscated the next deposit that walked in. Any user at any time
   would have hit this.
3. **A vault that accepts assets and mints nothing has violated its core
   invariant.** "Deposits are never worth zero shares" is our job to enforce, and
   we didn't enforce it — not with a check, and not with math that makes it
   unreachable.

The one thing 0xA1 did that was "clever" rather than abusive was the direct
transfer, and that is a permissionless ERC-20 operation available against every
address on mainnet. It is a known, documented attack class (OpenZeppelin's
ERC-4626 security note, and years of incidents). Designing `totalAssets()` as a
raw `balanceOf` with an unguarded 1:1 empty-vault path is the defect.

Also note the empty-vault special case is what made it cheap. Without it, the
first deposit would have reverted on division by zero, which is its own bug —
the real answer is to remove the special case entirely rather than patch it.

## 3. What we ship

### 3.1 Primary fix — inherit OpenZeppelin `ERC4626` with a decimals offset

```solidity
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UsdcVault is ERC4626 {
    constructor(IERC20 usdc) ERC20("USDC Vault", "vUSDC") ERC4626(usdc) {}

    /// 1e6 virtual shares per virtual asset. Raises the attacker's cost to
    /// inflate the share price by ~1e6x and makes the victim's loss ~1e-6 of
    /// the attacker's outlay.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
```

OZ's conversions become, with `offset = 6` (so `2^... ` aside, virtual shares `= 10^6`, virtual assets `= 1`):

```
shares = assets.mulDiv(totalSupply + 10^offset, totalAssets + 1, Floor)
assets = shares.mulDiv(totalAssets + 1, totalSupply + 10^offset, Floor)
```

The `+1` virtual asset and `+10^6` virtual shares are an imaginary,
unredeemable initial position held by the vault itself. They do three things:

- **They remove the empty-vault special case.** `totalAssets == 0` no longer
  divides by zero, so there is no 1:1 branch to abuse. First deposit is priced
  by the same formula as every other deposit.
- **They cap the exchange rate the attacker can reach.** 0xA1's 1-unit deposit now
  mints 1,000,000 shares, not 1. To move the price per share by a factor of `k`,
  the attacker must now donate ~`k × 10^6` times more than before.
- **They route most of a donation to the virtual shares, which nobody can
  redeem** — so donating is a loss, not an investment.

**Re-running the exact incident against this contract** (offset 6, shares priced
off pre-transfer `totalAssets`):

| step | result |
|---|---|
| 0xA1 `deposit(1)` | `1 * (0 + 10^6) / (0 + 1)` = **1,000,000 shares** |
| 0xA1 donates 20,000 USDC | balance 20,000,000,001 |
| 0xB2 `deposit(15,000)` | `15e9 * (10^6 + 10^6) / (20,000,000,001 + 1)` = **1,499,999 shares** — not zero |
| 0xA1 `redeem(1,000,000)` | `1e6 * 35,000,000,002 / (2,499,999 + 10^6)` ≈ **10,000.003 USDC** |
| 0xB2 `redeem(1,499,999)` | ≈ **14,999.99 USDC** |

0xB2 is made whole to within a rounding unit, and **0xA1 loses ~10,000 USDC** on
the attempt. The attack inverts from profitable to self-destructive. To steal even
1 unit from a 15,000 USDC deposit now, 0xA1 would need to push the share price
above 15,000 USDC/share, which with a 10^6 virtual-share floor costs on the order
of 10^10 USDC — far past the point where the donation itself is the loss.

Offset 6 for a 6-decimal asset gives 18-decimal shares, matching the usual
`decimals() = 18` receipt token and costing nothing in precision. It stays fully
ERC-4626 compatible: `convertTo*`, `preview*`, `max*`, and the rounding
directions (shares down on deposit, assets down on redeem — always in the
vault's favour) are all standard OZ behaviour.

### 3.2 Secondary — revert on a zero-share mint

```solidity
function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
    internal
    override
{
    if (shares == 0) revert ZeroSharesMinted(assets);
    super._deposit(caller, receiver, assets, shares);
}
```

This is a **backstop, not the fix.** On its own it only converts theft into a
denial of service — the attacker inflates the price and now nobody can deposit
below it. It belongs in the contract because the invariant "assets in ⇒ shares
out" should be enforced explicitly rather than implied by arithmetic, and because
it turns any future rounding regression into a revert instead of a loss. Mirror it
on `_withdraw` (`assets == 0` on a non-zero share burn).

### 3.3 Secondary — seed the vault at deployment

In the same transaction as deployment, deposit a small amount (e.g. 10 USDC) from
our own deployer and send the resulting shares to `address(0)` — permanently
locked "dead shares". This removes the empty-vault state from mainnet history
entirely, so no attacker ever gets the first-depositor position. Cheap, and it
composes with 3.1 rather than replacing it.

### 3.4 Slippage protection for depositors

`deposit`/`mint` have no slippage argument in the standard. Ship a thin router (or
add non-standard sibling functions — do **not** change the ERC-4626 signatures):

```solidity
function depositWithMin(uint256 assets, address receiver, uint256 minShares)
    external
    returns (uint256 shares)
{
    shares = vault.deposit(assets, receiver);
    if (shares < minShares) revert Slippage(shares, minShares);
}
```

Point our frontend at this and set `minShares` from `previewDeposit` with a tight
tolerance. This is the user-facing guarantee that survives any future pricing
change.

### 3.5 Consider internal asset accounting — with eyes open

Tracking `totalAssets` in a storage variable updated only by our own
deposit/withdraw paths makes donations accounting-neutral by construction.
It's a legitimate design, but it has real costs: donated tokens become stranded
(they need a sweep function, which is new privileged surface), and it breaks
vault strategies that receive yield as a direct transfer. **Recommendation: stick
with OZ's `balanceOf`-based `totalAssets` + virtual offset**, which is the
battle-tested path and keeps donation-as-yield working. Revisit only if we later
need donation-proof accounting for a different reason.

### 3.6 While we're in here

- Use `SafeERC20.safeTransfer` / `safeTransferFrom` (USDC's `transfer` returns a
  bool, and the token is upgradeable — don't assume today's behaviour is forever).
- USDC is blocklistable and pausable: a blocked `receiver` makes `redeem` revert.
  Make sure `withdraw`/`redeem` let the caller name an arbitrary `receiver` so a
  blocked user isn't permanently stuck.
- Add a `nonReentrant` guard on the value-moving entry points. Not required for
  plain USDC, but the guard is cheap and the vault may later hold a token with
  transfer hooks.

## 4. Tests that must exist before redeploy

1. **Replay this exact incident**: deposit 1 unit, donate 20,000 USDC, deposit
   15,000 USDC, assert shares > 0 and assert the attacker's redemption is
   strictly less than their outlay.
2. **Invariant fuzz**: for any sequence of deposits, redemptions and arbitrary
   direct donations, no depositor can withdraw more than they put in plus their
   pro-rata share of donations — and no deposit ever mints 0 shares.
3. **Rounding-direction invariant**: `previewDeposit(x) <= deposit(x)` returned
   shares, `previewRedeem(s) <= redeem(s)` returned assets; a deposit
   immediately followed by a redeem never returns more than was put in.
4. **Ordering**: assert `previewDeposit` is computed from `totalAssets` *before*
   the incoming `transferFrom`. Reading the post-transfer balance would
   systematically under-mint every depositor — an independent bug that OZ's
   `_deposit` ordering avoids and that a hand-rolled rewrite easily reintroduces.
5. **Zero and max**: `deposit(0)`, `redeem(0)`, `deposit(type(uint256).max / n)`
   for overflow behaviour in `mulDiv`.

## 5. Immediate remediation for the incident

Separate from the code fix: the vault is empty and 0xB2 is out 15,000 USDC. The
contract is non-upgradeable as described, so the path is deploy-new + migrate,
not patch-in-place. 0xA1's address and the 35,000.000001 USDC outflow are on
chain; that's a recovery/legal question, but preserve the trace now and pause new
deposits into the current vault before anyone else hits the same state.
