# Executor transcript — 2026-08-28T002239Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a045bf-4fac-7111-ab4d-b9bf1f0279a6
--------
user
I want to build an escrow service for freelance payments. Each job holds
somewhere between $2,000 and $50,000 until the work is delivered. Which
chain should I deploy on, and why?

Write your answer to answer.md in this directory. Show the numbers you used
and the reasoning behind the recommendation.

2026-08-28T00:22:41.010862Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a045bf-4fac-7111-ab4d-b9bf1f0279a6.tmp-1787876560821378065: line 2547: syntax error near unexpected token `('

codex
I’ll compare deployment costs and security/settlement tradeoffs for an escrow contract at your stated payment sizes, then write a concise, numbers-backed recommendation in `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,120p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001
package.json
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001
 succeeded in 0ms:
web search: 
web search: L2Fees.info Arbitrum Base transaction fee current gas tracker ...
web search: 
web search: 
web search: 
web search: site:l2beat.com/scaling/projects/base Base stage 1 sequencer 7 days withdrawals ...
codex
The fee gap is real, but at this ticket size it is small relative to the value locked. I’m treating a cheap L2 as an option only if its additional bridge and rollup assumptions are acceptable—not as a substitute for the escrow’s core security requirement.
2026-08-28T00:23:51.590038Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 54, 'docs say transaction data is posted to Ethereum and invalid transitions depend' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cff493e04b424c2af29bb6d1b8bd948ea664162a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Recommendation: Ethereum mainnet, escrowed in native USDC
+
+Deploy the first version on **Ethereum mainnet** and accept the Circle-issued Ethereum USDC contract (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`). This is an escrow holding $2,000--$50,000 for a meaningful period, not a high-frequency payments product. The modest L1 fee premium buys the simplest security model: the contract, the USDC, and the final settlement are all on Ethereum. There is no rollup bridge, sequencer, challenge-period exit, or L2 upgrade/governance risk between the parties and their collateral.
+
+Use **native**, not bridged, USDC. Circle lists the Ethereum address above and labels its mainnet tokens as having real financial value; it also lists distinct native contracts for Arbitrum and Base. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+
+## The numbers
+
+Fee snapshot taken 2026-08-27 from [L2Fees](https://l2fees.info/) (a live tracker):
+
+| Network | One ERC-20 token transfer | Three-transfer conservative job budget | Budget / $2,000 job | Budget / $50,000 job |
+| --- | ---: | ---: | ---: | ---: |
+| Ethereum | $5.48 | $16.44 | 0.822% | 0.0329% |
+| Arbitrum One | $0.27 | $0.81 | 0.0405% | 0.00162% |
+| Base | not displayed in that snapshot | -- | -- | -- |
+
+The $16.44 is deliberately a conservative, easily reproducible **network-fee allowance**, not a quote for this exact contract: `3 × $5.48`. It covers an approval/funding/release-style flow. A permit-based USDC funding flow may omit the separate approval, while a dispute or refund adds a transaction. A stateful escrow call can also consume more gas than the tracker’s plain token-transfer benchmark. Charge gas separately or include a $20/job L1 network reserve; do not promise a fixed fee. Recheck estimates at signing time because gas and ETH price move continuously.
+
+The L2 saving is therefore about `$16.44 - $0.81 = $15.63` per three-operation job in this snapshot. That is material for thousands of tiny jobs, but for the stated range it is only 0.78 percentage points on the smallest job and 0.031 points on the largest. It does not justify making a $2k--$50k claim depend on an extra bridge/rollup security model by default.
+
+## Why not make a rollup the custody layer?
+
+Arbitrum One is the best L2 fallback if adoption and low fees dominate: the same tracker showed $0.27 per token transfer, it has native USDC, and L2BEAT classifies it as a Stage 1 optimistic rollup with about $18.08bn TVS in its displayed snapshot. But L2BEAT also documents upgrade paths, including a Security Council path without delay, and its risk table lists a 10-day exit window. [Arbitrum One project page](https://l2beat.com/scaling/projects/arbitrum?selectedChart=activity) [L2 risk table](https://l2beat.com/scaling/risk?highlight=fuel&tab=rollups)
+
+Base is also a reasonable low-cost distribution rail, especially if Coinbase onboarding is essential, but it is an optimistic rollup too. Its own protocol docs say transaction data is posted to Ethereum and invalid transitions depend on challenge proofs; canonical L2-to-L1 withdrawals have a protocol challenge period (documented as seven days in the withdrawal specification). [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview) [Base withdrawals](https://docs.base.org/base-chain/specs/protocol/bridging/withdrawals)
+
+That does **not** mean either L2 is unsafe or unusable. It means that their lower price is compensation for a different operational and trust model. For freelance escrow, recovery and dispute resolution are exactly when a delayed canonical exit is least attractive.
+
+## Implementation guardrails
+
+* Make the mainnet escrow small and auditable: USDC only, explicit payer/payee, deadline, release, refund, and a narrowly specified arbitrator path. Do not make it upgradeable once it holds customer funds; use a multisig with a delay for administrative controls that cannot move escrowed funds.
+* Require parties to fund the exact native-USDC address; reject token lookalikes and fee-on-transfer assets. Use USDC `permit` where supported to reduce the approval transaction and improve UX.
+* Obtain a professional security audit, monitor events, cap exposure during launch, and design an off-chain evidence/arbitration process. Chain choice cannot solve smart-contract bugs, key compromise, sanctions/freezing risk, or the legal/regulatory requirements of holding client money.
+* If usage proves fee-sensitive, offer Arbitrum escrow as a clearly labelled cheaper tier or use it for non-custodial payments; keep the $2k--$50k default on L1. Do not bridge user deposits yourself unless the bridge and its failure handling are part of the product’s audited threat model.
+
+In short: accept roughly a **$20 maximum normal-flow gas reserve** to custody high-value jobs directly on Ethereum. The L2 alternative can save roughly **$16/job** under the measured fee conditions, but that is a poor trade for the core escrow balance unless low fees and L2-native users are a deliberate product priority.
+

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cff493e04b424c2af29bb6d1b8bd948ea664162a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Recommendation: Ethereum mainnet, escrowed in native USDC
+
+Deploy the first version on **Ethereum mainnet** and accept the Circle-issued Ethereum USDC contract (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`). This is an escrow holding $2,000--$50,000 for a meaningful period, not a high-frequency payments product. The modest L1 fee premium buys the simplest security model: the contract, the USDC, and the final settlement are all on Ethereum. There is no rollup bridge, sequencer, challenge-period exit, or L2 upgrade/governance risk between the parties and their collateral.
+
+Use **native**, not bridged, USDC. Circle lists the Ethereum address above and labels its mainnet tokens as having real financial value; it also lists distinct native contracts for Arbitrum and Base. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+
+## The numbers
+
+Fee snapshot taken 2026-08-27 from [L2Fees](https://l2fees.info/) (a live tracker):
+
+| Network | One ERC-20 token transfer | Three-transfer conservative job budget | Budget / $2,000 job | Budget / $50,000 job |
+| --- | ---: | ---: | ---: | ---: |
+| Ethereum | $5.48 | $16.44 | 0.822% | 0.0329% |
+| Arbitrum One | $0.27 | $0.81 | 0.0405% | 0.00162% |
+| Base | not displayed in that snapshot | -- | -- | -- |
+
+The $16.44 is deliberately a conservative, easily reproducible **network-fee allowance**, not a quote for this exact contract: `3 × $5.48`. It covers an approval/funding/release-style flow. A permit-based USDC funding flow may omit the separate approval, while a dispute or refund adds a transaction. A stateful escrow call can also consume more gas than the tracker’s plain token-transfer benchmark. Charge gas separately or include a $20/job L1 network reserve; do not promise a fixed fee. Recheck estimates at signing time because gas and ETH price move continuously.
+
+The L2 saving is therefore about `$16.44 - $0.81 = $15.63` per three-operation job in this snapshot. That is material for thousands of tiny jobs, but for the stated range it is only 0.78 percentage points on the smallest job and 0.031 points on the largest. It does not justify making a $2k--$50k claim depend on an extra bridge/rollup security model by default.
+
+## Why not make a rollup the custody layer?
+
+Arbitrum One is the best L2 fallback if adoption and low fees dominate: the same tracker showed $0.27 per token transfer, it has native USDC, and L2BEAT classifies it as a Stage 1 optimistic rollup with about $18.08bn TVS in its displayed snapshot. But L2BEAT also documents upgrade paths, including a Security Council path without delay, and its risk table lists a 10-day exit window. [Arbitrum One project page](https://l2beat.com/scaling/projects/arbitrum?selectedChart=activity) [L2 risk table](https://l2beat.com/scaling/risk?highlight=fuel&tab=rollups)
+
+Base is also a reasonable low-cost distribution rail, especially if Coinbase onboarding is essential, but it is an optimistic rollup too. Its own protocol docs say transaction data is posted to Ethereum and invalid transitions depend on challenge proofs; canonical L2-to-L1 withdrawals have a protocol challenge period (documented as seven days in the withdrawal specification). [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview) [Base withdrawals](https://docs.base.org/base-chain/specs/protocol/bridging/withdrawals)
+
+That does **not** mean either L2 is unsafe or unusable. It means that their lower price is compensation for a different operational and trust model. For freelance escrow, recovery and dispute resolution are exactly when a delayed canonical exit is least attractive.
+
+## Implementation guardrails
+
+* Make the mainnet escrow small and auditable: USDC only, explicit payer/payee, deadline, release, refund, and a narrowly specified arbitrator path. Do not make it upgradeable once it holds customer funds; use a multisig with a delay for administrative controls that cannot move escrowed funds.
+* Require parties to fund the exact native-USDC address; reject token lookalikes and fee-on-transfer assets. Use USDC `permit` where supported to reduce the approval transaction and improve UX.
+* Obtain a professional security audit, monitor events, cap exposure during launch, and design an off-chain evidence/arbitration process. Chain choice cannot solve smart-contract bugs, key compromise, sanctions/freezing risk, or the legal/regulatory requirements of holding client money.
+* If usage proves fee-sensitive, offer Arbitrum escrow as a clearly labelled cheaper tier or use it for non-custodial payments; keep the $2k--$50k default on L1. Do not bridge user deposits yourself unless the bridge and its failure handling are part of the product’s audited threat model.
+
+In short: accept roughly a **$20 maximum normal-flow gas reserve** to custody high-value jobs directly on Ethereum. The L2 alternative can save roughly **$16/job** under the measured fee conditions, but that is a poor trade for the core escrow balance unless low fees and L2-native users are a deliberate product priority.
+

exec
/bin/bash -lc "sed -n '1,220p' answer.md && git diff --check && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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

?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cff493e04b424c2af29bb6d1b8bd948ea664162a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Recommendation: Ethereum mainnet, escrowed in native USDC
+
+Deploy the first version on **Ethereum mainnet** and accept the Circle-issued Ethereum USDC contract (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`). This is an escrow holding $2,000--$50,000 for a meaningful period, not a high-frequency payments product. The modest L1 fee premium buys the simplest security model: the contract, the USDC, and the final settlement are all on Ethereum. There is no rollup bridge, sequencer, challenge-period exit, or L2 upgrade/governance risk between the parties and their collateral.
+
+Use **native**, not bridged, USDC. Circle lists the Ethereum address above and labels its mainnet tokens as having real financial value; it also lists distinct native contracts for Arbitrum and Base. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+
+## The numbers
+
+Fee snapshot taken 2026-08-27 from [L2Fees](https://l2fees.info/) (a live tracker):
+
+| Network | One ERC-20 token transfer | Three-transfer conservative job budget | Budget / $2,000 job | Budget / $50,000 job |
+| --- | ---: | ---: | ---: | ---: |
+| Ethereum | $5.48 | $16.44 | 0.822% | 0.0329% |
+| Arbitrum One | $0.27 | $0.81 | 0.0405% | 0.00162% |
+| Base | not displayed in that snapshot | -- | -- | -- |
+
+The $16.44 is deliberately a conservative, easily reproducible **network-fee allowance**, not a quote for this exact contract: `3 × $5.48`. It covers an approval/funding/release-style flow. A permit-based USDC funding flow may omit the separate approval, while a dispute or refund adds a transaction. A stateful escrow call can also consume more gas than the tracker’s plain token-transfer benchmark. Charge gas separately or include a $20/job L1 network reserve; do not promise a fixed fee. Recheck estimates at signing time because gas and ETH price move continuously.
+
+The L2 saving is therefore about `$16.44 - $0.81 = $15.63` per three-operation job in this snapshot. That is material for thousands of tiny jobs, but for the stated range it is only 0.78 percentage points on the smallest job and 0.031 points on the largest. It does not justify making a $2k--$50k claim depend on an extra bridge/rollup security model by default.
+
+## Why not make a rollup the custody layer?
+
+Arbitrum One is the best L2 fallback if adoption and low fees dominate: the same tracker showed $0.27 per token transfer, it has native USDC, and L2BEAT classifies it as a Stage 1 optimistic rollup with about $18.08bn TVS in its displayed snapshot. But L2BEAT also documents upgrade paths, including a Security Council path without delay, and its risk table lists a 10-day exit window. [Arbitrum One project page](https://l2beat.com/scaling/projects/arbitrum?selectedChart=activity) [L2 risk table](https://l2beat.com/scaling/risk?highlight=fuel&tab=rollups)
+
+Base is also a reasonable low-cost distribution rail, especially if Coinbase onboarding is essential, but it is an optimistic rollup too. Its own protocol docs say transaction data is posted to Ethereum and invalid transitions depend on challenge proofs; canonical L2-to-L1 withdrawals have a protocol challenge period (documented as seven days in the withdrawal specification). [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview) [Base withdrawals](https://docs.base.org/base-chain/specs/protocol/bridging/withdrawals)
+
+That does **not** mean either L2 is unsafe or unusable. It means that their lower price is compensation for a different operational and trust model. For freelance escrow, recovery and dispute resolution are exactly when a delayed canonical exit is least attractive.
+
+## Implementation guardrails
+
+* Make the mainnet escrow small and auditable: USDC only, explicit payer/payee, deadline, release, refund, and a narrowly specified arbitrator path. Do not make it upgradeable once it holds customer funds; use a multisig with a delay for administrative controls that cannot move escrowed funds.
+* Require parties to fund the exact native-USDC address; reject token lookalikes and fee-on-transfer assets. Use USDC `permit` where supported to reduce the approval transaction and improve UX.
+* Obtain a professional security audit, monitor events, cap exposure during launch, and design an off-chain evidence/arbitration process. Chain choice cannot solve smart-contract bugs, key compromise, sanctions/freezing risk, or the legal/regulatory requirements of holding client money.
+* If usage proves fee-sensitive, offer Arbitrum escrow as a clearly labelled cheaper tier or use it for non-custodial payments; keep the $2k--$50k default on L1. Do not bridge user deposits yourself unless the bridge and its failure handling are part of the product’s audited threat model.
+
+In short: accept roughly a **$20 maximum normal-flow gas reserve** to custody high-value jobs directly on Ethereum. The L2 alternative can save roughly **$16/job** under the measured fee conditions, but that is a poor trade for the core escrow balance unless low fees and L2-native users are a deliberate product priority.
+

codex
Wrote the recommendation, calculations, caveats, and source links to [answer.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001/answer.md). It recommends Ethereum mainnet with native USDC for the core escrow.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cff493e04b424c2af29bb6d1b8bd948ea664162a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Recommendation: Ethereum mainnet, escrowed in native USDC
+
+Deploy the first version on **Ethereum mainnet** and accept the Circle-issued Ethereum USDC contract (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`). This is an escrow holding $2,000--$50,000 for a meaningful period, not a high-frequency payments product. The modest L1 fee premium buys the simplest security model: the contract, the USDC, and the final settlement are all on Ethereum. There is no rollup bridge, sequencer, challenge-period exit, or L2 upgrade/governance risk between the parties and their collateral.
+
+Use **native**, not bridged, USDC. Circle lists the Ethereum address above and labels its mainnet tokens as having real financial value; it also lists distinct native contracts for Arbitrum and Base. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+
+## The numbers
+
+Fee snapshot taken 2026-08-27 from [L2Fees](https://l2fees.info/) (a live tracker):
+
+| Network | One ERC-20 token transfer | Three-transfer conservative job budget | Budget / $2,000 job | Budget / $50,000 job |
+| --- | ---: | ---: | ---: | ---: |
+| Ethereum | $5.48 | $16.44 | 0.822% | 0.0329% |
+| Arbitrum One | $0.27 | $0.81 | 0.0405% | 0.00162% |
+| Base | not displayed in that snapshot | -- | -- | -- |
+
+The $16.44 is deliberately a conservative, easily reproducible **network-fee allowance**, not a quote for this exact contract: `3 × $5.48`. It covers an approval/funding/release-style flow. A permit-based USDC funding flow may omit the separate approval, while a dispute or refund adds a transaction. A stateful escrow call can also consume more gas than the tracker’s plain token-transfer benchmark. Charge gas separately or include a $20/job L1 network reserve; do not promise a fixed fee. Recheck estimates at signing time because gas and ETH price move continuously.
+
+The L2 saving is therefore about `$16.44 - $0.81 = $15.63` per three-operation job in this snapshot. That is material for thousands of tiny jobs, but for the stated range it is only 0.78 percentage points on the smallest job and 0.031 points on the largest. It does not justify making a $2k--$50k claim depend on an extra bridge/rollup security model by default.
+
+## Why not make a rollup the custody layer?
+
+Arbitrum One is the best L2 fallback if adoption and low fees dominate: the same tracker showed $0.27 per token transfer, it has native USDC, and L2BEAT classifies it as a Stage 1 optimistic rollup with about $18.08bn TVS in its displayed snapshot. But L2BEAT also documents upgrade paths, including a Security Council path without delay, and its risk table lists a 10-day exit window. [Arbitrum One project page](https://l2beat.com/scaling/projects/arbitrum?selectedChart=activity) [L2 risk table](https://l2beat.com/scaling/risk?highlight=fuel&tab=rollups)
+
+Base is also a reasonable low-cost distribution rail, especially if Coinbase onboarding is essential, but it is an optimistic rollup too. Its own protocol docs say transaction data is posted to Ethereum and invalid transitions depend on challenge proofs; canonical L2-to-L1 withdrawals have a protocol challenge period (documented as seven days in the withdrawal specification). [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview) [Base withdrawals](https://docs.base.org/base-chain/specs/protocol/bridging/withdrawals)
+
+That does **not** mean either L2 is unsafe or unusable. It means that their lower price is compensation for a different operational and trust model. For freelance escrow, recovery and dispute resolution are exactly when a delayed canonical exit is least attractive.
+
+## Implementation guardrails
+
+* Make the mainnet escrow small and auditable: USDC only, explicit payer/payee, deadline, release, refund, and a narrowly specified arbitrator path. Do not make it upgradeable once it holds customer funds; use a multisig with a delay for administrative controls that cannot move escrowed funds.
+* Require parties to fund the exact native-USDC address; reject token lookalikes and fee-on-transfer assets. Use USDC `permit` where supported to reduce the approval transaction and improve UX.
+* Obtain a professional security audit, monitor events, cap exposure during launch, and design an off-chain evidence/arbitration process. Chain choice cannot solve smart-contract bugs, key compromise, sanctions/freezing risk, or the legal/regulatory requirements of holding client money.
+* If usage proves fee-sensitive, offer Arbitrum escrow as a clearly labelled cheaper tier or use it for non-custodial payments; keep the $2k--$50k default on L1. Do not bridge user deposits yourself unless the bridge and its failure handling are part of the product’s audited threat model.
+
+In short: accept roughly a **$20 maximum normal-flow gas reserve** to custody high-value jobs directly on Ethereum. The L2 alternative can save roughly **$16/job** under the measured fee conditions, but that is a poor trade for the core escrow balance unless low fees and L2-native users are a deliberate product priority.
+

tokens used
42,650
```

## final message

Wrote the recommendation, calculations, caveats, and source links to [answer.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T002239Z-codex-no-skill-1/gas-quiz-001/answer.md). It recommends Ethereum mainnet with native USDC for the core escrow.
