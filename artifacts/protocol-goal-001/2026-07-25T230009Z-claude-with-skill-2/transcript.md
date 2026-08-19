Written to `brief.md`. Here's what the research turned up, including a few things that materially change the planning picture:

## The headline finding

**The relief is real, scheduled, and it's a gas repricing — not statelessness.** EIP-8037 (State Creation Gas Cost Increase) and EIP-8038 (State-access gas cost update) were **ratified SFI on 23 July 2026** — two days ago, at ACDC #183. New storage slot goes from 20,000 → 97,920 gas (~4.9x); new account 25,000 → 183,600 (~7.3x); `STORAGE_WRITE` +257%.

EIP-8037's motivation section gave me hard numbers your capacity model needs: Geth state DB ~390 GiB (Jan 2026), ~326 MiB/day new state at the current 60M limit (~116 GiB/yr), and a stated **650 GiB threshold where nodes start degrading**. I confirmed the 60M gas limit live against mainnet.

## Three corrections worth flagging

**Statelessness is not in your window — and the evidence is unambiguous.** I swept all 591 EIP records in Forkcast's dataset: binary tree (EIP-7864), Verkle (all `Stagnant`), leaf-level state expiry, stateless witnesses — **not one has a fork relationship of any kind.** Not scheduled, not considered, not proposed. The `state-expiry` R&D Discord channel was archived in May 2026 after 18 months of silence, and there's no state-tree working group among ACD's ~15 standing breakout calls.

**History expiry shipped — and you may be leaving money on the table.** EIP-4444 reads `Stagnant`, which is misleading: history expiry moved out of the fork process into client releases. Every major client supports it, and the `ere` cold-archive format spec merged in May 2026. This is available today, needs no core-dev action, and is likely your largest near-term saving.

**The repricing won't lower your bill — and I'd correct the finance model on this.** Its explicit purpose is making *higher* gas limits safe (EIP-8038 targets 100 Mgas/s vs ~20 today). Realistic outcome: growth holds near ~120 GiB/yr while throughput rises 2.5x. The saving is the avoided acceleration toward ~387 GiB/yr, not a reduction.

## Timing

Devnet-7 live and stable since 14 July; devnet-8 early August; first public testnet targeted September; **no mainnet date announced**. Fusaka ran 9 weeks from first testnet to mainnet, which would imply Nov–Dec 2026 — but Glamsterdam is far larger (ePBS across 23 EIPs, described by the EF as "trickier than anticipated"), SSZ containers are running 10–20% slow pending optimization, and the repricing parameters aren't frozen. **Base case Q1 2027 (~45%)**, with Q4 2026 as upside.

Two Glamsterdam items hit your product surface directly: EIP-7708 eliminates your tracing dependency for ETH transfer detection (real opportunity), and EIP-8159 states archive nodes may need to store BALs indefinitely (new, unsized cost). Devnet-7 is public with a faucet right now — worth measuring both before parameters freeze.

Every status, parameter, and date came from primary sources; web search was orientation only. Appendix C has re-verification commands, since Hegotá scope firms up after the 6 August deadline.
