# Base vault early-withdrawal fee incident plan

## Decision

**A 100-USDC minimum in the web UI does not resolve the incident.** It only
reduces accidental exposure for users of that exact frontend version. The vault
is a public Base contract: anyone can call its withdrawal method directly, use
an older/cached/IPFS frontend, script a transaction, or integrate it elsewhere.
It also does not correct fees already collected. Ship the UI guard today as a
temporary harm-reduction measure, but treat the incorrect on-chain arithmetic
as the incident and replace or upgrade the contract this week.

The UI guard must not imply that withdrawals of 100 USDC or more are generally
safe until the fee formula has been independently checked across all amounts,
lock states, and token-decimal conversions.

## What ships today (containment and user protection)

1. Declare an incident owner and open an incident timeline. Capture the vault
   address, implementation address (if any), deployment block, the intended
   fee formula/rate, the actual formula, and the precise withdrawal range and
   conditions that overcharge.
2. Confirm the bug against the verified Base source and a small set of
   `eth_call`/fork simulations. Have a second engineer independently reproduce
   the decimal calculation. Do not send production test withdrawals merely to
   validate it.
3. Determine whether the vault is upgradeable and whether an authorized,
   time-delayed upgrade path exists. If there is a safe pause switch that
   governs withdrawal (or early withdrawal), have the authorized multisig use
   it according to the documented procedure; publish the resulting transaction
   link. If there is no pause capability, say so plainly—frontend changes
   cannot stop direct contract calls.
4. Release a frontend containment update immediately:
   - block and disable early-withdraw inputs below 100 USDC, with a clear
     message that this is a temporary protection for a known fee-calculation
     issue;
   - validate the same rule immediately before transaction submission;
   - show the **contract-derived estimated fee and net amount**, prominently
     labeled as an estimate, and do not silently round it;
   - link to the incident notice and advise affected users not to use other
     interfaces or direct calls for early withdrawals;
   - use Scaffold-ETH contract hooks and `parseUnits(amount, 6)` for USDC;
     do not edit generated `deployedContracts.ts`.
5. Deploy the frontend update, purge/invalidate the primary-host CDN where
   applicable, and verify the public URL on Base with a real wallet in a
   non-broadcast/simulation path. Because old deployments and alternate UIs
   remain usable, label it explicitly as a mitigation, not a fix.
6. Publish a concise status notice in-app and on official channels: impact,
   affected operation/range, contract address, recommended action, the fact
   that funds are otherwise safe, and the next update time. Avoid claiming a
   loss amount until reconciled.
7. Snapshot affected activity from the deployment block through containment:
   identify every early withdrawal, recompute intended versus charged fees
   using integer USDC units, retain transaction hashes and inputs, and prepare
   a reviewable refund ledger. Preserve evidence and monitoring alerts for any
   direct calls below the threshold.

## What ships this week (permanent remediation)

1. Implement the corrected fee calculation in Foundry using explicit unit
   conventions. Keep values in base units end-to-end; encode the fee denominator
   and any USDC `6`-decimal conversion once, with named constants. Add the
   regression case for withdrawals below 100 USDC that demonstrates the former
   approximately-10x overcharge.
2. Add boundary, fuzz, and invariant tests: 0/minimum/99.999999/100 USDC,
   normal and maximum amounts, each early-withdrawal time boundary, rounding
   direction, fee caps, and `fee + payout == withdrawal amount`. Fork Base at a
   recent block and exercise real USDC behavior and all vault states. Require
   code review plus an independent calculation review before deployment.
3. Choose the contract path based on the architecture:
   - **Upgradeable proxy with a safe, authorized upgrade process:** deploy the
     new implementation, verify it, simulate the upgrade and withdrawals on a
     Base fork, execute via the required multisig/timelock, then verify the
     proxy points to the intended implementation and storage/invariants hold.
   - **Immutable vault (or unsafe upgrade path):** deploy and verify a new
     fixed vault. Build a migration that lets users withdraw/claim their old
     position and deposit into the new vault with the fewest transactions
     possible. Do not ask users for blanket token approvals; request exact or
     bounded approvals only. If feasible, use a purpose-built migration helper
     only after its own review and tests.
4. Before production, run the full upgrade/migration rehearsal on a Base fork
   from current live state, including representative staker balances, rewards,
   early-withdraw cases, pause/unpause, and recovery/rollback behavior. Confirm
   owner roles, multisig signers, timelock delays, explorer verification, and
   monitoring.
5. Deploy through the authorized multisig process; verify contracts immediately
   on BaseScan. Update the frontend only after the production address or proxy
   implementation is confirmed. For an immutable replacement, retain a clearly
   labeled legacy page until all positions can be exited/migrated.
6. Remove the temporary 100-USDC restriction only after production tests show
   correct fees for sub-100-USDC withdrawals and the incident owner signs off.
   Keep fee/net previews and add a contract-level minimum only if it is a
   deliberate product rule, not a substitute for arithmetic correctness.
7. Complete restitution: have two people reconcile the ledger, publish the
   eligibility and calculation methodology, distribute the overcharge delta
   from the treasury (or provide an on-chain claim), and retain an auditable
   record. Obtain legal/compliance and communications review if required by the
   organization.
8. Close only after monitoring shows corrected behavior, the remediation and
   refunds are reconciled, the postmortem is published internally, and controls
   are added: decimal/unit code-review checklist, regression tests, simulation
   tests, and alerts for anomalous effective fee rates.

## Concrete order of operations

1. Triage and independently reproduce; calculate affected scope.
2. Pause the affected path if the existing contract permits it safely.
3. Publish the incident notice and ship the frontend guard/fee preview.
4. Inventory and monitor direct calls; build the provisional refund ledger.
5. Write and test the corrected contract on a Base fork.
6. Decide and rehearse proxy upgrade versus immutable-vault migration.
7. Execute the authorized production upgrade/deployment, verify, and perform
   small controlled post-deployment checks.
8. Point the UI to the remediated contract, remove temporary restrictions only
   after validation, and complete refunds and the postmortem.

## Success criteria

No user can be overcharged by the corrected production path; direct calls are
either prevented by an on-chain pause or execute the fixed code; affected users
are identified and made whole; and the public communication never represents a
client-side guard as an on-chain fix.
