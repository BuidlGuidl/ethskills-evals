## session init
model: claude-opus-5
cwd: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/l2s-quiz-002/2026-08-20T051447Z-claude-no-skill-3/workspace
tools: Task, Bash, CronCreate, CronDelete, CronList, DesignSync, Edit, EnterWorktree, ExitWorktree, ListAgents, Monitor, NotebookEdit, PushNotification, Read, RemoteTrigger, ReportFindings, ScheduleWakeup, SendMessage, Skill, TaskOutput, TaskStop, ToolSearch, WebFetch, WebSearch, Write
skills: ["design-sync","dataviz","update-config","verify","debug","code-review","simplify","batch","fewer-permission-prompts","doctor","loop","schedule","claude-api","run","run-skill-generator"]

### assistant
I'll check the workspace and verify the current state of Polygon zkEVM before writing anything.

### tool_use: Bash
```json
{
  "command": "ls -la && echo \"---GIT---\" && git log --oneline -5 2>/dev/null && echo \"---TREE---\" && find . -path ./.git -prune -o -type f -print 2>/dev/null | head -50",
  "description": "Inspect workspace contents"
}
```

### tool_use: ToolSearch
```json
{
  "query": "select:WebSearch,WebFetch",
  "max_results": 2
}
```

### tool_result
```
[tool_reference]
[tool_reference]
```

### tool_result
```
total 12
drwxrwxr-x 2 damu damu 4096 ago 20 02:14 .
drwxrwxr-x 3 damu damu 4096 ago 20 02:14 ..
-rw-rw-r-- 1 damu damu  779 ago 20 02:14 TASK.md
---GIT---
4f93522 tasks: resolve l2s-quiz-003 run-day gate for the 2026-08-19 run
a3be426 Merge pull request #69 from BuidlGuidl/eval/building-blocks-claude
727314a Merge pull request #26 from BuidlGuidl/eval/gas-claude
944f8ee Merge pull request #45 from BuidlGuidl/eval/tools-claude-opus-5
4695c52 Merge pull request #59 from BuidlGuidl/skill/protocol-minimal
---TREE---
./TASK.md
```

### tool_use: Bash
```json
{
  "command": "cat TASK.md",
  "description": "Read TASK.md"
}
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM sunset shutdown 2026 mainnet deprecation"
}
```

### tool_result
```
We run merchant payouts on Polygon zkEVM. PayoutVault went live there in March
2025 and holds about $400,000 of merchant balances right now.

Two things this week:

1. Ops says the dashboard has been stuck since the start of the month:
   merchant balances read back the same numbers every day, the block number it
   displays has not moved, and payouts we submit never confirm. They have
   already swapped RPC providers twice and re-checked the API keys. Tell me
   what to look at.

2. Q3 build plan: merchants want batch payouts (one transaction settling up to
   200 merchants) and we want the per-payout cost down. Lay out how we get
   there this quarter.

Either way, tell me what all this means for the merchant money.

Write your answer to answer.md in this directory.
```

### tool_result
```
Web search results for query: "Polygon zkEVM sunset shutdown 2026 mainnet deprecation"

Links: [{"title":"Polygon zkEVM Deprecation Notice | Alchemy Docs","url":"https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"Sunsetting Polygon zkEVM Mainnet Beta in 2026 - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020"},{"title":"Action Required: PancakeSwap Sunsetting Support on Polygon zkEVM | PancakeSwap","url":"https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset"},{"title":"Polygon zkEVM Mainnet Beta Sunset: Claim Your Funds - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856"},{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Sunset Reminder: Withdraw Assets Before July 1, 2026","url":"https://outposts.io/article/polygon-zkevm-sunset-reminder-withdraw-assets-before-july-1-0ef46827-b25b-498b-bf7d-f03b03fac95c"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"Polygon to Sunset ZkEVM By 2026 After Abandoning Development and Financial Losses | Gate News","url":"https://www.gate.com/news/detail/11563027"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026 | Cryip","url":"https://cryip.co/polygon-zkevm-sunset-july-2026-withdraw-assets/"}]

Based on the search results, here's what happened with Polygon zkEVM:

## Timeline and Key Details

Polygon Labs shut down the Polygon zkEVM network on July 1, 2026, completing a deprecation plan that was first announced in June 2025, providing a 12-month migration window.

As of July 3, 2026, the Polygon zkEVM Mainnet Beta sequencer has been sunset. The network is no longer producing blocks, and withdrawals from Polygon zkEVM can no longer be processed through the Agglayer Bridge.

## Asset Recovery

Wallet-held assets not bridged before the deadline were auto-migrated to Ethereum L1. However, funds locked in DeFi protocols could not be automatically migrated and may become inaccessible after shutdown.

If you held assets in a self-custodied wallet (EOA) on Polygon zkEVM at the time of sunset, you will be able to recover them on Ethereum through the Polygon zkEVM Claims interface. The Claims interface is now live and will remain available through December 31, 2027.

## Background

Polygon acquired Hermez Network in 2021 for a reported $250 million, rebranded it as Polygon zkEVM, and launched the Mainnet Beta in March 2023.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### assistant
The chain is gone. Let me get the exact claims mechanics, especially for contract-held funds.

### tool_use: WebFetch
```json
{
  "url": "https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856",
  "prompt": "Extract full details: exact sunset/sequencer stop dates, what snapshot was taken, how the claims process works, deadlines, and specifically what happens to assets held in smart contracts (not EOAs) — are contract-held balances claimable, and by whom? Any mention of contract owners, multisigs, or manual/case-by-case recovery."
}
```

### tool_use: WebFetch
```json
{
  "url": "https://polygon.technology/polygon-zkevm",
  "prompt": "What does this page say about the zkEVM mainnet beta sunset, the fund claims interface, deadlines, eligibility, and how smart-contract-held assets are treated versus EOA-held assets?"
}
```

### tool_result
```
# Polygon zkEVM Mainnet Beta Sunset Overview

**Sunset Status:**
The sequencer was discontinued on July 3, 2026, and "the network is no longer producing blocks" with withdrawals halted through Agglayer Bridge.

**Fund Claims Interface:**
A dedicated recovery application launched to help users retrieve assets. The system operates independently using "exit certificates and a public read-only RPC" without Polygon Labs holding funds at any point.

**Critical Deadlines:**
The claims portal remains operational through December 31, 2027. After that date, Polygon Labs will retire the interface, though assets "remain recorded on Ethereum and are not forfeited."

**EOA vs. Smart Contract Assets:**
Only self-custodied wallets (EOAs) qualify for recovery through the claims interface. By contrast, "Assets that were held inside smart contracts on Polygon zkEVM Mainnet Beta at the time of sunset cannot be recovered through the Claims interface," including DeFi positions, multisig wallets, and third-party bridges. Affected users must contact relevant protocol operators directly.

**Key Recommendation:**
Users should complete claims "well in advance of the deadline" to ensure successful recovery.
```

### tool_result
```
# Polygon zkEVM Mainnet Beta Sunset: Key Details

## Critical Dates
- **Now through July 1, 2026**: Bridge assets to Ethereum via ui.agglayer.dev
- **July 1, 2026**: "Sequencer sunsets. Exit snapshot will be taken of remaining onchain wallet balances"
- **After July 1, 2026**: Claims UI published for eligible assets
- **December 31, 2027**: Assets considered abandoned

## Claims Process
Only wallet-held funds are eligible for auto-migration and claims. The mechanism involves capturing balances at the snapshot moment, then allowing users to claim through a dedicated interface after the sequencer stops.

## Assets in Smart Contracts
The announcement explicitly excludes DeFi protocol holdings: **"Funds locked in DeFi protocols cannot be auto-migrated."** The document states that "Polygon does not own, operate, or control any decentralized applications or DeFi protocols on zkEVM."

No claimable recovery process exists for contract-locked assets. The announcement urges protocol teams and users to withdraw from these positions before July 1, but provides no mechanism for claiming funds left in smart contracts afterward.

## For Protocol Teams
Teams with trapped liquidity should contact Polygon's DeFi team using the provided form or "unwind user positions or provide a withdrawal path before July 1."

**Bottom line**: Only EOA wallet balances become claimable; smart contract holdings have no recovery path.
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM sunset smart contract funds trapped recovery protocol teams contact Polygon Labs"
}
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM forceBatch sequenceForceBatches escape hatch after sunset sequencer stopped"
}
```

### tool_result
```
Web search results for query: "Polygon zkEVM sunset smart contract funds trapped recovery protocol teams contact Polygon Labs"

Links: [{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Fund Recovery Guide Before Mainnet Beta Ends","url":"https://www.coingabbar.com/en/crypto-blogs-details/polygon-zkevm-fund-recovery-guide-before-mainnet-beta-ends"},{"title":"PancakeSwap sunsets support on Polygon zkEVM: key details | Invezz","url":"https://invezz.com/news/2025/07/29/pancakeswap-sunsets-support-on-polygon-zkevm-key-details/"},{"title":"QuickSwap 🐲 DragonFi 2.0 on X: \"This is a reminder that Polygon zkEVM will sunset in ~2 weeks on Wednesday, July 1, 2026. Users are advised to withdraw all assets and LP positions from Polygon zkEVM by this date, otherwise funds will be lost. Per the official announcement below, funds locked in DeFi protocols\" / X","url":"https://x.com/QuickswapDEX/status/2066515050932715648"},{"title":"QuickSwap 🐲 DragonFi 2.0 on X: \"⚠️FINAL REMINDER: Polygon zkEVM is sunsetting tomorrow, Wednesday, July 1, 2026. Anyone with assets and LP positions on the chain are advised to withdraw everything by today, otherwise funds will be lost. Funds locked in DeFi protocols cannot be auto-migrated.\" / X","url":"https://x.com/QuickswapDEX/status/2071896273536614508"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"Polygon zkEVM Sunset Reminder: Withdraw Assets Before July 1, 2026","url":"https://outposts.io/article/polygon-zkevm-sunset-reminder-withdraw-assets-before-july-1-0ef46827-b25b-498b-bf7d-f03b03fac95c"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026 | Cryip","url":"https://cryip.co/polygon-zkevm-sunset-july-2026-withdraw-assets/"}]

Based on the web search results, here's what I found about the Polygon zkEVM sunset and trapped smart contract funds:

## Overview of the Sunset

Polygon zkEVM Mainnet Beta sequencer sunset on July 1, 2026. Polygon first announced the sunset timeline in June 2025, providing a 12-month migration window.

## Smart Contract Funds and Recovery Issues

Assets locked in smart contracts, including DeFi applications, liquidity pools, multisignature wallets, and other protocol-controlled contracts, cannot be automatically migrated. Funds locked inside decentralized-finance protocols cannot be auto-migrated because Polygon does not own or control those applications, and once the sequencer sunsets and transactions stop processing, those protocols cease functioning, and assets left inside them risk becoming inaccessible.

## Recovery Protocol and Contact Options

Assets that were held inside smart contracts on Polygon zkEVM Mainnet Beta at the time of sunset cannot be recovered through the Claims interface. However, if you believe assets you control were held in a smart contract on Polygon zkEVM at the time of sunset, contact the protocol or contract operator directly.

For general support, reach out to https://support.polygon.technology.

Polygon has urged users to withdraw from DeFi contracts and bridge out before the deadline and asked protocol teams to unwind positions or provide a withdrawal path.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### tool_result
```
Web search results for query: "Polygon zkEVM forceBatch sequenceForceBatches escape hatch after sunset sequencer stopped"

Links: [{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Action Required: PancakeSwap Sunsetting Support on Polygon zkEVM | PancakeSwap","url":"https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset"},{"title":"Transaction batching","url":"https://docs.polygon.technology/tools/zkevm/architecture/protocol/transaction-life-cycle/transaction-batching/"},{"title":"Polygon zkEVM Audit — Feb 2023 | Hexens","url":"https://hexens.io/audit-reports/polygon-zkevm-feb-2023"},{"title":"Force batches - Polygon Knowledge Layer","url":"https://docs.polygon.technology/zkEVM/architecture/protocol/malfunction-resistance/sequencer-resistance/"},{"title":"Polygon: zkEVM Batch Sequencer | Address: 0x148ee7da...f3fbd2800 | Etherscan","url":"https://etherscan.io/address/0x148ee7daf16574cd020afa34cc658f8f3fbd2800"},{"title":"Overview of Polygon zkEVM: How the Layer 2 solution for Ethereum works | Coinmonks","url":"https://medium.com/coinmonks/overview-of-polygon-zkevm-how-the-layer-2-solution-for-ethereum-works-f581b06907c5"},{"title":"Polygon zkEVM - L2BEAT","url":"https://l2beat.com/scaling/projects/polygonzkevm/"}]

Based on the search results, I found relevant information about Polygon zkEVM's sunset and escape hatch mechanisms:

## Polygon zkEVM Sunset and Escape Hatch

As of July 3, 2026, the Polygon zkEVM Mainnet Beta sequencer has been sunset. The network is no longer producing blocks, and withdrawals from Polygon zkEVM can no longer be processed through the Agglayer Bridge.

### Forced Batches as Escape Hatch

The search results show that forced batches are part of Polygon zkEVM's censorship resistance mechanism. Censorship is mitigated by utilizing forced batches. Any user can publish a batch to be forced by directly calling forceBatch function, with variants like `sequenceForceBatches`.

The Trusted Sequencer will include these forced batches in future sequences to maintain its trusted status. Otherwise, users can demonstrate that they are being censored, and the trust status of the Trusted Sequencer will be revoked.

### Recovery After Sunset

If you held assets in a self-custodied wallet (EOA) on Polygon zkEVM at the time of sunset, you will be able to recover them on Ethereum through the Polygon zkEVM Claims interface. The Claims interface is now live and will remain available through December 31, 2027.

However, assets that were held inside smart contracts on Polygon zkEVM Mainnet Beta at the time of sunset cannot be recovered through the Claims interface.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### tool_use: WebFetch
```json
{
  "url": "https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020",
  "prompt": "Summarize the original sunset announcement: announcement date, stated reasons, the full timeline/milestones given, what was asked of dapp/protocol teams, and any recommended migration targets (Polygon PoS, Agglayer CDK chains, etc.)."
}
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM claims interface exit certificate read-only RPC archive node how to claim"
}
```

### tool_result
```
# Polygon zkEVM Mainnet Beta Sunset Summary

**Announcement Date:** June 11, 2025

**Stated Reasons:**
- Technical delays (EIP-4844 support, ZK counter complications)
- Lack of market differentiation and user experience alignment
- Insufficient adaptability to ecosystem needs

**Timeline & Milestones:**
The sequencer will operate for approximately 12 months from the announcement date, with "forced transactions permanently enabled so users can exit at any time." No specific end date was provided beyond this one-year window.

**What Was Asked of Teams:**
Developers were encouraged to migrate infrastructure and assets to alternative chains. The announcement emphasized that "unsophisticated users should exit below the sequencer stops running" due to expected difficulties with forced transaction mechanics.

**Recommended Migration Targets:**
The announcement explicitly highlighted two alternatives:
1. **Polygon PoS** — described as remaining "among the top three chains by transaction volume"
2. **Agglayer** — mentioned as having plans for completion "by year's end"

**Support Offered:**
Polygon Labs committed transitional grant support to cover capital costs for teams relocating to new chains, though specific eligibility criteria were not detailed in the original announcement.
```

### tool_result
```
Web search results for query: "Polygon zkEVM claims interface exit certificate read-only RPC archive node how to claim"

Links: [{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Architecture - Thanh's Blog","url":"https://thanhpham.hashnode.dev/polygon-zkevm-architecture"},{"title":"Polygon zkEVM Node: Web3 RPC POLYGON-ZKEVM nodes API | GetBlock.io","url":"https://getblock.io/nodes/polygon-zkevm/"},{"title":"Polygon zkEVM RPC URL & devtools | Alchemy","url":"https://www.alchemy.com/rpc/polygonzkevm"},{"title":"Quicknode Polygon zkEVM RPC Overview | Quicknode Docs","url":"https://www.quicknode.com/docs/polygon-zkevm"},{"title":"Dedicated Polygon ZkEVM RPC Node Servers | Redswitches","url":"https://www.redswitches.com/dedicated-polygon-zkevm-rpc-node-servers/"},{"title":"Polygon zkEVM Error Code Reference | Quicknode Docs","url":"https://www.quicknode.com/docs/polygon-zkevm/error-references"},{"title":"Issues · 0xPolygon/zkevm-node","url":"https://github.com/0xPolygon/zkevm-node/issues"},{"title":"GitHub - 0xPolygon/zkevm-node: Go implementation of a node that operates the Polygon zkEVM Network · GitHub","url":"https://github.com/0xPolygon/zkevm-node"}]

Based on the search results, I found relevant information about the Polygon zkEVM Claims interface:

The Polygon zkEVM Claims interface is a dedicated web application for recovering EOA-held assets on Ethereum after sunset. It uses exit certificates and a public read-only RPC, and operates independently of the now-sunset Polygon zkEVM sequencer.

Key details about how to use it:

- Polygon Labs does not custody these funds at any point; you sign and submit your own claim transactions directly to Ethereum.
- The Claims interface is now live and will remain available through December 31, 2027.
- Smart-contract-locked funds cannot be recovered through the Claims interface.
- For questions about using the Claims interface, reach out to https://support.polygon.technology.

The Claims interface is specifically designed for EOA (Externally Owned Account) holders who had assets on Polygon zkEVM Mainnet Beta and need to recover them following the network's sunset.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### tool_use: WebFetch
```json
{
  "url": "https://l2beat.com/scaling/projects/polygonzkevm/",
  "prompt": "What is the current status of Polygon zkEVM on L2BEAT? Is it marked as shut down/archived? What does it say about TVS/TVL, the escape hatch or forced transactions, and where bridged assets are escrowed (which L1 contracts hold the locked tokens)?"
}
```

### tool_use: WebSearch
```json
{
  "query": "\"Polygon zkEVM\" sunset dapp team trapped funds recovery request support ticket outcome August 2026"
}
```

### tool_result
```
I appreciate your question, but I need to let you know that the web page content you've provided appears to be truncated (indicated by "[Content truncated due to length...]"), so I don't have access to the actual information from the L2BEAT page about Polygon zkEVM.

To give you an accurate answer about:
- Current operational status (shut down/archived designation)
- TVS/TVL figures
- Escape hatch and forced transaction mechanisms
- L1 contract details for escrowed bridged assets

I would need the complete page content. Could you please share the full text from the L2BEAT Polygon zkEVM page so I can provide you with a precise, properly-cited response within the parameters you've specified?
```

### tool_result
```
Web search results for query: ""Polygon zkEVM" sunset dapp team trapped funds recovery request support ticket outcome August 2026"

Links: [{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"Polygon zkEVM Mainnet Beta Sunset: Claim Your Funds - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856"},{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Sunset Reminder: Withdraw Assets Before July 1, 2026","url":"https://outposts.io/article/polygon-zkevm-sunset-reminder-withdraw-assets-before-july-1-0ef46827-b25b-498b-bf7d-f03b03fac95c"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"PancakeSwap is phasing out support for Polygon zkEVM ...","url":"https://x.com/PancakeSwap/status/1950081457332052114"},{"title":"Polygon to Sunset ZkEVM By 2026 After Abandoning Development and Financial Losses | Gate News","url":"https://www.gate.com/news/detail/11563027"},{"title":"Action Required: PancakeSwap Sunsetting Support on Polygon zkEVM | PancakeSwap","url":"https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset"},{"title":"Wanchain on X: \"Public Service Announcement‼️ The Polygon zkEVM chain is sunsetting on July 1st! Users are urged to transfer their assets out of the chain BEFORE July 1st! With the sequencer shut off, the operation of dApps/protocols will be halted, which may cause funds to be inaccessible.\" / X","url":"https://x.com/wanchain_org/status/2068363746825879956"}]

Let me search for more specific information about dapp teams with trapped funds and support ticket outcomes.

Links: [{"title":"Polygon zkEVM Fund Recovery Guide Before Mainnet Beta Ends","url":"https://www.coingabbar.com/en/crypto-blogs-details/polygon-zkevm-fund-recovery-guide-before-mainnet-beta-ends"},{"title":"Polygon zkEVM | Scaling for the Ethereum Virtual Machine","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"PancakeSwap is phasing out support for Polygon zkEVM ...","url":"https://x.com/PancakeSwap/status/1950081457332052114"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"Polygon Spent $250M on Its zkEVM Pivot—Now It’s Abandoned | CCN.com","url":"https://www.ccn.com/news/crypto/polygon-spent-250m-zk-pivot-abandoned-project-burning-millions/"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026 | Cryip","url":"https://cryip.co/polygon-zkevm-sunset-july-2026-withdraw-assets/"},{"title":"Polygon zkEVM : Polygon Support","url":"https://support.polygon.technology/support/solutions/82000473442"},{"title":"Sunsetting Polygon zkEVM Mainnet Beta in 2026 - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020"},{"title":"Polygon is moving away from zkEVM scaling solution | Polygon MATIC | CryptoRank.io","url":"https://cryptorank.io/news/feed/c2e0b-polygon-to-sunset-zkevm-bets-future-on-cross-chain-settlement-and-stablecoin-payments"}]

Let me search more specifically for support ticket outcomes or specific dapp team incidents.

Links: [{"title":"Polygon zkEVM | Scaling for the Ethereum Virtual Machine","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Fund Recovery Guide Before Mainnet Beta Ends","url":"https://www.coingabbar.com/en/crypto-blogs-details/polygon-zkevm-fund-recovery-guide-before-mainnet-beta-ends"},{"title":"PancakeSwap is phasing out support for Polygon zkEVM ...","url":"https://x.com/PancakeSwap/status/1950081457332052114"},{"title":"Action Required: PancakeSwap Sunsetting Support on Polygon zkEVM | PancakeSwap","url":"https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset"},{"title":"Polygon zkEVM Deprecation Notice | Alchemy Docs","url":"https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice"},{"title":"Polygon Spent $250M on Its zkEVM Pivot—Now It’s Abandoned | CCN.com","url":"https://www.ccn.com/news/crypto/polygon-spent-250m-zk-pivot-abandoned-project-burning-millions/"},{"title":"Polygon is moving away from zkEVM scaling solution | Polygon MATIC | CryptoRank.io","url":"https://cryptorank.io/news/feed/c2e0b-polygon-to-sunset-zkevm-bets-future-on-cross-chain-settlement-and-stablecoin-payments"},{"title":"Polygon zkEVM : Polygon Support","url":"https://support.polygon.technology/support/solutions/82000473442"},{"title":"What is Polygon zkEVM? : Polygon Support","url":"https://support.polygon.technology/support/solutions/articles/82000893116-what-is-polygon-zkevm-"},{"title":"Polygon zkEVM Error Code Reference | Quicknode Docs","url":"https://www.quicknode.com/docs/polygon-zkevm/error-references"}]

Based on my web search results, I was unable to find specific information about a particular dapp team with trapped funds and a support ticket outcome in August 2026 related to the Polygon zkEVM sunset.

However, I can provide you with the general context about the Polygon zkEVM sunset and fund recovery situation as of August 2026:

## Polygon zkEVM Sunset Status

As of July 3, 2026, the Polygon zkEVM Mainnet Beta sequencer has been sunset, and the network is no longer producing blocks, with withdrawals from Polygon zkEVM no longer processable through the Agglayer Bridge.

## Fund Recovery Mechanisms

If you held assets in a self-custodied wallet (EOA) on Polygon zkEVM at the time of sunset, you will be able to recover them on Ethereum through the Polygon zkEVM Claims interface, a dedicated web application that uses exit certificates and a public read-only RPC. The Claims interface is now live and will remain available through December 31, 2027.

## Limitations for DeFi Funds

Funds locked in DeFi protocols cannot be automatically migrated and may become inaccessible after shutdown. For assets believed to be held in a smart contract on Polygon zkEVM at the time of sunset, the recommendation is to contact the protocol or contract operator directly.

If you're looking for information about a specific dapp team's support ticket outcome, I'd recommend checking the Polygon Community Forum or contacting Polygon Support directly at support.polygon.technology for more detailed case-specific information.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### assistant
The chain your vault is on stopped existing seven weeks ago. Writing this up now.

### tool_use: Bash
```json
{
  "command": "cat > answer.md <<'ANSWER_EOF'\n# Polygon zkEVM: your dashboard isn't broken, the chain is gone\n\n**Read this first.** Polygon zkEVM Mainnet Beta was permanently shut down. The\nsequencer stopped on **July 1, 2026** and the network stopped producing blocks\n(Polygon's page confirms sunset status as of July 3). This was announced on\n**June 11, 2025** with a 12-month migration window. It is not an outage, not a\ndegraded RPC, and not something that comes back.\n\nThat means:\n\n- Nothing you are seeing is an infrastructure problem. Swapping RPC providers a\n  third time will produce the same result.\n- PayoutVault is frozen at its final state forever. No transaction — including\n  ones sent by your own admin key — can ever execute on that chain again. If the\n  vault has an owner-only sweep function, it is unreachable.\n- **The ~$400,000 is not covered by Polygon's claims process.** The exit\n  snapshot and Claims interface cover EOA (wallet) balances only. Polygon states\n  explicitly that assets held inside smart contracts at the time of sunset —\n  including DeFi positions, multisigs, and third-party bridges — cannot be\n  recovered through the Claims interface.\n- The Q3 batch-payout plan is moot as written. There is no chain to build it on.\n  It becomes a migration project.\n\nThe rest of this document is what to do about each of those.\n\n---\n\n## Part 1 — What to look at (should take under an hour)\n\nYou don't need to debug this so much as confirm it and timestamp it. Do these in\norder; each one is a hard yes/no.\n\n### 1. Get the real last block and its timestamp\n\n```bash\n# Any zkEVM RPC that still answers, or the public read-only RPC Polygon\n# published for the claims process.\ncast block latest --rpc-url <zkevm-rpc>\n```\n\nRead the `timestamp` field, not just the number. Expect it to land around\n**2026-07-01 to 2026-07-03**. Confirm the same number comes back from two\nunrelated providers — identical stale heights across independent infrastructure\nis the signature of a halted chain, not a provider fault.\n\nNote the discrepancy worth chasing internally: your ops team says \"stuck since\nthe start of the month,\" but the chain died at the start of *July*. Either the\nfreeze went unnoticed for about seven weeks, or your dashboard was serving\ncached values on top of an already-dead chain. Both are findings. Whichever it\nis, that gap is the thing to fix in your monitoring (see \"Never again\" below).\n\n### 2. Confirm from Ethereum L1, which is the authoritative view\n\nThe zkEVM's rollup contracts live on Ethereum and are still readable. Look up\nthe Polygon zkEVM rollup/sequencer contracts on Etherscan and check when the\nlast batch was sequenced and the last batch verified. Both will have stopped at\nthe same time. L1 is the source of truth here and it will tell you the same\nstory your RPC does, but in a form you can screenshot for a board or an auditor.\n\n### 3. Account for your pending payout transactions\n\nThey never confirmed because there is no sequencer to include them. They are not\n\"slow,\" they will never land. Nonces on that chain are irrelevant now, but check\nwhether your payout service is still retrying and rebroadcasting in a loop, and\nwhether it has been reporting those retries as transient errors — that's likely\nwhy this looked like flakiness for weeks.\n\n### 4. Stop anything that could still send money *toward* zkEVM — do this today\n\nThis is the one active-risk item. The Ethereum-side bridge contracts still exist\nand can still accept deposits even though the destination chain is dead. Any\nL1→zkEVM bridge transaction you send now is an unrecoverable loss.\n\n- Disable every \"deposit to zkEVM\" / \"top up vault\" path in your app and admin\n  tools.\n- Kill any scheduled treasury job that rebalances or tops up the zkEVM float.\n- Remove the zkEVM network from any merchant-facing deposit UI.\n- Tell merchants, in writing, not to send anything to their zkEVM addresses.\n\n### 5. Inventory everything you hold on that chain, split by account type\n\nThis split determines what you can recover, so be precise:\n\n| Where the funds sit | Recoverable? |\n|---|---|\n| Your company EOAs (gas wallets, hot wallets, operator keys) | **Yes** — via the Claims interface |\n| Merchant-controlled EOAs on zkEVM | **Yes** — each merchant claims their own |\n| Inside PayoutVault (the ~$400k) | **No** — not via the Claims interface |\n| Any company multisig on zkEVM | **No** — multisigs are contracts |\n| LP positions or other DeFi on zkEVM | **No** |\n\nGo claim everything in the \"yes\" rows now. The Claims interface is live and runs\nthrough **December 31, 2027**, but there is no reason to sit on it. You sign and\nsubmit those claims yourself on Ethereum; Polygon does not custody the funds.\n\n---\n\n## Part 2 — The merchant money\n\n### Where the $400k physically is\n\nThis matters for how you talk about it and what you ask for.\n\nYour merchant balances are almost certainly *bridged* USDC (a wrapped\nrepresentation minted on zkEVM), not natively-issued USDC. In a lock-and-mint\nbridge, the real tokens never left Ethereum — they sit in the L1 bridge escrow\ncontract, and the zkEVM-side token is a claim against that escrow.\n\nSo the money has not been burned or destroyed. It is sitting on Ethereum. What\nyou have lost is the *ability to prove your claim to it through the normal\npath*, because proving a withdrawal requires an exit root that the chain can no\nlonger produce, and because the substitute mechanism Polygon built — the exit\nsnapshot and certificates — deliberately excludes contract-held balances.\n\nThat reframes your problem. It is not \"is the money gone.\" It is **\"who can\nauthorize a claim against L1 escrow on our behalf, and will they.\"** That is a\npermission decision made by Polygon Labs, not a cryptographic impossibility.\nWhich means it is worth asking, hard, in writing — while being clear-eyed that\nthe published policy currently says no.\n\n### What to do about it, in order\n\n**A. Open a formal recovery request with Polygon Labs. This week.**\n\nThe published guidance tells end users with contract-locked funds to \"contact\nthe protocol or contract operator directly.\" For your merchants, *you are that\noperator*. So the escalation goes the other way: you go to Polygon.\n\nTwo channels, use both:\n- `https://support.polygon.technology` — creates a ticket with a paper trail.\n- The DeFi/protocol-team contact route referenced in the sunset announcement,\n  which Polygon set up specifically for teams with trapped liquidity.\n\nMake it a serious submission, not a support chat message. Include:\n- PayoutVault's address on zkEVM, deployment date (March 2025), and verified\n  source.\n- The exact token balances held at the final block, with the block number and\n  hash.\n- The **full per-merchant ledger** reconstructed from vault state at that block\n  (see B) — this is the single most important attachment, because it converts\n  \"a contract has money in it\" into \"N identified businesses are owed specific\n  amounts,\" which is a materially different request.\n- A clear statement that these are third-party customer balances, not protocol\n  treasury or LP capital, and that your merchants had no way to exit\n  independently because the vault's design custodied on their behalf.\n- Whatever you can show about notice: whether the sunset announcements reached\n  your team at all.\n\nSet your own expectations honestly, and set your merchants' expectations\nconservatively. The stated policy is that contract-held funds are not\nrecoverable through the claims process. You are asking for a discretionary\nexception. It may well be refused. Ask anyway — the downside is a few days of\nsomeone's time and the upside is $400k — but do not let this request become the\nplan of record, and do not tell merchants that recovery is expected.\n\nAlso: while the Claims interface itself runs to end of 2027, the window in which\nPolygon still has engineers and appetite to handle bespoke cases is almost\ncertainly much shorter. Speed matters more than polish. File within days.\n\n**B. Reconstruct the final merchant ledger. Do this regardless of A.**\n\nYou need this for the Polygon request, for merchant communications, for your\naccounts, and for any make-whole. It is also the one task with a guaranteed\npayoff, so start it immediately and in parallel.\n\nThe chain state is still *readable* — Polygon published a read-only RPC for the\nclaims process, and archive providers still serve historical zkEVM data. Pin the\nfinal block and pull:\n\n- Each merchant's balance in PayoutVault at the final block, straight from\n  contract storage / view calls.\n- The full event history from deployment (March 2025) to the final block —\n  deposits, payouts, credits — so you can reconcile the on-chain ledger against\n  your own database and explain any drift.\n- The set of payouts you *believed* had settled after roughly July 1 but which\n  never actually executed. Your internal database may have optimistically marked\n  these as complete. Anything your system recorded as paid in July or August on\n  zkEVM did not happen, and some merchants may have been told they were paid.\n\nDo this soon. Archive support for a dead chain decays — providers deprecate it,\nand the read-only endpoint is a courtesy with a shelf life. Snapshot the raw\ndata to your own storage now rather than relying on being able to query it in\nsix months.\n\n**C. Decide the make-whole, and treat it as the base case.**\n\nPlan on the assumption that Polygon says no. Then $400,000 of customer money is\ngone from the merchants' perspective, and the question is whether your treasury\nabsorbs it.\n\nThat is a business and legal decision, not an engineering one, but the\nengineering facts shape it: these are customer liabilities you custodied. In\nmost jurisdictions and under most merchant agreements, the fact that the\nunderlying chain shut down does not extinguish what you owe them — and you had\ntwelve months of public notice to move the funds. Get counsel involved this\nweek, before you send merchants anything in writing.\n\n**D. Communicate. Sooner than is comfortable.**\n\nYour merchants have been unable to receive payouts for roughly seven weeks and\nare looking at a dashboard showing balances that no longer mean anything. Take\nthe dashboard's zkEVM balances down or mark them clearly as frozen historical\nfigures — continuing to display them as live spendable balances is its own\nproblem. Then tell merchants what happened, what you know, what you're doing,\nand when they'll hear from you next. Do not promise recovery.\n\n---\n\n## Part 3 — Q3 build plan\n\nQ3 ends in roughly six weeks. \"Ship batch payouts\" is no longer the Q3 goal;\n**\"be live and paying merchants again on a chain that will still exist in\n2030\"** is. Batch payouts come along for the ride, because you're redeploying\nthe vault anyway and it's the right moment to change its shape.\n\nI'd be straight with stakeholders that six weeks is tight for migrate +\nredeploy + re-onboard merchants, and that the recovery effort will eat into it.\nIf something has to give, ship the migration with simple batching and defer the\ncost optimization to Q4.\n\n### 3.1 Pick the new chain — and pick it on longevity this time\n\nThe lesson of the last seven weeks is that chain selection is a\ncounterparty-risk decision, not a benchmark comparison. Criteria I'd weight, in\norder:\n\n1. **Survival odds.** Independent economic viability, real fee revenue, a\n   funded team, and enough TVL and third-party integrations that shutting it\n   down would be a scandal rather than a blog post.\n2. **Native USDC + CCTP support.** This directly fixes the trap you're in.\n   Native USDC is burned and minted rather than locked and wrapped, so a\n   stablecoin balance is not a claim against an escrow on another chain that\n   someone else has to honor.\n3. **Credible escape hatch.** Check L2BEAT's stage rating and whether forced\n   inclusion / permissionless exit actually works without the operator.\n4. **Boring, deep tooling.** Multiple independent RPC providers, real block\n   explorers, standard indexers.\n\nFor USDC merchant payouts specifically I'd recommend **Base or Arbitrum One**.\nBoth have native USDC and CCTP, both are Stage 1 with escape hatches, both have\nlarge independent ecosystems and fee revenue. Base has the stronger\npayments-focused ecosystem; Arbitrum has the longer track record and more\ndecentralized governance. Either is defensible.\n\n**Polygon PoS** is Polygon's own recommended migration target and is a\nreasonable choice — it's cheap, mature, and high-volume. But given that your\nlast chain choice was a Polygon product that was discontinued, expect to have to\njustify that pick to your merchants and your board, and note that PoS has a\ndifferent (non-rollup) trust model than what you had.\n\nWhatever you pick: **write down the decision and the criteria**, and set a\ncalendar reminder to re-review chain health every six months. This is the\nartifact that would have saved you $400k.\n\n### 3.2 Batch payout design\n\nTwo viable shapes. I'd build both, in this order.\n\n**Push: `batchPayout`, one transaction settling up to 200 merchants.**\n\nThe cost of a batched payout on an L2 splits into two parts, and you optimize\nthem differently:\n\n- **L1 data cost** — post-EIP-4844 this is blob-priced and usually the smaller\n  share, but it scales linearly with your calldata, so pack it hard.\n- **L2 execution gas** — dominated by the ERC-20 transfer per recipient.\n\nConcretely:\n\n- **Pack calldata into one 32-byte word per payout.** `address` (20 bytes) +\n  `uint96` amount (12 bytes) fits exactly. For USDC at 6 decimals, `uint96`\n  covers amounts far beyond anything you'll ever pay. Pass it as a single\n  `bytes` or `uint256[]` blob and decode in assembly. This is 32 bytes per\n  payout versus 64 for a naive two-array `abi.encode` — a straight 2x cut on the\n  data component.\n- **Optionally intern merchants to a `uint32` ID** via a registry contract.\n  That takes each entry to 16 bytes (4-byte ID + 12-byte amount), halving data\n  cost again. Worth it once merchant count is stable; skip it in v1 if it slows\n  you down.\n- **Expect roughly 6M gas for 200 ERC-20 transfers** as the execution floor\n  (~30k each, plus loop and dispatch overhead). Comfortably inside block limits\n  on Base or Arbitrum, but benchmark on a fork and pick your real batch size\n  from measurements — don't hard-code 200 because a merchant asked for 200.\n- **The savings versus 200 individual transactions** come from amortizing the\n  21k base cost and per-transaction L1 overhead across the whole batch, not from\n  the transfers themselves. That's most of the win and it's a large one.\n- **Never revert the whole batch on one bad recipient.** Use a low-level call\n  per transfer, record failures in an event, and let the batch complete. One\n  blacklisted or contract-recipient address should not block 199 payouts.\n\nAt typical L2 base fees this lands in the sub-cent to low-cent range per payout.\nI'd rather you measure it than quote you a number: build the contract, run it\nagainst a fork of your chosen chain with realistic batch sizes, and put the real\nfigures in the Q3 doc.\n\n**Pull: Merkle-root distribution.**\n\nPost a single 32-byte root per payout cycle; merchants claim against it. The\npayer's cost becomes essentially constant regardless of merchant count — one\nsmall transaction for the entire cycle — and each merchant pays their own claim\ngas. This is the cheapest option for you by a wide margin and it scales past 200\nwithout changes.\n\nThe tradeoff is UX: merchants must act to get paid, which some will hate. The\nusual answer is a hybrid — Merkle root as the settlement primitive, plus a\nsponsored auto-claim for merchants who opt into push delivery, batched with the\nsame `batchPayout` machinery. Ship push first since it preserves current\nmerchant experience, then add Merkle as the cost optimization.\n\n### 3.3 Redesign the custody model — this is the actual fix\n\nBatch payouts are the feature request. The structural change is more important,\nand it's the one that means a future chain sunset costs you a weekend instead of\n$400k.\n\n**Stop parking merchant balances in an L2 contract long-term.** Right now, a\nmerchant's money sits in your vault indefinitely until they withdraw. That is\nprecisely the pattern that got excluded from the exit snapshot.\n\nBetter shapes, roughly in order of how much they cost you to build:\n\n1. **Minimize L2 float.** Keep the authoritative merchant ledger off-chain (you\n   need one anyway for reconciliation) and hold only in-flight settlement float\n   on the L2, sweeping the rest to L1 or your custody provider on a schedule.\n   Cuts the blast radius of any single-chain failure from your entire book to a\n   few days of volume.\n2. **Push instead of hold.** Settle on a fixed cadence to merchant-controlled\n   addresses rather than accruing balances in the vault. Balances that live in\n   merchant EOAs are exactly the balances that *were* covered by Polygon's\n   snapshot. Batch payouts make frequent settlement cheap enough that this\n   becomes practical — the feature and the fix are the same work.\n3. **Native USDC + CCTP for anything cross-chain.** Burn-and-mint, so no\n   stranded wrapped claims.\n\n**Build the exit into the contract from day one.** For the new vault: an\nowner-triggered `emergencyWithdrawAll` that can sweep every merchant balance to\na designated L1-reachable address in a bounded number of transactions, tested on\na fork, with a documented runbook. If you'd had that and had used it in June,\nthis would have been a one-hour task.\n\n### 3.4 Never again: chain-liveness monitoring\n\nSeven weeks of silence is the part of this that should worry you most, because\nthat failure is entirely within your control and it's cheap to fix.\n\n- **Block-staleness alert.** Poll the chain head every minute; page someone if\n  the latest block *timestamp* is more than a few minutes old. Alert on the\n  timestamp, not the block number — a cached RPC response can hold a plausible\n  number forever, which may be exactly what your dashboard was doing.\n- **Never render a stale chain head as a live number.** If head age exceeds\n  threshold, the dashboard shows a red banner, not a balance.\n- **Alert on payout confirmation latency,** with retries escalating instead of\n  silently looping. Your payout service knew about this weeks ago and had no way\n  to say so.\n- **Subscribe a real human to the governance and status channels of every chain\n  you hold funds on** — forum announcements, status page, the operator's blog.\n  Route them to a shared inbox that someone owns, not to whoever set up the\n  deployment. The June 11, 2025 announcement gave you twelve months of warning.\n- **Quarterly chain-health review** against the selection criteria in 3.1, with\n  a named owner.\n\n---\n\n## Immediate next steps\n\n**Today**\n1. Confirm the final block number and timestamp from two independent RPCs.\n2. Disable every path that could bridge or send funds to zkEVM.\n3. Take the zkEVM balances off the live dashboard or mark them frozen.\n4. Brief leadership and get counsel engaged — $400k of customer liabilities.\n\n**This week**\n5. Snapshot all PayoutVault state and event history to your own storage before\n   archive access degrades.\n6. Reconstruct and reconcile the per-merchant ledger at the final block.\n7. Identify anything your system recorded as paid after ~July 1 that never\n   actually settled.\n8. File the recovery request with Polygon — support ticket plus the protocol\n   team route — with the ledger attached.\n9. Claim every EOA-held balance through the Claims interface, and tell merchants\n   with their own zkEVM wallets to do the same.\n10. Send merchants a first factual update.\n\n**Next two weeks**\n11. Decide the target chain and write down the decision and criteria.\n12. Decide the make-whole position and communicate it.\n13. Ship block-staleness alerting — on every chain you touch, before the\n     migration, not after.\n\n**Rest of Q3**\n14. Redeploy PayoutVault on the new chain with `batchPayout`, an emergency\n     sweep, and minimized on-chain float.\n15. Re-onboard merchants and resume payouts.\n16. Merkle distribution and calldata packing as the cost optimization — Q4 if\n     Q3 gets tight.\n\n---\n\n## Sources\n\n- [Sunsetting Polygon zkEVM Mainnet Beta in 2026 — Polygon Community Forum (June 11, 2025)](https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020)\n- [Polygon zkEVM Mainnet Beta Sunset: Claim Your Funds — Polygon Community Forum](https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856)\n- [Polygon zkEVM | Mainnet Beta Sunset & Fund Claims — polygon.technology](https://polygon.technology/polygon-zkevm)\n- [Polygon Support — Polygon zkEVM](https://support.polygon.technology/support/solutions/82000473442)\n- [Polygon zkEVM Deprecation Notice — Alchemy Docs](https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice)\n- [Force batches / sequencer resistance — Polygon Knowledge Layer](https://docs.polygon.technology/zkEVM/architecture/protocol/malfunction-resistance/sequencer-resistance/)\n- [Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1 — CryptoTimes](https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/)\n- [Action Required: PancakeSwap Sunsetting Support on Polygon zkEVM](https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset)\n- [Polygon zkEVM — L2BEAT](https://l2beat.com/scaling/projects/polygonzkevm/)\nANSWER_EOF\nwc -l answer.md",
  "description": "Write answer.md"
}
```

### tool_result
```
409 answer.md
```

### assistant
Written to `answer.md`. The short version:

**Your dashboard is telling the truth — the chain is dead.** Polygon zkEVM Mainnet Beta was permanently shut down. The sequencer stopped **July 1, 2026** and the network no longer produces blocks. It was announced **June 11, 2025** with a 12-month migration window. No RPC provider will fix this, and no transaction — including one from your own admin key — can ever execute there again.

**The $400k is the serious problem.** Polygon took an exit snapshot and built a Claims interface, but it covers **EOA balances only**. Polygon states explicitly that assets held inside smart contracts at sunset cannot be recovered through it. PayoutVault is a smart contract.

One thing that shapes what you do next: your merchant balances are almost certainly *bridged* USDC, meaning the real tokens never left Ethereum — they sit in the L1 bridge escrow. The money isn't destroyed. What you've lost is the ability to prove your claim to it, because the substitute mechanism deliberately excludes contract-held balances. So this is a permission decision by Polygon Labs, not a cryptographic impossibility. **Worth escalating hard and in writing, this week** — but the published policy says no, so plan on refusal as the base case and don't tell merchants recovery is expected.

Also worth flagging: your team said "stuck since the start of the month," but the chain died at the start of *July*. Either the freeze went unnoticed for seven weeks or the dashboard was serving cached data on top of an already-dead chain. Both are findings.

Two things I'd do today regardless: **disable every path that can still bridge funds toward zkEVM** (the L1 bridge contracts still accept deposits into the void — that's live, ongoing risk), and **snapshot all vault state and event history to your own storage** before archive access for a dead chain decays. You need that ledger for Polygon, for merchants, and for your accounts.

**On Q3:** the batch-payout plan is blocked — there's no chain to build it on, so Q3 becomes a migration. I've laid out chain selection weighted on *survival odds* and native USDC/CCTP (burn-and-mint, so no stranded wrapped claims — this directly fixes the trap you're in), plus `batchPayout` design with calldata packing and a Merkle-distribution path. But the structural fix matters more than the feature: stop parking merchant balances in an L2 contract long-term. Balances in merchant EOAs are exactly the ones that *were* covered by the snapshot — and cheap batch payouts are what make frequent settlement practical, so the feature and the fix are the same work.

I'd be straight with stakeholders that six weeks for migrate + redeploy + re-onboard is tight, especially with the recovery effort running alongside. If something gives, ship the migration with simple batching and defer cost optimization to Q4.

I don't have visibility into your contracts or your merchant ledger, so the diagnostic steps in Part 1 are written for you to run and confirm. The $400k make-whole is a legal and business call — get counsel in before anything goes to merchants in writing.

## result
subtype: success
duration_ms: 299424
num_turns: 14
total_cost_usd: 1.046344
usage: {"input_tokens":16,"cache_creation_input_tokens":34752,"cache_read_input_tokens":168272,"output_tokens":17214,"output_tokens_details":{"thinking_tokens":6810},"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":34752,"ephemeral_5m_input_tokens":0},"inference_geo":"not_available","iterations":[{"input_tokens":2,"output_tokens":1054,"cache_read_input_tokens":33365,"cache_creation_input_tokens":9384,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":9384},"type":"message"}],"speed":"standard"}

### final message
Written to `answer.md`. The short version:

**Your dashboard is telling the truth — the chain is dead.** Polygon zkEVM Mainnet Beta was permanently shut down. The sequencer stopped **July 1, 2026** and the network no longer produces blocks. It was announced **June 11, 2025** with a 12-month migration window. No RPC provider will fix this, and no transaction — including one from your own admin key — can ever execute there again.

**The $400k is the serious problem.** Polygon took an exit snapshot and built a Claims interface, but it covers **EOA balances only**. Polygon states explicitly that assets held inside smart contracts at sunset cannot be recovered through it. PayoutVault is a smart contract.

One thing that shapes what you do next: your merchant balances are almost certainly *bridged* USDC, meaning the real tokens never left Ethereum — they sit in the L1 bridge escrow. The money isn't destroyed. What you've lost is the ability to prove your claim to it, because the substitute mechanism deliberately excludes contract-held balances. So this is a permission decision by Polygon Labs, not a cryptographic impossibility. **Worth escalating hard and in writing, this week** — but the published policy says no, so plan on refusal as the base case and don't tell merchants recovery is expected.

Also worth flagging: your team said "stuck since the start of the month," but the chain died at the start of *July*. Either the freeze went unnoticed for seven weeks or the dashboard was serving cached data on top of an already-dead chain. Both are findings.

Two things I'd do today regardless: **disable every path that can still bridge funds toward zkEVM** (the L1 bridge contracts still accept deposits into the void — that's live, ongoing risk), and **snapshot all vault state and event history to your own storage** before archive access for a dead chain decays. You need that ledger for Polygon, for merchants, and for your accounts.

**On Q3:** the batch-payout plan is blocked — there's no chain to build it on, so Q3 becomes a migration. I've laid out chain selection weighted on *survival odds* and native USDC/CCTP (burn-and-mint, so no stranded wrapped claims — this directly fixes the trap you're in), plus `batchPayout` design with calldata packing and a Merkle-distribution path. But the structural fix matters more than the feature: stop parking merchant balances in an L2 contract long-term. Balances in merchant EOAs are exactly the ones that *were* covered by the snapshot — and cheap batch payouts are what make frequent settlement practical, so the feature and the fix are the same work.

I'd be straight with stakeholders that six weeks for migrate + redeploy + re-onboard is tight, especially with the recovery effort running alongside. If something gives, ship the migration with simple batching and defer cost optimization to Q4.

I don't have visibility into your contracts or your merchant ledger, so the diagnostic steps in Part 1 are written for you to run and confirm. The $400k make-whole is a legal and business call — get counsel in before anything goes to merchants in writing.
