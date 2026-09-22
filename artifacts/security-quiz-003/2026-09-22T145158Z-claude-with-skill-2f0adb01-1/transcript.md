# Executor transcript — 2026-09-22T145158Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T145158Z-claude-with-skill-2f0adb01-1/security-quiz-003

## assistant
- **Skill** `{"skill":"security","args":"fee-on-transfer token accounting in a staking pool"}`

  > Launching skill: security

## assistant
- **Bash** `ls -a`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
- **Bash** `cat > answer.md <<'EOF'
# The missing 25,000 TKN

## Short version

Nothing was stolen and nothing left the pool other than to unstakers. TKN is a
**fee-on-transfer token**, and the pool credits `stak … [9600 more chars]`

  > 208 answer.md

## assistant
Written to `answer.md`. Summary:

**Cause:** TKN is a fee-on-transfer token (2%, charged to the recipient, both directions). `stake` credits `stakedBalance` with the *requested* amount, but only 98% actually arrives. Nothing was stolen.

The arithmetic is exactly determined by your two data points:
- Stakes: credited 1,250,000, received 1,225,000
- Unstakes: pool debited and sent 250,000 (users got 245,000)
- 1,225,000 − 250,000 = **975,000** ✓, against a 1,000,000 liability → 25,000 = 2% of cumulative deposits

You need *both* observations: the 10,000→9,800 exit proves the outbound fee, and the 975,000 balance proves it also applies inbound (outbound-only would leave exactly 1,000,000).

**Why it grows:** `stake` widens the gap by 2% of each deposit; `unstake` leaves it unchanged (the pool is debited in full, the fee comes out of the user's side). So unstaking never repairs it — it just converts the abstract shortfall into a concrete one. The final 25,000 TKN of claims can never be paid, first-come-first-served.

**Fix:** snapshot `balanceOf(address(this))` around the `transferFrom` and credit the measured delta, not `amount` — plus `nonReentrant`/CEI (load-bearing, since a reentrant stake would corrupt the delta measurement) and SafeERC20. Invariant to fuzz: `balanceOf(pool) >= totalStaked`.

**For the stuck stakers**, the contract needs no rescue function — anyone can transfer TKN *to* it. Pull `stake` from the frontend now, then donate ~25,511 TKN (grossed up for the inbound fee) so 25,000 lands; that alone restores solvency and unblocks every reverting user. The residual 2% exit fee is a separate hole: whitelist the pool in the token's fee exemption if available, otherwise airdrop ~20,000 TKN against the `Unstaked` events. Then migrate to a V2 with the corrected accounting — don't carry the old balances over, they're the fiction.

## run stats
- turns: 5
- duration: 99s
- cost: $0.45396000000000003
- tokens in/out: 105249/7627
- of which cache write/read: 22171/83070
