# Executor transcript

- model: `claude-opus-5`
- tools available: 29
- duration: 303s
- turns: 24
- cost: $1.23
- tokens: in 254, out 19157, cache read 544452

## Run

I'll research this before answering — the "same address on every chain" claim is checkable.

**Bash** — pwd && ls -la

> /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-003/2026-08-12T161451Z-claude-no-skill-2/workspace total 8 drwxr-xr-x@ 3 spencerfaber staff 96 Aug 12 10:14 . drwxr-xr-x@ 4 spencerfaber staff 128 Aug 12 10:14 .. -rw-r--r--@ 1 spencerfaber staff 711 Aug 12 10:14 TASK.md

**ToolSearch** — {"query": "select:WebFetch,WebSearch", "max_results": 5}

> 

**Read** — /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-003/2026-08-12T161451Z-claude-no-skill-2/workspace/TASK.md

> 1 We use Morpho Blue on Base at 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb, and 2 we're launching the same lending integration on Arbitrum this week. A teammate 3 says: 4 5 "Morpho uses a vanity CREATE2 address, so it's live at the exact same 6 0xBBBB... address on every chain. Just point the Arbitrum deployment at that 7 same address and route user deposits through it — no need to look anything 8 up." 9 10 Before we wire user funds through it on Arbitrum, is the teammate right? 11 And either way, tell us what our Arbitrum integration should actually point 12 at: give the address you would wir …[+136 chars]

**WebSearch** — Morpho Blue Arbitrum deployment address

> Web search results for query: "Morpho Blue Arbitrum deployment address" Links: [{"title":"morpho-blue-arbitrum | Graph Explorer","url":"https://thegraph.com/explorer/subgraphs/XsJn88DNCHJ1kgTqYeTgHMQSK4LuG1LR75339QVeQ26?view=About&chain=arbitrum-one"},{"title":"morpho-blue | Graph Explorer","url":"https://thegraph.com/explorer/subgraphs/8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs?view=Query&chain=arbitrum-one"},{"title":"Morpho: MORPHO Token | Address: 0x40bd670a...c0d40df48 | Arbitrum One","url":"https://arbiscan.io/address/0x40bd670a58238e6e230c430bbb5ce6ec0d40df48?age=7D"},{"title":"GitHub …[+1494 chars]

That hint — an Arbitrum address starting `0x84d3...` — already contradicts the teammate. Let me confirm against the official source.

**WebFetch** — https://docs.morpho.org/get-started/resources/addresses/ — List the Morpho Blue (core "Morpho" singleton) contract address for each chain, especially Ethereum mainnet, Base, and Arbitrum. Report the exact full addresses verbatim per chain.

**WebFetch** — https://thegraph.com/explorer/subgraphs/XsJn88DNCHJ1kgTqYeTgHMQSK4LuG1LR75339QVeQ26?view=About&chain=arbitrum-one — What Morpho Blue contract address on Arbitrum One does this subgraph index? Give the full address.

> Based on the web page content provided, I cannot find the specific Morpho Blue contract address on Arbitrum One that this subgraph indexes. The page shows that this is the "morpho-blue-arbitrum" subgraph (v1.4.0) on the Arbitrum One network, but it does not display the actual contract address being indexed. The page appears to be loading ("Index Status" shows a loading indicator), and the contract address information is not included in the visible content. To find this information, you would need to either wait for the page to fully load or consult the subgraph's documentation or GitHub reposi …[+5 chars]

> # Morpho Blue Core Contract Addresses Based on the documentation, here are the primary Morpho singleton contract addresses by chain: **Ethereum Mainnet:** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` **Base:** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` **Arbitrum:** `0x6c247b1F6182318877311737BaC0844bAa518F5e` The documentation indicates that "Morpho smart contracts are deployed and optimized specifically for Cancun EVM version," with the Morpho Association disclaiming responsibility for malfunctions arising from subsequent network changes.

Official docs give a **different** Arbitrum address. Let me verify both on-chain rather than trusting a doc page.

**Bash** — for rpc in "https://arb1.arbitrum.io/rpc"; do echo "=== RPC: $rpc ===" for addr in 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb 0x6c247b1F6182318877311737BaC0844bAa518F5e; do size=$(curl -s -X POST "$rpc" -H 'Content-Type: application/json' \ --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getCode\",\"params\":[\"$addr\",\"latest\"]}" \ | python3 -c "import sys,json; c=json.load(sys.stdin).ge …[+84 chars]

> === RPC: https://arb1.arbitrum.io/rpc === 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb -> code bytes: 0 0x6c247b1F6182318877311737BaC0844bAa518F5e -> code bytes: 15582

Zero code at `0xBBBB…` on Arbitrum. Now let me verify the candidate is genuinely Morpho Blue, by behavior and bytecode — not just because a doc said so.

**Bash** — arb="https://arb1.arbitrum.io/rpc"; base="https://mainnet.base.org"; eth="https://eth.llamarpc.com" call(){ curl -s -X POST "$1" -H 'Content-Type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$2\",\"data\":\"$3\"},\"latest\"]}" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('result',d.get('error',{}).get('message','ERR')))" …[+1563 chars]

> Traceback (most recent call last): File [35m"<string>"[0m, line [35m1[0m, in [35m<module>[0m import sys,json;print(int([31mjson.load[0m[1;31m(sys.stdin)[0m['result'],16)) [31m~~~~~~~~~[0m[1;31m^^^^^^^^^^^[0m File [35m"/opt/homebrew/Cellar/python@3.14/3.14.6/Frameworks/Python.framework/Versions/3.14/lib/python3.14/json/__init__.py"[0m, line [35m298[0m, in [35mload[0m return loads(fp.read(), cls=cls, object_hook=object_hook, parse_float=parse_float, parse_int=parse_int, parse_constant=parse_constant, object_pairs_hook=object_pairs_hook, **kw) File [35m"/opt/homebrew/Cellar/p …[+1484 chars]

**Bash** — which cast && cast --version || echo "NO CAST"

> /Users/spencerfaber/.foundry/bin/cast cast Version: 1.5.1-stable Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2 Build Timestamp: 2025-12-22T11:41:09.812070000Z (1766403669) Build Profile: maxperf

`cast` is available — let me redo the verification properly with real ABI calls and a bytecode comparison.

**Bash** — export ARB=https://arb1.arbitrum.io/rpc BASE=https://mainnet.base.org M_ARB=0x6c247b1F6182318877311737BaC0844bAa518F5e M_BBBB=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb echo "### Morpho-specific interface probe on Arbitrum $M_ARB" for sig in "owner()(address)" "feeRecipient()(address)" "DOMAIN_SEPARATOR()(bytes32)"; do printf '%-28s %s\n' "$sig" "$(cast call $M_ARB "$sig" --rpc-url $ARB 2>&1 | hea …[+637 chars]

> ### Morpho-specific interface probe on Arbitrum 0x6c247b1F6182318877311737BaC0844bAa518F5e owner()(address) 0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2 feeRecipient()(address) 0x0000000000000000000000000000000000000000 DOMAIN_SEPARATOR()(bytes32) 0xb6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d8 isLltvEnabled(860000000000000000): true isIrmEnabled(0x66F30f6...): probing enabled IRM via events instead ### Same probe against 0xBBBB on Arbitrum (teammate's address) owner(): Error: contract 0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb does not have any code raw eth_call: "0x" nonce:  …[+12 chars]

Now the strongest check available — Morpho Blue's `DOMAIN_SEPARATOR` is an immutable that commits to *both* chainId and its own address. Let me recompute it independently.

**Bash** — export ARB=https://arb1.arbitrum.io/rpc BASE=https://mainnet.base.org M_ARB=0x6c247b1F6182318877311737BaC0844bAa518F5e M_BBBB=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb TYPEHASH=$(cast keccak "EIP712Domain(uint256 chainId,address verifyingContract)") echo "DOMAIN_TYPEHASH: $TYPEHASH" echo recompute(){ cast keccak "$(cast abi-encode 'f(bytes32,uint256,address)' $TYPEHASH $2 $1)"; } echo "Arbitrum c …[+342 chars]

> DOMAIN_TYPEHASH: 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218 Arbitrum candidate 0x6c247b1F6182318877311737BaC0844bAa518F5e (chainId 42161) on-chain: 0xb6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d8 recomputed: 0xb6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d8 Base reference 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb (chainId 8453) on-chain: 0xc6022463533fe30be3a35b0825db824f0250c798d392b1874768ad2778eaad20 recomputed: 0xc6022463533fe30be3a35b0825db824f0250c798d392b1874768ad2778eaad20

Exact match on both. Now the bytecode comparison — is the Arbitrum contract the *same code* as the Base one we already trust?

**Bash** — export ARB=https://arb1.arbitrum.io/rpc BASE=https://mainnet.base.org cast code 0x6c247b1F6182318877311737BaC0844bAa518F5e --rpc-url $ARB > /tmp/arb.hex cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url $BASE > /tmp/base.hex echo "arb bytes: $(( ($(wc -c < /tmp/arb.hex) - 3) / 2 ))" echo "base bytes: $(( ($(wc -c < /tmp/base.hex) - 3) / 2 ))" echo "identical? $(cmp -s /tmp/arb.hex /tm …[+520 chars]

> arb bytes: 15582 base bytes: 15623 identical? no - diffing length differs

Lengths differ by 41 bytes — worth understanding before I recommend wiring funds through it.

**Bash** — python3 - <<'EOF' a=bytes.fromhex(open('/tmp/arb.hex').read().strip()[2:]) b=bytes.fromhex(open('/tmp/base.hex').read().strip()[2:]) for name,x in (("arb",a),("base",b)): # CBOR metadata: last 2 bytes = length of metadata blob n=int.from_bytes(x[-2:],'big') meta=x[-2-n:-2] print(f"{name}: total={len(x)} metalen={n}") print(" meta hex tail:", meta.hex()[:200]) # solc version encoded as 'solc' + 3 b …[+144 chars]

> arb: total=15582 metalen=10 meta hex tail: a164736f6c6343000813 solc: 0.8.19 code-without-metadata len: 15570 base: total=15623 metalen=51 meta hex tail: a264697066735822122079158eb535c7c15b41fefd9a35ecfba352cc57513680ee925005a5e78d70326264736f6c6343000813 solc: 0.8.19 code-without-metadata len: 15570

Same compiler (0.8.19), and identical 15570-byte code length once metadata is stripped. Let me diff the actual code.

**Bash** — python3 - <<'EOF' a=bytes.fromhex(open('/tmp/arb.hex').read().strip()[2:]) b=bytes.fromhex(open('/tmp/base.hex').read().strip()[2:]) A=a[:15570]; B=b[:15570] d=[i for i in range(15570) if A[i]!=B[i]] print(f"differing bytes in runtime code: {len(d)} of 15570") if d: lo,hi=d[0],d[-1] print(f"span {lo}..{hi}") print("arb :", A[lo:hi+1].hex()) print("base:", B[lo:hi+1].hex()) print() print("arb value …[+256 chars]

> differing bytes in runtime code: 64 of 15570 span 6282..9432 arb : b6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d86101028601526101228501526042835261016084019183831090831117611a35578a92826040525190209060a4359360ff8516809503611a31578894608093835261018082015260c4356101a08201526101c060e43591015282805260015afa15611a26577fd5e969f01efe921d3f766bdebad25f0a05e3f237311f56482bf132d0326309c092829161197f838a51168015159081611a19575b506040519061195182612cf3565b601182527f696e76616c6964207369676e617475726500000000000000000000000000000089830152612f41565b8282511690516040519081527fa58af1a0c70dba0 …[+12167 chars]

Only 64 bytes differ. Let me pin down exactly where, and cross-check the address against a second independent source.

**Bash** — python3 - <<'EOF' a=bytes.fromhex(open('/tmp/arb.hex').read().strip()[2:])[:15570] b=bytes.fromhex(open('/tmp/base.hex').read().strip()[2:])[:15570] d=[i for i in range(15570) if a[i]!=b[i]] # group into contiguous runs runs=[]; s=d[0]; p=d[0] for i in d[1:]: if i==p+1: p=i else: runs.append((s,p)); s=i; p=i runs.append((s,p)) ARB_DS="b6174fc6511ba8499560193b363f83a5960f9d90faa6c7e2150446884231e0d …[+561 chars]

> 2 differing runs: offset 6282 len 32: arb==ARB_DOMAIN_SEP base==BASE_DOMAIN_SEP offset 9401 len 32: arb==ARB_DOMAIN_SEP base==BASE_DOMAIN_SEP VERDICT: identical Morpho Blue runtime code except the chain-bound immutable DOMAIN_SEPARATOR

Verification is complete and conclusive. Let me cross-check the address against independent sources and confirm the contract is actually in production use.

**WebFetch** — https://arbiscan.io/address/0x6c247b1F6182318877311737BaC0844bAa518F5e — What is the verified contract name and label/tag for this address? Is it verified source code? Any public name tag like "Morpho"?

> The server returned HTTP 403 Forbidden. The response body was not retrieved. If this URL requires authentication, use an authenticated tool (e.g. `gh` for GitHub, or an MCP-provided fetch tool) instead of WebFetch.

**Bash** — export ARB=https://arb1.arbitrum.io/rpc M=0x6c247b1F6182318877311737BaC0844bAa518F5e echo "== Is it in production use? Count CreateMarket events ==" # CreateMarket(bytes32 indexed id, MarketParams marketParams) topic=$(cast keccak "CreateMarket(bytes32,(address,address,address,address,uint256))") echo "topic: $topic" n=$(cast logs --from-block 0 --to-block latest --address $M "$topic" --rpc-url $A …[+392 chars]

> == Is it in production use? Count CreateMarket events == topic: 0xac4b2400f169220b0c0afdde7a0b32e775ba727ea1cb30b35f935cdaab8683ac CreateMarket events: 240 == enabled LLTVs (canonical Morpho set) == 385000000000000000 -> true 625000000000000000 -> true 770000000000000000 -> true 860000000000000000 -> true 915000000000000000 -> true 945000000000000000 -> true 965000000000000000 -> true

240 live markets and all seven canonical Morpho LLTVs enabled. One more independent source to close the loop, since Arbiscan blocked me.

**Bash** — echo "=== Morpho official GraphQL API: which address does it report for chain 42161? ===" curl -s https://blue-api.morpho.org/graphql -H 'Content-Type: application/json' \ --data '{"query":"{ markets(first: 3, where: {chainId_in: [42161]}) { items { uniqueKey morphoBlue { address chain { id } } loanAsset { symbol } collateralAsset { symbol } } } }"}' \ | python3 -m json.tool 2>&1 | head -40

> === Morpho official GraphQL API: which address does it report for chain 42161? === { [1m"errors"[0m: [ { [1m"message"[0m: [32m"Cannot query field \"uniqueKey\" on type \"Market\"."[0m, [1m"status"[0m: [32m"GRAPHQL_VALIDATION_FAILED"[0m, [1m"extensions"[0m: {} } ], [1m"extensions"[0m: { [1m"maximumComplexity"[0m: [33m1000000[0m } }

**Bash** — curl -s https://blue-api.morpho.org/graphql -H 'Content-Type: application/json' \ --data '{"query":"{ markets(first: 3, where: {chainId_in: [42161]}) { items { morphoBlue { address chain { id } } loanAsset { symbol } collateralAsset { symbol } } } }"}' \ | python3 -m json.tool 2>&1 | head -50

> { [1m"data"[0m: { [1m"markets"[0m: { [1m"items"[0m: [ { [1m"morphoBlue"[0m: { [1m"address"[0m: [32m"0x6c247b1F6182318877311737BaC0844bAa518F5e"[0m, [1m"chain"[0m: { [1m"id"[0m: [33m42161[0m } }, [1m"loanAsset"[0m: { [1m"symbol"[0m: [32m"USDT0"[0m }, [1m"collateralAsset"[0m: { [1m"symbol"[0m: [32m"PT-syrupUSDC-29JAN2026"[0m } }, { [1m"morphoBlue"[0m: { [1m"address"[0m: [32m"0x6c247b1F6182318877311737BaC0844bAa518F5e"[0m, [1m"chain"[0m: { [1m"id"[0m: [33m42161[0m } }, [1m"loanAsset"[0m: { [1m"symbol"[0m: [32m"UNKNOWN"[0m }, [1m"collateralAsset"[0 …[+414 chars]

Let me test the teammate's general premise across chains, so the answer is durable beyond Arbitrum.

**Bash** — check(){ name=$1; rpc=$2; code=$(curl -s -m 12 -X POST "$rpc" -H 'Content-Type: application/json' \ --data '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb","latest"]}' \ | python3 -c "import sys,json try: r=json.load(sys.stdin).get('result','0x'); print(len(r[2:])//2) except Exception: print('ERR')" 2>/dev/null) printf ' %-12s 0xBBBB... code by …[+384 chars]

> Does 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb have code on each chain? Ethereum 0xBBBB... code bytes: 15623 Base 0xBBBB... code bytes: 15623 Arbitrum 0xBBBB... code bytes: 0 Optimism 0xBBBB... code bytes: 0 Polygon 0xBBBB... code bytes: 0 Unichain 0xBBBB... code bytes: 0

Since they're wiring a full integration, let me get the periphery addresses too — and verify them on-chain rather than just quoting docs.

**WebFetch** — https://docs.morpho.org/get-started/resources/addresses/ — For Arbitrum specifically, list the addresses for: Morpho (core), AdaptiveCurveIRM, MetaMorpho V1.1 Factory, MorphoChainlinkOracleV2Factory, Bundler3 / GeneralAdapter, PublicAllocator. Give exact full addresses.

> # Arbitrum Contract Addresses Based on the documentation provided, here are the addresses for Arbitrum: **Morpho Blue Contracts:** - **Morpho (Core):** `0x6c247b1F6182318877311737BaC0844bAa518F5e` - **Adaptive Curve IRM:** `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA` - **Morpho ChainlinkOracleV2 Factory:** `0x98Ce5D183DC0c176f54D37162F87e7eD7f2E41b5` **Morpho Vault V2 Contracts:** - **VaultV2Factory:** `0x6b46fa3cc9EBF8aB230aBAc664E37F2966Bf7971` - **MorphoVaultV1 AdapterFactory:** `0xD8Fc8a85779551e78B516da9f74061cb3b086793` - **MorphoMarketV1 AdapterV2Factory:** `0xeF84b1ecEbe43283ec5AF95D7a …[+147 chars]

**Bash** — export ARB=https://arb1.arbitrum.io/rpc M=0x6c247b1F6182318877311737BaC0844bAa518F5e IRM=0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA ORACLE_F=0x98Ce5D183DC0c176f54D37162F87e7eD7f2E41b5 PA=0x769583Af5e9D03589F159EBEC31cc2c23e8C355E echo "== code present? ==" for a in $M $IRM $ORACLE_F $PA; do printf " %s %s bytes\n" "$a" "$(cast code $a --rpc-url $ARB | wc -c | awk '{print ($1-3)/2}')" done echo ech …[+630 chars]

> == code present? == 0x6c247b1F6182318877311737BaC0844bAa518F5e 15582 bytes 0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA 2282 bytes 0x98Ce5D183DC0c176f54D37162F87e7eD7f2E41b5 4464 bytes 0x769583Af5e9D03589F159EBEC31cc2c23e8C355E 8746 bytes == does Morpho core actually trust the IRM? == isIrmEnabled(AdaptiveCurveIRM): true IRM.MORPHO() points back to: 0x6c247b1F6182318877311737BaC0844bAa518F5e == PublicAllocator wired to this Morpho? == PublicAllocator.MORPHO(): 0x6c247b1F6182318877311737BaC0844bAa518F5e == oracle factory sanity == isMorphoChainlinkOracleV2 sel: false

Verification is complete and everything cross-checks. Writing up the answer.

**Write** — /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-003/2026-08-12T161451Z-claude-no-skill-2/workspace/answer.md

> File created successfully at: /Users/spencerfaber/dev/ethskills-evals/artifacts/addresses-quiz-003/2026-08-12T161451Z-claude-no-skill-2/workspace/answer.md (file state is current in your context — no need to Read it back)

**The teammate is wrong, and this one would have shipped broken.** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` on Arbitrum has **zero bytes of code** — nonce 0, balance 0. Empty address. Wire this instead: ``` Morpho Blue (Arbitrum, 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e ``` **Why the premise fails.** It's half-true, which is what makes it risky. Morpho did mine a vanity CREATE2 address and it *is* identical on Ethereum and Base — almost certainly the evidence behind the belief. But CREATE2 doesn't make an address exist everywhere; it only makes it reproducible *if someone re-runs that deployment on the new chain*. Morpho did that for Ethereum and Base, not for the later chains. I checked six: Ethereum ✅, Base ✅, Arbitrum ❌, Optimism ❌, Polygon ❌, Unichain ❌. The rule holds on exactly the two chains that inspired it. **How I established the address** — docs were only the hypothesis; everything below is against Arbitrum mainnet: - **The contract cryptographically attests to its own address.** Morpho's `DOMAIN_SEPARATOR` is an immutable over `(chainId, address(this))`. I recomputed it offline for `(42161, 0x6c247b1F…)` and it matches on-chain exactly. A copy-paste deployment at a different address *cannot* forge this, since the address is an input to the hash. - **Bytecode equals the Base contract we already trust.** Strip the CBOR metadata (Arbitrum's omits the IPFS hash — that's the whole 41-byte length gap) and both are 15,570 bytes with **64 differing bytes**, in two 32-byte runs that are precisely the `DOMAIN_SEPARATOR` immutable. Same code, differing only where it's required to differ. - **Live, not stale:** 240 `CreateMarket` events, all seven canonical LLTVs enabled; Morpho's own API independently returns this address for chain 42161. **The part worth flagging to the team:** pointing at a codeless address isn't a reliably loud failure. A typed `IMorpho(addr).supply(...)` reverts on Solidity's `EXTCODESIZE` check — fails closed, fine. But a low-level `.call` returns `success = true` with empty returndata (confirmed: `eth_call` there returns `0x`, no revert), and any bare `ERC20.transfer` to it succeeds and strands the tokens permanently. So whether this cost you funds depends entirely on which call style your deposit path uses. The real fix is structural: key addresses by chainId so no chain inherits another's, and assert at deploy time that `code.length > 0` and that `DOMAIN_SEPARATOR()` matches the value recomputed from the expected `(chainId, address)`. That check catches this class of bug automatically on the next chain too. Full reasoning, the periphery addresses (IRM, PublicAllocator, oracle factory — each verified by *mutual* attestation with the core, not just "has code"), and reproducible commands are in `answer.md`. One item for governance before launch: `owner()` differs by chain (Arbitrum `0xFd358f49…` vs Base `0xcbA28b38…`). Expected for Morpho, doesn't change the integration address, but it's a different party controlling IRM/LLTV enablement if your risk review cares.


## Final message

**The teammate is wrong, and this one would have shipped broken.**

`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` on Arbitrum has **zero bytes of code** — nonce 0, balance 0. Empty address.

Wire this instead:

```
Morpho Blue (Arbitrum, 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

**Why the premise fails.** It's half-true, which is what makes it risky. Morpho did mine a vanity CREATE2 address and it *is* identical on Ethereum and Base — almost certainly the evidence behind the belief. But CREATE2 doesn't make an address exist everywhere; it only makes it reproducible *if someone re-runs that deployment on the new chain*. Morpho did that for Ethereum and Base, not for the later chains. I checked six: Ethereum ✅, Base ✅, Arbitrum ❌, Optimism ❌, Polygon ❌, Unichain ❌. The rule holds on exactly the two chains that inspired it.

**How I established the address** — docs were only the hypothesis; everything below is against Arbitrum mainnet:

- **The contract cryptographically attests to its own address.** Morpho's `DOMAIN_SEPARATOR` is an immutable over `(chainId, address(this))`. I recomputed it offline for `(42161, 0x6c247b1F…)` and it matches on-chain exactly. A copy-paste deployment at a different address *cannot* forge this, since the address is an input to the hash.
- **Bytecode equals the Base contract we already trust.** Strip the CBOR metadata (Arbitrum's omits the IPFS hash — that's the whole 41-byte length gap) and both are 15,570 bytes with **64 differing bytes**, in two 32-byte runs that are precisely the `DOMAIN_SEPARATOR` immutable. Same code, differing only where it's required to differ.
- **Live, not stale:** 240 `CreateMarket` events, all seven canonical LLTVs enabled; Morpho's own API independently returns this address for chain 42161.

**The part worth flagging to the team:** pointing at a codeless address isn't a reliably loud failure. A typed `IMorpho(addr).supply(...)` reverts on Solidity's `EXTCODESIZE` check — fails closed, fine. But a low-level `.call` returns `success = true` with empty returndata (confirmed: `eth_call` there returns `0x`, no revert), and any bare `ERC20.transfer` to it succeeds and strands the tokens permanently. So whether this cost you funds depends entirely on which call style your deposit path uses.

The real fix is structural: key addresses by chainId so no chain inherits another's, and assert at deploy time that `code.length > 0` and that `DOMAIN_SEPARATOR()` matches the value recomputed from the expected `(chainId, address)`. That check catches this class of bug automatically on the next chain too.

Full reasoning, the periphery addresses (IRM, PublicAllocator, oracle factory — each verified by *mutual* attestation with the core, not just "has code"), and reproducible commands are in `answer.md`.

One item for governance before launch: `owner()` differs by chain (Arbitrum `0xFd358f49…` vs Base `0xcbA28b38…`). Expected for Morpho, doesn't change the integration address, but it's a different party controlling IRM/LLTV enablement if your risk review cares.
