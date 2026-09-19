# Custody review: agent treasury Safe (~$400k, Ethereum mainnet)

## Verdict

**Reject threshold 1.** A 1-of-2 Safe where one owner is a hot key held by an
automated agent gives exactly the security of a plain hot wallet holding $400k.
The Safe contract adds nothing here. The hardware wallet does not protect the funds.
It only helps if the agent's key is *lost*, and it is useless if the key is *stolen*.
Theft is the case that matters.

## Why threshold 1 fails

The Safe checks `signatures >= threshold`. With threshold = 1, **any single
owner is the full Safe**. So whoever holds the agent's hot key can, in one
transaction and with no one else signing:

1. **Drain everything.** They can transfer all ETH and tokens, or batch it through
   MultiSend so it all goes in one atomic transaction.
2. **Lock you out.** They can call `removeOwner` / `swapOwner` to remove your
   hardware wallet, `changeThreshold`, or `enableModule` / `setGuard` to install a
   backdoor. The "backup owner" can be removed by the very key it is supposed
   to back up.
3. **Act before you can.** Your hardware wallet has the same power, so in theory
   you could race the attacker. In practice a drain lands in the next block, often
   through a private mempool. A human reaching for a Ledger doesn't win that race.

The PR's reasoning mixes up two different failures:

| Failure | 1-of-2 (PR design) | What you actually need |
|---|---|---|
| Agent key **lost** (disk wiped) | Fine. The hardware wallet still controls the Safe. | Recovery |
| Agent key **stolen** (server compromise, leaked env var, malicious dependency, prompt injection that makes the agent sign) | **Total loss of $400k**, and you may be removed as owner | Prevention and a bounded blast radius |

Agent keys have a high chance of being stolen. They sit on internet-connected
servers, are used by software that processes untrusted input (market data, token
metadata, and LLM prompts if the agent is LLM-driven), and sign transactions
unattended. That is why the design has to assume the key will be compromised.
The rule is: **a compromised agent key must not mean total loss.** Threshold 1
breaks that rule by design.

A second, quieter problem: with threshold 1 the agent *itself* can empty the
treasury because of a bug, not just an attacker. A mis-scaled order size, a
wrong decimals value, a hallucinated address, or an approval to a malicious
contract all go through with nothing to stop them.

## Recommended design

The goal: the agent trades on its own **within tight on-chain limits**. Anything
outside those limits, including moving funds out or changing custody, needs
humans.

### 1. Treasury Safe: 2-of-3, agent is not needed for recovery

| Owner | Who / what | Where it lives | Hot or cold |
|---|---|---|---|
| A | Agent signing key | Cloud KMS or HSM/TEE (e.g. AWS KMS secp256k1 key). Not a raw private key in an env var or `.env` file, and never in git. Only the agent's service role can call `Sign`. | **Hot** |
| B | Your operational key | A separate device from the agent's infrastructure, e.g. a second hardware wallet or a phone wallet used through the Safe UI. | **Warm/hot**, manual signing only |
| C | Your recovery key | The hardware wallet you already have. Seed backed up offline (metal backup, separate location), used only for recovery or big changes. | **Cold** |

**Threshold: 2.**

B + C together can do anything without the agent, so if the agent key is lost
or burned you can still recover. A cannot do anything alone. Keep B and C on
separate devices, ideally in separate places, and never on the machine that runs
the agent. Two owner keys on one laptop add up to one key.

Optional: add a fourth owner, a trusted person or company signer who can
help with recovery, and use **2-of-4**. Then losing one of your own devices
still leaves two signers without the agent.

### 2. How the agent trades without a co-signer: scoped permissions, not threshold

The PR is right that the agent can't wait on a human for every trade. The fix is
to **give the agent narrow, on-chain-enforced powers**, not to lower the
threshold:

- **Zodiac Roles Modifier** (a Safe module) gives the agent key a role that allows
  only specific targets, functions and parameters. For example:
  - `swap`/`exactInputSingle` on an allowlisted DEX router (e.g. Uniswap), with
    `recipient == Safe address` enforced. Without that parameter check, a "swap"
    permission is a drain permission, because the attacker swaps and sends the
    output to themselves.
  - Only allowlisted tokens and pools.
  - `approve` only to allowlisted routers, capped amounts. No unlimited approvals
    to arbitrary spenders.
  - **No** `delegatecall`, no plain `transfer` to arbitrary addresses, no calls
    to the Safe itself.
  - Per-period limits on how much it can spend (Roles v2 allowances), e.g. a
    daily notional cap.
- **Alternatively, or as well: a trading sub-account.** The agent trades from a
  separate hot wallet or 1-of-1 sub-Safe that holds only working capital (e.g.
  5–10% of the treasury). The treasury refills it through the 2-of-3, manually or
  via the Safe **Allowance Module** with a daily limit. Loss is capped at whatever
  sits in the sub-account plus one period's allowance.
- **Only the Safe (the 2-of-3) can configure** the module, roles, allowances, and
  any transaction guard. The agent key must not be the owner of the Roles
  modifier.
- Keep an off-chain limit in the agent as well (human approval above $X, a
  sanity check on slippage and size). Treat it as a seatbelt only. The on-chain
  limits are what hold if the agent host is compromised.

Before mainnet: deploy the whole setup on an Anvil mainnet fork, and write tests
that try to use the agent's role to send funds anywhere other than the Safe
(changed recipient, `delegatecall`, `approve` to an attacker, `transfer`). All of
them must revert.

### 3. What the agent can and cannot do on its own

**Can (agent key alone, via the role):**
- Swap allowlisted tokens on allowlisted venues, with the output always going
  back to the Safe.
- Approve allowlisted routers up to set limits.
- Spend up to its per-period allowance or cap.
- Propose any other transaction to the Safe Transaction Service for humans to
  review and co-sign. Proposing doesn't need the threshold.

**Cannot (needs 2 of 3 signatures, i.e. at least one human):**
- Send funds to any address other than the Safe, including "just to the
  exchange" or "to my other wallet".
- Trade beyond its caps or use tokens or venues that aren't allowlisted.
- Add or remove owners, change the threshold, enable or disable modules, change
  roles or allowances, set a guard.
- Upgrade or `delegatecall` into anything.
- Remove you. The agent can never lock humans out.

## What this buys you if the agent key is stolen

With threshold 1: the attacker takes roughly $400k in one transaction and may
remove your hardware wallet as owner. Nothing is left to do but post-mortems.

With the recommended design:

1. **The attacker can't take custody.** One signature is below threshold 2, so
   they can't transfer funds out directly, add themselves as owners, or remove
   you.
2. **The loss is bounded.** The most they can do is what the role allows:
   trade the Safe's assets on allowlisted venues with output going back to the
   Safe. Realistically that means bad trades or sandwich/slippage losses, capped
   by the per-period allowance and slippage checks. With a trading sub-account,
   the loss is capped at the working capital in it. Either way it's a small,
   known fraction of $400k, not all of it.
3. **You can respond without the agent.** You sign with B + C to revoke the
   agent's role or disable the module, then `swapOwner` the stolen key A for a
   new KMS key. None of that needs the compromised key.
4. **You can see it happening.** Set up alerts on Safe events and role usage
   (e.g. Safe webhooks, Tenderly/OpenZeppelin Monitor). Unexpected proposals or
   cap-hitting trades page you before the next period's allowance resets.

## Required changes to the PR

1. Change the threshold 1-of-2 to **2-of-3** (agent KMS key, your
   operational key, your cold hardware wallet). Optionally 2-of-4 with a recovery
   contact.
2. Give the agent its autonomy through a **Zodiac Roles** module (scoped targets,
   functions, `recipient == Safe`, no `delegatecall`, spending allowances) and/or
   a capped trading sub-account refilled by an allowance. The agent key never
   gets unscoped signing power.
3. Store the agent key in KMS/HSM/TEE, not in an env var or file. Only the Safe
   can change the configuration.
4. Test fork-based attacks against the role before deploying. Add monitoring,
   and write down a revoke-and-rotate runbook that uses B + C only.
