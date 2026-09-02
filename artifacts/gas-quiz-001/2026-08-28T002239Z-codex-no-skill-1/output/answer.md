# Recommendation: Ethereum mainnet, escrowed in native USDC

Deploy the first version on **Ethereum mainnet** and accept the Circle-issued Ethereum USDC contract (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`). This is an escrow holding $2,000--$50,000 for a meaningful period, not a high-frequency payments product. The modest L1 fee premium buys the simplest security model: the contract, the USDC, and the final settlement are all on Ethereum. There is no rollup bridge, sequencer, challenge-period exit, or L2 upgrade/governance risk between the parties and their collateral.

Use **native**, not bridged, USDC. Circle lists the Ethereum address above and labels its mainnet tokens as having real financial value; it also lists distinct native contracts for Arbitrum and Base. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## The numbers

Fee snapshot taken 2026-08-27 from [L2Fees](https://l2fees.info/) (a live tracker):

| Network | One ERC-20 token transfer | Three-transfer conservative job budget | Budget / $2,000 job | Budget / $50,000 job |
| --- | ---: | ---: | ---: | ---: |
| Ethereum | $5.48 | $16.44 | 0.822% | 0.0329% |
| Arbitrum One | $0.27 | $0.81 | 0.0405% | 0.00162% |
| Base | not displayed in that snapshot | -- | -- | -- |

The $16.44 is deliberately a conservative, easily reproducible **network-fee allowance**, not a quote for this exact contract: `3 × $5.48`. It covers an approval/funding/release-style flow. A permit-based USDC funding flow may omit the separate approval, while a dispute or refund adds a transaction. A stateful escrow call can also consume more gas than the tracker’s plain token-transfer benchmark. Charge gas separately or include a $20/job L1 network reserve; do not promise a fixed fee. Recheck estimates at signing time because gas and ETH price move continuously.

The L2 saving is therefore about `$16.44 - $0.81 = $15.63` per three-operation job in this snapshot. That is material for thousands of tiny jobs, but for the stated range it is only 0.78 percentage points on the smallest job and 0.031 points on the largest. It does not justify making a $2k--$50k claim depend on an extra bridge/rollup security model by default.

## Why not make a rollup the custody layer?

Arbitrum One is the best L2 fallback if adoption and low fees dominate: the same tracker showed $0.27 per token transfer, it has native USDC, and L2BEAT classifies it as a Stage 1 optimistic rollup with about $18.08bn TVS in its displayed snapshot. But L2BEAT also documents upgrade paths, including a Security Council path without delay, and its risk table lists a 10-day exit window. [Arbitrum One project page](https://l2beat.com/scaling/projects/arbitrum?selectedChart=activity) [L2 risk table](https://l2beat.com/scaling/risk?highlight=fuel&tab=rollups)

Base is also a reasonable low-cost distribution rail, especially if Coinbase onboarding is essential, but it is an optimistic rollup too. Its own protocol docs say transaction data is posted to Ethereum and invalid transitions depend on challenge proofs; canonical L2-to-L1 withdrawals have a protocol challenge period (documented as seven days in the withdrawal specification). [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview) [Base withdrawals](https://docs.base.org/base-chain/specs/protocol/bridging/withdrawals)

That does **not** mean either L2 is unsafe or unusable. It means that their lower price is compensation for a different operational and trust model. For freelance escrow, recovery and dispute resolution are exactly when a delayed canonical exit is least attractive.

## Implementation guardrails

* Make the mainnet escrow small and auditable: USDC only, explicit payer/payee, deadline, release, refund, and a narrowly specified arbitrator path. Do not make it upgradeable once it holds customer funds; use a multisig with a delay for administrative controls that cannot move escrowed funds.
* Require parties to fund the exact native-USDC address; reject token lookalikes and fee-on-transfer assets. Use USDC `permit` where supported to reduce the approval transaction and improve UX.
* Obtain a professional security audit, monitor events, cap exposure during launch, and design an off-chain evidence/arbitration process. Chain choice cannot solve smart-contract bugs, key compromise, sanctions/freezing risk, or the legal/regulatory requirements of holding client money.
* If usage proves fee-sensitive, offer Arbitrum escrow as a clearly labelled cheaper tier or use it for non-custodial payments; keep the $2k--$50k default on L1. Do not bridge user deposits yourself unless the bridge and its failure handling are part of the product’s audited threat model.

In short: accept roughly a **$20 maximum normal-flow gas reserve** to custody high-value jobs directly on Ethereum. The L2 alternative can save roughly **$16/job** under the measured fee conditions, but that is a poor trade for the core escrow balance unless low fees and L2-native users are a deliberate product priority.

