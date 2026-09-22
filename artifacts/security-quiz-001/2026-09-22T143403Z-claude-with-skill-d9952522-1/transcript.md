# Executor transcript — 2026-09-22T143403Z-claude-with-skill-d9952522-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143403Z-claude-with-skill-d9952522-1/security-quiz-001

## assistant
- **Skill** `{"skill":"security","args":"ERC-4626 vault share inflation / donation attack, first depositor rounding to zero shares"}`

  > Launching skill: security

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143403Z-claude-with-skill-d9952522-1/security-quiz-001/answer.md <<'MDEOF'
# Post-mortem: 0xB2 received 0 shares for a 15,000 USDC depo … [11193 more chars]`

  > written

## assistant
Written to `answer.md`. Summary:

**What happened:** classic ERC-4626 inflation/donation attack.

1. 0xA1 deposited 1 unit → `totalShares = 1` (the 1:1 empty-vault branch), the coarsest possible share.
2. 0xA1 transferred 20,000 USDC directly to the vault. Since `totalAssets` is `balanceOf(this)`, this moved the exchange rate without any vault function running — one share was now worth 20,000 USDC.
3. 0xB2's deposit computed `15,000,000,000 × 1 / 35,000,000,001 = 0.428… → 0`. Truncating integer division. `mint(0xB2, 0)` is a legal no-op, so nothing reverted; the USDC stayed and 0xB2 got nothing.
4. 0xA1's 1 share was 100% of supply, so redeeming paid out 100% of assets: 35,000.000001. Net profit +15,000 — exactly 0xB2's deposit; the 20,000 donation was never at risk.

**Whose bug:** ours, on three counts — externally-writable `totalAssets`, an empty-vault state reachable for 1 unit of cost, and no revert on zero shares. Not 0xB2's mistake: ERC-4626's `deposit` has no min-shares-out parameter, and an off-chain `previewDeposit` quote is worthless because the donation can be ordered ahead of the deposit in the same block. The profitability condition is just `victimDeposit ≤ donation`, so no deposit size is inherently safe.

**Fix:** OpenZeppelin `ERC4626` with `_decimalsOffset() = 6` (virtual shares/assets). Replaying the exact attack against it, 0xB2 gets 1,499,999 shares and 0xA1 recovers ~10,000 of the 20,000 spent — a 10,000 loss, so the attack is strictly unprofitable, not merely harder. Stays fully ERC-4626 compliant; only visible change is 12-decimal shares. Plus: revert on zero shares, seed-and-burn at deployment, a `minSharesOut` overload alongside the standard `deposit`, `SafeERC20`, and fuzz/invariant tests over `(donation, victimDeposit)`.

The answer also covers the internal-accounting alternative and its yield trade-off, and the operational steps — pause, redeploy (the decimals change isn't a safe in-place patch), and the fact that 0xB2's 15,000 is not recoverable on-chain, so compensation is a business call.

## run stats
- turns: 4
- duration: 100s
- cost: $0.381533
- tokens in/out: 62867/7902
- of which cache write/read: 16055/46806
