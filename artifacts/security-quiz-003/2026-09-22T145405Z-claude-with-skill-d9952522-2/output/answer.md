# The missing 25,000 TKN: a fee-on-transfer token credited at face value

## 1. The numbers identify the bug before we look at the code

Two ledgers exist. The internal one:

```
credited = 1,250,000 staked - 250,000 unstaked = 1,000,000   ← matches stakedBalance sum
```

The real one is 975,000. The gap is **25,000 TKN, exactly 2.000% of the 1,250,000
that was ever staked** — not 2% of the 1,000,000 outstanding, and not 2% of the
250,000 withdrawn. A discrepancy proportional to *cumulative inflow* can only
come from the deposit path: every `stake()` credits more than the pool actually
received.

The single-user report confirms the rate and the direction. They staked 10,000,
the UI showed 10,000, and unstaking 10,000 delivered 9,800 to their wallet —
a 200 TKN haircut, 2%, on a transfer *out*. A token that shaves 2% off an
outbound transfer shaves 2% off an inbound one too.

**TKN is a fee-on-transfer (or transfer-burn) token with a 2% fee.** Nothing was
stolen, no admin key was abused, no rebase happened. The fee is taken on every
`transfer`/`transferFrom`; the sender is debited the full `amount` and the
recipient is credited `amount * 0.98`. The 25,000 TKN sits with the token's fee
recipient, or was burned.

## 2. Tracing it through the contract

```solidity
function stake(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    stakedBalance[msg.sender] += amount;          // ← credits `amount`
}                                                  //   pool received 0.98 * amount

function unstake(uint256 amount) external {
    stakedBalance[msg.sender] -= amount;
    token.transfer(msg.sender, amount);           // ← debits the pool `amount`
}                                                  //   user receives 0.98 * amount
```

`stake()` credits the *requested* amount instead of the *received* amount. Each
stake opens a hole of `0.02 * amount`.

`unstake()` is arithmetically consistent on the pool side: the contract's balance
falls by exactly `amount`, which is what it decremented. The 2% the withdrawing
user loses is their own cost of using this token, not a second leak. So:

```
pool balance = 0.98 * 1,250,000 - 250,000
             = 1,225,000 - 250,000
             = 975,000   ✓ exactly the observed balance
```

The model reproduces the books to the token. That is the whole explanation.

For the 10,000 TKN user: they contributed 9,800 to the pool and extracted 10,000
from it. Their own 400 TKN loss (2% in, 2% out) is the token's fee and is
unavoidable. The 200 TKN of *other stakers' money* they walked away with is the
bug.

## 3. Why the shortfall grows, and why it looks fine until it doesn't

The hole is `0.02 x cumulative staked`. It is monotonic: every new deposit
enlarges it, and no withdrawal shrinks it. Nothing in the contract ever heals.

The contract is also **first-come-first-served**. `unstake()` reverts only when
the requested amount exceeds what is physically left in the pool, so early
unstakers were paid in full out of later stakers' principal. That is why three
weeks passed quietly: the shortfall was always there, but the pool only had to
be *solvent enough for whoever asked next*. Now that outflows have drawn the
balance down toward the claims, individual withdrawals are starting to hit the
token's insufficient-balance revert. The last 25,000 TKN of credited claims is
backed by nothing, and it is a bank run — the users who move fastest are paid,
and the slowest are left holding a `stakedBalance` the contract cannot honor.
New deposits make this *worse*, not better, because each one adds 2% more claims
than it adds assets, even as it briefly restores liquidity for the people exiting.

Also note the unchecked return value on `transferFrom` — not the cause here, but
a second latent custody bug if TKN ever returns `false` instead of reverting.

## 4. The fix: credit the measured balance delta

Never trust the requested amount. Measure what actually arrived.

```solidity
using SafeERC20 for IERC20;

uint256 public totalStaked;

function stake(uint256 amount) external nonReentrant {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;

    require(received > 0, "nothing received");
    stakedBalance[msg.sender] += received;   // credit what the pool HAS
    totalStaked              += received;
}

function unstake(uint256 amount) external nonReentrant {
    stakedBalance[msg.sender] -= amount;     // effects before interaction
    totalStaked               -= amount;
    token.safeTransfer(msg.sender, amount);  // recipient bears the exit fee
}
```

That one change makes `sum(stakedBalance) == totalStaked <= token.balanceOf(pool)`
an invariant that holds for every token, fee-taking or not. The staker who sends
10,000 is credited 9,800 and can withdraw 9,800 (receiving 9,604 in hand) — the
fee is charged to the person who incurred it instead of to the pool.

Three points on the delta pattern:

- The delta must be measured on the deposit only. Do **not** use a balance delta
  to decide how much to decrement on withdrawal; the pool's debit is the full
  `amount`, and measuring the outbound delta would re-introduce the same class of
  error in reverse.
- `nonReentrant` plus checks-effects-interactions is required, not optional, once
  you read `balanceOf` around an external call — a token with transfer hooks
  (ERC-777/ERC-1363-style) can re-enter mid-measurement.
- The delta pattern does not survive a *rebasing* token, and a fee whose rate the
  token owner can raise (to 100%, in the worst case) is still an unbounded risk
  you are accepting. Either document TKN's fee mechanics and owner powers as a
  trust assumption, or move to share-based accounting where each share is a
  pro-rata claim on the real balance. If you go share-based, protect the empty
  state against first-depositor inflation (virtual shares, or an initial dead
  deposit) — see OpenZeppelin `ERC4626`.

## 5. What to do about the stakers who cannot withdraw

The 25,000 TKN is genuinely gone from the pool's control. Fixing `stake()` stops
the bleeding for future deposits; it does not conjure back the assets already
paid to the fee recipient. Recognize the loss as real and decide who eats it.

The critical constraint: **this contract has no admin withdrawal and no upgrade
path, so the 975,000 TKN inside it can only ever leave through `unstake()`,
called by each staker, capped at their own credited balance.** You therefore
*cannot* implement a pro-rata haircut. There is no way to sweep the 975,000 into
a fair distributor contract. Any "socialize the loss" plan is unenforceable here;
the default outcome is simply a race, where the last ~25,000 TKN of claims gets
nothing. That is arbitrary rather than fair, and it rewards whoever is watching
mempools.

The recommended sequence:

1. **Stop new deposits immediately.** Remove staking from the UI, announce it,
   and say plainly that the contract is not pausable so the function remains
   callable on-chain. Every further deposit adds 2% more claims than assets.
2. **Top up the pool from the treasury.** This is the only mechanism available
   that makes every staker whole, and it needs no contract change: a plain
   `transfer` of TKN to the pool address raises its balance with no bookkeeping
   side effects. Because the top-up transfer is *also* taxed 2%, you must send
   `25,000 / 0.98 = 25,510.21 TKN` for 25,000 to land. Confirm the resulting
   `balanceOf(pool)` is >= 1,000,000 before announcing; over-send slightly and
   verify on-chain rather than trusting the arithmetic, in case the fee rounds
   or the rate has changed.
3. **Let everyone exit V1.** After the top-up, assets equal claims and every
   remaining `unstake()` succeeds. Each user still pays the token's own 2% exit
   fee on the way out — that is TKN's behavior, not your shortfall, and should be
   stated clearly so it isn't reported as a second bug.
4. **Also ask the TKN team for the fees.** The 25,000 TKN was collected by the
   fee recipient or burn address. If your side controls that recipient, or the
   token team will cooperate, recovering it there funds the top-up directly
   instead of out of treasury. Pursue this in parallel — do not let it block
   step 2, because the exit race is live right now.
5. **Deploy V2 with the delta-based `stake()`**, plus `SafeERC20`, a reentrancy
   guard, and a `pause()` behind a multisig so the next incident can be stopped
   instead of announced. Migrate users by having them withdraw from V1 and stake
   into V2; do not attempt an automated migration that moves tokens twice, since
   each hop costs another 2%.

Before V2 ships, add the tests that would have caught this: a fork test pinned to
mainnet TKN asserting `sum(stakedBalance) <= token.balanceOf(pool)` after an
arbitrary sequence of stakes and unstakes, and a mock fee-on-transfer token in
the unit suite. The invariant is one line and it is the whole bug.
