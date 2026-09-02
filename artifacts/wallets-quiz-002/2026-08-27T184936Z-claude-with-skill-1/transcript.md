# Executor transcript — 2026-08-27T184936Z-claude-with-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-08-27T184936Z-claude-with-skill-1/wallets-quiz-002

## assistant
I'll pull up the wallets skill first, since this is exactly a custody-design question.

## assistant
- **Skill** `{"skill":"wallets"}`

  > Launching skill: wallets

## assistant
- **Bash** `ls -a /home/damu/.cache/ethskills-evals/2026-08-27T184936Z-claude-with-skill-1/wallets-quiz-002`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals/2026-08-27T184936Z-claude-with-skill-1/wallets-quiz-002/answer.md <<'EOF'
# Custody for ~$250k treasury, solo signer

## Short answer

I can't sign off on the o … [9968 more chars]`

  > 171 /home/damu/.cache/ethskills-evals/2026-08-27T184936Z-claude-with-skill-1/wallets-quiz-002/answer.md

## assistant
Written to `answer.md`. I didn't sign off on the plan.

**The short version:**

Your teammate is answering a storage question ("where does the key live?") when the one that decides whether you lose $250k is an authority question ("how many independent things must an attacker compromise?"). On one Ledger that number is **one**.

**What I'd use instead:** a **2-of-3 Safe on mainnet where all three owner keys are yours** — Ledger, a different-vendor device, and a third kept off-site. A multisig is a *threshold*, not a committee; you meet 2-of-3 alone. Your "no second person" constraint rules out shared control, not threshold control. Plus a small separate hot wallet so the vault never touches a random dapp for gas.

**The difference in attacker terms:**

- **One Ledger** — any *one* of these is the whole treasury: device+PIN, the seed backup *by itself*, one bad signature you're tricked into approving, a clipboard swap, a vendor firmware/supply-chain failure.
- **2-of-3** — needs *two*, across different vendors and different physical locations. Finding one seed backup is worth nothing, and a single stolen key can't escalate: adding an owner or lowering the threshold is itself a transaction requiring the threshold.

Two points worth pulling out:

1. **The seed backup is the real hole in the single-Ledger plan.** The device has a PIN and a secure element; the 24 words on steel have neither. It's a bearer instrument for $250k that you are *required* to create and cannot skip. Threshold custody is what makes finding it insufficient.
2. **Do the recovery drill** (step 4 in the doc): fund with $50, then execute a transaction with signers **B+C only**, pretending A is destroyed. That's what catches a mis-recorded seed while it costs $50. Skip it — or store all three backups in one safe — and you get the complexity without the safety, which is worse than the Ledger plan.

The doc also covers the inheritance angle (you're solo; that's a real loss vector at this size), why EIP-7702 isn't a substitute here, and the blind-signing rule.

## run stats
- turns: 5
- duration: 98s
- cost: $0.3199965
- tokens in/out: 8/5940
