# Vault early-withdrawal fee bug — fix plan

**Bug:** early-withdrawal fee computed at the wrong decimals scale. Withdrawals under 100 USDC are overcharged ~10x. Contract is live and verified on Base mainnet, ~$40k TVL, deployed ~3 weeks ago.

## The headline answer: the UI minimum does not resolve the incident

Ship it today if it buys us time — it is a fine stopgap. But it is not the fix, and we should not tell anyone it is.

The vault is a public API. A minimum enforced in our withdrawal form binds only people using our frontend:

- Direct `withdraw()` calls from a wallet, a script, or Etherscan's own **Write Contract** tab on our *verified* source still hit the bad math.
- Integrators, aggregators, and any alternate frontend hit it too.
- A cached copy of our own frontend that a user still has loaded hits it.
- Worse, a 100 USDC minimum blocks small stakers from getting *any* of their money out early. We'd be converting an overcharge bug into a withdrawal restriction on exactly the users the bug hurts most — from a user's view that is a worse incident, not a resolved one.

The overcharged fees that have already been taken are also still overcharged. A UI guard is forward-looking only; it does nothing about the money already collected.

Deployed bytecode cannot be edited. A live contract bug goes back to the start of the loop: reproduce, correct the source, add the regression test, redeploy or upgrade in place, repoint the frontend, then handle the users and state already there.

## What we ship today

1. **Reproduce the bug in a test against a fork of Base.** `yarn fork --network base` (note the exact token form — `yarn fork base` and `yarn fork --network=base` silently fork Ethereum mainnet instead). This gives us the real USDC at the real address, so we are testing the actual 6-decimals behavior rather than a mock. Confirm the fork is really Base by checking for code at Base's USDC address — the fork answers chain id 31337 no matter what it forked.
2. **Write the failing regression test first.** Withdraw 10 USDC, 50 USDC, 99.99 USDC, and assert the exact expected fee. It must fail against current source before we touch anything.
3. **Correct the decimals scaling in the vault source.** Make the test pass. Keep the diff to the fee math — no opportunistic changes in an incident fix.
4. **Frontend stopgap — with honest framing.** Not a hard 100 USDC minimum. Show a clear banner on the withdrawal form: known fee bug on early withdrawals under 100 USDC, overcharge will be refunded, fix landing this week. Optionally add a confirm-step warning on sub-100 withdrawals. Users who need their money out can still get it, and they know what they are being charged.
5. **Public comms in the same breath** — Discord/X/status page, same message as the banner. Users are already noticing; silence is the thing that turns an overcharge into a trust problem.
6. **Pull the overcharge ledger.** Index `Withdraw`/fee events since deploy, compute actual-fee vs intended-fee per address. We need this number today to size the refund and to state it publicly.

## What we ship this week

7. **Decide the deploy path — this determines everything after it.** Check whether the vault sits behind a proxy.
   - **If it is upgradeable:** upgrade in place. The address does not move, stakes stay put, approvals stay valid, no migration. This is by far the better outcome and the PM's real concern (heavy migration) evaporates.
   - **If it is not:** a fresh deploy plus migration is the only correct path. There is no version of this where we keep the broken bytecode as the live vault.
8. **Full test suite green,** including the new regression test, plus a dry run of the deploy/upgrade script against the Base fork. Go/no-go: tests pass, script runs clean on the fork, deployer funded. `yarn account` prints the deployer address and its balance per chain; it needs real ETH on Base *before* the deploy, not after one fails.
9. **Deploy/upgrade to Base, and verify in the same breath.** `yarn deploy --network base` then `yarn verify --network base`, back to back — not on a later checklist. Until verify runs, users and integrators are staring at opaque bytecode during an active incident. Run verify from the same checkout that did the deploy; it replays `broadcast/run-latest.json`. No explorer API key task here — `packages/foundry/.env.example` already ships a working `ETHERSCAN_API_KEY` and postinstall copies it.
10. **Repoint the frontend** at the new deployed addresses and confirm `scaffold.config.ts` `targetNetworks` is on Base, in the same step. If we were doing fork work it would have been on `chains.foundry`; a frontend built pointing at the wrong chain reads a chain nobody is on. Nothing sensitive in `scaffold.config.ts` — it is committed, so any RPC key goes through `process.env` and lives in `.env.local`.
11. **Walk the entire journey against the live contracts with a real wallet and our own money** before the public frontend goes out: approve, stake, early-withdraw a small amount, confirm the fee charged matches intended to the cent. Go/no-go: every step worked.
12. **Ship the frontend, then load the public URL ourselves and put one real transaction through it.** Remove the stopgap banner only after this passes.
13. **If migration was required:** publish the migration path, support both vaults read-only for a defined window, and help stakers move. Old vault: disable new deposits if we can; otherwise make the deprecation loud in the UI and in comms.
14. **Refund the overcharges** from the ledger in step 6. Direct transfers to affected addresses is simplest at $40k TVL and this many users. Publish the list and the total.

## Order dependencies worth calling out

- Step 7 (proxy or not) gates 9–13. Settle it first thing this week; if it is a proxy the whole "heavy migration" objection goes away and there is no reason to delay.
- Step 6 (ledger) must run *before* the new contract goes live, while the event history is unambiguous about which vault produced which fee.
- Steps 2 and 3 in that order. A fix without a test that failed first is a fix we are guessing at.

## On the PM's framing

"Avoid a redeploy" is the right instinct about cost and the wrong conclusion about scope. The redeploy (or upgrade) is not optional — the broken math is on a public function that anyone can call. What *is* negotiable is the migration weight, and that is decided by the proxy question in step 7, not by the frontend. Ship the banner today; ship the corrected contract this week.
