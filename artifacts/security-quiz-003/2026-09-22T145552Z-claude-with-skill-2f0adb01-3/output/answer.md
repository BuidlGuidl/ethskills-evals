# The missing 25,000 TKN: a fee-on-transfer token met a contract that trusts `amount`

## 1. The short answer

Nothing left the pool that you didn't send. **TKN is a fee-on-transfer (tax/deflationary)
token with a 2% fee, and the fee is deducted from the amount the *recipient* receives.**

So on every `stake()`:

- the staker's wallet is debited `amount`
- the pool is credited `amount * 0.98`
- the pool's ledger records `stakedBalance[user] += amount` — the **full, pre-fee** number

The contract credits a liability it never received the assets for. The gap is 2% of every
deposit, it is realised at the moment of the deposit, and it never comes back.

The missing tokens are not "lost" — they are sitting at the token's fee collector (or were
burned to `0x0`). You can see this directly on-chain: **every stake transaction emits two
`Transfer` events**, one of `9,800` to the pool and one of `200` to the fee recipient /
`address(0)`. That is the whole mystery, visible in the receipt logs of any stake tx.

## 2. The arithmetic proves it exactly

Let `S = 1,250,000` (cumulative staked), `U = 250,000` (cumulative unstaked), `f = 2%`.

**Ledger** (what the contract thinks it owes):
```
sum(stakedBalance) = S - U = 1,250,000 - 250,000 = 1,000,000   ✓ matches
```

**Reality** (what the contract actually holds):
```
balance = S*(1-f) - U = 1,225,000 - 250,000 = 975,000           ✓ matches
```

**Deficit:**
```
1,000,000 - 975,000 = 25,000 = 0.02 * 1,250,000 = f * S
```

The shortfall is exactly 2% of *cumulative gross deposits*. There is no other quantity in
this system that equals 25,000; that is the fingerprint.

### Why it must be a fee on *both* legs

The single user's report pins down the second leg:

| Hypothesis | Pool balance would be | User unstaking 10,000 receives |
|---|---|---|
| Fee on inbound only | 975,000 ✓ | 10,000 ✗ (they got 9,800) |
| Fee on outbound only | 1,000,000 ✗ | 9,800 ✓ |
| **Fee on every transfer (2%)** | **975,000 ✓** | **9,800 ✓** |

Only "2% on every transfer, taken out of the delivered amount" explains both the aggregate
and the individual receipt. Note the outbound fee is *not* what breaks the pool: on exit the
pool is debited the full 10,000 and the staker eats the 200. That is the staker's loss, not
the pool's. The pool's loss is entirely the **inbound** leg. (Total TKN taken by the token
contract from these flows: 25,000 on the way in plus 5,000 on the way out = 30,000; only the
25,000 is your solvency hole.)

### Why the shortfall grows

```
deficit(t) = 0.02 * cumulative_staked(t)
```

`cumulative_staked` is monotonically increasing, so the deficit is monotonically increasing.
Unstaking never shrinks it — an exit removes equal amounts from both the ledger and the
balance. **Every new 10,000 TKN stake enlarges the hole by another 200 TKN.** The pool is
strictly more insolvent after every single deposit.

### Why early unstakers got paid and today's are reverting

Full-value payouts were possible only because later stakers' principal was still sitting in
the contract. The pool has been honouring 100% claims out of a 98% asset base — a
first-come-first-served drain. The contract can satisfy withdrawals while
`balance >= requested`, i.e. while fresh deposits outrun the accumulated 2% leakage. Once the
remaining balance falls under the next requested amount, `token.transfer` reverts with
insufficient balance. The reverts starting now are the pool running out of other people's
money. **This is a live bank run**, and the current code rewards whoever pays the most gas.

### Ruled out

- **Reentrancy** — `unstake` decrements before transferring (CEI-correct), and there is no
  way to inflate the ledger via `stake`.
- **Admin theft / stray transfers** — none exist, and both would break the "exactly 2% of
  cumulative deposits" identity.
- **Rebase / supply change** — stated as not having happened, and a rebase would move the
  balance without any relationship to `S`.
- **Decimals** — a decimals mistake produces a 10^n error, not a clean 2%.

## 3. The code fix: measure what you actually received

The rule: **never credit `amount`; credit the balance delta.** The parameter is what the
user *asked* to send; only the balance change is what arrived.

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
    uint256 public totalStaked;            // invariant: == sum(stakedBalance)

    event Staked(address indexed user, uint256 requested, uint256 credited);
    event Unstaked(address indexed user, uint256 amount);

    constructor(IERC20 _token) { token = _token; }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before; // <-- the fix

        require(received > 0, "Nothing received");

        stakedBalance[msg.sender] += received;
        totalStaked += received;
        emit Staked(msg.sender, amount, received);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        stakedBalance[msg.sender] -= amount;   // 0.8.x reverts on underflow
        totalStaked -= amount;
        token.safeTransfer(msg.sender, amount);  // caller bears any exit fee
        emit Unstaked(msg.sender, amount);
    }
}
```

What changed and why each part matters:

1. **Balance-delta accounting** — the liability can never exceed the assets. The invariant
   `token.balanceOf(pool) >= totalStaked` now holds by construction for any fee schedule.
2. **`totalStaked`** — makes the invariant cheap to assert in tests/monitoring and in an
   invariant fuzz run (`forge test --fuzz-runs 10000`). Assert it after every operation.
3. **`SafeERC20`** — the original bare `transfer`/`transferFrom` also silently ignores tokens
   that return no `bool` (USDT-style). Unrelated to this bug, but it is the same class of
   "assumed the token is well-behaved" mistake.
4. **`nonReentrant`** — the balance-delta pattern is only safe if the token cannot re-enter
   between the two `balanceOf` reads (ERC-777 / callback tokens can). Without the guard the
   fix introduces a new bug.
5. **Exit semantics** — `unstake` debits the credited amount and lets the staker absorb the
   outbound fee. The pool must never try to "gross up" the exit; that would re-create the
   hole on the way out.

**The alternative, if a 1:1 pool is a product requirement:** reject the token class outright
rather than supporting it.

```solidity
require(received == amount, "Fee-on-transfer token not supported");
```

Pick one deliberately. Do not ship code that assumes 1:1 without asserting it. Also note the
delta pattern is still wrong for **rebasing** tokens (stETH) — there, credit shares, or
require the wrapped version (wstETH).

## 4. What happens to the stakers who cannot unstake

This is the part that is not a code change, and it is the part that matters most. **The pool
is insolvent by 25,000 TKN against 1,000,000 TKN of claims — a 2.5% shortfall. Redeploying
fixed code does nothing for the existing hole.** Do these in order.

**Step 1 — stop the bleed, today.** Disable `stake()` at the frontend immediately and, if the
contract has any pause capability, on-chain. Every new deposit makes the hole deeper *and*
new depositors are funding the exits of earlier ones while being told the pool is 1:1. That
is a disclosure problem, not just an engineering one. Keeping deposits open now is the single
worst thing you can do.

**Step 2 — decide who eats the 25,000.** There are only two honest options:

- **(a) Top up (recommended).** The treasury sends 25,000 TKN into the pool and everyone is
  made whole. Watch the trap: sending 25,000 delivers only 24,500 through the 2% fee. You
  must send **`25,000 / 0.98 = 25,510.21 TKN`**, or get the pool address added to the token's
  fee-exemption allowlist first (most tax tokens have one — ask the token team; this is also
  worth doing permanently for the new pool). Verify with `balanceOf` after the transfer, not
  with the amount you typed.
- **(b) Socialise the loss pro-rata.** If no treasury funds exist, every remaining staker
  takes the same haircut instead of a gas race deciding it:
  ```
  redemptionFactor = poolBalance / totalCredited = 975,000 / 1,000,000 = 97.5%
  ```
  A 10,000 TKN staker redeems 9,750 (and receives 9,555 after the 2% exit fee — state this
  number in the announcement, not the pre-fee one). This is strictly fairer than the status
  quo, where the first ~97.5% of claimants get 100% and the tail gets 0%.

**Step 3 — snapshot and migrate.** Freeze the current pool, take a snapshot of
`stakedBalance` at a stated block, and deploy the fixed contract. Seed it either with the
topped-up full 1,000,000 (option a) or with the existing 975,000 (option b), and let users
claim pull-style against the snapshot:

```solidity
mapping(address => uint256) public credited;     // from snapshot
mapping(address => bool)    public claimed;
uint256 public immutable factorBps;              // 10_000 for (a), 9_750 for (b)

function claim() external nonReentrant {
    require(!claimed[msg.sender], "Already claimed");
    uint256 owed = (credited[msg.sender] * factorBps) / 10_000;  // multiply before divide
    require(owed > 0, "Nothing owed");
    claimed[msg.sender] = true;
    token.safeTransfer(msg.sender, owed);
}
```

Pull-based claiming means no gas race, no ordering advantage, and no revert-on-exhaustion —
the contract is solvent against its claim set by construction.

**Step 4 — disclose.** Publish the numbers above, including the fact that the ~250,000 of
early exits were paid in full out of later stakers' principal. Users can already read the
balance; a post that matches the chain is the only version that survives.

## 5. Before the redeploy

- Verify the token's actual fee on-chain (`eth_call` a transfer simulation, or read the fee
  variable) rather than trusting the 2% inferred here — some tax tokens use different
  buy/sell/transfer rates, and some can change the rate. If the fee is mutable by the token
  owner, that is a standing risk to any integration and belongs in your docs.
- Add an invariant test: after any sequence of stakes/unstakes,
  `token.balanceOf(pool) >= totalStaked`. This bug would have been caught by one fuzz run
  against a mock fee-on-transfer token.
- Run Slither, and verify the source on Etherscan after deploying.
- When rewards logic lands, size it from `totalStaked`, never from `balanceOf(address(this))`
  — otherwise a direct token donation inflates rewards.
