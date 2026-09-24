# Celo CELO Sweep To Ethereum Mainnet Treasury

As of 2026-09-23, Celo mainnet is an OP Stack Ethereum L2. CELO on Celo is the L2 native token, and CELO on Ethereum mainnet is an ERC-20 token. The default treasury sweep should use Celo's native bridge, exposed in the UI by Superbridge, rather than a third-party fast bridge. This avoids relayer inventory and slippage risk as the sweep grows from the current 180,000 CELO to roughly $2M.

The important operational point: a Celo-to-Ethereum withdrawal is not one transaction. It is a three-transaction optimistic-rollup exit:

1. Initiate the withdrawal on Celo.
2. Prove the withdrawal on Ethereum mainnet after the Celo output/root is available.
3. Finalize the withdrawal on Ethereum mainnet after the seven-day challenge/maturity period.

The money leaves the Celo ops wallet at initiation, but it does not appear in the Ethereum treasury wallet until finalization. Budget about 7 days plus 2 hours, plus Ethereum transaction confirmation time. Use 8 calendar days as the runbook SLA.

## Route

Use one of these two implementations:

- Standard operator UI: https://superbridge.app/celo
- Scripted implementation: viem OP Stack actions `initiateWithdrawal`, `proveWithdrawal`, and `finalizeWithdrawal`

Transfer details:

- Source chain: Celo Mainnet, chain ID `42220`
- Source asset: native CELO on Celo
- Destination chain: Ethereum Mainnet
- Destination asset: ERC-20 CELO on Ethereum
- Ethereum CELO token contract: `0x057898f3C43F129a17517B9056D23851F124b19f`
- Celo OptimismPortal on Ethereum: `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC`
- Recipient: the Ethereum mainnet treasury wallet controlled by the custodian

Do not send CELO directly from the Celo wallet to the treasury address as a normal transfer. That only moves funds on Celo. The custodian will not see those funds on Ethereum mainnet.

## Pre-Close Setup

Before the first production sweep:

1. Confirm the custodian can display and account for ERC-20 CELO on Ethereum mainnet at the treasury address.
2. Confirm the treasury address is the intended recipient. The treasury wallet does not need to sign the bridge transaction, but the operator must enter it correctly.
3. Confirm the Celo ops wallet has the CELO amount to sweep plus Celo gas.
4. Confirm the operator has ETH on Ethereum mainnet to pay for the prove and finalize transactions.
5. Run a small test withdrawal, for example 1 CELO, through the full initiate, prove, and finalize lifecycle.
6. Store the test transaction hashes and final receipt in the treasury controls folder.

For each monthly sweep, finance should provide:

- Sweep amount
- Revenue cutoff timestamp
- Destination treasury address
- Internal approval ticket
- Maximum acceptable bridge fee and Ethereum gas budget

## Monthly Runbook

### 1. Initiate On Celo

When: last business day, after the revenue cutoff and approvals are complete.

Operator actions:

1. Open Superbridge Celo or run the approved viem script.
2. Select Celo to Ethereum.
3. Select CELO.
4. Enter the approved sweep amount.
5. Set the recipient to the Ethereum mainnet treasury address.
6. Review the route. It should be the OP Stack native bridge, not a fast bridge or swap route.
7. Sign the initiation transaction from the Celo ops wallet.
8. Record the Celo transaction hash, amount, recipient, and timestamp.

Result:

- The CELO is debited from the Celo ops wallet.
- The withdrawal message is created on Celo.
- Funds are now in flight and cannot be used from the ops wallet.

Timing:

- Celo confirmation is normally fast.
- The proof is not immediately available. The Celo guide warns this step can take up to about 2 hours.

### 2. Wait Until The Withdrawal Can Be Proven

When: after initiation, usually within about 2 hours.

Operator actions:

1. Monitor Superbridge, or use `getTimeToProve` if using viem.
2. Set an alert for the earliest prove time.
3. If the proof is not available after 3 hours, check Celo and Superbridge status before retrying.

Result:

- No new funds move during this wait.
- If the operator forgets this step, the withdrawal is not lost, but the seven-day finalization clock has not started yet.

### 3. Prove On Ethereum Mainnet

When: as soon as the bridge reports the withdrawal is provable.

Operator actions:

1. Switch to Ethereum mainnet.
2. Submit the prove transaction.
3. Pay Ethereum gas from the operator wallet.
4. Record the Ethereum prove transaction hash and block timestamp.
5. Schedule finalization for seven days after the prove transaction is confirmed.

Result:

- Ethereum has accepted the proof that the Celo withdrawal exists.
- The challenge/maturity period starts from the prove transaction, not from the initial Celo transaction.

Timing:

- Ethereum confirmation depends on gas conditions.
- Celo's current `proofMaturityDelaySeconds` is 604,800 seconds, which is 7 days.

### 4. Wait Through The Challenge/Maturity Period

When: from Ethereum proof confirmation until the bridge reports the withdrawal is finalizable.

Operator actions:

1. Monitor the pending withdrawal daily.
2. Use Superbridge status or viem `getTimeToFinalize`.
3. Keep the prove transaction hash in the close checklist.
4. If there is a bridge pause, dispute, or status anomaly, escalate to engineering and treasury before taking any alternate route.

Result:

- Funds remain in flight.
- The treasury wallet still will not show the ERC-20 CELO.

Timing:

- Plan for 7 full days after proof.
- With the prove availability delay, the practical total is about 7 days plus 2 hours from initiation, assuming Ethereum transactions are submitted promptly.

### 5. Finalize On Ethereum Mainnet

When: immediately after the withdrawal becomes finalizable.

Operator actions:

1. Open the pending withdrawal in Superbridge or run the approved finalize script.
2. Submit the finalize transaction on Ethereum mainnet.
3. Pay Ethereum gas from the operator wallet.
4. Wait for Ethereum confirmation.
5. Verify ERC-20 CELO arrived at the treasury address.
6. Record the finalization transaction hash and ending treasury balance.
7. Send finance the close packet: initiation hash, proof hash, finalization hash, amount, recipient, and timestamps.

Result:

- The Ethereum bridge releases ERC-20 CELO to the treasury wallet.
- The custodian should now see the funds on Ethereum mainnet.

## Expected In-Flight Time

For monthly close planning:

- Initiation on Celo: minutes.
- Wait until proof is available: up to about 2 hours.
- Prove transaction on Ethereum: minutes, depending on gas.
- Challenge/maturity period after proof: 7 days.
- Finalize transaction on Ethereum: minutes, depending on gas.

Operational SLA: 8 calendar days from initiation to treasury visibility.

If the sweep is initiated on the last business day of the month, it should be visible in the mainnet treasury during the first third of the following month, assuming the operator proves promptly and finalizes promptly. The main reason this slips is operator delay between initiation and proof, because the seven-day clock starts at proof.

## Controls For A $2M Sweep

Use the native bridge for the standard flow. It is slower, but it is not dependent on a fast bridge having enough CELO inventory for a seven-figure fill.

Add these controls before the sweep reaches $2M:

1. Two-person approval for amount, destination address, and route.
2. Address allowlist for the Ethereum treasury recipient.
3. A small monthly canary withdrawal, or reuse the prior month finalization as the canary if the process has been stable.
4. Gas budget pre-funded in ETH on Ethereum before close day.
5. Calendar alerts for prove and finalize, owned by a named operator and backup operator.
6. Daily status check while funds are in flight.
7. Reconciliation against both explorers: Celo initiation, Ethereum prove, Ethereum finalization, and final ERC-20 CELO balance.

Do not split the production amount merely for bridge liquidity; the native bridge does not need relayer liquidity. Split only if treasury policy wants reduced single-transaction operational risk. If splitting, initiate the tranches at the same time so they share the same proof/finalization window.

## If Finance Needs Same-Week

The native bridge cannot satisfy a same-week settlement requirement after the sweep is initiated. The seven-day wait is part of the optimistic-rollup withdrawal security model.

If finance needs same-week visibility, change the treasury design, not just the operating calendar:

1. Preferred: pre-fund a mainnet CELO treasury buffer.
   - Keep at least one expected monthly sweep, plus a volatility and growth buffer, already on Ethereum mainnet.
   - Finance books against the mainnet buffer during close.
   - The Celo native withdrawal replenishes the buffer 7-8 days later.
   - This preserves the native bridge trust model and avoids urgent liquidity hunting.

2. Alternative: use an approved fast bridge, OTC desk, exchange, or custodian route.
   - This can settle same-day or same-week, but it adds counterparty, relayer, smart-contract, liquidity, slippage, and compliance risk.
   - Before approving it for $2M, test the exact route, asset, recipient type, limits, fees, failure handling, and whether the treasury receives canonical Ethereum ERC-20 CELO or a wrapped/synthetic asset.
   - Get written treasury and compliance approval for the route.

3. If the real finance requirement is USD value rather than CELO custody, consider whether policy should convert CELO to a stablecoin on Celo or through an exchange before moving funds. That is a treasury policy decision, not a bridge operation detail.

For a same-week close, I would run the native bridge continuously as the system of record replenishment path and keep a mainnet buffer sized to the next close. I would not rely on a just-in-time fast bridge for an untested $2M CELO sweep.

## Sources

- Celo native bridge docs: https://docs.celo.org/operate/specification/native-bridge
- Celo withdrawal guide: https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum.md
- Celo L1 contract addresses: https://docs.celo.org/tooling/contracts/l1-contracts.md
- Celo bridge options and Superbridge link: https://docs.celo.org/home/bridged-tokens/bridges.md
- Superbridge native withdrawal step explanation: https://help.superbridge.app/en/articles/9748435-why-do-i-have-to-make-multiple-transactions-to-bridge-to-the-settlement-chain
