# The missing 25,000 TKN

## Short version

Nothing was stolen and nothing left the pool other than to unstakers. TKN is a
**fee-on-transfer token**, and the pool credits `stakedBalance` with the amount the
user *asked* to transfer rather than the amount the pool *actually received*. Every
stake mints ~2% of internal liability that is not backed by any real token. The pool
has been insolvent since block one; it only started reverting now because the buffer
built up by early stakers has been eaten by early unstakers.

---

## Deriving it from the numbers

Two observations pin down the token's behaviour, and each one is needed:

**1. The exit fee.** One user staked 10,000, was credited 10,000, unstaked all 10,000,
and received 9,800. The pool debited 10,000 from its own balance and called
`transfer(user, 10000)`; the user received 9,800. So the token takes **2% out of the
transfer amount, charged to the recipient**.

**2. The entry fee.** If the fee applied *only* on the way out, the pool would have
received the full 1,250,000 and sent 250,000, leaving 1,000,000 — which matches the
liability but not the observed 975,000. So the fee must also apply on the way in.
Check it:

| Flow | Credited in storage | Tokens actually moved |
|---|---|---|
| Stakes in | `+1,250,000` | pool **received** 1,250,000 × 0.98 = **1,225,000** |
| Unstakes out | `−250,000` | pool **sent** 250,000 (users received 245,000) |
| **Result** | **1,000,000 liability** | **975,000 balance** |

1,225,000 − 250,000 = **975,000**. Exact match, no residual. The hypothesis is fully
determined by the data: a flat 2% fee deducted from the recipient on every transfer,
in both directions.

**The deficit is therefore:**

```
shortfall = 2% × cumulative amount ever staked
          = 0.02 × 1,250,000
          = 25,000 TKN            ✔ matches exactly
```

## Why it grows

Look at what each operation does to the gap `liabilities − assets`:

- `stake(amount)`: liabilities `+amount`, assets `+0.98 × amount` → **gap grows by 2% of amount**
- `unstake(amount)`: liabilities `−amount`, assets `−amount` (the pool is debited the
  full amount; the fee is taken out of the *user's* side) → **gap unchanged**

So unstaking never repairs anything — it just converts an abstract shortfall into a
concrete one by draining the buffer. The gap is a strictly monotonic function of
cumulative deposits: every new staker deepens the hole by 2% of their own deposit and
is themselves 2% underfunded. This is a slow-motion bank run with a self-feeding
liability.

## Why reverts appear "now" and not earlier

`unstake` reverts when the requested `amount` exceeds the pool's remaining TKN
balance. Early on the pool held far more than any single claim, so everyone was paid —
out of tokens that belonged to *other* stakers. As the balance falls, the set of
claims that can still be satisfied shrinks. Reverts today mean some stakers now hold
a `stakedBalance` larger than what is left in the pool; mechanically the **final
25,000 TKN of credited balances can never be paid**, and the payout order is pure
first-come-first-served — the last people to press the button eat the entire loss.
(A staker who unstakes in small slices can still drain past a whale who is blocked
from exiting in one call; the queue is a gas race, not a queue.)

One more consequence worth stating plainly: even with a solvent pool, under this token
**a staker of 10,000 can never receive more than 9,800** from `unstake`, because the
fee is charged again on the way out. The 2% entry loss and the 2% exit loss are two
separate holes; fixing the accounting only fixes the first.

---

## The fix

### 1. Credit the measured delta, not the requested amount

The only correct way to account for an arbitrary ERC-20 is to measure the balance
before and after:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 requested, uint256 credited);
    event Unstaked(address indexed user, uint256 amount);

    constructor(IERC20 _token) {
        token = _token;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;

        require(received > 0, "Nothing received");

        stakedBalance[msg.sender] += received;   // credit what ARRIVED
        totalStaked += received;

        emit Staked(msg.sender, amount, received);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        stakedBalance[msg.sender] -= amount;     // reverts on underflow (0.8+)
        totalStaked -= amount;                   // effects before interaction

        token.safeTransfer(msg.sender, amount);  // user receives amount - fee

        emit Unstaked(msg.sender, amount);
    }
}
```

Key points:

- `received`, not `amount`, is what gets credited. The invariant becomes
  `token.balanceOf(pool) >= totalStaked` and it holds forever, including if the token
  turns its fee **on later** — a hardcoded `FEE_BPS` constant would not survive that.
- The `balanceOf` snapshot must bracket the transfer directly, and `nonReentrant` +
  CEI are load-bearing here: with a callback-capable token (ERC-777 hooks), a
  reentrant `stake` inside the transfer would corrupt the delta measurement.
- `SafeERC20` because a token that plays games with fees is exactly the kind that also
  returns no `bool`.
- The user is told in the `Staked` event (and must be told in the UI) that 10,000 in
  becomes 9,800 staked. The UI showing "10,000 staked" was not a display bug — the
  contract genuinely believed it, which is the whole problem.

**Simpler alternative if this pool is only ever meant to hold one well-behaved token:**
reject fee-on-transfer outright with `require(received == amount, "Fee-on-transfer
token")`. That is the right call for a pool with a fixed, known token — but it is not
available to you here, because your token *is* fee-on-transfer. You need the delta
version.

### 2. What happens to the stakers who cannot unstake

The deployed contract is immutable and has no admin withdrawal, so there is no way to
fix the existing balances in place. Concretely, in this order:

1. **Stop the bleeding first.** Take `stake` off the frontend immediately and tell
   users not to interact with the contract directly. Every further deposit deepens the
   deficit by 2% of itself and adds another victim. Do this before anything else —
   it costs nothing and the hole is still growing while you deliberate.

2. **Make the old pool solvent by donating to it.** The contract has no rescue
   function, but it needs none: anyone can `transfer` TKN *to* the pool address.
   Sending **25,000 TKN** (grossed up for the inbound fee: 25,000 / 0.98 ≈
   **25,511 TKN** sent, so 25,000 arrives) restores
   `balanceOf(pool) == Σ stakedBalance` and every single staker can then unstake their
   full credited balance. No one is stranded, and the first-come-first-served race
   disappears. This is the critical step — it is the only one that unblocks the
   currently-reverting users.

3. **Compensate the exit fee separately.** After step 2, a staker credited 10,000 still
   only *receives* 9,800, because the old contract can never send more than
   `stakedBalance`. Two options:
   - **Preferred:** if TKN has a fee-exemption whitelist (most fee-on-transfer tokens
     do, and you control the token if this is your own launch), whitelist the pool
     address. Transfers to and from it become fee-free, the 25,000 top-up is exact, and
     every staker gets back precisely what the UI promised. Cleanest outcome by far.
   - Otherwise, airdrop the 2% exit loss (≈20,000 TKN against the remaining 1,000,000
     of liabilities) from treasury, using the pool's `Unstaked` events as the claim
     list. Also reimburse the 245,000-cohort who already exited 2% light.

4. **Deploy V2 with the delta accounting above and migrate.** Do not try to preserve
   the old balances by writing them into V2 — they are the fiction. Have users exit
   the (now solvent) V1 and stake into V2, where their credited balance will match the
   tokens the pool actually holds.

5. **Before V2 goes out:** a fork test against mainnet TKN asserting
   `balanceOf(pool) >= totalStaked` after a fuzzed sequence of stakes and unstakes.
   That single invariant, fuzzed, would have caught this on day one.

**Cost to make everyone whole:** ~25,500 TKN to resolve the insolvency, plus ~20,000
TKN of exit-fee compensation if the whitelist route isn't available — call it 45,500
TKN worst case, against 1,000,000 of user deposits. That is cheap, and it gets
dramatically more expensive every day `stake` stays open. Step 1 today.

---

## The generalisable rule

**Never let internal accounting be derived from a number you passed to an external
contract. Derive it from what actually happened.** The parameter you hand to
`transferFrom` is a request; the balance delta is the fact. Anywhere those two can
diverge — fee-on-transfer, rebasing, blocklists, deflationary burns — the gap between
them becomes a permanent, compounding solvency hole in your books.
