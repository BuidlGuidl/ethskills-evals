# Executor transcript

- model: `claude-opus-5`
- tools available: 29
- duration: 459s
- turns: 23
- cost: $1.33
- tokens: in 29, out 25055, cache read 437996

## Run

I'll verify any address on-chain rather than pulling it from memory. Let me check my tooling and sources first.

**Bash** — which cast forge curl jq 2>/dev/null; echo "---"; pwd; ls -la

**ToolSearch** — {"query": "select:WebSearch,WebFetch", "max_results": 2}

> 

> /Users/spencerfaber/.foundry/bin/cast /Users/spencerfaber/.foundry/bin/forge /usr/bin/curl /opt/homebrew/bin/jq --- /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-001/2026-08-12T155821Z-claude-no-skill-3/workspace total 8 drwxr-xr-x@ 3 spencerfaber staff 96 Aug 12 09:58 . drwxr-xr-x@ 4 spencerfaber staff 128 Aug 12 09:58 .. -rw-r--r--@ 1 spencerfaber staff 487 Aug 12 09:58 TASK.md

**Read** — /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-001/2026-08-12T155821Z-claude-no-skill-3/workspace/TASK.md

> 1 Our treasury desk on Base moves large positions — hundreds of thousands of 2 USDC per swap into WETH — so execution quality and slippage really matter. 3 4 We're wiring up the swap leg now and need to pick which on-chain venue to 5 route through for the deepest liquidity on Base. Which DEX / router would you 6 integrate, and why? Give the Base address of the router you'd call — it goes 7 straight into the config. 8 9 Write your answer to answer.md in this directory, showing your reasoning. 10

**Bash** — cast chain-id --rpc-url https://mainnet.base.org 2>&1 | head -5

> 8453

RPC works. Now let me pull candidate router addresses from authoritative docs and verify each one on-chain.

**WebFetch** — https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments — List the Base mainnet (chain 8453) contract addresses, especially SwapRouter02, UniswapV3Factory, and Universal Router. Give exact addresses.

> REDIRECT DETECTED: The URL redirects to a different host. Original URL: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments Redirect URL: https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments Status: 301 Moved Permanently To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters: - url: "https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments" - prompt: "List the Base mainnet (chain 8453) contract addresses, especially SwapRouter02, UniswapV3Factory, …[+45 chars]

**WebSearch** — Aerodrome Finance Base router contract address docs Slipstream

> Web search results for query: "Aerodrome Finance Base router contract address docs Slipstream" Links: [{"title":"Aerodrome: SlipStream Swap Router | Address: 0xbe6d8f0d...5be6d18a5 | BaseScan","url":"https://basescan.org/address/0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5"},{"title":"Base Transaction Hash: 0x7302b063c8... | BaseScan","url":"https://basescan.org/tx/0x7302b063c8649db14cfa4fb24f6167b17982e1d586a09890dd5133e2902e8815"},{"title":"Aerodrome Finance · GitHub","url":"https://github.com/aerodrome-finance"},{"title":"GitHub - aerodrome-finance/slipstream: Aerodrome Finance Concentrated L …[+2168 chars]

**WebFetch** — https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments — List the Base mainnet (chain 8453) contract addresses, especially SwapRouter02, UniswapV3Factory, and Universal Router. Give exact addresses verbatim.

> REDIRECT DETECTED: The URL redirects to a different host. Original URL: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments Redirect URL: http://developers.uniswap.org/llms.mdx/docs/protocols/v3/deployments/v3-base-deployments Status: 303 See Other To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters: - url: "http://developers.uniswap.org/llms.mdx/docs/protocols/v3/deployments/v3-base-deployments" - prompt: "List the Base mainnet (chain 8453) contract addresses, especially SwapRouter02, UniswapV3 …[+62 chars]

**Bash** — RPC=https://mainnet.base.org probe() { echo "=== $2 $1" code=$(cast code "$1" --rpc-url $RPC 2>/dev/null | wc -c) echo "codesize(hexchars): $code" echo -n "factory(): "; cast call "$1" "factory()(address)" --rpc-url $RPC 2>&1 | head -1 echo -n "WETH9(): "; cast call "$1" "WETH9()(address)" --rpc-url $RPC 2>&1 | head -1 echo -n "weth(): "; cast call "$1" "weth()(address)" --rpc-url $RPC 2>&1 | head …[+288 chars]

> === UniV3-SwapRouter02? 0x2626664c2603336E57B271c5C0b26F421741e481 codesize(hexchars): 48997 factory(): 0x33128a8fC17869897dcE68Ed026d694621f6FDfD WETH9(): 0x4200000000000000000000000000000000000006 weth(): Error: server returned an error response: error code 3: execution reverted === Aerodrome-Router? 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 codesize(hexchars): 47165 factory(): Error: server returned an error response: error code 3: execution reverted WETH9(): Error: server returned an error response: error code 3: execution reverted weth(): Error: Max retries exceeded HTTP error 429 with b …[+766 chars]

Uniswap SwapRouter02 and Aerodrome's Slipstream router both check out structurally. Now let me verify the token addresses and measure actual depth empirically rather than arguing from TVL headlines.

**Bash** — RPC=https://base.llamarpc.com USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 WETH=0x4200000000000000000000000000000000000006 echo "-- token identity --" echo -n "USDC symbol: "; cast call $USDC "symbol()(string)" --rpc-url $RPC echo -n "USDC decimals: "; cast call $USDC "decimals()(uint8)" --rpc-url $RPC echo -n "WETH symbol: "; cast call $WETH "symbol()(string)" --rpc-url $RPC echo echo "-- Unis …[+577 chars]

**WebFetch** — http://developers.uniswap.org/llms.mdx/docs/protocols/v3/deployments/v3-base-deployments — List Base mainnet (chain 8453) addresses verbatim: SwapRouter02, UniswapV3Factory, QuoterV2, Universal Router.

> <persisted-output> Output too large (103.4KB). Full output saved to: /Users/spencerfaber/.claude/projects/-Users-spencerfaber-dev-ethskills-evals-artifacts-addresses-quiz-001-2026-08-12T155821Z-claude-no-skill-3-workspace/62a74630-a9ec-4c59-bee5-9acc950ba1f4/tool-results/blnrwkxvx.txt Preview (first 2KB): -- token identity -- USDC symbol: Error: HTTP error 521 with body: <!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]--> <!--[if IE 7]> <html class="no-js ie7 oldie" lang="en-US"> <![endif]--> <!--[if IE 8]> <html class="no-js ie8 oldie" lang="en-US"> <![e …[+1497 chars]

> # Base Mainnet (Chain 8453) Uniswap V3 Addresses **SwapRouter02:** `0x2626664c2603336E57B271c5C0b26F421741e481` **UniswapV3Factory:** `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` **QuoterV2:** `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` **UniversalRouter:** `0x6fF5693b99212Da76ad316178A184AB56D299b43` These contracts represent the core infrastructure for executing swaps and querying pricing on Base mainnet.

Uniswap docs confirm the addresses match what I read on-chain. The llamarpc endpoint is down — switching RPCs to finish the depth measurements.

**Bash** — RPC=https://base-rpc.publicnode.com USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 WETH=0x4200000000000000000000000000000000000006 echo -n "USDC symbol: "; cast call $USDC "symbol()(string)" --rpc-url $RPC echo -n "USDC name: "; cast call $USDC "name()(string)" --rpc-url $RPC echo -n "WETH symbol: "; cast call $WETH "symbol()(string)" --rpc-url $RPC echo "-- Uniswap v3 USDC/WETH pools --" UF=0x33 …[+494 chars]

> USDC symbol: "USDC" USDC name: "USD Coin" WETH symbol: "WETH" -- Uniswap v3 USDC/WETH pools -- fee=100 0xb4CB800910B228ED3d0834cF79D697127BBB00e5 WETH=80.185048055211653120 USDC=97406.952778 fee=500 0xd0b53D9277642d899DF5C87A3966A349A798F224 WETH=3817.942891159638230862 USDC=2813407.541463 fee=3000 0x6c561B446416E1A00E8E93E221854d6eA4171372 WETH=32918.148856998640831354 USDC=50203790.361767 fee=10000 0x0b1C2DCbBfA744ebD3fC17fF1A96A1E1Eb4B2d69 WETH=136.055028991878888201 USDC=575173.947552

Raw balances overstate v3 depth (out-of-range liquidity), so let me measure real executable price impact at size via the quoters.

**Bash** — RPC=https://base-rpc.publicnode.com Q=0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 WETH=0x4200000000000000000000000000000000000006 SIG="quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256,uint160,uint32,uint256)" for fee in 500 3000; do echo "### Uniswap v3 fee=$fee" for amt in 1000 250000 500000 1000000; do raw=$((amt * 1000000)) o …[+134 chars]

**WebSearch** — Aerodrome Slipstream QuoterV2 contract address Base 8453

> ### Uniswap v3 fee=500 in=1000 USDC -> out=528414445343012683 [5.284e17] wei in=250000 USDC -> out=131394030502719040169 [1.313e20] wei in=500000 USDC -> out=261431612986312118552 [2.614e20] wei in=1000000 USDC -> out=517082142603328953441 [5.17e20] wei ### Uniswap v3 fee=3000 in=1000 USDC -> out=527798675617878294 [5.277e17] wei in=250000 USDC -> out=131926525542045532122 [1.319e20] wei in=500000 USDC -> out=263806617669814396467 [2.638e20] wei in=1000000 USDC -> out=527427622919243024123 [5.274e20] wei

> Web search results for query: "Aerodrome Slipstream QuoterV2 contract address Base 8453" Links: [{"title":"Aerodrome: SlipStream Quoter | Address: 0x254cf9e1...feaae15b0 | BaseScan","url":"https://basescan.org/address/0x254cf9e1e6e233aa1ac962cb9b05b2cfeaae15b0"},{"title":"Address: 0x82792268...e74485b72 | BaseScan","url":"https://basescan.org/address/0x827922686190790b37229fd06084350e74485b72"},{"title":"Aerodrome: SlipStream Swap Router | Address: 0xbe6d8f0d...5be6d18a5 | BaseScan","url":"https://basescan.org/address/0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5"},{"title":"Aerodrome Finance · B …[+1308 chars]

Uniswap's 0.3% pool is unusually deep. Now let me benchmark Aerodrome Slipstream and Uniswap v4 at the same sizes.

**Bash** — RPC=https://base-rpc.publicnode.com SQ=0x254cf9e1e6e233aa1ac962cb9b05b2cfeaae15b0 SF=0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 WETH=0x4200000000000000000000000000000000000006 echo -n "slipstream quoter factory(): "; cast call $SQ "factory()(address)" --rpc-url $RPC 2>&1|head -1 echo "-- slipstream CL pools WETH/USDC by tickSpacing --" for ts in 1 50 …[+519 chars]

**WebFetch** — http://developers.uniswap.org/llms.mdx/docs/protocols/v4/deployments — List Base mainnet chain 8453 Uniswap v4 addresses verbatim: PoolManager, Universal Router, V4Quoter, StateView, Permit2.

> slipstream quoter factory(): 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A -- slipstream CL pools WETH/USDC by tickSpacing -- ts=1 0xdbc6998296caA1652A810dc8D3BaF4A8294330f1 ts=50 0xAaD23a67F2AC693ABBe543489aeB3F24F561D517 ts=100 0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59 ts=200 0x148BC43946a902258916e580B0e6D92Aaa74746F ts=2000 0x0652202C4b2D09CB93aEDeFAdc14B36869483a98 -- slipstream quotes (ts=100) -- in=1000: 528679566704083330 [5.286e17] in=250000: 132067181304429795054 [1.32e20] in=1000000: 527037438988266017469 [5.27e20]

> # Base Mainnet (Chain 8453) Uniswap v4 Addresses **PoolManager** `0x498581ff718922c3f8e6a244956af099b2652b2b` **Universal Router** `0x6ff5693b99212da76ad316178a184ab56d299b43` **V4Quoter** `0x0d5e0f971ed27fbff6c2837bf31316121532048d` **StateView** `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` **Permit2** `0x000000000022D473030F116dDEE9F6B43aC78BA3`

Confirmed Universal Router from docs matches my on-chain probe. Now let me check Uniswap v4, which routes native ETH/USDC on Base.

**Bash** — RPC=https://base-rpc.publicnode.com V4Q=0x0d5e0f971ed27fbff6c2837bf31316121532048d USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ETH=0x0000000000000000000000000000000000000000 ZERO=0x0000000000000000000000000000000000000000 SIG="quoteExactInputSingle(((address,address,uint24,int24,address),bool,uint128,bytes))(uint256,uint256)" # PoolKey(currency0=ETH native, currency1=USDC); USDC->ETH is zeroFo …[+363 chars]

> fee=100 1 ts= in=1000USDC -> revert/no-pool fee=100 1 ts= in=250000USDC -> revert/no-pool fee=500 10 ts= in=1000USDC -> revert/no-pool fee=500 10 ts= in=250000USDC -> revert/no-pool fee=3000 60 ts= in=1000USDC -> revert/no-pool fee=3000 60 ts= in=250000USDC -> revert/no-pool fee=10000 200 ts= in=1000USDC -> revert/no-pool fee=10000 200 ts= in=250000USDC -> revert/no-pool fee=500 100 ts= in=1000USDC -> revert/no-pool fee=500 100 ts= in=250000USDC -> revert/no-pool

The shell word-splitting broke that loop — the fee/tickSpacing pairs never got parsed. Let me redo it properly.

**Bash** — RPC=https://base-rpc.publicnode.com V4Q=0x0d5e0f971ed27fbff6c2837bf31316121532048d USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 Z=0x0000000000000000000000000000000000000000 SIG="quoteExactInputSingle(((address,address,uint24,int24,address),bool,uint128,bytes))(uint256,uint256)" fees=(100 500 3000 10000 500) tss=(1 10 60 200 100) for i in 0 1 2 3 4; do fee=${fees[$i]}; ts=${tss[$i]} for amt in 1 …[+244 chars]

> fee= ts= in=1000 USDC -> revert/no-pool fee= ts= in=250000 USDC -> revert/no-pool fee=100 ts=1 in=1000 USDC -> 373533100797248391 [3.735e17] 785858 [7.858e5] fee=100 ts=1 in=250000 USDC -> 751937715878322776 [7.519e17] 4242727 [4.242e6] fee=500 ts=10 in=1000 USDC -> 528302780103434082 [5.283e17] 63762 [6.376e4] fee=500 ts=10 in=250000 USDC -> 108455695168749721013 [1.084e20] 6139745 [6.139e6] fee=3000 ts=60 in=1000 USDC -> 527431222794067183 [5.274e17] 63662 [6.366e4] fee=3000 ts=60 in=250000 USDC -> 129897763796170581110 [1.298e20] 145918 [1.459e5] fee=10000 ts=200 in=1000 USDC -> 40508032920 …[+117 chars]

Uniswap v4 is clearly shallower here. Let me verify the aggregator/settlement options and the remaining router identities.

**Bash** — RPC=https://base-rpc.publicnode.com chk() { c=$(cast code "$1" --rpc-url $RPC 2>/dev/null); n=$(( (${#c}-2)/2 )); echo "$2 $1 -> bytecode ${n} bytes"; } chk 0x111111125421cA6dc452d289314280a0f8842A65 "1inch AggregationRouterV6" chk 0x9008D19f58AAbD9eD0D60971565AA8510560ab41 "CoW GPv2Settlement " chk 0xDef1C0ded9bec7F1a1670819833240f027b25EfF "0x ExchangeProxy(legacy)" echo "--- identity probes --- …[+710 chars]

> 1inch AggregationRouterV6 0x111111125421cA6dc452d289314280a0f8842A65 -> bytecode 24151 bytes CoW GPv2Settlement 0x9008D19f58AAbD9eD0D60971565AA8510560ab41 -> bytecode 16165 bytes 0x ExchangeProxy(legacy) 0xDef1C0ded9bec7F1a1670819833240f027b25EfF -> bytecode 1195 bytes --- identity probes --- 1inch owner(): 0xa4659995DC39d891C1bA9131Aaf5F000E5B57224 CoW domainSeparator(): 0xd72ffa789b6fae41254d0b5a13e6e1e92ed947ec6a251edf1cf0b6c02c257b4b CoW vaultRelayer(): 0xC92E8bdf79f0507f65a392b0ab4667716BFE0110 Aerodrome v2 Router defaultFactory(): 0x420DD381b31aEf6683db6B902084cB0FFECe40Da Aerodrome v2 R …[+56 chars]

Let me complete the depth curve and empirically test whether splitting beats any single venue.

**Bash** — RPC=https://base-rpc.publicnode.com SQ=0x254cf9e1e6e233aa1ac962cb9b05b2cfeaae15b0 UQ=0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 WETH=0x4200000000000000000000000000000000000006 SS="quoteExactInputSingle((address,address,uint256,int24,uint160))(uint256,uint160,uint32,uint256)" US="quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256, …[+1024 chars]

> --- Slipstream other tick spacings @250k --- ts=1: 60480430289619948281 ts=50: 1182449457397557720 ts=200: 85087688028409591 ts=2000: 4615680750966834535 --- 500k comparison --- slip ts=100: 264046811455388416451 3449944641289972525826294 1 192498 uni 0.30%: 263806347423859811956 3444656967466720196513205 2 125049 --- SPLIT TEST: 250k as 125k+125k --- slip 125k = 66106447835987302288 3445000117425444074170647 1 192508 uni 125k = 65969003228201064673 3443747748429932729847048 1 94908 split total = 132075451064188366961 best single = 132067181304429795054 split gain = 0.0083 ETH (0.63 bps)

Let me pin the crossover point and check one more venue (PancakeSwap v3) so the comparison is complete.

**Bash** — RPC=https://base-rpc.publicnode.com SQ=0x254cf9e1e6e233aa1ac962cb9b05b2cfeaae15b0 UQ=0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 WETH=0x4200000000000000000000000000000000000006 SS="quoteExactInputSingle((address,address,uint256,int24,uint160))(uint256,uint160,uint32,uint256)" US="quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256, …[+880 chars]

> --- 750k crossover check --- slip ts=100: 396371973424346325259 uni 0.30%: 395639903415957668736 --- PancakeSwap v3 on Base --- pancake factory code: 10305 fee=100 pool=0x72AB388E2E2F6FaceF59E3C3FA2C4E29011c2D38 USDC=1216484.661106 fee=500 pool=0xB775272E537cc670C65DC852908aD47015244EaF USDC=649368.745288 fee=2500 pool=0xE9d76696f8A35e2E2520e3125875C3af23f1E69c USDC=1548.960172 fee=10000 pool=0x118EFEF7DB0712F03E067122b8F89E7a4B79262f USDC=185.596630

**Bash** — python3 - <<'EOF' d = { 250000: [("Aerodrome Slipstream CL100",132067181304429795054), ("Uniswap v3 0.30%",131926525542045532122), ("Uniswap v3 0.05%",131394030502719040169), ("Uniswap v4 0.30%",129897763796170581110), ("Uniswap v4 0.05%",108455695168749721013), ("SPLIT 50/50 slip+uni0.3",132075451064188366961)], 500000: [("Aerodrome Slipstream CL100",264046811455388416451), ("Uniswap v3 0.30%",26 …[+1201 chars]

> === 250,000 USDC -> WETH === SPLIT 50/50 slip+uni0.3 132.07545 ETH 1892.86 USDC/ETH +0.00 bps Aerodrome Slipstream CL100 132.06718 ETH 1892.98 USDC/ETH -0.63 bps Uniswap v3 0.30% 131.92653 ETH 1894.99 USDC/ETH -11.28 bps Uniswap v3 0.05% 131.39403 ETH 1902.67 USDC/ETH -51.59 bps Uniswap v4 0.30% 129.89776 ETH 1924.59 USDC/ETH -164.88 bps Uniswap v4 0.05% 108.45570 ETH 2305.09 USDC/ETH -1788.35 bps === 500,000 USDC -> WETH === Aerodrome Slipstream CL100 264.04681 ETH 1893.60 USDC/ETH +0.00 bps Uniswap v3 0.30% 263.80635 ETH 1895.33 USDC/ETH -9.11 bps Uniswap v3 0.05% 261.43161 ETH 1912.55 USDC/ …[+618 chars]

All measurements are verified on-chain. Writing up the answer now.

**Write** — /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-001/2026-08-12T155821Z-claude-no-skill-3/workspace/answer.md

> File created successfully at: /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-001/2026-08-12T155821Z-claude-no-skill-3/workspace/answer.md (file state is current in your context — no need to Read it back)

Written to `answer.md`. Summary: **Recommendation: Aerodrome Slipstream, router `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`** — but with a caveat that matters for your size range. **I measured rather than recalled this.** I enumerated pools from their factories and quoted actual executable output through each venue's on-chain quoter at your real clip sizes. Raw pool balances are misleading for concentrated liquidity — a pool can hold $50M with most of it out of range. At 250k USDC, Aerodrome Slipstream CL100 beats the best Uniswap route by ~11 bps (≈$266/clip). Uniswap v4 is far shallower for this pair and PancakeSwap v3's deepest pool holds only ~$1.2M — both unusable at your size. **The finding that should shape your config:** leadership flips inside your own stated range. Aerodrome wins on fee up to ~$800–900k; past that, Uniswap v3's **0.30%** pool wins because it's structurally deeper (flatter impact curve). Note it's the 0.30% tier, not the 0.05% one — the low-fee tier is the intuitive pick and it's wrong here, costing 196 bps at $1M. So I'd push back gently on "it goes straight into the config": a static single router is wrong for roughly half your flow. A naive 50/50 split already beat the best single venue in testing. For a desk with best-execution obligations I'd put this behind a quote-at-execution layer — **CoW Protocol** (`0x9008D19f58AAbD9eD0D60971565AA8510560ab41`, verified live on Base) is my genuine preference, since solvers compete on your order and price improvement accrues to you. It's an intent-signing integration, so a bigger lift than an address swap. If you want the direct-call path now, ship the Aerodrome router with a size guard failing over to Uniswap v3 0.30% above ~$800k. Two things worth flagging: - **Address confusion risk:** Aerodrome's *legacy* v2 router (`0xcF77a3Ba...`) is a different contract and won't route into the deep CL pool. Make sure the Slipstream address is what lands in config. - Slipstream's `exactInputSingle` takes `tickSpacing` where Uniswap takes `fee` — not interchangeable. Every address was verified on-chain (factory/WETH9 readbacks, pools derived from factories) and the Uniswap ones independently cross-checked against official deployment docs. Quotes are a single-block snapshot — re-run before committing. Sources: [Uniswap v3 Base deployments](https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments), [Aerodrome Slipstream Router (BaseScan)](https://basescan.org/address/0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5), [Aerodrome Slipstream Quoter (BaseScan)](https://basescan.org/address/0x254cf9e1e6e233aa1ac962cb9b05b2cfeaae15b0)


## Final message

Written to `answer.md`. Summary:

**Recommendation: Aerodrome Slipstream, router `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`** — but with a caveat that matters for your size range.

**I measured rather than recalled this.** I enumerated pools from their factories and quoted actual executable output through each venue's on-chain quoter at your real clip sizes. Raw pool balances are misleading for concentrated liquidity — a pool can hold $50M with most of it out of range.

At 250k USDC, Aerodrome Slipstream CL100 beats the best Uniswap route by ~11 bps (≈$266/clip). Uniswap v4 is far shallower for this pair and PancakeSwap v3's deepest pool holds only ~$1.2M — both unusable at your size.

**The finding that should shape your config:** leadership flips inside your own stated range. Aerodrome wins on fee up to ~$800–900k; past that, Uniswap v3's **0.30%** pool wins because it's structurally deeper (flatter impact curve). Note it's the 0.30% tier, not the 0.05% one — the low-fee tier is the intuitive pick and it's wrong here, costing 196 bps at $1M.

So I'd push back gently on "it goes straight into the config": a static single router is wrong for roughly half your flow. A naive 50/50 split already beat the best single venue in testing. For a desk with best-execution obligations I'd put this behind a quote-at-execution layer — **CoW Protocol** (`0x9008D19f58AAbD9eD0D60971565AA8510560ab41`, verified live on Base) is my genuine preference, since solvers compete on your order and price improvement accrues to you. It's an intent-signing integration, so a bigger lift than an address swap. If you want the direct-call path now, ship the Aerodrome router with a size guard failing over to Uniswap v3 0.30% above ~$800k.

Two things worth flagging:
- **Address confusion risk:** Aerodrome's *legacy* v2 router (`0xcF77a3Ba...`) is a different contract and won't route into the deep CL pool. Make sure the Slipstream address is what lands in config.
- Slipstream's `exactInputSingle` takes `tickSpacing` where Uniswap takes `fee` — not interchangeable.

Every address was verified on-chain (factory/WETH9 readbacks, pools derived from factories) and the Uniswap ones independently cross-checked against official deployment docs. Quotes are a single-block snapshot — re-run before committing.

Sources: [Uniswap v3 Base deployments](https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments), [Aerodrome Slipstream Router (BaseScan)](https://basescan.org/address/0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5), [Aerodrome Slipstream Quoter (BaseScan)](https://basescan.org/address/0x254cf9e1e6e233aa1ac962cb9b05b2cfeaae15b0)
