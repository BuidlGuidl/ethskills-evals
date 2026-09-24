# Runbook: sweeping CELO from Celo ops wallet to Ethereum mainnet treasury

## Decision

Use the Celo native bridge, exposed through Superbridge or through a scripted viem OP Stack flow, for the normal monthly close sweep. Celo is now an Ethereum L2, and CELO on Celo is the L2/native representation of CELO whose canonical L1 token exists on Ethereum. A withdrawal from Celo to Ethereum is therefore an optimistic-rollup withdrawal, not a simple same-chain transfer.

Plan on the funds being in flight for about 7 days plus 1-2 hours, plus however long the operator takes to submit the required Ethereum transactions. For close planning, reserve 8 calendar days. Once the withdrawal is initiated, the CELO is no longer available in the Celo ops wallet and will not be visible in the Ethereum treasury wallet until the finalization transaction confirms on Ethereum.

## Addresses and contracts to verify before first production run

- Source chain: Celo mainnet, chain ID `42220`.
- Source wallet: Celo ops wallet holding the monthly CELO balance.
- Destination chain: Ethereum mainnet.
- Destination wallet: Ethereum mainnet treasury wallet controlled/monitored by the custodian.
- L1 CELO token: `CeloTokenProxy` on Ethereum mainnet, `0x057898f3C43F129a17517B9056D23851F124b19f`.
- Celo native bridge portal: `OptimismPortalProxy` on Ethereum mainnet, `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC`.

Before the first real sweep, confirm with the custodian that the treasury wallet can display and account for Ethereum-mainnet CELO at the L1 token address above. Also confirm who pays the Ethereum gas for the proof and finalization transactions; the signing wallet must have enough ETH on mainnet before the run starts.

## Monthly timeline

Use `T` for the last business day of the month.

### T-3 to T-1 business days: preflight

1. Finance confirms the sweep amount. For the current balance, assume approximately `180,000 CELO`, leaving a small CELO dust balance in the ops wallet for future Celo gas if that wallet continues to operate.
2. Treasury/operator confirms the exact Ethereum treasury recipient address from an allowlist, not from a chat message or manually typed value.
3. Operator checks:
   - Ops wallet CELO balance on Celo.
   - Ops wallet has enough Celo gas.
   - Ethereum signer has enough ETH for two L1 transactions: prove and finalize.
   - Bridge UI/API is using the native Celo route, not a third-party liquidity route, unless an exception has been approved.
4. Operator records the run ID, amount, source address, destination address, bridge route, and screenshots or signed transaction previews for approval.
5. For a first run or after any wallet/bridge change, send a small test withdrawal first. Because the native path has the same 7-day challenge period even for a small test, do this well before relying on the route for close.

### T, morning UTC/business start: initiate withdrawal on Celo

1. Open Superbridge for Celo-to-Ethereum, or run the approved viem script.
2. Select:
   - From: Celo mainnet.
   - To: Ethereum mainnet.
   - Token: CELO.
   - Recipient: Ethereum treasury wallet.
   - Amount: approved monthly sweep amount.
   - Route: native bridge.
3. Review the route and warnings. Native rollup withdrawals are multi-step, cannot be canceled once started, and normally include a 7-day waiting period.
4. Submit the initiation transaction from the Celo ops wallet.
5. Record the Celo transaction hash and wait for the Celo receipt.

Status after this step: funds are in flight. They should be treated as a receivable/bridge-in-transit item, not available cash on either chain.

### T plus about 1-2 hours: prove withdrawal on Ethereum

The operator waits until the Celo output/root containing the withdrawal is published to Ethereum. Superbridge will show the withdrawal as ready to prove; in a scripted flow, use the OP Stack `waitToProve` / `getTimeToProve` equivalent.

When ready:

1. Submit the prove transaction on Ethereum mainnet.
2. Pay gas in ETH from the designated Ethereum signer.
3. Record the Ethereum prove transaction hash and receipt.
4. Record the earliest finalization time. On Celo mainnet, the fault challenge/proof maturity delay is `604800` seconds, i.e. 7 days.

Status after this step: withdrawal is proven but still locked in the challenge period. No operator action can make the native bridge settle earlier.

### T plus 7 days and 1-2 hours: finalize on Ethereum

After the 7-day challenge period has elapsed:

1. Open the bridge activity item or run the finalize step in the script.
2. Submit the finalization transaction on Ethereum mainnet.
3. Record the Ethereum finalization transaction hash and receipt.
4. Confirm the Ethereum treasury wallet received CELO.
5. Send finance/custody the final evidence packet:
   - Celo initiation transaction hash.
   - Ethereum prove transaction hash.
   - Ethereum finalization transaction hash.
   - Amount sent and amount received.
   - Source and destination addresses.
   - Token contract on Ethereum.
   - Date/time each stage completed.

Status after this step: funds have arrived in the mainnet treasury wallet.

## Expected elapsed time

Normal case:

- Celo initiation confirmation: minutes.
- Wait until proof is available on Ethereum: usually about 1-2 hours, but can be longer during bridge infrastructure outages.
- Challenge period after proof: 7 days.
- Ethereum finalization confirmation: minutes once the transaction is mined.

Operational planning number: 8 calendar days from initiation to custodian-visible funds.

If the sweep is started on a Friday morning, expect finalization around the following Friday after the proof delay and exactly 7 days of challenge-period time. If the operator does not prove promptly, the finalization time moves out by the same delay.

## Controls for larger sweeps

For a sweep growing toward `$2M`, keep the native bridge as the default route because it avoids third-party bridge liquidity and counterparty risk. Strengthen the operating controls rather than changing the mechanics:

- Use an allowlisted recipient address and require two-person review before initiation.
- Avoid unlimited approvals. For native CELO withdrawal there should generally be no standing ERC-20 approval needed from Celo; if any UI asks for an approval, stop and re-verify the route and token.
- Run the first production month as a smaller pilot or split the transfer into two tranches if internal policy requires operational risk reduction. Splitting reduces fat-finger blast radius but does not shorten bridge timing.
- Monitor bridge status daily until finalized.
- Keep an exception procedure for delayed output publication or failed Ethereum transactions; most failures are operator/gas/RPC issues, while the 7-day challenge period is by design.

## If finance needs same-week settlement

Do not promise same-week settlement through the native bridge. The canonical Celo-to-Ethereum withdrawal path intentionally waits through the optimistic-rollup challenge period, so a last-business-day kickoff will not meet a same-week requirement if "same-week" means funds visible on Ethereum inside a few business days.

For same-week needs, change the treasury process, not just the button being clicked:

1. Pre-fund mainnet treasury liquidity.
   - Keep a target CELO buffer in the Ethereum treasury wallet or with the custodian.
   - On close day, finance recognizes the mainnet buffer as available immediately.
   - Replenish the buffer using the native bridge in the background over the normal 8-day cycle.
   - This is the cleanest approach for recurring close deadlines and large sizes.

2. Use an approved liquidity/fast-withdrawal bridge only as an exception.
   - Superbridge and other Celo bridge providers may expose fast routes through third-party protocols such as Hyperlane, Wormhole, LayerZero, CCIP, Relay, or other liquidity providers.
   - These routes can settle in minutes or hours when liquidity exists, but they introduce route-specific smart-contract, liquidity, relayer, pricing, limit, and compliance risk.
   - For `$2M`, quote the route before close, check max size, fees, slippage, recipient token contract, sanctions/compliance posture, and whether the custodian recognizes the received asset as canonical Ethereum CELO.

3. Use an exchange/OTC/custodian conversion path if custody policy prefers intermediated settlement.
   - Send CELO from Celo to a venue that supports Celo deposits and Ethereum-mainnet CELO withdrawals, or execute OTC against an Ethereum CELO delivery.
   - This can meet same-week timing but replaces bridge risk with venue, settlement, KYC/AML, and withdrawal-limit risk.

Recommended policy: native bridge for the ordinary monthly sweep; pre-funded mainnet buffer for same-week finance deadlines; third-party fast routes or exchange/OTC only under a written exception approved by treasury, finance, security, and compliance.

## Sources checked

- Celo docs, "Withdrawing CELO to Ethereum": https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum
- Celo docs, "Bridging to and from Celo": https://docs.celo.org/home/bridged-tokens/bridges
- Celo docs, "L1 Contracts": https://docs.celo.org/tooling/contracts/l1-contracts
- Celo docs, "CELO Token Duality": https://docs.celo.org/home/protocol/celo-token
- Superbridge help, "Why do I have to make multiple transactions to bridge to the Settlement Chain": https://help.superbridge.app/en/articles/9748435-why-do-i-have-to-make-multiple-transactions-to-bridge-to-the-settlement-chain
- Superbridge help, "How to bridge off a Rollup to the Settlement Chain": https://help.superbridge.app/en/articles/9748050-how-to-bridge-off-a-rollup-to-the-settlement-chain-withdraw
- Superbridge docs, Celo supported chain detail: https://docs.superbridge.app/overview/supported-chains/celo
