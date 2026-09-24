# Custody review: agent-operated Safe holding ~$400k

## Verdict

**No. Threshold 1 is not acceptable, and I'd block the PR as written.** A 1-of-2
Safe where one owner is a hot key isn't a multisig. It's a single hot key
controlling $400k, with a Safe wrapper around it. The hardware wallet adds no
protection. It only adds a second way to lose everything.

## Why the draft design fails

### 1. In a Safe, threshold 1 means *any* owner has full control

With `threshold = 1`, each owner can sign and execute **any** Safe transaction
alone. That includes the Safe's admin functions, which are just transactions the
Safe makes to itself:

- `transfer` / `transferFrom` the whole treasury to any address.
- `removeOwner` / `swapOwner`: kick your hardware wallet out.
- `changeThreshold`, `addOwnerWithThreshold`: add an attacker-controlled owner.
- `enableModule`: install a module that can move funds with no signatures at all.
- `setGuard` / `setFallbackHandler`: disable or subvert any checks you add later.
- `DELEGATECALL` to arbitrary code, which can rewrite the Safe's storage directly.

So whoever steals the agent key doesn't just drain funds. They can **remove your
hardware wallet in the same block**. The "backup" can't win a race against the
key it's supposed to back up, and once it's been removed it can't do anything.

### 2. The "backup owner" argument is backwards

The PR treats the hardware wallet as recovery in case the agent key is
**lost**. But loss isn't the risk that matters for a hot key. **Theft** is. A
hot key sits in a process that:

- reads untrusted inputs (market data, APIs, possibly LLM prompts, so prompt
  injection counts too);
- runs a large dependency tree (supply-chain risk);
- lives on a server, in env vars, CI secrets, logs and backups.

Adding owners at threshold 1 **makes security worse**: the attack surface
becomes the *union* of all the keys. The hardware wallet adds recovery against
loss and zero protection against theft. Also, recovery from a lost agent key
doesn't need the hardware wallet to be a full co-owner. In the design below,
replacing the agent key is a routine admin action.

### 3. "The agent must not wait on a human" is a real requirement, but ownership is the wrong way to meet it

The actual requirement is: *the agent can trade without a human in the loop.*
It is **not**: *the agent can move funds anywhere, change the owners, and
install modules without a human in the loop.* Those are different permission
sets, and a Safe lets you separate them. Owners handle **administration and
custody**. The agent should get a **narrow, enforced trading role**, not
ownership.

## Recommended design

### Owner set and threshold: **2-of-3 human/cold keys, and the agent is NOT an owner**

| Signer | Where it lives | Hot/cold | Role |
|---|---|---|---|
| Owner A | Your hardware wallet (Ledger/Trezor/Keystone), seed backed up offline | Cold | Owner |
| Owner B | A second hardware wallet: a different device from a different vendor if possible, kept in a different physical location (e.g. a co-founder or trusted officer, or a second device of yours in a safe/bank box) | Cold | Owner |
| Owner C | A third hardware wallet or an institutional co-signer, again kept separately | Cold | Owner |
| **Agent key** | KMS/HSM-backed signer (AWS KMS, GCP KMS, Turnkey, Fireblocks-style policy signer). The key is non-exportable and never sits in plaintext env vars or on disk | **Hot** | **Not an owner.** Only a scoped *role member* through a module |

**Safe threshold: 2 of 3.**

- **Why 2:** no single stolen or coerced device, and no single compromised
  person, can move the treasury or change who controls it.
- **Why 3 keys:** losing any one device still leaves 2, so you can rotate it
  out. That gives you real *loss* recovery, which is what the PR wanted the
  "backup owner" for.
- If you truly have only one human, still use 2-of-3 hardware wallets held
  in separate places (home, office safe, safety-deposit box). That's better
  than giving the agent owner rights. A professional co-signer or a second
  trusted person is better still.

### How the agent gets to act: a scoped permissions module

Enable a permissions module on the Safe, for example **Zodiac Roles Modifier**
(v2). Safe's own **Allowance Module** also works if all you need is plain
spending limits. The owners assign the agent's address a **role** that only
permits specific calls:

- **Target allowlist:** only the DEX routers/pools you actually use
  (e.g. Uniswap Universal Router, CoW settlement, a specific aggregator), plus
  `approve` on the allowlisted tokens, scoped so the spender must be one of
  those routers.
- **Function and parameter scoping:**
  - `recipient` / `to` / `receiver` **must equal the Safe's own address**. The
    agent can swap A→B but the output always lands back in the Safe. This is
    the single most important rule.
  - Token in/out restricted to an allowlist (e.g. ETH, WETH, USDC, USDT, and
    whatever the strategy needs). No arbitrary tokens, so no swapping into an
    attacker's worthless token through their own pool.
  - `Call` only, **no `DelegateCall`**.
  - No plain `transfer` of any token to anyone.
- **Rate/size limits (Roles v2 allowances):** e.g. max notional per trade and
  a rolling cap per 24h (say $50k/trade, $150k/day, tuned to the strategy).
  These cap the damage from deliberately bad trades.
- **Price protection:** because the agent picks `amountOutMin`, a thief could
  drain value by trading at awful prices through a thin pool or a sandwich.
  Mitigations:
  - Only allow deep, allowlisted pools/aggregators.
  - Enforce slippage on-chain where you can. Route through a small wrapper
    contract that checks `amountOut` against a Chainlink/TWAP price, and
    allow the agent to call only that wrapper.
  - Use private orderflow (Flashbots Protect / MEV Blocker, or CoW intents).

The agent then calls `execTransactionWithRole` on the Roles Modifier. The
modifier checks the permissions and forwards the call to the Safe with
`execTransactionFromModule`. **No human signature is needed, so the agent
trades at full speed.**

### Optional but strongly recommended: split hot vs. cold capital

Don't keep the full $400k inside the agent's reach even with scoping:

- **Vault Safe (2-of-3, no modules):** holds most of the funds.
- **Trading Safe (same 2-of-3 owners + Roles module for the agent):** holds
  only the working capital the strategy needs, e.g. $50–100k. The humans top
  it up from the vault.

Worst-case loss from a compromised agent is then capped by *both* the role
limits *and* the balance of the trading Safe.

### Operational controls

- **Monitoring and alerting** on every module transaction and on any Safe
  config change (owners, threshold, modules, guard, fallback handler), using
  e.g. Tenderly, OpenZeppelin Defender/Monitor, Forta or Hypernative.
- **Kill switch:** owners can revoke the agent's role or disable the module
  in one 2-of-3 transaction. Prepare and simulate this transaction in advance
  so revocation takes minutes, not hours. If you want one person to be able
  to pause alone, add a dedicated "guardian" role that can *only* revoke the
  agent role or pause, never move funds.
- **Agent key hygiene:** non-exportable KMS/HSM key, an IAM policy limited to
  the agent's runtime identity, signing request logs, regular rotation (which
  is just the owners reassigning the role to a new address).
- **Review and test the permission set:** run fork tests that try to
  exfiltrate funds with the agent key (transfer, approve to an attacker,
  swap with an attacker recipient, delegatecall, `enableModule`) and assert
  every attempt reverts.
- **Keep the Safe itself clean:** no other modules, no delegatecall-able
  fallback handlers, and a pinned, audited Safe version.

## What the agent can and cannot do on its own

**The agent CAN, with no human signature:**

- Swap between allowlisted tokens on allowlisted venues.
- Approve allowlisted tokens to allowlisted routers only.
- Do this up to the per-trade and per-period size caps, within the slippage
  bounds enforced on-chain.
- In every case, the proceeds land back in the Safe.

**The agent CANNOT:**

- Transfer any asset to any external address, including its own.
- Set a swap recipient other than the Safe.
- Interact with non-allowlisted contracts or tokens, or use `DELEGATECALL`.
- Exceed its rolling notional limits.
- Add or remove owners, change the threshold, or enable/disable modules.
- Set a guard or fallback handler, or upgrade the Safe.
- Change its own permissions.
- Touch the vault Safe at all, if you use the split.

Everything outside the role needs **2 of the 3 cold keys**: withdrawals,
off-ramping, new venues or tokens, raising limits, and rotating the agent key.

## What this buys you if the agent's key is stolen

| | Draft (1-of-2, agent is owner) | Recommended (2-of-3 cold owners + scoped agent role) |
|---|---|---|
| Attacker can withdraw funds to own address | **Yes, 100%, immediately** | **No.** Every output must go to the Safe |
| Attacker can lock you out (remove your HW wallet, add own owner) | **Yes** | **No.** Admin actions need 2 cold keys |
| Attacker can install a backdoor module / delegatecall | **Yes** | **No** |
| Remaining attack | None needed; they already have everything | Value leakage through bad trades, capped by allowlisted pools, on-chain slippage checks and the daily notional limit |
| Worst-case loss | ~$400k (everything) | A small fraction: bounded by slippage × daily cap, and further by the trading Safe's balance if split |
| Recovery | None; funds and control are gone | Owners revoke the role (one pre-built 2-of-3 tx), rotate the KMS key, reassign the role. Funds never left the Safe |

A stolen agent key goes from **"total, irreversible loss of the treasury"** to
**"a bounded incident you contain with a single revoke transaction."** The
agent still trades autonomously, which was the PR's legitimate goal. The
difference is that its autonomy is enforced by on-chain rules instead of by
trusting that its key never leaks.

## Summary of requested changes to the PR

1. Remove the agent key from the Safe owner set.
2. Owners: 3 hardware wallets (or 2 HW wallets plus a professional co-signer)
   in separate locations; threshold **2**.
3. Add a Zodiac Roles Modifier (or equivalent) granting the agent a
   scoped trading role: allowlisted targets, selectors and tokens,
   recipient = Safe, no delegatecall, rate limits, on-chain slippage checks.
4. Keep the agent key in a non-exportable KMS/HSM.
5. Preferably split into a vault Safe and a smaller trading Safe.
6. Add monitoring, a pre-signed or pre-built revoke transaction, and fork
   tests proving the agent key can't exfiltrate funds.
