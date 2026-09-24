# Deploying the WETH/USDC rebalancer to mainnet

This agent trades a ~$400k treasury unattended on a cloud VM. The main design
question is not where the agent's key is stored. It is **what that key can do
if someone else gets it.** Assume a cloud VM key will leak at some point: through
a dependency, a misconfigured instance role, a leaked snapshot, or your laptop.
Plan for that case up front.

## 1. Authority model

```
 You (2 of 3 hardware wallets)
   │  owners, threshold 2
   ▼
 Treasury Safe ─────────────── holds ALL WETH + USDC (the $400k)
   │  enabled module
   ▼
 Zodiac Roles Modifier v2 ───── role "rebalancer": one function, pinned args, daily allowance
   ▲  execTransactionWithRole
   │
 Agent EOA (cloud VM) ───────── holds ~0.3 ETH for gas. Nothing else.
```

**The agent key can:** make the Safe call `SwapRouter02.exactInputSingle` on the
WETH/USDC 0.05% pool, with the proceeds going back to the Safe, for up to the
daily allowance on each side.

**The agent key cannot:** transfer tokens, set approvals, send proceeds to any
other address, touch any other token, pool or contract, delegatecall, raise its
own allowance, add signers, or disable the module. The Roles Modifier enforces
all of this on-chain. `rebalance.ts` also checks it before every trade (see
`assertScoped`). If a swap to the agent address or a token transfer would
succeed, the script halts.

**Worst case if the agent key is stolen.** The attacker can't withdraw anything.
What they can do is submit in-scope swaps with `amountOutMinimum = 0` and
sandwich them. That turns part of the daily allowance into MEV profit for them.
**Your maximum loss per day is roughly the daily allowance on both sides, until
you revoke the role.** So set the allowance to an amount you would accept losing
in one day, not an amount that is merely convenient. Roles v2 can't compare
`amountOutMinimum` to an oracle price on-chain. Closing this gap needs a small
custom swap-guard contract that checks Chainlink on-chain. That's worth doing
later, but new unaudited code isn't something to ship this week.

The worst case under the obvious alternative ("the agent EOA holds the treasury,
with its key in KMS") is the entire $400k in a single transaction. KMS only
controls who can use the key. It does not limit what the key can do.

### Operations that need your signature (2 of 3 Safe owners)

| Operation | How |
|---|---|
| Move principal in or out of the Safe | Safe tx |
| Raise or lower the agent's daily allowance | `Roles.setAllowance(...)` via Safe tx |
| Change what the role permits (pairs, fee tier, router) | `Roles.scopeFunction/...` via Safe tx |
| Add, remove or rotate the agent key | `Roles.assignRoles(...)` via Safe tx |
| Change Safe owners or threshold, enable or disable modules | Safe tx |
| Approve SwapRouter02 to spend the Safe's WETH and USDC | Safe tx (setup, and top-ups later) |

Routine trades need no human approval. The owners approve the role once, and the
role is the approval for every trade inside it. Anything outside the role
reverts on-chain.

### Revoking the agent without its cooperation

- **Normal:** two owners sign `Roles.assignRoles(agent, [roleKey], [false])`.
  The next agent tx reverts.
- **Hard stop:** two owners sign `Safe.disableModule(prevModule, rolesModifier)`.
  This cuts off every role at once.
- **Pre-signed kill switch (recommended):** module executions **do not consume
  the Safe nonce**. A revoke tx signed by two owners at the current Safe nonce
  therefore stays valid until you next do an owner tx. Sign it now and give it
  to your monitor (§7). Anyone holding it can submit it, but all it can do is stop
  trading. **Re-sign it after every owner transaction**, because each one uses up
  that nonce.

Nothing the agent does can block any of these steps.

## 2. Owner keys (do this first)

1. Get **three hardware wallets**, ideally from two different vendors. One person
   can hold all three. The threshold protects you because it forces an attacker
   to compromise two separate devices. A single hardware wallet holding $400k is
   a single point of failure.
2. Generate each seed on its own device. Back up each seed on metal and store the
   backups in **separate locations**. Keep device 3 and its backup off-site.
   Losing two of the three seeds locks the treasury permanently.
3. Rehearse recovery before funding: restore one device from its backup and sign a
   test tx.

## 3. Treasury Safe

1. Use app.safe.global on Ethereum mainnet to create a Safe with the 3 owner
   addresses and **threshold 2**. Check the owner addresses on each device's screen.
2. Send a small test amount. Sign and execute a transfer out with two devices.
3. Don't add the agent key as an owner.

## 4. Roles Modifier and the "rebalancer" role

Deploy a Roles Modifier v2 instance with the Zodiac app in the Safe
(Apps → Zodiac → Roles), with `owner = avatar = target = Safe`. The app deploys
a proxy of the Roles v2 mastercopy (`0x9646fDAD06d3e24444381f44362a3B0eB343D337`)
through the Zodiac ModuleProxyFactory (`0x000000000000aDdB49795b0f9bA5BC298cDda236`).
Before you sign, check both addresses against the current Zodiac docs. The app
also enables the module on the Safe.

Configure the role in the Roles app (roles.gnosisguild.org) or with
`zodiac-roles-sdk`. Every item below is a Safe tx signed by two owners:

- **Role key:** `rebalancer` (bytes32-encoded, which is what `ROLE_KEY` defaults to).
- **Member:** the agent EOA address (§5).
- **Target:** SwapRouter02 `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`,
  function-scoped, **ExecutionOptions = None** (no ETH value, no delegatecall).
- **Function:** `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`,
  with the params tuple conditioned as:
  - `Or` of two `Matches`, one per direction:
    - tokenIn = WETH `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`, tokenOut = USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
      amountIn `WithinAllowance(weth-in-daily)`
    - tokenIn = USDC, tokenOut = WETH, amountIn `WithinAllowance(usdc-in-daily)`
  - in both: fee `EqualTo 500`, **recipient `EqualTo <your Safe>`**, amountOutMinimum and
    sqrtPriceLimitX96 `Pass`.
- **Allowances** (`setAllowance`, refill period 86400 s):
  - `usdc-in-daily`: e.g. 100,000 USDC (`100000000000`), maxRefill equal to that.
  - `weth-in-daily`: the same USD value in WETH **at today's price**. Revisit it
    when ETH moves a lot.
  - These two numbers are your daily blast radius (§1). Start low and raise them
    once you have a track record. `POLICY.maxDailyNotionalUsd` in
    `rebalance.ts` must stay at or below them.
- **Nothing else.** Specifically: no `approve` or `transfer` on any token, no
  `multicall`, and no wildcarded targets.

**Router approvals.** The owners sign `WETH.approve(SwapRouter02, X)` and
`USDC.approve(SwapRouter02, Y)` from the Safe. Use finite amounts, for example
the Safe's holdings plus some headroom. The agent can't top these up. When one
runs low, `rebalance.ts` refuses the trade and tells you.

## 5. Agent key

- Generate a **new** key on the VM or inside your secret manager. Don't reuse an
  old key, and never let a key pass through a chat, a prompt, a ticket, an email
  or a git commit. **A key that has been through any of those is burned: generate
  a new one and don't fund the old one.**
- Store it in the cloud secret manager (AWS Secrets Manager / GCP Secret Manager).
  Grant read access only to the VM's service identity. Inject it as
  `AGENT_PRIVATE_KEY` at process start. It never goes in the repo, the image, or
  a `.env` that is committed. `.gitignore` already covers `.env*` and `state/`.
  Check this before your first push.
- Moving to KMS-backed signing (the key never leaves the HSM) is a reasonable
  later improvement. It limits who can sign. §1 already limits what can be signed.
- Fund it with **~0.3 ETH for gas only**. It never holds tokens.
- Never sign an EIP-7702 authorization with this key. It doesn't need one. If
  code ever appears at the agent address (`0xef0100…` delegation designator),
  treat that as a compromise.

## 6. The VM and the process

- Node 22+, `npm ci` from the committed lockfile, with exact dependency versions
  pinned. Your dependencies can read the key, so treat every upgrade as a
  security change.
- Environment:

  | var | value |
  |---|---|
  | `AGENT_PRIVATE_KEY` | from the secret manager at runtime |
  | `RPC_URL` | a paid mainnet RPC (Alchemy, Infura, QuickNode…). Used for reads, simulation and receipts |
  | `SUBMIT_RPC_URL` | defaults to `https://rpc.flashbots.net/fast` (Flashbots Protect). Keeps trades out of the public mempool so they can't be sandwiched |
  | `SAFE_ADDRESS` | your Safe |
  | `ROLES_MODIFIER_ADDRESS` | your Roles Modifier proxy (not the mastercopy) |
  | `ROLE_KEY` | optional, default `rebalancer` |
  | `STATE_DIR` | persistent disk. Holds the pending-tx record and the daily ledger |

- Run it under systemd (or similar) as a non-root user, with no inbound ports
  apart from SSH (ideally SSO or IAP rather than a public port 22).
- `STATE_DIR` must survive restarts. If you lose it, you lose the pending-tx
  guard. The on-chain allowance still holds.
- The signal process calls `executeRebalance({direction, amountIn}, {execute: true})`,
  or runs `tsx rebalance.ts <SELL_WETH|BUY_WETH> <amount> --execute`. Handle exit
  codes as follows. **2** = refused by policy: skip this signal. **3** = unresolved
  pending tx: stop trading and send an alert. **1** = error: send an alert.

### What happens on each trade

1. Refuses if a previous tx is still pending, or if the agent's nonce was used by
   a tx that isn't in the ledger (a sign of key compromise).
2. Reads Chainlink ETH/USD and USDC/USD live and rejects stale feeds. Halts if
   USDC is more than 1% off its peg.
3. Enforces a trade size of $1k–$50k and the off-chain daily cap. Checks the
   Safe's balance and its router allowance.
4. Quotes through QuoterV2. Refuses if the quote is more than 1% worse than
   Chainlink (a manipulated or illiquid pool). Sets min-out to the quote minus 0.3%.
5. Builds `Roles.execTransactionWithRole(SwapRouter02, 0, exactInputSingle(...), CALL, roleKey, shouldRevert=true)`.
6. Simulates the call, then checks that out-of-scope calls are rejected.
7. Estimates gas, prices it in USD from the live feed, and enforces the base-fee,
   gas-cost and gas-float caps.
8. Prints the signer, target, Safe, amount, min-out and gas cost. **Without
   `--execute` it stops here.** Always do a dry run by hand before you enable the
   service.
9. Signs locally, writes the tx hash to `state.json` **before** broadcasting, and
   submits through Protect.
10. Waits for the receipt and checks the Safe's balance change.

## 7. Before the real $400k goes in

- [ ] Dry run with the Safe holding about $5k. The output should show the right
      Safe, Roles Modifier and amounts, and a sensible gas cost.
- [ ] One `--execute` trade of about $1k. Check it on Etherscan: the tx goes
      agent → Roles → Safe → router, and the tokens come back to the Safe.
- [ ] Negative test: from the agent key, try a swap with `recipient = agent`
      and a `USDC.transfer`. Both must revert (the script's `assertScoped` does
      this through `eth_call`).
- [ ] Revoke the agent with the owner keys, confirm the next trade reverts, then
      re-grant. Time how long this takes you.
- [ ] Pre-sign the kill-switch tx (§1) and store it with the monitor.
- [ ] Monitoring is live (below), and you have tested that it can page you.
- [ ] Run for a week at around $50k. Then move the rest in from the owner wallets.

## 8. What you're on the hook for once it's running

**Things that must page you (the only things that should wake you up):**
- Any tx from the agent address whose hash isn't in `state.json`. That means
  someone else holds the key. Response: submit the pre-signed revoke, then rotate.
- Any Safe owner transaction you didn't make, or any change to the Roles config
  (`AssignRoles`, `SetAllowance`, `ScopeFunction`, module enabled or disabled).
- The Safe's USD value falling more than X% in 24h beyond what ETH's price move
  explains.
- Exit code 3 (stuck tx) or repeated exit code 1.

Run the monitor **somewhere other than the trading VM**, using a different RPC
provider, for example Tenderly alerts plus a small cron job on another cloud
account. A monitor on the same machine as the key goes down with it.

**Routine work (daytime):**
- Top up agent gas when the balance falls below ~0.1 ETH.
- Top up the Safe's router approvals when the script reports they are low.
- Re-sign the kill-switch tx after every owner transaction.
- Review the allowances when ETH's price moves a lot, since the WETH allowance
  is set in WETH.
- Update dependencies deliberately, with pinned versions and a reviewed diff.

**Incidents:**
- *Agent key suspected leaked:* revoke the role, stop the service, generate a new
  key (§5), assign it, and send the old address's leftover gas back. There's no
  need to move the treasury, because the old key never had authority over it.
- *Owner device lost:* you can still sign with 2 of 3. Right away, have two owners
  sign a `swapOwner` that replaces the lost device's address with a new device.
- *Uniswap, Chainlink or USDC problem:* the script refuses on a stale feed, a
  depeg or a bad quote. Pause the service by hand if an incident is ongoing.
  USDC is an upgradeable contract whose issuer can freeze balances, and that risk
  sits in your treasury whatever the agent does.

**Not covered by any of the above:** the agent can lose money *inside* its
permissions, through bad signals, churn, or slippage on every trade. The daily
allowance limits the damage per day. Whether the strategy is any good is up to
you, and so are tax and accounting for every swap. Each one is a taxable event
in most jurisdictions.
