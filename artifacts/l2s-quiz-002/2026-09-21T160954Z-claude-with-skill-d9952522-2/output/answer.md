# PayoutVault on Polygon zkEVM: what's wrong, the Q3 plan, and the merchant money

## Short version

Your RPC providers and API keys are fine. **Polygon zkEVM has been shut down.** The Mainnet Beta sequencer stopped producing blocks around **2026-07-01**. Since then:

- no new blocks are produced,
- submitted transactions never confirm,
- AggLayer withdrawals are no longer processed,
- RPC nodes still answer reads, but only with the frozen final state.

That matches every symptom ops reported: the same balances every day, a block number that never moves, and payouts that never confirm. Switching RPC providers can't fix it because every provider is serving the same dead chain.

This changes both items on your list. Item 1 is not a dashboard bug. It is **a fund-recovery problem for about $400k of merchant money**. Item 2 can't be built on zkEVM, and Q3 ends on **2026-09-30**, nine days from now. That time should go to recovery and to choosing where payouts run next, not to batching on a chain that no longer exists.

---

## 1. The "stuck dashboard": what to check

These checks confirm the diagnosis in under an hour. None of them is about API keys.

1. **Check chain liveness yourself, independent of the dashboard.** Call `eth_blockNumber` and `eth_getBlockByNumber("latest")` against 2–3 unrelated RPC endpoints and the public zkEVM explorer. If they all return the same block height with a `timestamp` from around the start of July, the chain has stopped. It is not a provider fault.
2. **Read Polygon's official sunset notice** (Polygon blog, docs, and status page for zkEVM Mainnet Beta). Get from it the exact final block, the snapshot block, **the claims interface and any claim deadline**, and what it says about balances held in contracts. Deadlines are the part that can quietly cost you money.
3. **Check the date gap.** The sequencer stopped around July 1. Ops says the dashboard has been stuck "since the start of the month," which, if they mean September, doesn't add up. Pull the timestamp of the last block. If it is around July 1, the dashboard or ops has been showing a frozen state for roughly 11 weeks. Then:
   - **Every payout submitted after the final block did not happen**, whatever any internal status says.
   - Any merchant told "paid" in that window has not been paid.
4. **List all unconfirmed payout transactions** (hash, nonce, merchant, amount) and mark them *not settled*. Do not rebroadcast them anywhere. If you later pay these merchants on another chain, your ledger needs an explicit "voided on zkEVM, reissued on X" record so no merchant is paid twice or not at all.
5. **Look for in-flight bridge activity.** Check for L1→zkEVM deposits or zkEVM→L1 withdrawals your system started near or after the shutdown. Withdrawals are no longer processed, so anything in flight is stuck and needs the same recovery process as the vault.
6. **Fix monitoring.** A health check that only asks "did the RPC answer?" reports a dead chain as healthy. Alert on block staleness instead: page someone if `now - latest_block.timestamp` goes above a few minutes on any chain you settle on.

## 2. What this means for the merchant money

**The $400k is stuck, and the standard exit doesn't cover it.** The sunset snapshot and claims interface are built for balances **held in wallets**. Your merchant balances sit **inside PayoutVault, a contract**. A contract balance has no routine exit:

- Merchants can't claim it themselves as wallet holders.
- You can't call a withdraw or admin function on the vault, because no transaction will ever confirm again.

Do this now, in this order:

1. **Freeze and preserve the ledger of record.** Reads still work, so export the final state today: every merchant's balance in PayoutVault at the final block, the vault's token balances, the contract address, the owner/admin addresses, and the deployment details. Keep the raw RPC responses and block hashes alongside the export. This is your evidence for any claim, and it matches your internal books. Don't assume RPC providers will keep serving this chain.
2. **Identify what the $400k actually is**, token by token. This decides whether it can be recovered.
   - **Tokens bridged from Ethereum through the zkEVM bridge** (e.g. bridged USDC or ETH): the backing assets are held in the bridge contract on L1. That money still exists, and recovery is a question of getting Polygon to recognise your contract's claim on it.
   - **Tokens issued natively on zkEVM** (including any native stablecoin deployment): the issuer's policy decides what happens. Contact that issuer separately.
3. **Contact Polygon Labs directly, with the exported evidence.** Say explicitly that the balances are held in a contract. Ask:
   - whether contract-held balances are handled at all,
   - whether a controlling address (your vault's owner or admin key) can claim on the contract's behalf,
   - what the deadline is.
   Put a named owner on this and give it a deadline this week.
4. **Decide the business position toward merchants now, not after recovery finishes.** Your obligation to merchants is still $400k, whether or not the on-chain funds come back. Options include:
   - paying merchants from treasury or working capital on the new chain, and recording the zkEVM funds as a receivable,
   - paying them in part now,
   - paying them after recovery. This is the slowest option and the worst for merchant trust.
   Bring in finance and legal: this is customer money you can't currently reach. Tell merchants proactively. They already see payouts not arriving.
5. **Stop anything that still points at zkEVM**: deposit instructions, merchant onboarding, any automation that signs payouts. Nothing new should go to that chain.

There is no migration to run. You can't move the contract's state to another chain. What you can do is recover the money through Polygon's process, pay merchants from somewhere else, or both.

## 3. Q3 build plan: batch payouts and lower per-payout cost

### Reset the scope

- **Don't build on zkEVM.**
- **Q3 has 9 days left.** Realistically, Q3 covers the recovery above plus choosing the new chain. Batch payouts ship early Q4 on the new chain. If the date matters to the business, a minimal batch contract on the new chain can be written and audited quickly, but don't let that pull effort away from the $400k.
- **Check that any chain you pick is still live, and that every feature you rely on is on its mainnet, before committing.** Chains and features have both failed inside the last year. zkEVM is the example.

### Pick the chain by the constraint that actually matters

For merchant payouts, the constraints that matter are: stablecoin support, a cheap per-transfer cost, merchants being able to off-ramp, and how long an exit to L1 takes.

| If this matters most | Look at |
| --- | --- |
| Merchants cashing out to fiat, native USDC, consumer reach | **Base** (Ethereum L2, chain id 8453; now runs its own Base Stack rather than the OP Stack, which doesn't matter for a single-chain payout contract) |
| Merchants or ops holding no gas token, with fees paid in stablecoins | **Celo** (an Ethereum L2 since March 2025; gas can be paid in USDC/USDT directly through the fee-currency field, with no paymaster or bundler) |
| Treasury moving funds back to L1 without a ~7-day wait | a **ZK rollup** such as zkSync Era, Scroll or Linea (settles in minutes to hours, not days) |

Base and Celo are optimistic rollups, so a canonical withdrawal to L1 takes three steps: initiate, prove, then finalize after a window of roughly 7 days on Celo. Read the current window with viem's `getTimeToProve` / `getTimeToFinalize`. A fast bridge shortens the wait in exchange for a fee and an extra trust assumption.

Two process points after this incident:

- **Keep only working balances on any one L2.** Sweep excess funds to L1 or custody on a schedule, so that a chain shutdown never again traps the full merchant float.
- **Record a written wind-down plan for each chain.** It should list the exit route, who holds the admin keys, and what monitoring alerts you if the chain stalls.

Do not rely on remembered gas prices. **Measure them.** Deploy to the testnets of 2–3 candidate chains, run a 200-recipient batch, and read the actual gas used and fee paid. Choose based on those numbers.

### Batch payout design (up to 200 merchants per transaction)

- **`payoutBatch(batchId, recipients[], amounts[])`**, restricted to a payout role and holding stablecoins directly. Plain ERC-20 transfers, with no per-merchant accounting in storage beyond what you actually need.
- **Idempotency:** store `batchId` and revert if it is reused. After what happened with unconfirmed payouts, you need a guarantee that a resubmitted batch can't pay anyone twice.
- **Failure isolation:** one bad recipient must not revert the other 199. A USDC-blacklisted address, for example, will make its transfer revert. Wrap each transfer (low-level call or try/catch), and on failure emit an event and credit a `claimable[merchant]` balance instead of reverting the batch.
- **Gas budget:** 200 ERC-20 transfers come to single-digit millions of gas. That is well within block limits on the candidate chains, but confirm it with the testnet run. Transfers to recipients who have never held the token cost more than transfers to existing holders.
- **Events** per payout and per batch, so the dashboard and reconciliation are built from logs, not from polling balances.
- **Option for the lowest per-payout cost: Merkle claim.** One transaction posts a Merkle root covering all 200 payouts, and each merchant claims their own payout (or you or a relayer claim for them). Your cost per batch becomes nearly flat. Merchants, or a relayer you run, pay the claim gas. On Celo they can pay it in stablecoins. Use push batches for merchants who expect funds to simply arrive, and Merkle claims when the lowest operator cost matters most.
- **Security:** keep the admin and payout keys in a multisig or HSM, add a pause function and an emergency-withdraw function to a designated treasury address, and get an audit before the contract holds merchant funds. Emergency-withdraw can't help if the chain itself stops, which is why sweeping excess funds off the chain (above) matters too.

### Timeline

| When | What |
| --- | --- |
| This week | Confirm the shutdown, export the frozen ledger, contact Polygon, decide how merchants get paid in the meantime, fix staleness monitoring, notify merchants |
| By 9/30 (end of Q3) | Choose the chain from measured testnet costs; write the batch contract with tests (idempotency, partial failure, 200-recipient gas) |
| Early Q4 | Audit, mainnet deploy, pilot batches with a small set of merchants, then full cut-over; the zkEVM recovery claim runs in parallel until closed |

---

**Bottom line:** the dashboard is correctly showing a chain that stopped around July 1. The ~$400k of merchant balances is locked inside a contract on that chain, and the standard claims route doesn't cover contract-held balances. Recovering it has to go through Polygon directly, and your obligation to merchants stands regardless of how that goes. Batch payouts are a sound goal, but they belong on a new, verified-live chain, with a design that keeps only working balances on any single L2.
