# Runbook draft: monthly CELO sweep, Celo → Ethereum mainnet treasury

## 0. What you're actually doing

Celo has been an **Ethereum L2 on the OP Stack since 2025-03-26**. It is no longer a separate L1. So the right way to move funds to mainnet is **Celo's own L2→L1 withdrawal**, not a third-party wrapped-asset bridge. CELO is the native gas token on Celo. On Ethereum it's a plain **ERC-20**. When the withdrawal finishes, the treasury wallet receives ERC-20 CELO on mainnet, the same asset and not a wrapped IOU.

It's an optimistic-rollup withdrawal, so it is **three transactions on two chains**, and none of them happens by itself:

| # | Step | Chain | Who signs | When |
|---|------|-------|-----------|------|
| 1 | **Initiate** the withdrawal | Celo | Ops wallet (holds the CELO) | T0 |
| 2 | **Prove** the withdrawal | Ethereum L1 | Any L1 wallet with ETH for gas (operator's L1 hot wallet) | Once a dispute game covering the T0 block is posted on L1 (usually hours after T0) |
| 3 | **Finalize** the withdrawal | Ethereum L1 | **The same address that proved it** (see below) | After the challenge/maturity window, **about 7 days after the prove tx** |

Funds arrive at the **recipient address set in step 1**, not at whoever signs steps 2–3. Put the custodian treasury address in as the recipient at initiation. The custodian never has to sign anything, and the operator's L1 wallet only needs a little ETH for gas.

## 1. How long the money is in flight

**Plan on about 7.5–8 calendar days from initiation to funds in the treasury.** Allow up to 10 in the runbook.

Why it's about 7 days and not the "3.5 days" people quote: Celo's exit has **two gates, and the later one wins**. These are values read off Celo's portal and dispute-game contracts on 2026-08-24:

- `proofMaturityDelaySeconds` = 604,800 → **7 days counted from your prove transaction**.
- OP Succinct dispute game: `maxChallengeDuration` = 302,400 (3.5 d), then `disputeGameFinalityDelaySeconds` = 302,400 (3.5 d) after the game resolves → about 7 days from game creation.

"Celo exits in 3.5 days" is just the challenge window taken on its own. The real wait is about 7 days, and **that clock starts at prove, not at initiation**. Every hour you're late proving adds an hour to the whole transfer.

Timeline:

```
T0            initiate on Celo (Celo blocks are ~1s, so it confirms in seconds)
T0 + hours    dispute game covering your block posted on L1 → PROVE ASAP
T_prove + 7d  maturity reached → FINALIZE ASAP
T_finalize    ERC-20 CELO in treasury wallet (one L1 block)
```

**These numbers change with upgrades.** Don't hardcode 7 days in the runbook. Put in a step that reads the current values each month: viem's OP Stack actions `getTimeToProve` / `getTimeToFinalize` (or `getWithdrawalStatus`) against Celo's own L1 contracts. Also confirm the contract addresses and the L1 CELO token address from Celo's official docs, not from this doc or from memory.

## 2. Operator runbook, step by step

### Pre-flight (a few days before month end)
1. **Confirm the custodian supports ERC-20 CELO on Ethereum mainnet** at the canonical L1 token address from Celo's docs, and that the treasury address will be credited and shown for it. If the custodian doesn't list the token, the funds land fine but finance can't see them, which defeats the purpose. **Do this before the first run.**
2. Confirm the recipient address with the custodian through an out-of-band channel. A wrong recipient can't be recovered.
3. Make sure the L1 operator wallet has ETH for two L1 transactions (prove and finalize, each a few hundred thousand gas), plus some buffer.
4. Make sure the Celo ops wallet keeps enough CELO for gas after the sweep. Don't sweep the balance to zero.
5. Read the current `proofMaturityDelaySeconds` and dispute-game parameters (or run `getTimeToFinalize` on a recent withdrawal). If they differ from last month, update the expected land date.
6. **First month only:** send a small canary withdrawal through all three steps a week or more ahead, so tooling, keys, gas and the custodian's crediting are tested before real size.

### T0: last business day, morning
7. Snapshot the balance and compute the sweep amount (balance minus gas reserve).
8. **Initiate** the withdrawal on Celo from the ops wallet, with `to` = treasury address. Use Celo's documented withdrawal path (the L2 bridge / `L2ToL1MessagePasser` flow its docs and the viem/OP SDK tooling wrap). Don't use a third-party bridge UI for this step.
9. Record: the Celo tx hash, block number, amount, recipient, and the withdrawal hash. **Hand this to finance as "in transit" documentation.** From here until finalize, the funds are neither in the ops wallet nor in the treasury.

### T0 + a few hours (same day or next morning)
10. Poll `getTimeToProve` / withdrawal status until it's "ready to prove", then **submit the prove transaction on L1** from the operator L1 wallet. Record the tx hash and timestamp. **This timestamp is the start of the 7-day clock.**
11. Put a calendar event and an automated alert at `T_prove + maturity delay` (read live). If that falls on a weekend, someone has to be on call, or you accept a Monday finalize and add the delay to the land date.

### T_prove + ~7 days
12. Check status with `getTimeToFinalize`. If it says ready, **submit the finalize transaction** on L1. In current OP Stack portals the finalize has to come **from the address that submitted the prove** (proofs are recorded per prover), so the same L1 wallet or signer must be available. Don't rotate that key mid-flight.
13. Confirm the ERC-20 CELO balance in the treasury address on Etherscan and with the custodian. Close the in-transit entry.

### Exceptions to cover in the runbook
- **Status goes back to "ready to prove", or finalize reverts after proving:** the dispute game your proof referenced was challenged, invalidated or blacklisted. Re-prove against a newer game, and the 7-day clock restarts. Escalate: this should be rare and is worth a look.
- **Nobody finalizes:** nothing expires. Funds just sit in the portal until someone finalizes. It's a delay, not a loss, but it will miss the close.
- **Upgrade in flight:** check Celo's announcements before T0. A portal or dispute-game upgrade during your window can change the gates or force a re-prove.

## 3. Does "last business day → before next month's close" work?

Only if the books close **after about business day 6–8** of the next month. Kick off on, say, Friday 30 Oct and the funds land around Sat 7 – Mon 9 Nov. For many finance teams that's tight or late. Also:

- **Price exposure:** the amount is fixed in CELO for 7–8 days. At $2M, a routine 10–15% move in CELO over a week is $200–300k of P&L swing that finance needs to either accept or hedge. Raise this with them explicitly. It's the bigger issue at scale, more than latency.
- **Easy fix that keeps the canonical route:** move the **revenue cutoff** earlier (e.g. sweep revenue through the ~20th, kick off on the 20th–22nd) or sweep weekly. Weekly sweeps still take 7 days each, but they're smaller, the pipeline is always moving, and a single stuck withdrawal doesn't hold up the whole month.

## 4. If finance says "same week"

The canonical exit **can't** get below about 7 days. That's the security model. Getting under it means paying someone to front the money, which adds a fee and a **trust assumption beyond Ethereum**. Options, best first for this case:

1. **Convert to a stablecoin on Celo, then move the stablecoin fast.** Swap CELO → USDC on Celo, then move USDC with Circle's CCTP (burn on Celo, mint native USDC on mainnet, minutes). *Check that CCTP currently supports Celo as a domain before committing.* If it doesn't, use a fast bridge for USDC, where liquidity is much deeper than for CELO.
   - Trust: Circle's attestation service (for CCTP), plus the Celo DEX for the swap.
   - Also removes the CELO price risk above, which finance probably wants anyway.
   - Catch: the custodian then holds USDC, not CELO. Confirm that's acceptable. Also measure swap slippage for the real size: quote $2M CELO→USDC on Celo DEXs, and split across days or tranches if the price impact is material.
2. **Fast/intent bridge for CELO itself** (Across, Squid, LayerZero/CCIP-based routes, etc.): a relayer pays you on L1 within minutes and takes the canonical exit themselves.
   - Trust: the bridge's relayer set, oracle or messaging layer, and its contracts.
   - **Catch at your size:** CELO is a long-tail gas token. Relayer inventory for $2M of CELO on any route is likely thin or nonexistent. Get live quotes at full size, and expect to split into tranches or get refused. Don't put a route in the runbook without a real $2M quote.
3. **Exchange hop:** deposit native CELO to an exchange that supports the Celo network, then withdraw ERC-20 CELO (or sell and withdraw USDC) to the treasury on Ethereum.
   - Trust: the exchange's custody while the funds sit there. Usually same day.
   - Catch: withdrawal limits, KYB/whitelisting of the treasury address, and deposit-confirmation holds. Set up the account and whitelisting well in advance.

**My recommendation:**
- **If finance is fine receiving USD:** swap to USDC on Celo at T0 and use the fastest USDC route with verified Celo support (CCTP if it's live, otherwise a vetted fast bridge).
- **If they must receive CELO:** keep the canonical withdrawal as the default and move the cutoff earlier, or sweep weekly. Keep a pre-arranged exchange account (with the treasury address whitelisted) as the break-glass same-week path.
- **Either way:** write down which trust assumption each path adds, and get finance and security to sign off on it once, not every month.

## 5. Verify before this goes live
- Current `proofMaturityDelaySeconds` and dispute-game durations (viem `getTimeToProve` / `getTimeToFinalize`). The values in this doc were read 2026-08-24.
- The L1 CELO token address and Celo portal/bridge addresses, from Celo's official docs.
- That the custodian lists ERC-20 CELO on mainnet.
- Any fast route's support for Celo and a live quote at full size.
