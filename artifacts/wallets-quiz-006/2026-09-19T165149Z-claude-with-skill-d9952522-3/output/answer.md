# Custody review: agent Safe, 2 owners, threshold 1

## Verdict

**No. Threshold 1 isn't acceptable here, and the PR shouldn't merge with it.**

A 1-of-2 Safe where one owner is a hot agent key gives that hot key full,
unilateral authority over all $400k. Against theft, it's no stronger than
putting $400k in the agent's EOA. It's actually slightly worse, because the
thief can also take the Safe away from you.

## Why threshold 1 fails

### 1. Threshold 1 means any single owner is the whole Safe

With `threshold = 1`, `execTransaction` needs one valid owner signature. Anyone
holding the agent key can do all of this without you:

- `transfer` every token and all ETH to an address they control, in one
  transaction. A MultiSend batch can empty the whole Safe at once.
- call `removeOwner` / `swapOwner` to remove your hardware wallet from the
  owner list.
- call `enableModule` or `setGuard` to install a backdoor that stays after
  you've rotated keys.
- `delegatecall` into arbitrary code, which can rewrite Safe storage.

### 2. The hardware wallet protects against the wrong failure

The PR calls the hardware wallet a backup "in case the agent's key is ever
lost." But a lost agent key is the harmless case. The funds are in the Safe,
not in the key. You would just rotate the agent's permissions, and even a
threshold-1 Safe already lets you do that.

The case that matters is a stolen agent key. There, a co-owner at threshold 1
can only race the attacker. The attacker's drain is one transaction, usually
sent through a private relay, so you won't see it in the mempool. You will lose
that race.

So the hardware wallet adds nothing against the realistic threat. It covers a
case that was already covered.

### 3. Key storage doesn't limit key authority

Keeping the agent key in a KMS, HSM or encrypted keystore limits who can use
it. It doesn't limit what the key can do. A hot key is exposed by the job it
does: it's on a networked host, it signs without a human, and it's driven by
software. That software might be an LLM loop that reads untrusted market data,
web content or tool output. Any of these can compromise it:

- a server breach
- a dependency supply-chain attack
- a leaked environment variable
- prompt injection that makes the agent sign something harmful

That risk is permanent, so the design has to assume the agent key will be
compromised at some point.

### 4. The PR's premise is a false choice

"If it has to wait on a human co-signer it can't do its job" is only true if
the agent's trading authority and custody of the principal are the same
permission. They don't need to be. The agent needs to trade. It doesn't need
to be able to send principal anywhere, change owners, or raise its own limits.
Separate those powers and the agent never waits on a human to trade.

## Recommended design

Rule: **whatever signs unattended should only be able to move what you'd
accept losing. The principal sits behind a threshold the agent key can't meet
alone, and ideally the agent key isn't part of that threshold at all.**

### Tier 1: Treasury Safe (principal, about 90%+ of funds)

| | |
|---|---|
| Owners | 3 cold keys, all controlled by humans. **The agent key is not an owner.** |
| Threshold | **2-of-3** |
| Modules | none |
| Guard | optional, e.g. a guard that blocks `delegatecall` |

Where the keys live:

| Key | Where | Hot/cold |
|---|---|---|
| Owner A | Your main hardware wallet (e.g. Ledger), kept at home or in the office | cold |
| Owner B | A second hardware wallet from a **different vendor** (e.g. Trezor or Keystone), kept in a **different location** | cold |
| Owner C | A third hardware wallet or a steel seed backup in a safe-deposit box, **or** a trusted second person (co-founder, finance lead) on their own hardware wallet | cold |

- A multisig doesn't need several people. You can hold all three devices
  yourself and still get the benefit: an attacker would need two physical
  devices in two places, not one. A second person on C adds protection against
  coercion or you being unavailable, if you have someone suitable.
- 2-of-3 lets you lose any one key without losing funds, and survive any one
  key being stolen without being drained. 2-of-2 would lock you out if one
  device died. 3-of-3 would be fragile. 1-of-anything is the current problem.
- Keep each seed backup on steel, stored separately from its device. Never
  store a seed in a photo, a password manager on a daily-use laptop, or a
  cloud drive.
- Check every transaction on the hardware wallet screens, including the
  decoded calldata and the Safe transaction hash, before signing. Don't rely
  only on the web UI.

### Tier 2: Trading Safe (bounded float, run by the agent)

| | |
|---|---|
| Owners | The same 3 human cold keys, **2-of-3**. The agent key is **not** an owner. |
| Holds | A float capped at an amount you accept losing. As a starting point, $20–40k (5–10%). You choose the number, deliberately. |
| Agent authority | A **Zodiac Roles Modifier (v2)** module on this Safe. The agent's hot key is the only member of a `trader` role. |

The `trader` role's scope is what actually enforces the agent's limits:

- **Allowed targets:** only the specific DEX router(s) or aggregator the
  strategy uses, and only the swap function selectors. Only `approve` calls to
  those routers.
- **Recipient must be the Trading Safe.** Every swap's `recipient` / `to`
  parameter is pinned to the Safe's own address. No `transfer` or
  `transferFrom` to arbitrary addresses.
- **Token allowlist:** only the assets the strategy trades.
- **Rate limits:** Roles v2 allowances cap the sell amount per asset per period
  (e.g. $X per 24h), so even bad trades are throttled.
- **Call only, no `delegatecall`.** No calls to the Safe itself, so no
  `enableModule`, `addOwner`, `changeThreshold` or `setGuard`, and no calls to
  the Roles Modifier's own admin functions.
- **No ETH `value`**, except where a specific swap path needs it, and then with
  a cap.

The Roles Modifier is owned by the Trading Safe, so only the 2-of-3 humans can
change the role.

Refills: the humans move funds Treasury → Trading Safe on a schedule (e.g.
weekly) or when a monitor alerts on a low balance. Each refill is a 2-of-3
transaction. The agent never waits on a human to trade, only for new capital.

Simpler alternative: if the Roles setup is too much for v1, the agent can
trade from a plain EOA that holds only the float, with the Treasury Safe
(2-of-3, agent not an owner) refilling it. The worst case is the same, losing
the float. You give up the "recipient must be the Safe" restriction, so a
thief can withdraw the float directly rather than only losing it through bad
trades. It's still far better than the current design.

### Where the agent key lives

- Hot, but not in plaintext. Use a cloud KMS or HSM with secp256k1 support
  (e.g. AWS KMS `ECC_SECG_P256K1`, GCP KMS, or Turnkey/Fireblocks-style signing
  policies), with IAM limited to the agent's runtime.
- Never put it in the repo, a `.env` that's committed, a Docker image, logs,
  or the LLM's context or prompt. A key that has been pasted into a chat,
  ticket or prompt counts as burned. Rotate it.
- Its ETH balance only needs to cover gas: a small amount, topped up as
  needed.
- As noted above, this storage limits who can use the key. The role scope
  limits what it can do, which is the more important control.

### Monitoring and kill switch

- Alert on every Trading Safe transaction and on any allowance nearing its
  cap. Alert on **any** Treasury Safe transaction proposal.
- Kill switch: one 2-of-3 transaction on the Trading Safe that revokes the
  agent's role membership (or disables the Roles Modifier). This needs **no
  cooperation from the agent or its key**. Write it in advance and keep it
  ready to sign as a pre-built transaction.
- Test key rotation and revocation on a fork or testnet before launch.

## What the agent can and cannot do on its own

**Can do alone (agent hot key only):**

- Swap allowlisted tokens on allowlisted routers, with proceeds always coming
  back to the Trading Safe.
- Set token approvals to those routers.
- Trade up to the per-period allowance, using only the float in the Trading
  Safe.

**Cannot do alone, needs 2 of the 3 human cold keys:**

- Move **any** funds out of the Treasury Safe (the principal).
- Send funds from the Trading Safe to any address other than itself, including
  withdrawing profits.
- Refill or increase the float.
- Raise its own allowances, add routers, tokens or functions, or widen its role
  in any other way.
- Add, remove or swap owners, change the threshold, enable or disable modules,
  or set guards on either Safe.
- Use `delegatecall` or upgrade anything.
- Stop itself from being revoked: humans can evict the agent without its
  signature.

## If the agent's key is stolen

| | Current PR (1-of-2, agent is owner) | Recommended design |
|---|---|---|
| Principal ($360k+) | Drained in one transaction | **Untouchable.** The agent key isn't an owner of the Treasury Safe. |
| Float | Drained | Can't be sent out. The only possible loss is through bad-price swaps (e.g. sandwiching itself or trading into a pool the attacker controls), and that is capped by the per-period allowance and the float size. |
| Owner set | Attacker can remove your hardware wallet | Can't be touched |
| Persistence | Attacker can install a module or guard backdoor | Impossible, because the role can't call the Safe or the modifier's admin functions |
| Your response | A race you lose | Revoke the role with 2-of-3 on your own schedule. Issue a new agent key. Resume. |
| **Worst case** | **$400k** | **≤ the float, and in practice ≤ one allowance period of bad trades** |

About that residual risk: pinning the recipient doesn't make swaps
theft-proof. A thief with the key can still lose value through deliberately
bad prices (high slippage, illiquid pools they control). That's why the
allowance caps and the float size, not the recipient rule, are the real upper
bound, and why the float should be an amount you truly accept losing. If
you're using an aggregator, tighten this further: pin `minAmountOut` where the
Roles conditions allow it, or use a guard or oracle check.

If one of the three human cold keys is stolen, nothing happens: one key can't
meet 2-of-3. You swap it out with the other two.

If the agent's key is lost, nothing is lost. Revoke the old key's role, grant
the role to a new key, and carry on. This is the case the PR's hardware wallet
"backup" was meant for, and the recommended design handles it without making
any hot key all-powerful.

## Requested changes for the PR

1. Take the agent key out of the owner set of any Safe that holds principal.
2. Treasury Safe: 2-of-3 human cold keys, on separate devices from different
   vendors, stored in separate places.
3. Put agent trading on a separate float Safe, driven through a Zodiac Roles v2
   role scoped to: allowlisted routers and selectors, recipient = self,
   allowlisted tokens, per-period allowances, no `delegatecall`, no
   self-calls.
4. Put the agent key in a KMS/HSM, keep it out of the repo and the prompt, and
   fund it with gas only.
5. Document the refill procedure and a pre-built revoke transaction, and test
   both on a fork before mainnet.
6. State the float cap and the allowance numbers in the PR, as the loss you're
   explicitly accepting.
