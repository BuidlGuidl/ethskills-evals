# Post-mortem: 0xB2 deposited 15,000 USDC and received 0 shares

**Short version:** this is a textbook ERC-4626 **first-depositor / share-inflation
("donation") attack**. It is a bug in our contract, not a mistake by the depositor.
0xA1 is an attacker, not an unlucky user. The 15,000 USDC loss is ours to make good.

---

## 1. What actually happened, step by step

Everything below is in USDC base units. **USDC has 6 decimals**, so 1 unit =
0.000001 USDC and 15,000 USDC = `15_000_000_000` units.

Our mint rule is:

```
shares = assets * totalShares / totalAssets      // totalAssets = USDC the vault holds
if (totalShares == 0) shares = assets            // bootstrap branch
```

Solidity has no floating point. `/` is **integer division that truncates toward
zero**. That single property is the whole exploit.

| time | event | totalShares | vault USDC (units) |
|---|---|---|---|
| 09:12 | 0xA1 `deposit(1)` → bootstrap branch mints 1 share | 1 | 1 |
| 09:13 | 0xA1 sends 20,000 USDC **by plain ERC-20 transfer** | 1 | 20_000_000_001 |
| 09:41 | 0xB2 `deposit(15_000_000_000)` | 1 | 35_000_000_001 |
| 09:44 | 0xA1 `redeem(1)` | 0 | 0 |

**The 09:13 transfer is the attack.** A raw `token.transfer(vault, …)` never calls
our contract — there is no hook, no callback, nothing to reject. But
`totalAssets()` is derived from `USDC.balanceOf(vault)`, so the vault's asset side
grew by 20,000 USDC while the share side stayed at exactly **1 share**. The price of
one share went from 0.000001 USDC to 20,000.000001 USDC in one transaction, with no
state change inside our code at all.

**The 09:41 mint then rounds to zero:**

```
shares = 15_000_000_000 * 1 / 20_000_000_001
       = 0.749999999962...
       → 0        (integer division truncates)
```

`mint(0xB2, 0)` is a perfectly valid no-op. The `transferFrom` succeeded, the
require checks (`amount > 0`, allowance, balance) all passed, and nothing in the
function asserted that the caller received anything. **That is why the transaction
did not revert.** It did exactly what we wrote: it took 15,000 USDC and minted the
truncated result, which was nothing.

**The 09:44 redemption collects:**

```
payout = totalAssets * shares / totalShares
       = 35_000_000_001 * 1 / 1
       = 35_000_000_001 units = 35,000.000001 USDC
```

0xA1 owned 1 of 1 outstanding shares — 100% of the vault — so they took 100% of the
assets, including 0xB2's deposit.

**Attacker P&L:** paid in 0.000001 + 20,000 = 20,000.000001 USDC, withdrew
35,000.000001 USDC. Net **+15,000.00 USDC**, i.e. precisely 0xB2's deposit. The
20,000 USDC "donation" was never a gift; it was working capital the attacker got
back in full because they held every share. The only cost of the attack was gas
and 28 minutes of capital lock-up.

### Why the attacker picked 20,000

To steal from a victim depositing `V`, the attacker must make the share price
exceed `V` so the division floors to zero: `V * totalShares / totalAssets < 1`, i.e.
`totalAssets > V` while holding `totalShares == 1`. They needed the vault to hold
more than 15,000 USDC before 0xB2's transaction landed; 20,000 gave margin. This is
cheaply done by watching the mempool — the deposit sits there in public before
inclusion, so the attacker can size the donation to the victim's exact amount and
bundle donate-then-let-victim-land. MEV infrastructure makes this a reliable,
repeatable attack against any fresh vault, not a lucky one-off.

---

## 2. Is this a contract bug or depositor error?

**A contract bug. Unambiguously.** Three independent defects, any one of which
would have stopped this:

1. **`totalAssets()` trusts `balanceOf(address(this))`.** Anyone on earth can
   increase that number with a transfer we cannot observe or refuse. We made an
   attacker-controlled value the denominator of our pricing function. Same class of
   error as reading a DEX spot price as an oracle: manipulable by an outsider in a
   single transaction.
2. **We accept a deposit that mints zero shares.** Any function that moves a user's
   funds must assert the user got something back. There is no legitimate reason to
   let `shares == 0` through.
3. **The bootstrap branch lets one share represent the entire vault.** 1 total
   share means the share price has 0 bits of precision below "everything," so every
   subsequent deposit rounds against the depositor.

0xB2 did nothing wrong. They called a public `deposit` on a live mainnet vault with
a normal amount and it returned success. Nor could they have defended themselves:
`previewDeposit` would have quoted `0` only if they had called it in the *same*
transaction, and even a slippage check in their own wrapper would only have turned
the theft into a revert — protection a normal EOA user has no way to add. EIP-4626
calls this out directly in its security considerations: mitigating the inflation
attack is the **implementer's** responsibility, because the standard's
`convertTo*` rounding rules are what make it possible.

A note on causation: it does not matter whether our mint math reads the balance
*before* or *after* pulling the deposit in — here `15e9 * 1 / 35_000_000_001` is
also `0`. But if we are reading the balance *after* the `transferFrom`, that is a
**second, separate bug** that shortchanges *every* depositor forever, attack or no
attack, and must be fixed in the same pass. Verify which one the deployed code does.

---

## 3. What we ship

Stay on ERC-4626 — the standard is fine, our implementation is not. Do not hand-roll
the math again. **Inherit OpenZeppelin v5's `ERC4626`**, which has the virtual-offset
mitigation built in, and layer the rest on top.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20}   from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20}  from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UsdcVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Fix #2: the vault's own books. Donations can no longer move the price.
    uint256 private _bookedAssets;

    constructor(IERC20 usdc) ERC20("USDC Vault", "vUSDC") ERC4626(usdc) {}

    /// Fix #1: virtual shares/assets. 6 offset decimals => 1e6 virtual shares
    /// against 1 virtual asset, so shares are quoted in 18-decimal-like precision
    /// even though USDC has 6. Makes truncation-to-zero economically impossible.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /// Fix #2 cont.: internal accounting, NOT balanceOf(address(this)).
    function totalAssets() public view override returns (uint256) {
        return _bookedAssets;
    }

    /// Fix #3: never take a user's money without giving them shares.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        require(assets > 0, "zero assets");
        require(shares > 0, "zero shares minted");
        _bookedAssets += assets;          // effects before interactions (CEI)
        super._deposit(caller, receiver, assets, shares);
    }

    function _withdraw(
        address caller, address receiver, address owner, uint256 assets, uint256 shares
    ) internal override nonReentrant {
        require(shares > 0, "zero shares burned");
        _bookedAssets -= assets;
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /// Yield/donations are now opt-in and explicit, since totalAssets() is booked.
    function sync() external {
        uint256 held = IERC20(asset()).balanceOf(address(this));
        require(held >= _bookedAssets, "accounting underflow");
        _bookedAssets = held;             // gate this behind a role + drip if you
    }                                     // do not want donation front-running
}
```

### The four changes, and why each one matters

**1. Virtual shares and assets (`_decimalsOffset`) — the primary fix.**
OZ prices every conversion as
`shares = assets.mulDiv(totalSupply + 10**offset, totalAssets + 1, Floor)`.
The `+1` virtual asset and `10**offset` virtual shares are permanently owned by
"nobody," so a donation is diluted across them and the attacker can never capture
their own donation back.

Run our exact attack against `offset = 6`:

- 0xA1 deposits 1 unit → `1 * (0 + 1e6) / (0 + 1)` = **1,000,000 shares**, not 1.
- 0xA1 donates `D` units.
- 0xB2 deposits 15,000 USDC → `15e9 * (1e6 + 1e6) / (D + 2)`. To floor this to
  zero, the attacker needs `D > 3e16` units = **30 billion USDC** — more than the
  entire USDC supply.
- Worse for them, they'd hold only `1e6` of `2e6` effective shares, so redeeming
  returns about half. They would burn ~$15 billion to steal $15,000.

The attack doesn't get patched; it gets priced out of existence.

**2. Internal `_bookedAssets` instead of `balanceOf(this)` — closes the vector at
the source.** With this, the 09:13 transfer is inert: the USDC sits in the contract
and the share price does not move at all. This is defense in depth on top of (1),
and it is what makes the fix robust against variants we haven't thought of.
*Tradeoff to be aware of:* real yield that arrives as a direct transfer (an airdrop,
a strategy's profit) no longer shows up automatically — it must be booked through
`sync()`/`harvest()`. If the vault will earn yield, gate `sync()` behind a keeper
role and stream it over time, otherwise a searcher can deposit right before a large
`sync()` and skim the step change.

**3. `require(shares > 0)` — the cheap backstop.** One line, and 0xB2's transaction
reverts with their funds intact instead of succeeding into a black hole. This is
the rule for *any* value-moving function: assert the user received something.

**4. Seed the vault at deployment, in the same transaction.** Even with (1) and (2),
never let a hostile address be the first depositor. In the deploy script, atomically
deposit ~1,000 USDC from the deployer and send the resulting shares to
`address(0)`. Burned shares can never be redeemed, so there is a permanent,
non-zero denominator from block one and no bootstrap branch to game.

### Also in this change set

- **Rounding always favors the vault**, never the caller: `deposit`/`redeem` floor,
  `mint`/`withdraw` ceil. OZ's `Math.mulDiv` with explicit `Rounding` gets this
  right; our hand-rolled `*/` did not.
- **`SafeERC20`** for every transfer. USDC is upgradeable, pausable and has a
  blocklist; `safeTransfer`/`safeTransferFrom` handles non-standard returns and
  surfaces failures instead of silently continuing.
- **Measure what actually arrived.** Compute `assets` as
  `balanceAfter - balanceBefore` around the `transferFrom` rather than trusting the
  argument, and never read the balance *after* the pull when computing the share
  price (see §2).
- **CEI + `nonReentrant`** on `_deposit`/`_withdraw`, as above.
- **Tests that would have caught this**, added to CI as regressions:
  a) the exact 1-unit-deposit → donate → victim-deposit → redeem sequence, asserting
  the victim's shares are `> 0` and their redeemable value is `>= 99.99%` of their
  deposit; b) a fuzz test over `(donation, victimDeposit)` asserting
  `previewDeposit(x) > 0` for every `x >= 1 USDC`; c) an invariant test that no
  sequence of deposits/withdrawals/donations lets any address exit with more assets
  than it put in. Run `slither .` before redeploy — its `incorrect-shift`/rounding
  and unchecked-return detectors plus `forge test --fuzz-runs 10000` are table
  stakes here.

---

## 4. Incident response (do this before the code fix)

The vault is empty and the bug is live and trivially repeatable — every new
depositor is exposed right now.

1. **Pause deposits immediately** if a pause exists; if not, get a public warning
   out and pull the UI/frontend so no one else deposits.
2. **Do not upgrade in place** unless you are certain of the storage layout. Deploy
   the fixed vault fresh, seeded and verified on Etherscan, and migrate.
3. **Make 0xB2 whole: 15,000 USDC.** Their loss is exactly the attacker's profit,
   and it was caused by our code, not their behaviour.
4. **Check for other victims.** Grep the logs for any `Deposit`-style event with a
   zero share amount, and for any address holding zero shares that has ever sent
   USDC to the vault. Assume 0xA1 tried this on every vault we've shipped.
5. **Trace 0xA1** and file the addresses with Chainalysis/TRM and the exchanges;
   also worth checking whether 0xA1 has run the identical pattern elsewhere, which
   helps attribution.
6. **Write up and publish the post-mortem.** Depositors will find this on-chain
   regardless; getting ahead of it is the only version where we keep any trust.

---

## 5. The one-sentence lesson

Any value a contract reads from `balanceOf(address(this))` is an input the outside
world controls — and any division in Solidity truncates — so a vault that prices
shares off its own balance will eventually mint someone zero shares and keep their
money.
