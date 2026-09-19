# Review: threshold-1 Safe custody for a $400k trading agent

## Verdict

**No. Threshold 1 isn't acceptable here, and I'd block the PR as written.**

A 1-of-2 Safe works like two EOAs that each have full control of the treasury. The Safe adds no protection over one hot key holding $400k. It only adds a second way to lose the funds.

## What's wrong with the draft

### 1. The agent's hot key alone controls the whole $400k

With `threshold = 1`, any single owner signature can call `execTransaction` for anything. That covers transferring every asset, `delegatecall`-ing into arbitrary code, and changing the Safe's configuration. The agent key is a hot key. It sits on a server, is read by a process, and is exposed to that host, its dependencies, its logs, and (for an LLM-driven agent) prompt injection from market data or other inputs. Whoever steals that key can drain the treasury in **one transaction**.

Where the key is stored doesn't change this. A KMS, HSM or encrypted keystore limits *who* can use the key. It doesn't limit *what* the key can do. If an attacker gets code execution on the agent host, they can ask the KMS to sign a drain just as easily as the agent asks it to sign a swap.

### 2. The hardware wallet isn't a backup against theft, only against loss

The PR says the hardware wallet is there "in case the agent's key is ever lost". That covers **loss**. The risk that matters here is **theft**, and against theft the hardware wallet does nothing:

- Owners are equal at threshold 1. The attacker's first transaction can be `removeOwner(hardwareWallet)`, `swapOwner`, `enableModule(attackerModule)` or `setGuard(...)`, or it can just drain the funds. A Safe's owner-management functions are guarded by the same threshold as everything else, so the thief can **evict your hardware wallet** without your cooperation.
- There's no delay and no veto. By the time you see the alert and plug in the Ledger, the funds are already gone. At threshold 1 your signature can't stop a transaction that already has enough signatures.

### 3. The agent can raise its own limits

Nothing on-chain separates "trade" from "change who may sign" or "move principal". A compromised agent, a buggy one, or one that has been prompt-injected has the same power as you do.

### 4. The hardware wallet is also a single point of failure

The hardware wallet alone can also move everything. If its seed phrase leaks (from a photo, a cloud backup, or a supply-chain-compromised device), that is a second route to losing the full $400k.

**Rule to apply:** anything that signs unattended should be able to move only what you'd accept losing. The principal should sit behind a threshold that the unattended key can't meet alone.

## Recommended design

Keep the agent's ability to act on its own, but move it out of the owner set and give it a bounded, scoped, revocable role.

### A. Treasury Safe: holds the principal

| | |
|---|---|
| **Owners** | 3 human-controlled cold keys: **H1** is your hardware wallet (e.g. Ledger) · **H2** is a second hardware wallet from a *different vendor*, seed generated separately and stored at a different location · **H3** is a recovery key: a third hardware wallet kept offline in a safe or bank box, or held by a trusted co-founder or officer |
| **Threshold** | **2-of-3** |
| **Agent key** | **Not an owner.** |

- The threshold doesn't require several people. You can hold H1 and H2 yourself on separate devices and meet 2-of-3 alone. An attacker then has to compromise two separate devices or seeds instead of one.
- 2-of-3 rather than 2-of-2 lets you survive **losing** any one key, which is what the PR wanted the hardware wallet "backup" for. The difference is that no single stolen key is enough.
- All three keys are **cold**: they never touch the agent's infrastructure, and each is used only for deliberate, reviewed signatures. Check what the device shows against the Safe UI before signing.

### B. The agent's authority: a bounded float with scoped permissions

The agent gets a **hot key** (call it **A**). Keep it in a non-exportable KMS/HSM key (e.g. AWS KMS `ECC_SECG_P256K1`, where the signing IAM role is used only by the agent service). Never put it in an env file, the repo, a prompt, or logs. Then give A limited authority, and enforce every limit **on-chain**:

1. **Trading Safe.** A second Safe with the **same 2-of-3 cold owners** (H1/H2/H3). **A isn't an owner here either.** It holds the working float, sized to what you'd accept losing, e.g. **$20–40k**. You pick the number; the important part is that you choose it deliberately.
2. **Zodiac Roles Modifier** enabled as a module on the Trading Safe. A is assigned a role that allows **only**:
   - calls to allowlisted targets: specific DEX routers or pools you choose, e.g. the Uniswap / 1inch / CoW settlement contracts;
   - allowlisted function selectors (the swap functions only);
   - swaps between allowlisted tokens only;
   - a `recipient` / `to` parameter pinned to **the Trading Safe itself**, so swap output can't be sent elsewhere;
   - ERC-20 `approve` only to those allowlisted routers;
   - no `delegatecall`, no plain `transfer` to arbitrary addresses, no ETH sends out.
   
   Roles v2 can also enforce per-period value allowances on parameters, e.g. a maximum notional per swap or per day. Use them.
3. **Top-ups from the Treasury Safe.** Either:
   - (simplest) the 2-of-3 owners refill the Trading Safe manually when needed; or
   - (hands-off) the Treasury Safe's **Allowance Module** gives A a daily or weekly allowance that it may pull **only into the Trading Safe**. Put a Roles restriction in front if you want the destination pinned on-chain. This keeps the agent running without a human while capping the refill rate.

This setup doesn't make the agent wait on a human for day-to-day trading. It signs and executes within its envelope immediately. A human is needed only for actions that change the envelope.

## What the agent can and can't do on its own

| Action | Agent alone (key A)? | Who must sign |
|---|---|---|
| Swap allowlisted tokens on allowlisted venues, output back to the Trading Safe | **Yes**, immediately, no human | - |
| Approve allowlisted routers for allowlisted tokens | **Yes** | - |
| Pull its periodic allowance from Treasury → Trading Safe (if the Allowance Module is used) | **Yes**, up to the cap per period | - |
| Trade above the per-swap / per-day notional caps | **No** | 2-of-3 owners (raise the cap) |
| Send any asset to an address other than the Trading Safe | **No** | 2-of-3 owners |
| Touch the principal in the Treasury Safe beyond the allowance | **No** | 2-of-3 owners |
| Add a new token, router or protocol to its allowlist | **No** | 2-of-3 owners |
| Raise its own float, allowance or limits | **No** | 2-of-3 owners |
| Add/remove owners, change the threshold, enable/disable modules, set guards | **No** | 2-of-3 owners |
| `delegatecall` or arbitrary contract calls | **No** | 2-of-3 owners |

### Revoking the agent without its cooperation

The 2-of-3 owners can do any of the following with one Safe transaction each, and the agent key can't block or race them:
- `revokeRole` / remove A from the role on the Roles Modifier;
- `disableModule(roles)` on the Trading Safe (this cuts off all agent access at once);
- delete A's allowance on the Treasury Safe's Allowance Module;
- sweep the Trading Safe's float back to the Treasury Safe.

Write this down as a runbook, and rehearse it once on a testnet or fork before you go live.

## What this buys you if the agent's key is stolen

| | Draft (1-of-2, agent is an owner) | Recommended |
|---|---|---|
| Max loss | **All ~$400k**, in one transaction | Capped: at most the float in the Trading Safe plus at most one period's allowance, and in practice less (see below) |
| Can the attacker transfer funds out directly? | Yes | No. Swap output is pinned to the Trading Safe and there's no `transfer`/ETH-send permission |
| Can the attacker evict your hardware wallet or add their own owner/module? | Yes | No. That needs 2 of the 3 cold keys |
| Can the attacker raise the limits? | Yes | No |
| Can you stop it? | No. They act first and remove you | Yes. 2-of-3 revoke the role or disable the module, and the principal was never reachable |

**Remaining risk:** a thief who can only call the allowlisted swaps can still **destroy value inside the envelope**. They can make bad-price swaps with loose slippage, route through a thin pool they have manipulated, or let themselves be sandwiched, up to your per-swap and per-day notional caps. Keep that risk small with:
- a strict allowlist of venues and pools (no arbitrary pool addresses);
- tight notional caps per swap and per day in Roles;
- if possible, trading via CoW or another intent-based venue with signed limit prices, or checking a minimum-out value against an oracle in a small guard contract;
- off-chain monitoring (e.g. Tenderly or Forta alerts on every Trading Safe transaction and every role use), with a pre-signed or quickly signable revocation path.

With this design, a key compromise costs you part of the float. With the draft, it costs you the treasury.

## Other items for the PR

- **Key handling:** A is never committed and never pasted into chat, tickets or prompts. Add `.gitignore` entries for `.env*` and keystores *before* the first push. The repo must have no hardcoded, default or "example" private key. If A (or any key) has ever appeared in a prompt, chat or commit, treat it as burned: generate a new one and don't fund the old one.
- **Human gate for principal moves:** any tool or script that proposes a Treasury Safe transaction should print the amount, the checksummed destination and a live gas estimate priced at the current gas price, then wait for the owners to sign. It must never auto-execute.
- **Size the float from the loss budget, not convenience:** start small, e.g. 5–10% of the treasury. Raise it only by a deliberate 2-of-3 decision once the agent has a track record.
- **Test the recovery paths:** revoke the agent, rotate A, and replace a lost owner key using the other two, each once on a fork, before you deposit $400k.

## Summary

Replace "1-of-2 with the agent as owner" with:

- **Treasury Safe:** 2-of-3, all three keys cold hardware wallets you (and optionally a trusted second person) control on separate devices and in separate locations. The agent isn't an owner.
- **Trading Safe:** the same 2-of-3 cold owners, holding a bounded float. The agent's KMS-held hot key acts only through a **Zodiac Roles** role limited to allowlisted swaps with output back to the Trading Safe, with notional caps. It can optionally pull a capped **Allowance Module** top-up from the Treasury.
- **Result:** the agent trades on its own with no human in the loop. It can't move principal, send funds anywhere else, raise its own limits or change who signs. If its key is stolen, the loss is capped by the float and caps you chose, and you revoke the agent with 2 of your 3 keys without needing its cooperation.
