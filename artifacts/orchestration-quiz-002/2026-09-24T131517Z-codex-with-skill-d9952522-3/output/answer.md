# Fix plan for the Base mainnet staking vault fee bug

## Bottom line

Ship the `100 USDC` frontend minimum today as an emergency mitigation, but do not call the incident resolved. It only protects users who withdraw through our current frontend after the change is live. The vault contract is still public Base mainnet bytecode: users, scripts, block explorer calls, bots, integrators, older cached frontends, or any alternate UI can still call the withdrawal function directly and hit the bad fee calculation.

The incident is resolved only when the contract path that computes the fee is corrected or disabled, affected users are handled, and the public frontend points at the fixed path.

## What we ship today

1. Add a frontend withdrawal minimum of `100 USDC`.
   - Block form submission for amounts below `100 USDC`.
   - Use token decimals explicitly: `100_000000` for USDC, not `100e18`.
   - Show a concise inline validation message: withdrawals below `100 USDC` are temporarily unavailable while a fee issue is being fixed.
   - Hide or disable any quick-withdraw controls that can generate an amount below `100 USDC`.

2. Add a same-day operational guard.
   - If the vault has a pause, withdrawal disable flag, fee admin switch, or allowlisted emergency control, use it only if it is safer than the UI clamp and after checking its exact effect on deposits, rewards, and withdrawals.
   - If there is no contract-level mitigation, document that clearly in the incident notes.

3. Notify users immediately.
   - Put a status-page or banner note on the app.
   - Say plainly that withdrawals under `100 USDC` are temporarily blocked in the UI because of an early-withdrawal fee bug.
   - Do not imply funds are at risk.
   - Tell users not to withdraw below `100 USDC` directly from the contract until the fixed vault path is live.

4. Start impact accounting.
   - Query Base mainnet logs for early withdrawals since launch.
   - Identify withdrawals under `100 USDC`.
   - Compute intended fee versus actual charged fee using the corrected formula.
   - Produce a refund list with wallet, tx hash, token, actual fee, intended fee, and overcharge.

## What we ship this week

1. A real contract fix.
   - If the vault is upgradeable, prepare and execute a proxy implementation upgrade with the corrected fee scale.
   - If it is not upgradeable, deploy a new fixed vault and migrate users with the least disruptive supported path.
   - If migration requires user action and new approvals, make that explicit; heavy migration cost is real, but it does not make the frontend clamp a protocol fix.

2. Regression coverage.
   - Add tests for USDC 6-decimal accounting.
   - Add boundary tests for withdrawals below, at, and above `100 USDC`.
   - Include representative cases like `1 USDC`, `10 USDC`, `99.99 USDC`, `100 USDC`, and a larger amount.
   - Assert both fee amount and final user receive amount.

3. A rehearsed Base fork run.
   - Fork Base mainnet with the current deployed vault and USDC state.
   - Reproduce the overcharge on the fork.
   - Run the fixed implementation or new vault path on the fork.
   - Walk the full deposit, stake, early-withdraw, normal-withdraw, rewards, and migration path with realistic balances.

4. Public frontend repoint.
   - Update deployed contract addresses or ABI references only after the fixed contract path exists.
   - Keep `targetNetworks` on Base mainnet for the public build.
   - Test the public frontend against the live fixed path with a small real transaction before announcing resolution.

5. User remediation.
   - Refund confirmed overcharges.
   - Publish the final impact window, affected count, total overcharge, refund txs, and fixed contract address.
   - Keep the temporary `100 USDC` UI block until the fixed path is live and verified.

## Concrete order of operations

1. Freeze the risky path in the product surface.
   - Patch the frontend withdrawal form to reject `< 100 USDC`.
   - Patch all secondary withdrawal entry points.
   - Deploy the frontend today.
   - Verify the public URL blocks `< 100 USDC` and still allows `>= 100 USDC`.

2. Communicate before users discover inconsistent behavior.
   - Publish an incident note.
   - Tell support exactly what happened: the early-withdrawal fee is scaled incorrectly for small USDC withdrawals, causing roughly `10x` intended fee under `100 USDC`.
   - Tell users that using the contract directly can bypass the UI protection.

3. Reproduce the bug locally on a Base fork.
   - Use the live vault address and live USDC decimals.
   - Execute an early withdrawal below `100 USDC`.
   - Confirm the actual charged fee matches the reported overcharge.
   - Save the failing test before changing the contract.

4. Fix the source.
   - Correct the fee calculation to use the token's decimal scale consistently.
   - Avoid assuming `18` decimals anywhere in the USDC path.
   - Add regression tests around the exact bug and boundary values.

5. Choose the deployment path.
   - If upgradeable: review storage layout, simulate upgrade on the fork, then upgrade the proxy on Base.
   - If immutable: deploy a fixed vault, verify it, and prepare migration instructions or migration tooling.
   - If the old vault can be paused or deprecated after migration starts, do that at the right point to prevent new deposits into the bad path.

6. Verify and rehearse.
   - Run contract tests.
   - Run deployment or upgrade scripts against the Base fork.
   - Run the frontend locally against the fork.
   - Complete the full user journey with realistic USDC amounts.

7. Execute on Base mainnet.
   - Deploy or upgrade.
   - Verify the contract immediately.
   - Repoint the frontend if the address changed.
   - Deploy the frontend.
   - Submit a small real transaction through the public UI.

8. Remediate users.
   - Finalize the overcharge list from Base logs.
   - Send refunds or create a claim path.
   - Publish transaction hashes.
   - Remove the temporary `100 USDC` block only after the fixed path is confirmed live and no longer needed.

## Incident status language

Use this framing internally and externally:

- Today's UI minimum mitigates accidental overcharges through our frontend.
- It does not resolve the contract incident.
- Resolution requires corrected contract behavior, verified deployment or upgrade, frontend repoint if needed, and remediation for users already overcharged.
