# Custody review: 1-of-2 Safe (agent hot key + hardware wallet) for ~$400k

## Verdict

**No. Threshold 1 isn't acceptable here, and I'd block the PR on it.**

With a 1-of-2 Safe, the agent's hot key has full control of the treasury. The hardware wallet adds no protection against the case that matters most: someone stealing the hot key. The PR is right that the agent has to be able to trade without waiting for a human. But the fix isn't to make the agent an owner. The fix is to let it act on its own **within narrow limits enforced on-chain**, while ownership stays with cold keys.

---

## 1. What's wrong with 1-of-2

### 1.1 A 1-of-N Safe is an EOA with extra steps

In a Safe, `threshold = 1` means **any single owner's signature can run any transaction**. So the agent's hot key can, on its own, in one transaction:

- `transfer` all ETH and ERC-20s to any address.
- `approve` an attacker's contract to spend every token.
- Run an arbitrary `DELEGATECALL`, which executes attacker code in the Safe's own storage context.
- Call the Safe's admin functions on itself: `removeOwner` / `swapOwner` (**removing your hardware wallet**), `changeThreshold`, `enableModule` (adding a permanent backdoor), `setGuard`, `setFallbackHandler`.

Anyone who gets the agent key doesn't just drain the $400k. They can remove your hardware wallet as an owner in the same batch. The "backup owner" is gone before you see the alert.

### 1.2 The hardware wallet protects against the wrong failure

The PR says the hardware wallet is "a backup in case the agent's key is ever lost." Look at the two failure modes:

| Failure | 1-of-2 outcome |
|---|---|
| Agent key **lost** (deleted, corrupted) | The hardware wallet can still act. ✅ This is the only case the design handles. |
| Agent key **stolen** (server compromise, leaked env var, malicious dependency, prompt-injected agent signing what it's told) | Attacker drains everything and can remove your owner key. ❌ The hardware wallet does nothing. |
| Hardware wallet stolen or phished | That key alone can also drain everything. ❌ Two keys that can each drain the Safe means two ways to lose it, not one extra safeguard. |

Theft is the risk that dominates for a hot key on an internet-facing machine running an LLM-driven agent. Losing the key is the cheap failure. A 1-of-N threshold makes **every** owner a single point of total compromise, so adding owners makes the Safe *less* safe.

### 1.3 The agent itself is part of the threat model

Even if the key never leaves the server, the agent's *decisions* can be hijacked. Examples: prompt injection through market data, token metadata, or web content; a bug in the trading logic; a poisoned dependency. Any of these can get the agent to sign a legitimate-looking transaction that sends funds to an attacker. Under 1-of-2, whatever the agent signs executes, so the agent's software is part of the trusted base for all $400k.

---

## 2. Recommended design

The core idea: **separate ownership from execution.**

- **Owners** (who can change the rules, move funds anywhere, add or remove keys) are cold keys held by humans, with a threshold above 1.
- **The agent is not an owner.** It gets a narrowly scoped *role* through a Safe module. The module checks every call it makes against an on-chain allowlist and spending limits. The agent can act alone, but only inside that box.

### 2.1 Structure: two Safes

```
┌─────────────────────────────────────────┐
│  Treasury Safe   (2-of-3, cold owners)  │   ~$300k+  (reserves)
│  no modules, or only a capped           │
│  Allowance Module → Trading Safe only   │
└───────────────────┬─────────────────────┘
                    │ top-ups: 2-of-3 humans, or a small
                    │ daily allowance that can ONLY go to the Trading Safe
┌───────────────────▼─────────────────────┐
│  Trading Safe    (2-of-3, same cold     │   working capital, e.g. $50–100k
│  owners)                                │
│  + Zodiac Roles Modifier                │
│      └─ role "trader" → agent address   │
└─────────────────────────────────────────┘
          ▲
          │ execTransactionWithRole(...)  (checked on-chain)
   Agent EOA (hot, key in KMS/HSM, holds only gas ETH)
```

Size the working capital by what the strategy actually needs in the trading Safe. The rest sits in a Safe the agent can't touch at all.

### 2.2 Owner set and threshold: **2-of-3, all cold, none of them the agent**

| Key | Who / where | Type |
|---|---|---|
| Owner A | You. Hardware wallet (Ledger/Trezor/Keystone/GridPlus), day-to-day device, kept at your home or office. | Cold (hardware, signs by explicit physical confirmation) |
| Owner B | Second hardware wallet, **different vendor** from A, stored in a separate physical location (safe, safe-deposit box). Seed backed up separately from A's. | Cold |
| Owner C | A trusted co-signer (co-founder, finance lead, or professional custodian or co-signing service) on their own hardware wallet, in a different location or jurisdiction. | Cold |

Why 2-of-3:
- **Theft of any one key isn't enough** to move funds or change owners.
- **Losing any one key is recoverable.** The other two sign a `swapOwner` to replace it. This covers the "backup in case something is lost" goal the PR was after, without the theft exposure.
- It's the smallest configuration that is tolerant of both theft and loss. 3-of-5 is reasonable if you have enough trustworthy, geographically separate signers. Avoid 2-of-2, because one lost device would lock the treasury permanently.

Operational rules for owners:
- Verify every transaction on the hardware device screen, and check the calldata hash against an independent decoder. The Bybit hack (Feb 2025) came from signers approving a malicious `delegatecall` shown to them through a compromised front end. Blind-signing defeats multisig.
- Hardware wallet seeds stay offline (metal backup), never photographed, never in a password manager.

### 2.3 The agent's key: hot, but hardened and powerless beyond its role

- The agent signs from a plain **EOA whose only assets are gas ETH** (for example 0.5 ETH, topped up manually). That address holds no treasury funds.
- Store the key in a **KMS/HSM**, such as AWS KMS or GCP KMS with secp256k1 keys, or a policy-enforcing signer like Turnkey or Fireblocks. The raw private key should never sit in the agent's process memory, env vars, or disk. The agent process gets IAM permission to *request signatures*, nothing more. Where the signer supports it, add a second layer of policy there as well (allowed `to` addresses and selectors).
- Rotation is cheap: the owners reassign the role to a new address.

### 2.4 The agent's role: Zodiac Roles Modifier permissions on the Trading Safe

Roles Modifier v2 (or karpatkey's DeFi Kit presets built on it) lets you scope each permission down to specific target contracts, function selectors, **parameter values**, whether ETH can be sent, whether delegatecall is allowed, and per-period allowances. Suggested scope:

1. **Targets**: only the DEX contracts you trade through, e.g. Uniswap V3 `SwapRouter02`, the CoW Protocol settlement / `GPv2VaultRelayer` flow, 1inch/0x if needed. Nothing else.
2. **Functions**: only the swap entry points (e.g. `exactInputSingle`, `exactInput`, CoW order presign). No generic `multicall` or `execute` unless you scope what's inside it.
3. **Parameter constraints**:
   - `recipient == TradingSafe`. **This is the most important rule.** Without it, a "swap" can send the output tokens to the attacker.
   - `tokenIn` / `tokenOut` ∈ allowlist of deep-liquidity assets (WETH, USDC, USDT, DAI, WBTC, …). This stops the agent from being steered into an illiquid token or an attacker-controlled pool.
   - Fee tiers / pool paths restricted where possible.
4. **Execution options**: `delegatecall` **disabled**, ETH value **disabled** (use WETH).
5. **Allowances** (the Roles modifier's rate limits): e.g. max sell volume of X USDC-equivalent per 24h per token, refilling on a period. This caps how much can be run through bad trades before a human reacts.
6. **Approvals**: the owners set ERC-20 approvals to the allowlisted routers themselves (2-of-3), or the agent may call `approve` only with `spender` ∈ allowlisted routers. Never unrestricted `approve`.
7. **Never permitted**: calls to the Safe itself (`addOwner`, `removeOwner`, `swapOwner`, `changeThreshold`, `enableModule`, `setGuard`, `setFallbackHandler`), calls to the Roles Modifier's admin functions, and `transfer` / `transferFrom` on any token.

Only the Safe, meaning 2-of-3 owners, owns the Roles Modifier. The agent can't widen its own permissions.

### 2.5 Response and monitoring

- Set up real-time alerts (Tenderly, OpenZeppelin Defender/Monitor, Forta, or your own indexer) on every role execution. Alert on unusual volume, slippage, or reverts from calls that failed permission checks. A burst of reverted out-of-scope calls is a strong sign of key compromise.
- **Freeze path.** Pre-draft (don't pre-sign) the owner transaction that revokes the agent's role, and drill it so two owners can sign it within minutes to hours. Optionally, add an asymmetric "pause" control that any *single* owner can trigger. It can only *remove* the agent's powers and never grant any, so it is safe at threshold 1.
- Size the daily allowances to what you'd be willing to lose during your realistic detection-plus-response window.

---

## 3. If the agent key is stolen

| | Current PR (1-of-2) | Recommended design |
|---|---|---|
| Attacker can send funds to their own address | **Yes, all ~$400k, in one transaction** | **No.** `transfer` is not permitted, and every swap must have `recipient == TradingSafe`. |
| Attacker can remove your hardware wallet / change the threshold | **Yes** | **No.** Owner management needs 2-of-3 cold keys. |
| Attacker can install a backdoor module or guard, or run a delegatecall | **Yes** | **No.** Calls to the Safe aren't in scope, and delegatecall is disabled. |
| Attacker can touch the Treasury Safe | **Yes** (it's all one Safe) | **No.** The agent has no role on the Treasury Safe. |
| Attacker can grief through trades | Moot | **Bounded.** They can make allowlisted swaps back into the Trading Safe at bad prices (high slippage, getting sandwiched), up to the per-period allowance. The loss is a fraction of the capped daily volume, not the principal. |
| Recovery | Race the attacker. You probably lose. | Owners revoke the role (or pause), rotate the KMS key, investigate, reassign. Funds never left your Safes. |

**Worst case, roughly:** under the PR, the loss is **100% of $400k plus loss of control**. Under the recommended design, the loss is **a slippage/MEV hit on at most `daily allowance × days until revocation`, and only on the Trading Safe's balance**. For example, a $100k/day volume cap with a worst-case ~5–10% execution loss is about $5–10k before a human steps in. The treasury reserve is untouched. You pick the numbers when you set the allowances and the working-capital float.

(Tighter still, optionally: add a Safe Guard or a custom Roles condition that checks swap `amountOutMinimum` against a Chainlink price with a max-slippage bound. That shrinks the griefing loss toward zero. It's more engineering, and it's worth it once the basic design is live.)

---

## 4. What the agent can and cannot do on its own (recommended design)

**The agent CAN, with no human in the loop:**
- Swap between allowlisted tokens on allowlisted DEX routers or protocols, with the output always going to the Trading Safe.
- Do this as often as its strategy wants, up to the per-period volume allowances.
- Pay its own gas from its gas-only EOA.
- (If you configure it) pull a capped daily top-up from the Treasury Safe **into the Trading Safe only**, via the Allowance Module.

**The agent CANNOT, on its own:**
- Send ETH or tokens to any external address, including "its own" address or any other wallet or exchange.
- Trade tokens that aren't on the allowlist, use unlisted protocols, or set a swap recipient other than the Trading Safe.
- Grant token approvals to arbitrary spenders.
- Execute `delegatecall` or send native ETH value.
- Exceed its per-period allowances.
- Add, remove, or swap owners, change the threshold, enable modules, set guards, or change the fallback handler.
- Change its own role permissions or allowances.
- Touch the Treasury Safe beyond the capped top-up route, if you enable it.

**Only 2-of-3 cold owners can:** move funds anywhere, change the agent's permissions or limits, rotate or revoke the agent, change owners, rebalance between Treasury and Trading, and do anything else outside the role.

---

## 5. Suggested changes to the PR

1. Remove the agent key as a Safe owner. Set owners to 3 cold hardware keys (A: you, B: second device in a separate location, C: independent co-signer), **threshold 2**.
2. Split into a Treasury Safe (reserves) and a Trading Safe (working capital).
3. Deploy a Zodiac Roles Modifier on the Trading Safe, owned by the Safe. Create a `trader` role for the agent EOA with the targets, selectors, `recipient == Safe` constraint, token allowlist, no delegatecall, no value, and allowances described above.
4. Move the agent key into KMS/HSM. The agent EOA holds gas only.
5. Add monitoring, a drilled revoke/pause runbook, and a policy that owners never blind-sign.
6. Before mainnet funds, test the permission set on a fork. Write negative tests that try `transfer`, `approve(attacker)`, `swap(recipient=attacker)`, `delegatecall`, and `addOwner` through the role. Every one must revert.

This design gives the agent the autonomy the PR wants: it trades without waiting on a human. It also covers the lost-key case better than the original (a lost agent key costs nothing), and a stolen agent key goes from losing everything to a bounded, recoverable loss.
