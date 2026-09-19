# Custody review: agent-operated Safe holding ~$400k

## Verdict

**Threshold 1 isn't acceptable. Reject this part of the PR.**

A 1-of-2 Safe where one owner is a hot key works exactly like a hot wallet holding $400k. The Safe and the hardware wallet add almost no security. The PR is right that the agent has to be able to trade without a human. It's wrong about how to get there. Making the agent a sole-signing **owner** is the wrong tool. Instead, give the agent a **narrowly scoped, on-chain-enforced permission** to trade, and give it no ownership at all.

---

## Why 1-of-2 fails

### 1. Either owner alone has full control

With `threshold = 1`, `execTransaction` needs one owner signature. Whoever holds the agent's hot key can, in **one transaction** (for example, a `MultiSend` batch):

- `transfer` every ERC-20 and all the ETH to an attacker address;
- `approve` an attacker contract for unlimited amounts;
- `delegatecall` into arbitrary code, which runs with the Safe's own storage and authority;
- `removeOwner(hardwareWallet)`, `swapOwner`, `changeThreshold`, `enableModule(attackerModule)`, `setGuard`, `setFallbackHandler`.

A threshold-1 Safe has no concept of a "junior" owner. The agent key has exactly the same power as your hardware wallet.

### 2. The hardware wallet doesn't protect you from theft

The PR says the hardware wallet is there "in case the agent's key is ever lost." That covers **loss**. It does nothing about **theft**, which is the threat that matters for a hot key on an internet-connected trading box. The thief moves first. By the time you notice and plug in the Ledger, the funds are gone. The thief can also remove your hardware wallet as an owner in the same transaction. You can't win a race against someone who acts in a single block.

### 3. The attack surface is the whole agent stack

The agent key is hot by necessity. It sits on a server that also runs:

- the trading code;
- its dependencies (supply-chain risk);
- RPC/API credentials;
- if it's LLM-driven, a component that reads untrusted data such as token names, market data and web content, which invites prompt injection.

Any of these can lead to the key being stolen, or to the agent being tricked into signing something harmful. Neither case should be able to move treasury funds out.

### 4. The agent itself is a risk, not only its key

Even if nobody steals the key, a bug or a manipulated decision under 1-of-1 authority can send funds anywhere. A good design limits what a **correct key, used by a confused or hijacked agent**, can do.

**Conclusion:** the only thing standing between an attacker and $400k is the security of one hot key on one server. Treasury funds need more than that.

---

## Recommended design

The main idea is to **separate ownership from operation.**

- Humans with cold keys **own** the Safe, under a real multisig threshold.
- The agent **operates** the Safe through a permissions module. On-chain rules limit it to a whitelist of trading actions, and it can never change those rules.

### Part A: ownership (the vault's root of trust)

**Safe owners: 2-of-3, all cold hardware keys. The agent key is *not* an owner.**

| Owner | Key type | Where it lives |
|---|---|---|
| Owner 1 | Hardware wallet (Ledger/Trezor/GridPlus) | You, your primary device |
| Owner 2 | Hardware wallet, a **different device and seed** | A second trusted person (co-founder/finance lead), or you, stored in a separate physical location |
| Owner 3 | Hardware wallet, or a seed on a metal backup | Recovery key, cold storage in a safe or bank box, used only for recovery and rotation |

Threshold **2**. Why 2-of-3:

- **One compromised key can't move funds.** That includes one stolen hardware wallet or one phished human.
- **One lost key doesn't lock you out.** The other two can rotate the lost one.
- The agent key doesn't appear here at all. Stealing it grants **zero owner rights**.

(If you really are the only person involved, still use three separate hardware seeds in separate places. Two devices kept in the same drawer are effectively one key. A second human signer is better, because it also defends against someone coercing or phishing you.)

Owners are needed only for rare administrative actions:

- adding or removing owners;
- changing the threshold;
- changing the agent's permissions;
- revoking the agent;
- moving money between vault and trading funds;
- anything else outside the agent's whitelist.

Those actions can wait for humans.

### Part B: the agent's authority (a scoped role, not ownership)

Enable a permissions module on the Safe. The **Zodiac Roles Modifier v2** is the standard, audited choice. You could also use an equivalent audited policy module or Safe-compatible policy framework. The Safe owns and configures the module. The agent's hot address is assigned to one role, "trader." The module checks every call the agent makes against that role's permissions **on-chain**, before the Safe executes it.

Scope the "trader" role like this:

1. **Target allowlist.** The agent can call only specific contracts:
   - the approved DEX routers or pools (for example, a specific Uniswap/CoW/1inch router version);
   - the approved tokens, and only for `approve`.
2. **Function allowlist.** Only specific selectors on those targets, such as `exactInputSingle` or `swap`. It gets no generic `execute` or multicall paths that could hide arbitrary calls.
3. **Parameter constraints.**
   - `recipient` / `to` **must equal the Safe's own address**. This is the most important rule. It means that any trade the agent makes sends the proceeds back to the Safe.
   - `approve(spender, …)` only when `spender` is one of the allowlisted routers.
   - `tokenIn` / `tokenOut` only from an asset allowlist (for example USDC, USDT, DAI, WETH, wstETH).
4. **No `delegatecall`, no ETH value** except where needed, **no `transfer` / `transferFrom`** of tokens to anyone.
5. **Rate limits / allowances.** Use the Roles "allowance" feature to cap how much can be swapped per period, for example $X of notional per 24h and $Y per trade. Size these to the strategy's real needs, not to $400k.
6. **Slippage/price protection.** The Roles module checks parameters well but can't judge prices. Route swaps through a thin, audited wrapper contract (or use CoW/limit orders) that enforces `minAmountOut` against an oracle (Chainlink/TWAP), with a maximum deviation of, say, 0.5–1%. Otherwise a hijacked agent could push the treasury through a pool the attacker controls or has manipulated.

On top of the scoped role, add these safeguards:

- **Split the funds.** Keep most of the treasury in a **vault Safe** (2-of-3, no modules at all). Keep only working capital in the **trading Safe**, which has the Roles module. Refills from vault to trading require 2-of-3. If the strategy really needs all $400k to be deployable, the allowances and wrapper checks still bound the damage. But splitting keeps the "if everything else fails" exposure small.
- **Separate gas EOA.** The agent's hot address holds only a small ETH balance for gas and holds no treasury assets.
- **Hot-key hygiene.** Store the agent key in a KMS/HSM (AWS KMS, GCP KMS, a cloud HSM) or a TEE so it's non-exportable. It should never be a raw private key in an env var or `.env` file. Lock down IAM, and alert on signing requests.
- **Monitoring and kill switch.** Use off-chain monitoring (Tenderly/Forta/OpenZeppelin Defender-style alerts) for:
  - any failed module calls (probing);
  - trade volume approaching the caps;
  - any owner-level transaction.

  Keep a pre-built "revoke trader role / disable module" transaction ready in the Safe queue, so two owners can kill the agent in minutes. Optionally, a dedicated guardian key can have a role whose **only** permission is revoking the trader role. It must be unable to move funds.
- **Guard (optional).** Add a Safe Guard, or a Delay modifier on owner actions, if you want a time lock on configuration changes.
- **Audit the permission config.** Once you use a module, the Roles config becomes the security boundary, because modules bypass the owner threshold by design. Review it carefully. Test it on a fork: try to make the agent key send funds out through every allowed path, and make sure all of those attempts fail.

---

## What the agent can and cannot do on its own

### The agent CAN, with no human involved:

- Swap between allowlisted tokens on allowlisted venues, with the output always going back to the Safe.
- Approve allowlisted routers to spend allowlisted tokens.
- Do this at any hour, as fast as it wants, **up to the per-trade and per-period allowances**.
- Pay its own gas from its gas EOA.

It gets the full autonomy it needs to trade. Nothing in its normal loop waits on a human.

### The agent CANNOT, even with a valid signature:

- Transfer any token or ETH to any external address, including its own.
- Approve an arbitrary spender.
- Call any contract or function that isn't on the allowlist, or use `delegatecall`.
- Exceed its trading allowances, or trade outside the oracle price band.
- Add or remove owners, change the threshold, enable or disable modules, change guards or fallback handlers, or upgrade the Safe.
- Change its own permissions or raise its own limits. The module's owner is the Safe, and that takes 2-of-3 cold keys.
- Touch the vault Safe at all.
- Bridge, withdraw to a CEX, or deploy to new protocols. Each of these is a human-approved config change.

---

## What this buys us if the agent's key is stolen

| | Current PR (1-of-2 owner) | Recommended design |
|---|---|---|
| Can the thief send funds to themselves? | **Yes, all $400k, in one tx** | **No.** Every trade's output must go back to the Safe, and transfers aren't permitted. |
| Can the thief lock you out? | **Yes**, `removeOwner` on your hardware wallet | **No.** The agent isn't an owner and can't touch the module config. |
| Can the thief plant persistence (a module or guard)? | Yes | No |
| Worst case | Total loss | Value leaked through bad trades, bounded by (per-period allowance × slippage band) until you revoke. Keep the vault separate and the maximum exposure is a small fraction of the trading balance. |
| Recovery | None. Funds are gone. | Two owners revoke the trader role, rotate to a new KMS key, re-assign the role, investigate. Funds never left the Safe. |

The same design also solves the problem the PR was worried about, **losing** the agent's key. That becomes a non-event: the owners assign the trader role to a new key. The hardware wallet goes from being a backup that can't act in time to being the actual root of control.

## Summary for the PR

- ❌ Reject `owners = [agentHotKey, myHardwareWallet], threshold = 1`.
- ✅ **Owners:** 3 cold hardware-wallet keys, on separate seeds and separate locations (ideally at least 2 people). **Threshold 2.** The agent is **not** an owner.
- ✅ **Agent:** a hot key in KMS/HSM, assigned a Zodiac Roles "trader" role. It can call only allowlisted swap functions, the recipient is pinned to the Safe, approvals only go to allowlisted routers, there's no delegatecall, and allowances cap volume per period. Price protection comes from an oracle-checked swap wrapper.
- ✅ Keep bulk funds in a separate vault Safe with no modules. Refill the trading Safe by 2-of-3.
- ✅ Monitoring plus a pre-staged revoke transaction as the kill switch. Fork-test the permission set before going to mainnet.
