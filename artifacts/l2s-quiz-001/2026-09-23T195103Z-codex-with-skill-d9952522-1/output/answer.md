# Celo CELO sweep to Ethereum mainnet treasury

## Recommended route

Use Celo's native L2-to-L1 bridge for the normal monthly close sweep. Celo is an OP Stack Ethereum L2, CELO is the native token on Celo and an ERC-20 on Ethereum, and the native withdrawal route mints/releases the canonical Ethereum CELO token to the recipient on mainnet. There is no DEX trade, slippage, or bridge liquidity limit on the native path, which matters as this grows toward a $2M sweep.

The tradeoff is time: the native withdrawal is an optimistic-rollup exit. It is not a single send. It requires:

1. Initiate withdrawal on Celo.
2. Prove withdrawal on Ethereum once the relevant Celo output/dispute game is available.
3. Finalize withdrawal on Ethereum after the proof maturity/challenge period.

As of September 23, 2026, the Celo mainnet OptimismPortal on Ethereum is `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC`, is not paused, and reports `proofMaturityDelaySeconds = 604800` seconds, or 7 days. It also reports `disputeGameFinalityDelaySeconds = 302400` seconds, or 3.5 days. The 7-day proof maturity gate is the binding one for ordinary withdrawals. Re-check these values before each close because bridge parameters can change.

The Ethereum mainnet CELO token address the custodian should display is `0x057898f3C43F129a17517B9056D23851F124b19f`.

## Monthly close timing

Plan on roughly 7 days plus a few hours from kickoff to spendable mainnet funds:

| Time | State | Operator action |
| --- | --- | --- |
| Last business day, after revenue cutoff | CELO is still in the Celo ops wallet | Confirm sweep amount, treasury address, custodian token support, Celo gas, and ETH for Ethereum gas. Initiate the withdrawal on Celo. Record the Celo tx hash. |
| Same day, usually within 2 hours | Withdrawal exists on Celo but cannot yet be proven on Ethereum | Monitor `getTimeToProve` or the bridge UI until the Celo output/dispute game covering the withdrawal is available. |
| Same day, when provable | Funds are in flight; not usable on Celo or Ethereum | Submit the prove transaction on Ethereum. Record the Ethereum prove tx hash and the withdrawal hash. The 7-day clock starts from this proof transaction, not from the Celo initiation. |
| 7 days after proof | Withdrawal is eligible to finalize | Submit the finalize transaction on Ethereum. Record the finalize tx hash. |
| After Ethereum confirmation | CELO is visible in the Ethereum mainnet treasury wallet | Reconcile the received CELO amount against the initiated amount, update the close package, and attach all three tx hashes. |

For a last-business-day kickoff, this easily lands before the following month's books close. If finance actually means "visible before this month-end close package is locked in early next month," work backward from that deadline: the prove transaction must be mined at least 7 calendar days before the required visibility date, and the initiation should happen a few hours before that.

## Operator runbook

### 1. Preflight

Confirm these before touching funds:

- Ops wallet on Celo holds the sweep amount plus enough CELO or approved fee currency for Celo gas.
- Operator or automation wallet on Ethereum holds enough ETH for the prove and finalize transactions.
- Treasury address is the correct Ethereum mainnet address, not a Celo address copied from a Celo-only custody screen.
- Custodian has enabled/displayed Ethereum mainnet CELO at `0x057898f3C43F129a17517B9056D23851F124b19f`.
- No bridge pause or incident is active. Check the Celo bridge UI/docs, Celo status channels, and the OptimismPortal `paused()` value.
- For the first production run, do a small test withdrawal to the treasury address and reconcile it end to end.

### 2. Initiate on Celo

Use Superbridge for an operator-driven UI flow, or use the viem OP Stack actions for automation. Programmatically, build the withdrawal with the Ethereum treasury address as `to`, then submit `initiateWithdrawal` from the Celo ops wallet on Celo.

The Celo transaction removes the CELO from the ops wallet and creates the L2 withdrawal message. At this point the funds are in flight. They are not yet visible or spendable on Ethereum.

Record:

- Amount of CELO.
- Celo ops wallet.
- Ethereum treasury recipient.
- Celo initiation transaction hash.
- Initiation timestamp.

### 3. Prove on Ethereum

Wait until the withdrawal is provable. Celo's withdrawal guide notes this can take up to about 2 hours; automation should use viem's `getTimeToProve` or `waitToProve` rather than a hardcoded timer.

Once ready, submit the L1 prove transaction from the Ethereum operator wallet. The prover does not have to be the treasury wallet, and it does not have to be the same key that initiated the withdrawal.

Record:

- Ethereum prove transaction hash.
- Withdrawal hash.
- Proof timestamp.
- Computed finalize-eligible time, normally proof timestamp plus 604,800 seconds.

### 4. Wait through the finalization window

During the 7-day window, monitor the withdrawal using the bridge UI or viem's `getTimeToFinalize`. If the proof is invalidated, blacklisted, or otherwise cannot finalize, escalate to engineering and treasury before retrying or re-proving.

Accounting treatment should mark the sweep as "bridge receivable/in transit" after the initiation transaction and "mainnet treasury CELO" only after finalization confirms.

### 5. Finalize on Ethereum

After `getTimeToFinalize` reports the withdrawal is ready, submit the finalize transaction on Ethereum. This executes the L1 side of the withdrawal and transfers the Ethereum CELO ERC-20 to the treasury address.

Record:

- Ethereum finalize transaction hash.
- Ethereum block/timestamp.
- Final CELO balance change in the treasury wallet.
- Any gas costs paid on Celo and Ethereum.

## Automation notes

For a recurring close process, do not rely on an operator remembering the second and third transactions. Store the withdrawal hash and tx hashes in a tracker, then alert on:

- Initiated but not proven after 3 hours.
- Proven but not finalized 7 days plus 6 hours later.
- Finalization reverted or bridge paused.
- Treasury balance does not increase by the exact withdrawn amount after finalize.

The clean automation path is viem OP Stack:

- `buildInitiateWithdrawal` and `initiateWithdrawal` for the Celo transaction.
- `getTimeToProve` / `waitToProve`, then `buildProveWithdrawal` and `proveWithdrawal` for the Ethereum proof.
- `getTimeToFinalize` / `waitToFinalize`, then `finalizeWithdrawal` for the Ethereum claim.

## If finance needs same-week

The native bridge cannot make a last-business-day kickoff land same-week in less than 7 days. There are only three practical changes:

1. Keep the native bridge, but start earlier or run rolling exits. Sweep daily or weekly during the month so the oldest withdrawals are already finalized, or initiate the month-end estimate at least 8 calendar days before the treasury visibility deadline and true-up later.
2. Maintain a mainnet CELO treasury buffer. Finance gets same-week visibility from existing mainnet inventory, while operations replenishes that buffer with the canonical 7-day bridge in the background.
3. Use a fast bridge, RFQ desk, market maker, centralized exchange, or custodian-supported transfer path. This can be same-day or same-week, but it is no longer the pure canonical exit. The provider fronts Ethereum-side CELO or routes through liquidity and later absorbs the native withdrawal delay. For a $2M CELO sweep, pre-clear the route, quote fees/slippage, transfer limits, inventory, settlement SLA, and counterparty risk before close day. Do not assume a public bridge UI has enough CELO depth for seven figures.

My recommendation: native bridge for the monthly treasury sweep; rolling native exits or a mainnet buffer if finance wants same-week without new bridge/counterparty risk; RFQ/custodian/fast bridge only when the value of faster visibility is worth explicit provider risk and fees.

## Sources checked

- Celo withdrawal guide: https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum
- Celo L1 contract addresses: https://docs.celo.org/tooling/contracts/l1-contracts
- Celo protocol overview: https://docs.celo.org/home/protocol/index
- OP Stack withdrawal and OptimismPortal specifications: https://specs.optimism.io/protocol/withdrawals.html and https://specs.optimism.io/fault-proof/stage-one/optimism-portal.html
