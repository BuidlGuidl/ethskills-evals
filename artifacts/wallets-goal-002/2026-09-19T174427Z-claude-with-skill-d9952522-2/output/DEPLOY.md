# Deploying the WETH/USDC rebalancer on Ethereum mainnet

This covers what has to exist before `rebalance.ts` runs unattended with the ~$400k treasury behind it,
and what you're responsible for once it's running.

**The main design decision: the key on the VM can't spend the treasury.** It can only do one thing:
swap WETH↔USDC in the Uniswap V3 0.05% pool, with the output going back to the treasury, and only up to a
fixed amount per 24h. The contract layer enforces those limits, not `rebalance.ts`. Anything outside that
scope takes a signature from you on separate hardware wallets. Your VM, your code, or your signal logic
can all get compromised or have bugs, and the damage stays inside those caps.

---

## 1. Who can do what

| Actor | Where it lives | Can do | Cannot do |
|---|---|---|---|
| **Treasury Safe** (Safe 1.4.1, **2-of-3**) | on-chain | holds all WETH + USDC | — |
| **Owner keys ×3** | 3 hardware wallets, stored separately, **never on the VM** | anything, with 2 signatures: move principal, change caps, add/revoke the agent, change owners | anything with only 1 key |
| **Zodiac Roles Modifier v2** | on-chain, enabled as a Safe module, owned by the Safe | lets role members run exactly the calls their role allows | change itself (only the Safe can) |
| **Agent EOA** | key in an encrypted systemd credential on the VM | `SwapRouter.exactInputSingle`, WETH→USDC or USDC→WETH, fee 500, `recipient == Safe`, ≤ 20 WETH or ≤ 60k USDC per trade, ≤ 45 WETH and ≤ 150k USDC `amountIn` per rolling 24h | transfer or approve tokens, send to any address but the Safe, use any other pool, token, or contract, delegatecall, raise its own caps, add members, touch the Safe's owners |

You can be the only person holding all 3 owner keys. What matters is that they're on 3 separate devices:
someone who steals one device, or who compromises your laptop, still can't meet the threshold.
One hardware wallet as the sole owner would be a single point of failure (loss or theft) for the whole $400k.

The on-chain caps live in `config.ts` (`ONCHAIN_*`) and are applied by `roles-setup.ts`. `rebalance.ts`
also enforces a tighter off-chain policy: $50k per trade, 30 bps slippage, pool within 75 bps of Chainlink,
a gas ceiling, and a USDC peg floor. A stolen key skips the off-chain policy entirely, so **the on-chain
caps are your real loss limit.**

### What the caps mean in dollars, and what they don't cover

The role can't compare prices against an oracle. That means someone holding the agent key could push the
0.05% pool off-price and have the Safe trade into it with `amountOutMinimum = 0` (a self-sandwich). Their
profit is capped by how much the Safe can be made to sell, so **the worst case from a stolen agent key is
roughly the value of one day's cap**: 45 WETH + 150k USDC of `amountIn`, per 24h, until you revoke it.
Realistically the loss is the price impact they can extract, not the full notional, but plan around the
full figure.

- **Pick caps you can afford to lose once.** The defaults are about 3× a heavy normal day. If ~45 WETH +
  $150k is more than you can accept losing, lower `ONCHAIN_DAILY_*` before running `roles-setup.ts`.
  Raising them later takes the Safe threshold, which is the point.
- **If you want a tighter bound:** put a small guard contract in the path that checks `amountOutMinimum`
  against Chainlink on-chain. That's new, unaudited code sitting in front of $400k. Don't write it this
  week. If you add it, get it reviewed first.

---

## 2. Setup, in order

Before you run anything:
- Run `npm install`.
- Check that `.gitignore` is committed. It already is, and it covers `.env*`, `*.key`, `*.cred`, and `agent_key*`.
- Nothing in this repo contains a key, and none of the code falls back to one.

### 2.1 Owner keys (on your desk, not the VM)
1. Set up 3 hardware wallets. Ideally use 2 vendors, so one firmware bug can't hit every key.
   Write each seed down offline, and store the seeds in separate physical places.
2. Record the 3 owner addresses. The VM never sees these keys or seeds.

### 2.2 Treasury Safe
1. In app.safe.global on Ethereum mainnet, create a Safe with the 3 owners and **threshold 2**.
2. Verify it:
   `cast call $SAFE "getThreshold()(uint256)"` should return `2`, and `cast call $SAFE "getOwners()(address[])"`
   should list your 3 addresses.
3. Don't move the $400k yet.

### 2.3 Roles Modifier
1. In the Safe UI, open Apps → Zodiac → add **Roles Modifier v2**. This deploys a proxy of mastercopy
   `0x9646fDAD06d3e24444381f44362a3B0eB343D337` through `ModuleProxyFactory`
   `0x000000000000aDdB49795b0f9bA5BC298cDda236`, sets owner = avatar = target = the Safe, and enables it
   as a module. Sign it with 2 owners.
2. Verify it:
   - `cast call $ROLES "owner()(address)"`, `avatar()`, and `target()` should all return `$SAFE`.
   - `cast call $SAFE "isModuleEnabled(address)(bool)" $ROLES` should return `true`.
   - `cast call $SAFE "getModulesPaginated(address,uint256)(address[],address)" 0x0000000000000000000000000000000000000001 10`
     should list **only** `$ROLES`. Any other module can also move funds.

### 2.4 Agent key: generate it on the VM, and don't let it leave
```bash
sudo install -d -m 700 /etc/rebalancer
# generate straight into an encrypted systemd credential (bound to this host's TPM/host key)
openssl rand -hex 32 | sed 's/^/0x/' | sudo systemd-creds encrypt --name=agent_key - /etc/rebalancer/agent_key.cred
# derive the address (the key passes through argv once; do this on the VM, not over a shared session log)
sudo systemd-creds decrypt /etc/rebalancer/agent_key.cred - | xargs -I{} cast wallet address --private-key {}
```
- Only the **address** goes into your config, notes, and the Safe batch.
- **If this key, or any key you plan to use, has ever been pasted into a chat, an AI prompt, a ticket,
  a Slack message, or a git commit, treat it as burned.** Generate a new one, and never fund the old address.
- Optional upgrade: a cloud KMS or HSM signer means an attacker on the VM can sign only while they're on
  the VM, instead of copying the key out. It doesn't change the loss limit, because the role already sets that.

### 2.5 Grant the role (the one big owner transaction)
```bash
SAFE_ADDRESS=0x… ROLES_MODIFIER_ADDRESS=0x… AGENT_ADDRESS=0x… npx tsx roles-setup.ts > roles-batch.json
```
Load `roles-batch.json` into the Safe **Transaction Builder**. It contains 7 calls. Check each one before signing:
1. `scopeTarget(rebalancer, SwapRouter 0xE592…1564)`
2. `scopeFunction(…, exactInputSingle 0x414bf389, <conditions>, options=0)`: no ETH value, no delegatecall
3. `setAllowance(rebalancer-weth-in, 45e18, 45e18, 45e18, 86400, now)`
4. `setAllowance(rebalancer-usdc-in, 150000e6, …)`
5. `assignRoles(<agent address>, [rebalancer], [true])`: **check that this address matches the one you derived in 2.4**
6. and 7. `WETH.approve(SwapRouter, max)` and `USDC.approve(SwapRouter, max)`, both from the Safe

The agent gets no `approve` permission. SwapRouter can only pull tokens from the Safe during a swap the
Safe itself makes.

Sign with 2 owners and execute.

### 2.6 Prove it on a fork before anything real
```bash
anvil --fork-url $MAINNET_RPC --port 8599
FORK_RPC=http://127.0.0.1:8599 npx tsx test/fork-test.ts
```
This test runs against real mainnet contracts. It:
- deploys a 2-of-3 Safe and a Roles v2 proxy, and applies the same batch;
- runs `rebalance.ts` in dry-run and execute modes;
- checks that the role rejects each of these: output to another address, another fee tier, another token,
  more than 20 WETH in one trade, `transfer`, `approve`, delegatecall, and trades after the 24h cap is used up;
- checks that the cap refills after 24h, that a revoked agent is rejected, and that `rebalance.ts` halts
  when the module is disabled.

### 2.7 RPC endpoints
- `RPC_URL` is used for reads, quotes, and simulation. Use a paid provider or your own node, not a free public endpoint.
- `SUBMIT_RPC_URL` should be private orderflow, e.g. `https://rpc.flashbots.net/fast`. A $50k swap in the
  public mempool invites sandwiching. `amountOutMinimum` limits how much a sandwich can take;
  private submission avoids most of them.

### 2.8 Fund, then ramp
1. Send **0.1–0.2 ETH** to the agent EOA for gas. That's its entire balance, ever.
2. Move a **small test amount** into the Safe (e.g. $5k).
3. On mainnet, run `npx tsx rebalance.ts sell-weth 0.5`. This is a dry run: it prints the amount,
   the checksummed recipient (the Safe), the min-out, and the live gas cost, and signs nothing.
4. Run `npx tsx rebalance.ts sell-weth 0.5 --confirm`, read the plan, type `yes`, then check the tx on
   Etherscan: `from` = agent, `to` = Roles, and the tokens ended up in the Safe.
5. Move the rest of the treasury into the Safe. Each of those transfers is signed by a human, from wherever the funds are now.
6. Switch to unattended mode (below).

### 2.9 The VM
- Use a dedicated unix user, no password SSH, SSH only from your IP, and automatic OS security updates.
  Put nothing else on the box.
- systemd unit (sketch):
```ini
[Service]
User=rebalancer
StateDirectory=rebalancer            # /var/lib/rebalancer: lock + inflight.json
LoadCredentialEncrypted=agent_key:/etc/rebalancer/agent_key.cred
Environment=AGENT_KEY_FILE=%d/agent_key
Environment=EXECUTE=1
EnvironmentFile=/etc/rebalancer/env  # RPC_URL, SUBMIT_RPC_URL, SAFE_ADDRESS, ROLES_MODIFIER_ADDRESS, AGENT_ADDRESS
ExecStart=/usr/bin/node --import tsx /opt/rebalancer/your-signal-loop.ts
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
```
- Your signal loop calls `rebalance({ side, amountIn }, "execute")`.
  - Only one trade is in flight at a time. A lock file enforces this, along with `inflight.json`,
    which makes the next run wait until the previous tx is mined or its 10-minute deadline has passed.
  - Setting `EXECUTE=1` is the deliberate switch that means "no per-trade human approval". Per-trade
    approval is replaced by the on-chain role, not dropped.

---

## 3. Operations that always need you (2 owner signatures)

None of these can happen from the VM:

| Operation | How |
|---|---|
| Move principal out of the Safe, or into anything other than WETH/USDC | normal Safe transaction |
| Raise or lower the caps | `setAllowance` / `scopeFunction` on Roles, via Transaction Builder |
| Widen the scope (new pool, new token, new router) | edit `roles-setup.ts`, regenerate, review, sign |
| Add, rotate, or remove the agent | `assignRoles(agent, [rebalancer], [true/false])` |
| Change Safe owners or threshold | Safe settings |
| Top up the agent's gas | any wallet can send it ETH. Keep the float small |

### Kill switch: evicting the agent without its cooperation
Pick either option. Both work even if the VM is compromised and still running:
- **Revoke the role:** `Roles.assignRoles(<agent>, [rebalancer], [false])`
- **Unplug all delegated authority:** `Safe.disableModule(prevModule, $ROLES)`. `prevModule` is
  `0x0000000000000000000000000000000000000001` when Roles is the only module.

Have one ready before you need it. Sign a revoke transaction with 2 owners in advance and leave it
queued. Once signed, **anyone** can execute it, including a hot wallet on your phone. It's tied to the
Safe's nonce, though, so re-sign it after every other owner transaction.

Then rotate: generate a new agent key (2.4), `assignRoles(new,true)` + `assignRoles(old,false)` in one
batch, and replace the credential on the VM.

---

## 4. What you're on the hook for once it runs

**Things that should page you** (these aren't routine rebalancing):
- Any transaction **from the agent EOA** that doesn't match a `submitted` hash in your logs. That means
  someone else is using the key: revoke first, investigate second.
- Any Safe transaction or module/owner change you didn't initiate.
- More than 25% of either 24h cap used in an hour, or daily realized slippage against Chainlink above
  ~50 bps.
- `rebalance.ts` erroring with `not enabled`, `ConditionViolation`, `peg floor`, or `pool quote deviates`
  more than a few times in a row.
- Agent gas balance below 0.03 ETH. It halts at 0.01 ETH, and a halted rebalancer that sits unnoticed is its own risk.

Set these up with an on-chain watcher (Tenderly alerts, OpenZeppelin Monitor, or a small script against
your RPC) that pages you. **Don't** run the alerting on the same VM: if the VM is compromised, it can't
be trusted to report on itself.

**Routine things that don't page you, but you still own them:**
- **Gas float:** top it up monthly. A handful of trades a day at 150–250k gas each is cheap, but not zero.
- **Cap review:** caps tuned to today's ETH price drift as the price moves. Revisit monthly.
- **Logs:** journald JSON lines (`plan`, `submitted`, `confirmed`, `error`). Keep them off-box too.
  They're your audit trail, and tax/accounting will need every fill.
- **Dependencies:** pin `viem` and `zodiac-roles-sdk` versions. Rerun the fork test before any upgrade.
- **Owner keys:** check once a quarter that 2 of the 3 still work (firmware, PINs, seed backups).
  If you lose 2, the treasury is frozen for good.
- **Stuck transactions:**
  - If a tx isn't mined within about 8 minutes, `rebalance.ts` logs `receipt_timeout` and refuses new
    trades until the swap deadline passes.
  - After the deadline, a late inclusion can only revert, so nothing needs doing by hand. Just don't
    delete `inflight.json` while a tx is pending.
- **Things outside your control:**
  - USDC is a centrally issued token and Circle can blacklist addresses, including your Safe.
  - A de-peg halts trading (the `$0.99` floor), but the USDC already in the Safe stays exposed to it.
  - Chainlink feeds can stall. The code refuses stale prices rather than trading on them.
  - Uniswap V3 pools and the routers used here are immutable, so nothing changes under you. Roles v2 and
    Safe proxies only change if *your* Safe signs the change.
- **The agent EOA:** it never needs to sign an EIP-7702 authorization or anything besides
  `execTransactionWithRole`. If you ever see a 7702 delegation on it, treat that as compromise.

---

## 5. Files

| File | Purpose |
|---|---|
| `rebalance.ts` | turns a decision into a signed, submitted transaction: wiring checks → Chainlink → balances and cap headroom → QuoterV2 → min-out → simulate as agent → live gas pricing → gate (dry-run / `--confirm` / `EXECUTE=1`) → sign locally → private submit → receipt + balance check |
| `config.ts` | mainnet addresses, ABIs, role/allowance keys, on-chain caps. No secrets |
| `roles-setup.ts` | builds the owner-signed Safe batch that scopes the agent. Never signs anything |
| `test/fork-test.ts` | end-to-end proof on a mainnet fork, including the negative cases |
| `.gitignore` | keeps keys, credentials, and runtime state out of git |
