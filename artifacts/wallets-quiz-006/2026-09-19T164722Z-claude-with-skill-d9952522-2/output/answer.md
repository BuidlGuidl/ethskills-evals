# Custody review: agent-operated Safe holding ~$400k

## Verdict

**Threshold 1 is not acceptable.** A 1-of-2 Safe is effectively a single-key wallet with extra steps. If the agent's hot key is stolen, the attacker has the whole $400k. The hardware wallet does not protect against that. It only helps if the agent's key is *lost*, and losing the key is the smaller risk.

Fix the design by changing what the agent's key is **authorized** to do. Better storage for that key does not fix it.

---

## Why 1-of-2 fails

1. **Any one owner can do anything.** With `threshold = 1`, the agent key alone can sign any `execTransaction` the Safe can run:
   - transfer every token and all the ETH to any address,
   - `removeOwner` your hardware wallet, `addOwnerWithThreshold` for its own addresses, or `changeThreshold`,
   - `enableModule` or `setGuard` to install a backdoor,
   - `delegatecall` into arbitrary code, which can rewrite the Safe's storage.

   An attacker holding the agent key can drain the Safe in one transaction. They can also remove your hardware wallet as an owner first, so you are locked out even before the funds leave.

2. **The "backup owner" covers the wrong failure.** The PR plans for the agent key being *lost*. For an internet-connected key that signs without a human, the realistic failure is the key being *stolen* or *misused*. Examples: host compromise, a leaked env var, a dependency supply-chain attack, prompt injection steering the agent, or a plain bug in the trading logic. A backup owner gives no protection in any of these cases. Whoever holds the hot key simply moves faster than you.

3. **Where the key is stored limits who can use it, not what it can do.** Putting the agent key in a KMS or HSM makes theft harder. It does not limit what a stolen or hijacked key can sign. If the agent process is compromised, the KMS signs whatever that process asks it to sign. At threshold 1, the key is still a key to the whole treasury.

4. **"The agent has to work without waiting for a human" is valid, but the conclusion doesn't follow.** The agent does need to act alone. It does *not* need to act alone over **all** of the funds, or over **who controls the Safe**. Those are separate kinds of authority, and threshold 1 gives the agent both.

---

## Recommended design

### Principle

The agent signs unattended, but only within a scope limited to an amount you would accept losing. The principal and all control over the Safe sit behind a threshold that the agent's key cannot meet, even with help from any one other key.

### Treasury Safe: principal and admin

| Owner | Device | Where it lives |
|---|---|---|
| Hardware wallet A | Your primary hardware wallet | With you; seed phrase backed up on metal at location 1 |
| Hardware wallet B | A second hardware wallet, ideally a different vendor or model | Kept physically apart from A (home safe or office); seed phrase on metal at location 2 |
| Hardware wallet C (recovery) | A third hardware wallet, **or** a trusted co-founder/partner's hardware wallet | Offsite (bank safe-deposit box or the partner); seed phrase stored separately from the device |

**Threshold: 2-of-3.**

- **The agent is not an owner.** If the agent key were an owner in a 2-of-3, one stolen hot key plus one compromised or phished device would be enough. Owner status would also give the agent the power to co-sign changes to its own permissions. It needs neither.
- **A multisig does not require multiple people.** You can hold A and B yourself and meet the threshold alone. The benefit is that an attacker then needs two separate devices rather than one. That is also why a single hardware wallet would be the wrong way to hold the treasury.
- **Why three owners and not two:** if you lose any one device, the other two still meet the threshold. You can then `swapOwner` the lost device out. A 2-of-2 would lose the funds after a single lost device.
- **All cold keys stay offline.** They only sign on-device, and you check the destination, amount and calldata on the device screen before signing.

### The agent's authority: bounded and scoped

Give the agent power through a **module** on the treasury Safe, not through an owner seat. Combine two limits:

1. **Zodiac Roles Modifier.** It controls *what* the agent may call:
   - Only the specific DEX router or aggregator functions you trade on, such as `exactInputSingle` or `swap`, and only on allowlisted contract addresses.
   - Only allowlisted tokens.
   - **Swap recipient hard-pinned to the Safe's own address.** Without this, "swap" becomes "send funds to the attacker".
   - `approve` calls only to allowlisted routers, with a cap on the amount.
   - No `delegatecall`, no plain `transfer` or `transferFrom` to arbitrary addresses, and no calls to the Safe itself. That rules out `addOwner`, `removeOwner`, `changeThreshold`, `enableModule`, `setGuard` and `setFallbackHandler`.
   - The Roles Modifier's own role and permission settings are owned by the Safe. Only the 2-of-3 can change them.

2. **Rate and value caps.** The Roles Modifier's allowance feature, or the Safe Allowance Module, sets a limit *per period*, for example a cap on notional value swapped per day. A monitoring service should also alert and auto-pause on anomalies. Because trading can lose value inside a permitted scope (bad fills, slippage, manipulated pools), also enforce **minimum-output / maximum-slippage** checks in the scoped parameters where the router allows it.

**A simpler alternative, if the module setup is too much for version 1:** keep the principal in the 2-of-3 Safe with no modules at all. Give the agent its own **separate hot wallet holding only a float**, for example $20–40k, or whatever amount you would genuinely accept losing. Humans top up the float from the treasury with a 2-of-3 signature. The float is then the entire blast radius. The drawback is manual top-ups; the benefit is that it is very easy to reason about.

The dollar figures above are placeholders. Choose them by asking: "if this key is stolen at the worst possible moment, what is the most I lose, and can I accept that?"

### Where the agent key lives

Put the agent key in a cloud KMS or HSM as a **non-exportable** key. Only the agent's service identity may sign with it, access is logged and alerted on, and it is never in a `.env` file, a repo, a prompt or a log. If the key has ever appeared in a chat, ticket or commit, treat it as burned and rotate it before funding anything. This storage choice is defense in depth. The on-chain scope is what bounds the loss.

---

## What the agent can and cannot do on its own

**The agent CAN, with no human signature:**
- Execute swaps on the allowlisted routers, between allowlisted tokens, with output returned to the Safe.
- Set approvals to allowlisted routers, up to the cap.
- Do all of this up to its per-period value cap, 24/7, without waiting on anyone.
- (Float variant) Spend anything in its own float wallet.

**The agent CANNOT do alone. These need 2-of-3 human hardware-wallet signatures:**
- Move principal: send any asset out of the Safe to an external address, including to itself.
- Raise its own limits, widen its allowlist, or add new tokens, protocols or functions.
- Change who may sign: add, remove or swap owners, or change the threshold.
- Enable or disable modules, set guards or fallback handlers, or upgrade the Safe.
- Use `delegatecall`, or call anything outside its role.
- Refill its float (in the float variant).

**How humans revoke the agent without its cooperation:** two hardware wallets sign one Safe transaction that either:
- revokes the agent's role in the Roles Modifier or sets its allowance to zero, or
- calls `disableModule` on the Roles Modifier to remove the agent's whole access path at once.

The agent has no say in this, because it is not an owner. (In the float variant: stop topping up the float and sweep what is left if you still can.) Write down this procedure and rehearse it on a testnet or fork before going live. You do not want to be learning Safe transaction building in the middle of an incident.

---

## What this buys you if the agent's key is stolen

| | PR design (1-of-2) | Recommended (2-of-3 cold + scoped agent) |
|---|---|---|
| Maximum loss | **All ~$400k** | Whatever the scope allows before you revoke: at most one period's cap, and realistically only value lost through bad trades, because proceeds are forced back to the Safe. Float variant: the float. |
| Can the attacker withdraw funds to their own address? | Yes, in one transaction | No. Swap recipients are pinned to the Safe and there is no transfer permission. |
| Can the attacker lock you out? | Yes, by calling `removeOwner` on your hardware wallet | No. Owner management requires 2-of-3 cold keys. |
| Can the attacker widen their access? | Yes, via `enableModule` or `delegatecall` | No. Those calls are outside the role. |
| Can you respond? | Only if you are faster than a bot | Yes. 2-of-3 revokes the role or disables the module; the principal was never at risk. |
| Recovery | Nothing left to recover | Rotate: new KMS key, grant it the role, done |

Other failures the design handles:
- **Agent key lost:** no funds are lost. Grant the role to a new key using 2-of-3. This was the PR's actual concern, and the new design covers it better.
- **One hardware wallet lost or stolen:** the other two still meet the threshold, and one device alone cannot move anything. `swapOwner` the lost device out.
- **Agent is buggy or prompt-injected rather than stolen:** same bound as theft. It can only trade within its scope and caps.

## Operational notes for the PR

- Any tooling that moves funds outside the agent's scope, such as top-ups or owner changes, must print the amount, the checksummed destination and the live-priced gas cost, then stop until a human confirms.
- Deploy the configuration first on a mainnet fork. Test it with the agent key attempting a `transfer` to an outside address, `addOwner`, `enableModule`, and a swap with an outside recipient. All of these **must revert**.
- Add monitoring on every module transaction, with an alert if cumulative value in a period approaches the cap.
