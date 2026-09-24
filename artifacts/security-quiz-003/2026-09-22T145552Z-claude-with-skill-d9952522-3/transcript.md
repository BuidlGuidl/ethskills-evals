# Executor transcript — 2026-09-22T145552Z-claude-with-skill-d9952522-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T145552Z-claude-with-skill-d9952522-3/security-quiz-003

## assistant
- **Skill** `{"skill":"security","args":"ERC-20 integration: staking pool accounting shortfall, fee-on-transfer token"}`

  > Launching skill: security

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T145552Z-claude-with-skill-d9952522-3/security-quiz-003/answer.md <<'EOF'
# The missing 25,000 TKN

## Short answer

Nothing left the po … [7209 more chars]`

  > ok

## assistant
Written to `answer.md`. Summary:

**Where it went:** nowhere — TKN charges a ~2% transfer fee, and the pool credits `stakedBalance` with the requested `amount` rather than the amount actually received. The numbers confirm it exactly: `0.98 × 1,250,000 − 250,000 = 975,000` (actual balance) while liabilities are `1,250,000 − 250,000 = 1,000,000`. The hole is precisely 2% of *cumulative* stakes. The 10,000-in/9,800-out report is the fee on the outbound leg.

**Why it grows:** unstakes don't shrink it (the pool debits the full `amount`; the exiting user eats the exit fee personally), so the deficit only ratchets up — 200 TKN per 10,000 staked. Payouts are first-come-first-served with no solvency check, so early exits drew down other people's principal until the balance dropped below the next claim.

**The fix:** measure the balance delta around `safeTransferFrom` and credit `received`, not `amount` (or explicitly `require(received == amount)` to reject FoT tokens) — plus `SafeERC20` and a reentrancy guard. Don't rely on whitelisting the token: a fee switch flipped post-launch is the likely cause here, and only delta-measurement survives that.

**For the stranded stakers** — the part that the code fix alone doesn't solve: pause `stake()` first (new deposits are currently funding earlier exits), then either backfill 25,000 from treasury (sending `25,000/0.98 ≈ 25,510` since the fee hits that transfer too) or switch to share-based payouts so all remaining stakers take the same ~2.5% haircut instead of the last ones taking a 100% loss. Disclose before unpausing.

## run stats
- turns: 4
- duration: 66s
- cost: $0.26941149999999997
- tokens in/out: 60752/4623
- of which cache write/read: 12993/47753
