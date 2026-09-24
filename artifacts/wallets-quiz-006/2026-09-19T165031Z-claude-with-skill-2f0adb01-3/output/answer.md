# Custody design review: agent-operated treasury Safe (~$400k, Ethereum mainnet)

## Verdict

**No, reject threshold 1.** A 1-of-2 Safe where one owner is the agent's hot key is,
from a security point of view, **an EOA holding $400k with a hot key**. The Safe
adds a contract and a second owner, but it does not add a second approval for anything.
The hardware wallet only helps if the agent's key is *lost*. It does nothing if
the key is *stolen*, and theft is the case that matters for a hot key on a server.

## Why threshold 1 fails

### 1. One key can do everything
In a Safe, `threshold` is the number of owner signatures needed for **every**
Safe transaction. With threshold 1, the agent key alone can:

- transfer all ETH and tokens to any address,
- `approve` any spender for unlimited amounts,
- run arbitrary calls, including `delegatecall` through MultiSend or any contract,
- **call the Safe's own admin functions**: `addOwnerWithThreshold`, `removeOwner`,
  `swapOwner`, `changeThreshold`, `enableModule`, `setGuard`, `setFallbackHandler`.

### 2. The "backup owner" can be removed by the attacker
The PR says the hardware wallet is "there as a backup." But with threshold 1, a thief
holding the agent key can send `removeOwner(prev, hardwareWallet, 1)` or
`swapOwner(...)` in the **same block** as the drain, or before it. They can also
enable a malicious module that keeps access after you rotate keys. Your
hardware wallet has no veto. At best it can race the attacker, and the attacker
chooses when that race begins. Draining $400k takes one transaction, or one
MultiSend batch, in the next block. No human reacts that fast.

### 3. The keys are unequal, and the weaker one decides
Security is set by the *easiest* key to steal. Here that is a key that:
- sits on an internet-connected server,
- is used automatically, with no human looking at each signature,
- is used by software that reads untrusted input (market data, APIs, maybe LLM
  prompts). That opens it to prompt injection, dependency and supply-chain
  compromise, leaked `.env` files and logs, and a compromised host.

The skill's rule applies directly: *"Assume keys will be compromised. Design so a
compromised agent key doesn't mean total loss."* Threshold 1 does the opposite: a
compromised agent key **is** a total loss.

### 4. The PR's premise mixes two requirements
"The agent needs to act on its own" is true, but it means the agent needs
**bounded** autonomy for **trading**. It does not need unbounded authority over
**custody**: withdrawing to arbitrary addresses, changing owners, enabling
modules. Those are separate powers, and a Safe lets you grant them separately.
The fix is to keep the agent's autonomy and remove its unilateral control of the
treasury.

## Recommended design

### Owner set and threshold: **2-of-3 Safe**

| Owner | Who / what | Where the key lives | Hot/cold |
|---|---|---|---|
| **A: Agent key** | the trading agent | Non-exportable key in a cloud KMS/HSM or a TEE on the agent's host. Never a plaintext env var, file, or repo secret. The agent process can ask for signatures but cannot read the key. | **Hot**, automated |
| **B: Human operational key** | you | A separate device, e.g. a phone wallet or a second hardware wallet you keep at hand. **Never on the agent's server or in the same cloud account.** Used for routine co-signing. | **Hot-ish**, manual |
| **C: Human recovery key** | you | Your existing hardware wallet, with the seed backup offline in a separate physical location. Used only for recovery and admin changes. | **Cold** |

**Threshold = 2.**

Rules that make this setup hold up:
- B and C must be **independent**: different devices, and different seeds
  (not two accounts from the same mnemonic).
- None of the three keys should share a compromise path with another. In
  particular, B must not be reachable from the agent's infrastructure.
- A 2-of-3 threshold also keeps you able to act: lose any one key and the
  other two can still rotate it out.

### Giving the agent autonomy without custody: a scoped module

A Safe **module** can execute transactions without owner signatures. So give the
agent **one tightly scoped module permission**, not an owner threshold of 1.
Use the **Zodiac Roles Modifier (v2)**, which is audited and made for exactly
this. Assign a role to the agent's address with:

- **Target allowlist**: only the specific DEX router(s) or aggregator you trade on,
  plus `approve` on allowlisted tokens with the **spender pinned** to those routers.
- **Function allowlist**: only the swap functions you actually use.
- **Parameter conditions**: `recipient` / `to` **must equal the Safe's own address**.
  Token in and token out must be on the allowlist. `operation` must be `Call`,
  **never `DelegateCall`**. Value must be 0 except where needed.
- **Rate limits / allowances**: a cap on notional traded per period (for example,
  a daily volume budget you choose; start small, such as $25–50k/day, and raise it
  with experience).
- **Nothing else.** No `transfer` to arbitrary addresses, no calls to the Safe
  itself (so no owner, threshold, module, or guard changes), no arbitrary
  contracts, no bridges.

Module setup and every later permission change is a 2-of-3 Safe transaction, so
changing it takes you, not the agent.

> **Simpler alternative if you don't want to maintain a Roles config:** keep the
> $400k in the 2-of-3 treasury Safe and give the agent a separate **trading float**
> (its own small Safe or KMS-backed EOA) holding a capped amount, e.g. $20–40k.
> Top it up with 2-of-3 transactions from the treasury, and have the agent sweep
> profits back. The worst-case loss equals the float. This is cruder but very
> hard to misconfigure. Either option is acceptable; threshold 1 on the whole
> treasury is not.

Also:
- Add **monitoring and alerts** on the Safe (owner/threshold/module/guard changes,
  outflows, unusual swap volume) so you find out about a compromise within minutes.
- Optionally add a **Safe Guard** that rejects `delegatecall` and calls to the
  Safe itself, as defense in depth.
- Test the whole setup on a mainnet fork (Anvil) first, including the "agent key
  stolen" drill below.

## What the agent can and cannot do on its own

**The agent CAN, alone (through its Roles permission):**
- Run swaps on the allowlisted venues between allowlisted tokens, with output
  going back to the Safe, up to the per-period volume cap.
- Approve allowlisted tokens to the allowlisted routers only.
- **Propose** any other transaction to the Safe (sign it as owner A and queue it
  in the Safe Transaction Service). It counts as one of the two signatures.

**The agent CANNOT, alone:**
- Send ETH or tokens to any address other than the Safe (no withdrawals).
- Approve arbitrary spenders, call arbitrary contracts, or `delegatecall`.
- Exceed its trading cap.
- Add or remove owners, change the threshold, enable or disable modules, change
  its own role, or set a guard or fallback handler. All of these need 2 of 3.
- Do anything outside its role that you haven't co-signed with B or C.

**Anything outside the envelope** (larger rebalances, new venues, withdrawals,
paying expenses) follows the normal pattern: the agent proposes, and you check
and co-sign with B. Only the unusual actions wait on you. Routine trading does not.

## What this design buys you if the agent's key is stolen

| | Threshold 1 (PR) | 2-of-3 + scoped role (recommended) |
|---|---|---|
| Attacker can withdraw the treasury | **Yes, all $400k, in one tx** | **No.** Withdrawals need 2 signatures; the attacker has 1 |
| Attacker can remove your hardware wallet / add owners / add a backdoor module | **Yes** | **No.** Admin changes need 2 of 3 |
| Attacker's worst case | Total loss plus loss of control of the Safe | Bad trades inside the allowlist, with proceeds still landing in the Safe, limited by the per-period cap (see the caveat below) |
| Your response | Race the attacker (you lose) | B + C (2 of 3, no agent needed) call `removeOwner`/`swapOwner` to rotate out key A, and revoke or re-key its role. Funds never left the Safe |
| Lost (not stolen) agent key | Hardware wallet takes over | B + C swap in a new agent key. Same result, and B + C are the only keys that can do it |

**Honest caveat about the remaining risk:** a thief using the agent's role cannot
send funds out, but could still do deliberately bad swaps. For example, they could
trade into a thin pool they have manipulated, or skip slippage protection so that
they sandwich the trade. Roles conditions can't enforce a fair price. That is why
the **volume cap** matters: it bounds this loss to a known amount per period, and
monitoring plus a quick B + C revocation stops it. If you want to reduce this
further, allow only venues or aggregators where you can pin a strict
`minAmountOut` condition, or use the trading-float alternative, where the loss is
bounded by the float. Either way, the worst case goes from **"$400k gone and the
Safe lost"** to **"a capped, recoverable loss on trading budget."**

Also note that 2-of-3 with the agent as an owner means **agent key + key B** can
act together. That is the reason B must not live anywhere the agent's
infrastructure can reach. An attacker must then break into two unrelated
environments, not one.

## Summary for the PR
- Threshold 1 with an agent hot key means a single point of failure over $400k.
  The "backup" hardware wallet can be removed by the attacker and provides
  no protection against theft.
- Replace it with a **2-of-3 Safe**: agent key (hot, KMS/TEE), human operational
  key (separate device), human recovery key (cold hardware wallet). **Threshold 2.**
- Give the agent autonomy through a **Zodiac Roles** permission limited to specific
  swaps, with output back to the Safe and a volume cap, or through a capped
  **trading float**. Do not give it owner-level unilateral authority.
- If the agent's key is stolen, the treasury stays in place, the attacker cannot
  lock you out, and the two human keys rotate the agent out without its cooperation.
