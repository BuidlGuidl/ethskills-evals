# Custody review: agent-operated Safe holding ~$400k

## Verdict

**No, threshold 1 is not acceptable.** A 1-of-2 Safe with the agent's hot key as
an owner gives that hot key full control of the $400k. That is no safer than
keeping the treasury in the agent's EOA. It is arguably worse, because there are
now two keys that can each drain it on their own.

The PR confuses two different failure modes:

| Failure mode | Does 1-of-2 handle it? |
|---|---|
| Agent key **lost** (liveness) | Yes. The hardware wallet can still sign. |
| Agent key **stolen** (security) | **No.** The thief can do anything any owner can do. |

A $400k hot treasury is threatened mainly by the second case: server
compromise, leaked env var, dependency supply-chain attack, prompt injection
that makes the agent sign something hostile, or a key committed to git. The
design only protects against the first case.

## What a thief with the agent key can do under 1-of-2

With threshold 1, one owner signature satisfies `execTransaction`, so the thief
can do all of the following:

1. **Drain everything in one transaction.** Using `MultiSend`, they can send
   all ETH and all ERC-20s to their own address in a single atomic tx. Your
   hardware wallet has no time to react. Nothing is queued and there is no
   delay.
2. **Lock you out.** `removeOwner(prevOwner, yourHardwareWallet, 1)` or
   `swapOwner(...)` makes the thief the only owner. The "backup owner" is gone
   in one call.
3. **Plant persistence.** `enableModule(attackerModule)`, `setGuard(...)`, or
   `setFallbackHandler(...)` can keep control after you think you have rotated
   keys. A module bypasses owner signatures entirely.
4. **Use `delegatecall`** (operation = 1) to run arbitrary code in the Safe's
   storage context, including rewriting the owner list directly.
5. **Leave approvals behind.** Unlimited `approve()` calls to attacker-controlled
   spenders keep draining any funds that arrive later.

Being an owner does not help you win a race either. Your hardware wallet sits
in a drawer and the attacker's script runs in the same block they get the key.
So the backup owner only protects the funds if the agent key is lost. If the key
is stolen, the funds are gone.

## The real requirement, restated

The PR is right that the agent must be able to trade without a human in the
loop. It is wrong to conclude that the agent must therefore have **unlimited**
authority. What the agent needs is:

- autonomy for **routine, bounded, allow-listed** actions, and
- **no** unilateral authority over custody itself: withdrawals to arbitrary
  addresses, owner/threshold/module changes, arbitrary calls, `delegatecall`.

A Safe can enforce that split on-chain. Keep a threshold > 1 for anything
unbounded. Give the agent a narrowly scoped path for the routine actions.

## Recommended design

### Treasury Safe: 2-of-3 owners, threshold 2

| Owner | Who | Where / how stored | Hot or cold | Used for |
|---|---|---|---|---|
| 1. Agent signer | Agent | Non-exportable key in Cloud KMS / HSM / TEE. Never in `.env`, never in the repo, never in logs. | Hot (automated) | Proposing and co-signing Safe txs; nothing on its own |
| 2. Operator signer | You | A **separate** device from the agent host, e.g. a second hardware wallet you use routinely, or a phone wallet. | Warm / hot (manual) | Day-to-day co-signing: approving agent proposals, refilling limits, emergency revocation |
| 3. Recovery signer | You | Your existing hardware wallet, seed backed up offline (steel/paper, separate physical location). | **Cold** | Recovery and emergencies only; together with #2 it can do anything without the agent |

**Threshold: 2.**

Why 2-of-3 and not 2-of-2: with 2-of-2, losing either key freezes the funds.
With 2-of-3 you can lose **any one** key, including the agent's, and still
operate with the other two. So this design meets the PR's stated goal ("backup
in case the agent's key is lost") better than 1-of-2 does. It also adds theft
resistance.

Why the two human keys must be on different devices from each other and from the
agent: the property we want is "an attacker must compromise two independent
devices." If the operator key sits on the same server as the agent key, the
setup is effectively 1-of-1 again.

Optional: add a 4th owner that is a trusted contact's wallet or a second cold
backup, and keep threshold 2 (2-of-4). This makes recovery more robust if you
lose two of your own keys.

### Agent autonomy: a scoped module, not a lower threshold

To let the agent trade without a co-signer, attach an **on-chain permission
layer** to the Safe. Do not lower the threshold. Enabling it requires 2-of-3.
Use one or both:

1. **Zodiac Roles Modifier** (preferred for trading). Give a role to the agent
   address (ideally a separate agent "operator" key from the owner key, also in
   KMS) that allows **only**:
   - specific target contracts, e.g. the exact DEX router(s) and aggregator you
     trade through;
   - specific function selectors, e.g. `exactInputSingle` / the swap
     function you use;
   - parameter constraints: **`recipient` must equal the Safe address**,
     tokens in/out restricted to an allow-list (e.g. USDC, WETH, WBTC), and
     amountIn capped;
   - `approve` only to the allow-listed router, with bounded amounts;
   - `operation = Call` only (**no `delegatecall`**), `value` bounded;
   - rate/allowance limits per period (Roles v2 supports allowances), e.g.
     "at most $50k notional swapped per 24h".
2. **Safe Allowance Module** (for outbound transfers, if the strategy needs
   any, e.g. moving collateral to a CEX deposit address or paying gas to a
   relayer). Set a per-token spending limit with a reset period, e.g. 10k USDC
   per day, and pair it with a destination allow-list enforced by the Roles
   Modifier.

In addition, keep only a small ETH balance on the agent's own EOA for gas.

Variant if the strategy can't be expressed as scoped calls: split the funds.
Keep the bulk (e.g. $350k+) in the 2-of-3 treasury Safe with no agent module.
Keep a **bounded trading account** (e.g. $25–50k) that the agent controls, and
refill it from the treasury via a 2-of-3 transaction when needed. The maximum
loss is then the trading account balance, not the treasury.

## What the agent can and cannot do on its own

**Can do alone (no human signature):**
- Execute swaps on the allow-listed router(s), between allow-listed tokens,
  with output going back to the Safe, within per-tx and per-period caps.
- Grant bounded approvals to the allow-listed router only.
- Spend up to the Allowance Module limit per period, only to allow-listed
  destinations (if configured).
- Pay gas from its own small EOA balance.
- **Propose** any other Safe transaction and add its own signature. The tx sits
  in the Safe Transaction Service queue until you add the second signature.

**Cannot do alone (needs 2 of 3 signatures):**
- Transfer funds to any address not on the allow-list, or send anything above
  the caps.
- Add, remove, or swap owners, or change the threshold.
- Enable or disable modules, change the guard or fallback handler, or edit its
  own role permissions or allowances.
- Call arbitrary contracts or selectors, or use `delegatecall`.
- Approve arbitrary spenders or grant unlimited approvals.
- Upgrade the Safe singleton / masterCopy.

Anything outside the envelope becomes a proposal that you approve from the
operator key, usually in minutes from your phone or hardware wallet. The agent
runs the routine work and you approve the exceptions.

## What this buys you if the agent's key is stolen

Assume the attacker gets the agent's owner key **and** its role key (worst
case: the whole agent host is compromised).

| Attacker action | 1-of-2 (PR) | 2-of-3 + scoped role (recommended) |
|---|---|---|
| Send all funds to own address | ✅ one tx, $400k gone | ❌ recipient must be the Safe; needs 2 sigs |
| Remove your hardware wallet / change threshold | ✅ | ❌ needs 2 sigs |
| Enable a malicious module / `delegatecall` | ✅ | ❌ needs 2 sigs; role forbids delegatecall |
| Unlimited approval to attacker contract | ✅ | ❌ only allow-listed spender |
| Deliberately bad trades (max slippage, trade into an illiquid token they've pumped) | ✅ unbounded | ⚠️ limited to allow-listed tokens, per-tx cap, per-day cap, and whatever `amountOutMinimum` constraint you encode |
| Drain the Allowance Module limit | n/a | ⚠️ at most one period's allowance, only to allow-listed destinations |
| Drain agent's gas EOA | ✅ | ✅ (small amount by design) |

So in the worst case you lose roughly **one period's allowance + slippage losses
on capped trades + the gas float**. With the example numbers that is on the order
of a few thousand to low tens of thousands of dollars, set by you. Under the PR
design the loss is **$400k**, with no chance to react.

Recovery is also straightforward and cannot be blocked, because the attacker has
only one of three owner keys:

1. The monitoring alert fires (see below). You sign with operator + recovery
   keys (2 of 3).
2. In one batched Safe tx: revoke the agent's role / set its allowance to 0,
   `removeOwner` the agent key (threshold stays 2 with 2 remaining owners, or
   `swapOwner` to a fresh KMS key), revoke router approvals if desired.
3. Rotate the agent key in KMS, investigate the host, re-add the new key.

The attacker cannot front-run step 2 in a way that hurts you: with their one
key they can't change owners, modules, or thresholds.

## Additional requirements for the PR

- **Monitoring:** alert on every Safe event (`ExecutionSuccess`,
  `AddedOwner`, `RemovedOwner`, `ChangedThreshold`, `EnabledModule`,
  `ChangedGuard`) and on role/allowance usage approaching the cap. The design
  bounds the loss; monitoring shortens how long an attacker keeps access.
- **Key hygiene:** the agent key is created inside KMS/HSM and is
  non-exportable. No private keys in env vars on shared hosts, in `.env` files
  that could be committed, or in logs. Add `.env*`, `*.key`, `*.pem` to
  `.gitignore` and a pre-commit secret scan.
- **Test the permissions** on a mainnet fork (Anvil) before funding. Positive
  tests: the agent can swap within limits. Negative tests: the agent **cannot**
  transfer to a random address, set `recipient != Safe`, `delegatecall`, exceed
  the cap, or call `addOwnerWithThreshold`.
- **Rehearse recovery once** with the operator and recovery keys, so the
  emergency path is known to work before you need it.
- **Fund gradually:** start with a small amount, raise caps as the strategy and
  the permission set prove out.

## Summary

- 1-of-2 means whoever holds the agent key owns the whole $400k. The hardware
  wallet helps only if the agent key is lost, not if it is stolen.
- Use a **2-of-3 Safe**:
  - agent key in KMS/TEE (hot),
  - your operator key on a separate device (hot/warm),
  - your hardware wallet (cold, recovery).
- Give the agent autonomy through a **Roles Modifier / Allowance Module**, which
  enforces on-chain which contracts it can call, which tokens it can use, where
  output goes, and how much it can move per period. Don't give it autonomy
  through the threshold.
- If the agent key is stolen, the loss is bounded by the caps you chose instead
  of the whole treasury. You and your two keys stay in control and can remove
  the compromised key in one transaction.
