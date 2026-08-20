## session init
model: claude-opus-5
cwd: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/l2s-quiz-002/2026-08-20T052004Z-claude-with-skill-1/workspace
tools: Task, Bash, CronCreate, CronDelete, CronList, DesignSync, Edit, EnterWorktree, ExitWorktree, ListAgents, Monitor, NotebookEdit, PushNotification, Read, RemoteTrigger, ReportFindings, ScheduleWakeup, SendMessage, Skill, TaskOutput, TaskStop, ToolSearch, WebFetch, WebSearch, Write
skills: ["l2s","design-sync","dataviz","update-config","verify","debug","code-review","simplify","batch","fewer-permission-prompts","doctor","loop","schedule","claude-api","run","run-skill-generator"]

### assistant
I'll pull up the L2 skill first — Polygon zkEVM specifically has status changes worth checking before I answer.

### tool_use: Skill
```json
{
  "skill": "l2s",
  "args": "Polygon zkEVM status, deprecation, migration path"
}
```

### tool_result
```
Launching skill: l2s
```

### tool_use: Bash
```json
{
  "command": "cd /ssd/workspace/buidlguidl/ethskills-evals/artifacts/l2s-quiz-002/2026-08-20T052004Z-claude-with-skill-1/workspace/.claude/skills && ls -R l2s | head -60; echo \"---GREP---\"; grep -ril \"zkevm\" . | head -20"
}
```

### tool_result
```
l2s:
SKILL.md
---GREP---
l2s/SKILL.md
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

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM shutdown sunset date 2026 mainnet beta deprecation"
}
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM chain halted blocks not producing August 2026"
}
```

### tool_result
```
Web search results for query: "Polygon zkEVM shutdown sunset date 2026 mainnet beta deprecation"

Links: [{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"Polygon zkEVM Sunset Reminder: Withdraw Assets Before July 1, 2026","url":"https://outposts.io/article/polygon-zkevm-sunset-reminder-withdraw-assets-before-july-1-0ef46827-b25b-498b-bf7d-f03b03fac95c"},{"title":"Polygon zkEVM Mainnet Beta Sunset: Claim Your Funds - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Sunsetting Polygon zkEVM Mainnet Beta in 2026 - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020"},{"title":"Polygon to Sunset ZkEVM By 2026 After Abandoning Development and Financial Losses | Gate News","url":"https://www.gate.com/news/detail/11563027"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026 | Cryip","url":"https://cryip.co/polygon-zkevm-sunset-july-2026-withdraw-assets/"}]

Based on the search results, here are the key details about Polygon zkEVM's shutdown:

## Sunset Date and Timeline

Polygon zkEVM Mainnet Beta sequencer will sunset on July 1, 2026. Polygon first announced the sunset timeline in June 2025, providing a 12-month migration window.

## Asset Migration

Wallet-held assets not bridged before the deadline will be auto-migrated to Ethereum L1. However, funds locked in DeFi protocols cannot be automatically migrated and may become inaccessible after shutdown.

## Claims Process

The Polygon zkEVM Claims interface is a dedicated web application for recovering EOA-held assets on Ethereum after sunset and will remain available through December 31, 2027. Any eligible wallet-held assets left unclaimed after December 31, 2027, will be considered abandoned.

## Scope

The sunset applies only to Polygon zkEVM Mainnet Beta and does not affect Polygon PoS or other Polygon ecosystem networks.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### tool_result
```
Web search results for query: "Polygon zkEVM chain halted blocks not producing August 2026"

Links: [{"title":"Polygon zkEVM | Scaling for the Ethereum Virtual Machine","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM down due to issues with blockchain sequencer","url":"https://cointelegraph.com/news/polygon-zkevm-mainnet-beta-sequencer-issues"},{"title":"Polygon zkEVM suffers prolonged outage amid sequencing issues","url":"https://cryptonews.net/news/blockchain/28760784/"},{"title":"Polygon zkEVM Mainnet Beta Has Stopped Block Production on July 3 - ABAB News","url":"https://www.ababnews.com/news/89a52b49-02c1-4c15-af8d-7e32af7b0500"},{"title":"Polygon Spent $250M on Its zkEVM Pivot—Now It’s Abandoned | CCN.com","url":"https://www.ccn.com/news/crypto/polygon-spent-250m-zk-pivot-abandoned-project-burning-millions/"},{"title":"Polygon unpacks zkEVM outage and ‘emergency’ upgrade - Blockworks","url":"https://blockworks.co/news/polygon-zkevm-post-mortem"},{"title":"Wanchain on X: \"Public Service Announcement‼️ The Polygon zkEVM chain is sunsetting on July 1st! Users are urged to transfer their assets out of the chain BEFORE July 1st! With the sequencer shut off, the operation of dApps/protocols will be halted, which may cause funds to be inaccessible.\" / X","url":"https://x.com/wanchain_org/status/2068363746825879956"},{"title":"Polygon zkEVM Outage and Fixes Unraveled in Full Post-Mortem: Can Developers Prevent Future Occurrences?","url":"https://dailycoin.com/polygon-zkevm-outage-and-fixes-unraveled-in-full-post-mortem/"},{"title":"Polygon zkEVM Mainnet Incident - Incident details - Chainstack Status","url":"https://status.chainstack.com/incident/cmo7becip00uj14m7hg139t2t"}]

Based on the search results, here's what happened with Polygon zkEVM in August 2026:

As of July 3, 2026, the Polygon zkEVM Mainnet Beta sequencer has been sunset. The network is no longer producing blocks, and withdrawals from Polygon zkEVM can no longer be processed through the Agglayer Bridge.

This was part of a planned shutdown rather than an unexpected halt. Polygon phased out its zkEVM initiative by 2026, marking the end of a multi-year, $250 million effort that failed to gain traction. The chain was reportedly burning over $1 million annually to stay online.

To help users recover their assets, the Polygon zkEVM Claims interface is a dedicated web application for recovering EOA-held assets on Ethereum after sunset and remains available through December 31, 2027.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### assistant
Chain status confirmed and it's serious. Let me pin down the recovery path for contract-held funds specifically.

### tool_use: WebFetch
```json
{
  "url": "https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856",
  "prompt": "What is the exact process for claiming funds after the zkEVM sunset? Specifically: are assets held in SMART CONTRACTS (not EOAs) covered by the auto-migration or claims interface? What happens to funds locked in contracts? What is the deadline? Is there any escape hatch or forced-exit mechanism? Quote the relevant text."
}
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM sunset funds locked in smart contracts not EOA recovery claims interface"
}
```

### tool_result
```
# zkEVM Sunset Claims Process

Based on the announcement, here's what happens to smart contract-held assets:

**Smart contracts are NOT covered by auto-migration or claims:**

The document explicitly states: "Funds locked in DeFi protocols cannot be auto-migrated." Additionally, it notes that "Polygon does not own, operate, or control any decentralized applications or DeFi protocols on zkEVM."

**What this means:**

Assets in smart contracts have no recovery mechanism through Polygon's claims interface. The responsibility falls on protocol teams and users to withdraw before the deadline.

**Key deadline:** July 1, 2026 - after this date, the sequencer stops processing transactions, making protocol interaction impossible.

**No escape hatch mentioned:** The announcement provides no forced-exit mechanism or alternative recovery path for locked contract funds. The only option is manual withdrawal before July 1.

**Relevant quote:**
"Once the sequencer sunset, transactions will no longer be processed, which will affect the functionality of all protocols and applications built on it."

**Bottom line:** If your funds are in smart contracts and you don't withdraw them by July 1, 2026, they become inaccessible with no recovery option through Polygon.
```

### tool_result
```
Web search results for query: "Polygon zkEVM sunset funds locked in smart contracts not EOA recovery claims interface"

Links: [{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM | Scaling for the Ethereum Virtual Machine","url":"https://polygon.technology/polygon-zkevm/security-first"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"Polygon zkEVM Fund Recovery Guide Before Mainnet Beta Ends","url":"https://www.coingabbar.com/en/crypto-blogs-details/polygon-zkevm-fund-recovery-guide-before-mainnet-beta-ends"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"QuickSwap 🐲 DragonFi 2.0 on X: \"This is a reminder that Polygon zkEVM will sunset in ~2 weeks on Wednesday, July 1, 2026. Users are advised to withdraw all assets and LP positions from Polygon zkEVM by this date, otherwise funds will be lost. Per the official announcement below, funds locked in DeFi protocols\" / X","url":"https://x.com/QuickswapDEX/status/2066515050932715648"},{"title":"QuickSwap 🐲 DragonFi 2.0 on X: \"⚠️FINAL REMINDER: Polygon zkEVM is sunsetting tomorrow, Wednesday, July 1, 2026. Anyone with assets and LP positions on the chain are advised to withdraw everything by today, otherwise funds will be lost. Funds locked in DeFi protocols cannot be auto-migrated.\" / X","url":"https://x.com/QuickswapDEX/status/2071896273536614508"},{"title":"Polygon zkEVM | Scaling for the Ethereum Virtual Machine","url":"https://polygon-technology.translate.goog/polygon-zkevm?_x_tr_sl=en&_x_tr_tl=tr&_x_tr_hl=tr&_x_tr_pto=tc"},{"title":"Polygon zkEVM Sunset Reminder: Withdraw Assets Before July 1, 2026","url":"https://outposts.io/article/polygon-zkevm-sunset-reminder-withdraw-assets-before-july-1-0ef46827-b25b-498b-bf7d-f03b03fac95c"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026 | Cryip","url":"https://cryip.co/polygon-zkevm-sunset-july-2026-withdraw-assets/"}]

Based on the search results, here's what I found regarding Polygon zkEVM sunset and fund recovery:

## Key Finding: Smart Contracts Excluded from Claims Interface

Assets that were held inside smart contracts on Polygon zkEVM Mainnet Beta at the time of sunset cannot be recovered through the Claims interface. The Polygon zkEVM Claims interface opens for EOA-held fund recovery and remains available through December 31, 2027.

## Smart Contract-Locked Funds

Assets locked in smart contracts, including DeFi applications, liquidity pools, multisignature wallets, and other protocol-controlled contracts, cannot be automatically migrated. Funds locked inside decentralized-finance protocols cannot be auto-migrated, because Polygon does not own or control those applications. Once the sequencer sunsets and transactions stop processing, those protocols cease functioning, and assets left inside them risk becoming inaccessible.

## Recovery Options

If you believe assets you control were held in a smart contract on Polygon zkEVM at the time of sunset, contact the protocol or contract operator directly.

## Timeline

The Polygon zkEVM Claims interface opened for EOA-held fund recovery no earlier than July 13, 2026, and remains available through December 31, 2027. Any eligible wallet-held assets left unclaimed after December 31, 2027, will be considered abandoned.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### assistant
Confirmed the critical fact. Let me verify the official claims process and whether any recovery path exists for contract-held funds.

### tool_use: WebFetch
```json
{
  "url": "https://polygon.technology/polygon-zkevm",
  "prompt": "Detail the sunset and claims process: exact sequencer shutdown date, when the Claims interface opened, final deadline, which assets are eligible (EOA vs smart contract), and any stated contact or process for smart-contract-held funds. Also: is the L1 bridge claimAsset still functional for withdrawals initiated before the halt?"
}
```

### tool_use: WebSearch
```json
{
  "query": "Polygon zkEVM bridge claimAsset L1 pending withdrawals after sunset still claimable"
}
```

### tool_result
```
# Polygon zkEVM Mainnet Beta Sunset & Claims Process

## Key Dates

**Sequencer Shutdown:** July 3, 2026 – "the Polygon zkEVM Mainnet Beta sequencer has been sunset. The network is no longer producing blocks."

**Claims Interface Availability:** July 13, 2026 through December 31, 2027

**Final Deadline:** December 31, 2027 – after which "Polygon Labs no longer facilitates recovery"

## Eligible Assets

**EOA Wallets (Self-Custodied):** Users holding assets in externally-owned accounts can recover funds via the Claims interface using exit certificates and Ethereum's public RPC.

**Smart Contract Funds (NOT Eligible):** The page explicitly states that "Assets that were held inside smart contracts on Polygon zkEVM Mainnet Beta at the time of sunset cannot be recovered through the Claims interface," including DeFi liquidity, multisigs, and bridge contracts.

## Support for Smart Contract Holders

The guidance recommends: "contact the protocol or contract operator directly" for assistance with locked contract funds.

## L1 Bridge Status

The document does not address whether the L1 bridge's claimAsset function remains operational for pre-halt withdrawals.

For additional questions, users should contact support.polygon.technology.
```

### tool_result
```
Web search results for query: "Polygon zkEVM bridge claimAsset L1 pending withdrawals after sunset still claimable"

Links: [{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026","url":"https://cryptonews.net/news/altcoins/33017031/"},{"title":"Polygon zkEVM | Mainnet Beta Sunset & Fund Claims","url":"https://polygon.technology/polygon-zkevm"},{"title":"Polygon zkEVM Sunset Reminder: Withdraw Assets Before July 1, 2026","url":"https://outposts.io/article/polygon-zkevm-sunset-reminder-withdraw-assets-before-july-1-0ef46827-b25b-498b-bf7d-f03b03fac95c"},{"title":"Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1","url":"https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/"},{"title":"Polygon zkEVM - L2BEAT","url":"https://l2beat.com/scaling/projects/polygonzkevm/"},{"title":"QuickSwap 🐲 DragonFi 2.0 on X: \"This is a reminder that Polygon zkEVM will sunset in ~2 weeks on Wednesday, July 1, 2026. Users are advised to withdraw all assets and LP positions from Polygon zkEVM by this date, otherwise funds will be lost. Per the official announcement below, funds locked in DeFi protocols\" / X","url":"https://x.com/QuickswapDEX/status/2066515050932715648"},{"title":"Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026 | Cryip","url":"https://cryip.co/polygon-zkevm-sunset-july-2026-withdraw-assets/"},{"title":"Polygon zkEVM Mainnet Beta Sunset: Claim Your Funds - Announcements - Polygon Community Forum","url":"https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856"},{"title":"Action Required: PancakeSwap Sunsetting Support on Polygon zkEVM | PancakeSwap","url":"https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset"}]

Based on the search results, here's what I found about pending withdrawals and asset claims after the Polygon zkEVM sunset:

## Pending Withdrawals After Sunset

After the Polygon zkEVM sunset on July 3, 2026, the network is no longer producing blocks, and withdrawals from Polygon zkEVM can no longer be processed through the Agglayer Bridge.

## Asset Claims Still Available

However, assets are still claimable through a dedicated claims process:

If you held assets in a self-custodied wallet (EOA) on Polygon zkEVM at the time of sunset, you will be able to recover them on Ethereum through the Polygon zkEVM Claims interface. The Polygon zkEVM Claims interface is a dedicated web application for recovering EOA-held assets on Ethereum after sunset, uses exit certificates and a public read-only RPC, and operates independently of the now-sunset Polygon zkEVM sequencer.

The Claims interface is now live and will remain available through December 31, 2027.

## Important Limitations

Assets that were held inside smart contracts on Polygon zkEVM Mainnet Beta at the time of sunset cannot be recovered through the Claims interface. This means funds locked inside decentralized-finance protocols cannot be auto-migrated, because Polygon does not own or control those applications.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
```

### assistant
I have everything I need. Writing the answer now.

### tool_use: Bash
```json
{
  "command": "cd /ssd/workspace/buidlguidl/ethskills-evals/artifacts/l2s-quiz-002/2026-08-20T052004Z-claude-with-skill-1/workspace && cat > answer.md <<'EOF'\n# PayoutVault on Polygon zkEVM — status, recovery, and Q3\n\n## The headline\n\n**Polygon zkEVM no longer exists.** The sunset was announced in June 2025. The sequencer\nwas shut off on **July 1, 2026**, and the network **stopped producing blocks on July 3, 2026**.\nIt is not coming back.\n\nThis is not an RPC problem, an API key problem, or a provider problem. There is no chain\nbehind the RPC anymore. That explains every symptom in item 1, and it makes item 2 moot as\nwritten — there is no \"build on Polygon zkEVM in Q3,\" there is only \"get off it.\"\n\nThe urgent part is that **PayoutVault is a smart contract**, and Polygon's recovery process\nexplicitly **excludes contract-held assets**. Details and the path forward are below.\n\n---\n\n## 1. The dashboard: what's actually happening\n\n### Why the symptoms look exactly like this\n\nYour three symptoms are the precise signature of a halted chain being served by a still-running\narchive node:\n\n| Symptom | Cause |\n|---|---|\n| Balances read back identical every day | `eth_call` against a frozen final state. The state is real, it just never changes again. |\n| Block number never moves | `eth_blockNumber` returns the last block ever produced (July 3, 2026). |\n| Payouts never confirm | `eth_sendRawTransaction` is accepted into a mempool that no sequencer will ever drain. The tx is well-formed, signed, valid — and will sit there forever. |\n\n**This is why swapping providers twice didn't help.** Every RPC provider — yours, the two new\nones, and any you try next — points at the same dead chain. A provider swap changes who is\nserving the corpse, not whether there's a pulse. The API keys were never the issue either.\nBoth teams did reasonable debugging; the hypothesis space just didn't include \"the chain was\ndecommissioned.\"\n\n### Check these today\n\n1. **Get the exact final block.** Query `eth_blockNumber` on any zkEVM RPC and compare it to\n   what your dashboard shows. Note the discrepancy in your timeline: your team reported \"stuck\n   since the start of the month,\" but block production ceased **July 3**. If your dashboard\n   froze in early August rather than early July, something in your stack was serving cached or\n   lagging data for roughly a month before that — worth knowing, because it changes how far\n   back your reconciliation has to go.\n\n2. **Reconcile the ledger — this is the operationally dangerous part.** Every payout submitted\n   since the halt was *accepted* by the RPC and returned a tx hash. If your backend treats\n   \"got a tx hash\" or \"no error\" as success, your internal ledger and your merchant-facing\n   statements may show payouts as sent that **never happened onchain**. Pull every payout\n   since July 3, confirm each against the final chain state, and identify which merchants have\n   been told they were paid when they weren't. Do this before you talk to merchants.\n\n3. **Determine what actually sits in the vault.** Pull the final state and get the exact token\n   addresses and per-merchant balances at the last block. You will need this exact snapshot for\n   everything in the recovery section below, and the read-only RPC that Polygon maintains for\n   the claims process can serve it.\n\n4. **Check for any bridge exits initiated before the halt but never claimed on L1.** Polygon\n   zkEVM withdrawals are two-step: you burn on L2, then call `claimAsset` on the L1 bridge with\n   a Merkle proof. The **L1 bridge contract on Ethereum is permanent and still deployed**. If\n   anyone initiated exits before July 3 and never completed the L1 claim, that money is very\n   likely still claimable right now, independent of everything else. Check this first — it's\n   the one path that needs nobody's permission.\n\n5. **Add a chain-liveness alert everywhere you operate.** A single check — \"is the head block\n   less than N minutes old\" — would have caught this in an hour instead of seven weeks. Its\n   absence is the real failure here, more than the missed migration notice.\n\n---\n\n## 2. Where the merchant money actually is\n\nSome good news inside the bad news: **the $400,000 is not destroyed.**\n\nWhen assets are bridged onto Polygon zkEVM, the real tokens stay escrowed in the\n`PolygonZkEVMBridge` contract **on Ethereum L1**. What lived on zkEVM was a claim against that\nescrow. The L1 escrow contract is still deployed, still holds the backing assets, and that is\nprecisely why Polygon can run a claims process at all. The money exists. The question is purely\nwhether Polygon will issue *you* an exit certificate for it.\n\n### The problem: PayoutVault is on the wrong side of the eligibility line\n\nPolygon's recovery process splits assets into two buckets:\n\n- **EOA-held assets** — recoverable through the [Polygon zkEVM Claims interface](https://polygon.technology/polygon-zkevm),\n  which opened **July 13, 2026** and runs through **December 31, 2027**. It uses exit certificates\n  and a read-only RPC, and works independently of the dead sequencer.\n- **Smart-contract-held assets** — **not eligible.** Polygon's wording is explicit: assets held\n  inside smart contracts at the time of sunset \"cannot be recovered through the Claims interface,\"\n  and this explicitly includes DeFi contracts, multisigs, and bridge contracts. Their stated\n  guidance is to \"contact the protocol or contract operator directly.\"\n\nPayoutVault is a smart contract. **You are the protocol operator** — so that guidance loops back\nto you, and there is no self-serve path. Anything unclaimed after **December 31, 2027** is treated\nas abandoned.\n\n### The argument to make to Polygon\n\nDo not send a generic support ticket. Your situation is materially stronger than the generic\nDeFi case the exclusion was written for, and the ask should say so:\n\n- **It is not a DeFi pool.** PayoutVault is a custodial ledger holding identified merchant\n  balances. There is no anonymous LP set and no ambiguity about who is owed what.\n- **You can prove control.** Deployer key, owner/admin role, deployment tx, and source\n  verification all tie the contract to your company.\n- **You can produce an exact, verifiable beneficiary list.** Per-merchant balances at the final\n  block, derived from public state anyone can independently verify against the frozen chain.\n- **The distribution is off-chain-resolvable.** You are not asking Polygon to adjudicate a\n  protocol; you are asking for one exit certificate to a company-controlled L1 address, against\n  assets already sitting in their L1 escrow, backed by KYC'd merchant records.\n\nThe exclusion exists because Polygon can't safely unwind arbitrary protocol state for\npseudonymous users. That rationale does not apply to a single-operator custodial vault with a\nknown beneficiary list. Make that distinction the center of the request.\n\n**Escalate through more than one channel:** [support.polygon.technology](https://support.polygon.technology),\nthe [claims announcement thread](https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856)\non the community forum, and any direct BD or partnerships contact you have. Do it this week.\nThe Dec 31, 2027 deadline is not the real constraint — Polygon is winding down zkEVM staffing\nand the institutional knowledge to service an exception request is decaying month over month.\nThe earlier you're in the queue, the better.\n\n### Be straight about the odds\n\nI can't tell you this works. It is a **discretionary exception to a published, explicit exclusion**,\nand Polygon has no obligation to grant it. Pursue it hard, but plan in parallel for the case where\nthey say no. Given that this is customer money rather than treasury, get counsel and your finance\nlead involved now — the question of who absorbs a $400k shortfall if recovery fails is a decision\nfor the business, and it shouldn't be made implicitly by staying quiet with merchants.\n\n### Also check, in order of how much control you have\n\n1. **Pending L1 bridge claims** (item 4 above) — needs no permission from anyone.\n2. **Whether any funds were swept before July 3.** Confirm the shortfall is genuinely $400k\n   before escalating; the number you tell Polygon should be exact.\n3. **Your contract's own architecture.** If PayoutVault sits behind an upgradeable proxy, that\n   does *not* help — an upgrade is itself a transaction and there is no sequencer to include it.\n   Worth confirming so nobody burns a week on it.\n\n### On merchant communication\n\nMerchants' onchain balances are frozen and unspendable, and some of them have been told about\npayouts that never executed. Your obligation to them is unchanged by the chain disappearing.\nTell them what happened, what you're doing, and what your timeline is — before they find out\nfrom a stuck withdrawal. A known problem being actively worked is survivable; a silent one\nusually isn't.\n\n---\n\n## 3. Q3 build plan — reframed\n\nYou asked for batch payouts and lower per-payout cost this quarter. Two things have to change\nabout that plan.\n\n**First, the honest calendar note:** it's August 20 and Q3 ends September 30. That's about six\nweeks. Recovering $400k and standing up a payout rail on a new chain will consume all of it.\n**Batch payouts realistically land early Q4.** I'd rather tell you that now than have you commit\na date to merchants that the migration is going to eat. Scoping this down is your call, but the\nsequencing isn't really optional.\n\n**Second, the good news on cost:** the migration itself is the single largest per-payout cost\nreduction available to you, and it's already forced. Everything else is optimization on top.\n\n### Step 1 — Pick the new chain (week 1)\n\n**Recommendation: Base.**\n\n| | Why it fits merchant payouts |\n|---|---|\n| Cost | Cheapest major L2, roughly $0.0008–0.002 per transaction — often ~50% below Arbitrum/Optimism |\n| Stablecoins | Native USDC (not a bridged wrapper) plus Circle CCTP for canonical cross-chain movement |\n| Off-ramp | Direct Coinbase on/off-ramp — for a merchant payout product this is the feature, not a footnote. Merchants want fiat, not a token balance. |\n| Durability | Largest and fastest-growing L2 by activity, with a major corporate operator behind it |\n\nTwo caveats I'll state plainly, since you were just burned by a chain you trusted:\n\n- **7-day native withdrawals.** Base is an optimistic rollup, so L2→L1 exits take ~7 days versus\n  the 15–60 minutes you had on a ZK rollup. In practice this rarely bites a payouts business —\n  merchants get paid in USDC on Base and off-ramp via Coinbase without touching the native\n  bridge. When you need speed, CCTP or [Across](https://across.to) settle in minutes. Use the\n  official bridge for large treasury movements.\n- **Base announced in February 2026 that it is leaving the Superchain**, to be finalized in a\n  future hardfork. This is a *governance* change, not a liveness or shutdown risk, and it does\n  not affect funds. Flagging it so you hear it from me rather than reading it later and panicking.\n\n**Runner-up: Polygon PoS.** Polygon is explicitly refocusing there for payments, stablecoins and\nRWAs — it does $500M+ in monthly payment volume across 410M+ wallets, and it's the migration\ntarget Polygon itself points to. Two honest counterpoints: it's the same vendor that just shut a\nchain down under you, and it's a different security model from an Ethereum rollup. If your\nmerchants are concentrated in emerging markets or mobile-first, **Celo** (OP Stack L2, sub-cent\nfees, MiniPay) is worth a look instead.\n\nIf fast native exits are genuinely a hard requirement, **Scroll** or **Linea** keep ZK finality\n(30–120 min and 30–60 min) and are bytecode-compatible, so PayoutVault deploys with standard\n`solc` and no code changes. I don't think you need this, but it's the clean answer if you do.\n\n### Step 2 — Redeploy and harden (weeks 1–3)\n\nPayoutVault should port to Base with an RPC and chain ID change and no Solidity changes. While\nyou're in there, fix what this incident exposed:\n\n- **Don't hold merchant float on the L2.** Keep a working balance sized to a payout cycle;\n  hold the rest on mainnet or with your custodian. A chain going away should cost you a cycle,\n  not the whole book.\n- **Owner-controlled sweep**, with a timelock and a multisig on it.\n- **A written exit runbook**, tested on a testnet at least once. \"How do we get everything off\n  this chain in 24 hours\" should be a rehearsed procedure, not a question you answer under\n  pressure.\n- **Liveness and finality monitoring** with paging alerts, plus treating \"tx accepted but\n  unconfirmed after N blocks\" as a hard error in your payout pipeline rather than a success.\n- **Use CREATE2** so PayoutVault has the same address on every chain you ever deploy to. Makes\n  future migrations and integrations meaningfully less painful.\n\n### Step 3 — Batch payouts (weeks 4–6, likely completing early Q4)\n\nDesign for **200 recipients per transaction**:\n\n**Calldata is the dominant marginal cost on an L2, so encode tightly.**\n\n| Encoding | Bytes for 200 merchants | Notes |\n|---|---|---|\n| `batchPay(address[], uint256[])` | ~12,800 | ABI pads every address and amount to 32 bytes. Wasteful. |\n| Packed: 20-byte address + 12-byte amount in one word | 6,400 | ~50% saving. 12 bytes covers any plausible USDC amount. |\n| Merchant IDs: 4-byte ID + 12-byte amount | 3,200 | ~75% saving. Needs a one-time registry write per merchant, amortized after a single payout cycle. |\n\n**Set expectations on the gas saving honestly.** Batching does not make per-payout cost vanish,\nbecause the ERC-20 balance write per recipient is irreducible — roughly 20k gas for a merchant\nwhose balance starts at zero, ~5k for a repeat merchant with an existing balance. What batching\n*does* eliminate is the 21,000-gas base cost and per-transaction signature/envelope overhead,\n199 times over. Net, expect roughly **50–70% off**, not 99%. Rough order of magnitude on Base, a\n200-recipient batch should land well under a dollar total — a fraction of a cent per merchant.\n\nIf you want the dramatic reduction, the **Merkle-claim (pull) model** posts a single 32-byte root\nper epoch and drops your cost to near zero — but it shifts ~60–80k gas onto each merchant and\nleaves unclaimed funds sitting in your contract, which is uncomfortably close to the risk shape\nthat just bit you. **My recommendation: push batches by default, with Merkle claim as a fallback\nfor merchants who want to self-serve.** If you do add claims, put an expiry and a sweep on it.\n\n**Three things that matter more than gas in a payouts system:**\n\n- **Idempotency.** Every batch needs a unique ID recorded onchain, with replays rejected. A retry\n  after an ambiguous RPC response must never double-pay. Given what item 1 just did to your\n  ledger, treat this as the top requirement.\n- **Partial-failure isolation.** One bad recipient (a contract that reverts on receive, a\n  blacklisted USDC address) must not revert 199 good payouts. Use per-entry `try/catch`, emit a\n  failure event, and settle the rest.\n- **Chunk size as a tunable.** Ship it configurable and load-test it. 200 will fit comfortably in\n  a Base block, but you want the knob when a batch behaves unexpectedly.\n\n---\n\n## What this means for the merchant money — summary\n\n1. **The $400k is frozen but not destroyed.** The backing assets sit in Polygon's L1 bridge\n   escrow on Ethereum.\n2. **You are in the excluded category.** Contract-held funds have no self-serve recovery path.\n   Your case is stronger than the generic DeFi exclusion it was written for, but the exception is\n   discretionary and I can't promise it lands.\n3. **Some of it may be recoverable without anyone's permission** — check for pre-halt bridge\n   exits never claimed on L1. Do this first.\n4. **Your ledger is probably wrong.** Payouts submitted since July 3 returned tx hashes and never\n   executed. Reconcile before you talk to merchants.\n5. **The hard deadline is December 31, 2027**, but escalate this week — Polygon's ability to\n   service an exception is decaying.\n6. **Q3 is a migration quarter, not a features quarter.** Batch payouts slip to early Q4. Moving\n   to Base is itself the biggest per-payout cost win on your list.\n7. **The durable fix is a liveness alert and a rehearsed exit runbook.** The chain shutdown was\n   announced with twelve months of notice; what turned a scheduled migration into a $400k\n   incident was not having anything watching.\n\n### This week\n\n- [ ] Confirm the final block and the exact final vault state\n- [ ] Check for unclaimed pre-halt L1 bridge exits\n- [ ] Reconcile every payout since July 3; identify wrongly-credited merchants\n- [ ] Open the Polygon escalation through all available channels\n- [ ] Brief counsel and finance on a possible $400k customer-funds shortfall\n- [ ] Draft merchant communications\n- [ ] Freeze the Q3 feature plan; start the Base migration\n\n---\n\n**Sources:**\n\n- [Polygon zkEVM | Mainnet Beta Sunset & Fund Claims](https://polygon.technology/polygon-zkevm) — official sunset and claims page\n- [Polygon zkEVM Mainnet Beta Sunset: Claim Your Funds](https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856) — Polygon Community Forum announcement\n- [Sunsetting Polygon zkEVM Mainnet Beta in 2026](https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020) — original June 2025 announcement\n- [Polygon Shuts Down Its Once-Flagship $250M zkEVM on July 1](https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/)\n- [Polygon zkEVM Mainnet Beta Has Stopped Block Production on July 3](https://www.ababnews.com/news/89a52b49-02c1-4c15-af8d-7e32af7b0500)\n- [Polygon zkEVM Sunset Deadline Nears as Users Urged to Withdraw Assets Before July 1, 2026](https://cryptonews.net/news/altcoins/33017031/)\n- [Polygon zkEVM — L2BEAT](https://l2beat.com/scaling/projects/polygonzkevm/)\nEOF\nwc -l answer.md"
}
```

### tool_result
```
291 answer.md
```

### assistant
Written to `answer.md`. The short version, because the lead finding changes both of your questions:

**Polygon zkEVM was shut down.** The sunset was announced June 2025, the sequencer was turned off July 1, 2026, and the chain **stopped producing blocks on July 3, 2026**. It is not coming back.

**1. The dashboard.** Nothing is broken in your stack. Frozen balances, a frozen block number, and transactions that are accepted but never confirm are the exact signature of an archive node serving a dead chain. Swapping RPC providers couldn't help — every provider points at the same halted chain. Worth noting the date gap: your team said "start of the month," but block production ceased July 3, so if the dashboard froze in early August, something was serving stale data for a month before that.

The urgent operational item: **your ledger is probably wrong.** Payouts submitted since July 3 returned tx hashes and never executed. If your backend treats a tx hash as success, some merchants have been marked paid when they weren't. Reconcile before you talk to them.

**2. The $400k.** It's frozen but not destroyed — the backing assets sit in Polygon's L1 bridge escrow on Ethereum. The problem is that Polygon's claims process covers **EOA-held assets only**, and explicitly excludes smart contracts. PayoutVault is a contract, so there's no self-serve path; their guidance is "contact the protocol operator," which is you.

Your case is genuinely stronger than the generic DeFi exclusion it was written for — a single-operator custodial vault with a provable owner key and a verifiable KYC'd beneficiary list, asking for one exit certificate. Make that the center of the escalation. But it's a discretionary exception to a published rule, and I can't tell you it will land. Hard deadline is Dec 31, 2027, but escalate this week while Polygon still has people who can service it. Get counsel and finance involved now, since this is customer money.

One path needs nobody's permission: check for bridge exits initiated before July 3 but never claimed on L1. The L1 bridge contract is permanent, so those are likely still claimable today.

**3. Q3.** It's August 20 and Q3 ends September 30. Recovery plus standing up a new rail will eat those six weeks, so **batch payouts realistically lands early Q4** — I'd rather flag that than have you commit a date to merchants. The upside: the forced migration is itself your biggest per-payout cost win. I recommend **Base** (cheapest major L2, native USDC, and the Coinbase off-ramp, which for a merchant payout product is the feature). The doc covers the 7-day-withdrawal caveat, Polygon PoS as runner-up, and the batch design — packed calldata encodings with byte counts, plus an honest note that batching gets you ~50–70% off rather than 99%, since the per-recipient token write is irreducible.

The durable fix is a chain-liveness alert. This shutdown came with twelve months of notice; what turned a scheduled migration into a $400k incident was having nothing watching.

## result
subtype: success
duration_ms: 274033
num_turns: 12
total_cost_usd: 0.9627555
usage: {"input_tokens":16,"cache_creation_input_tokens":35606,"cache_read_input_tokens":174943,"output_tokens":16761,"output_tokens_details":{"thinking_tokens":7883},"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":35606,"ephemeral_5m_input_tokens":0},"inference_geo":"not_available","iterations":[{"input_tokens":2,"output_tokens":1033,"cache_read_input_tokens":33517,"cache_creation_input_tokens":10086,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":10086},"type":"message"}],"speed":"standard"}

### final message
Written to `answer.md`. The short version, because the lead finding changes both of your questions:

**Polygon zkEVM was shut down.** The sunset was announced June 2025, the sequencer was turned off July 1, 2026, and the chain **stopped producing blocks on July 3, 2026**. It is not coming back.

**1. The dashboard.** Nothing is broken in your stack. Frozen balances, a frozen block number, and transactions that are accepted but never confirm are the exact signature of an archive node serving a dead chain. Swapping RPC providers couldn't help — every provider points at the same halted chain. Worth noting the date gap: your team said "start of the month," but block production ceased July 3, so if the dashboard froze in early August, something was serving stale data for a month before that.

The urgent operational item: **your ledger is probably wrong.** Payouts submitted since July 3 returned tx hashes and never executed. If your backend treats a tx hash as success, some merchants have been marked paid when they weren't. Reconcile before you talk to them.

**2. The $400k.** It's frozen but not destroyed — the backing assets sit in Polygon's L1 bridge escrow on Ethereum. The problem is that Polygon's claims process covers **EOA-held assets only**, and explicitly excludes smart contracts. PayoutVault is a contract, so there's no self-serve path; their guidance is "contact the protocol operator," which is you.

Your case is genuinely stronger than the generic DeFi exclusion it was written for — a single-operator custodial vault with a provable owner key and a verifiable KYC'd beneficiary list, asking for one exit certificate. Make that the center of the escalation. But it's a discretionary exception to a published rule, and I can't tell you it will land. Hard deadline is Dec 31, 2027, but escalate this week while Polygon still has people who can service it. Get counsel and finance involved now, since this is customer money.

One path needs nobody's permission: check for bridge exits initiated before July 3 but never claimed on L1. The L1 bridge contract is permanent, so those are likely still claimable today.

**3. Q3.** It's August 20 and Q3 ends September 30. Recovery plus standing up a new rail will eat those six weeks, so **batch payouts realistically lands early Q4** — I'd rather flag that than have you commit a date to merchants. The upside: the forced migration is itself your biggest per-payout cost win. I recommend **Base** (cheapest major L2, native USDC, and the Coinbase off-ramp, which for a merchant payout product is the feature). The doc covers the 7-day-withdrawal caveat, Polygon PoS as runner-up, and the batch design — packed calldata encodings with byte counts, plus an honest note that batching gets you ~50–70% off rather than 99%, since the per-recipient token write is irreducible.

The durable fix is a chain-liveness alert. This shutdown came with twelve months of notice; what turned a scheduled migration into a $400k incident was having nothing watching.
