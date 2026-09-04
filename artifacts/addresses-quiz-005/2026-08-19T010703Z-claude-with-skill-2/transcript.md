# Executor transcript

- model: `claude-opus-5`
- tools available: 25
- duration: 307s
- turns: 25
- cost: $0.92
- tokens: in 38, out 14809, cache read 499553

## Run

I'll start with the addresses skill, since this is exactly the case it covers — real contract addresses going into a live call.

**Skill** — addresses

> Launching skill: addresses

**Bash** — ls -la && which cast foundryup node 2>&1 | head

**Bash** — curl -s -m 12 -X POST https://eth.llamarpc.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' ; echo "---"; curl -s -m 12 -X POST https://mainnet.base.org -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'

> total 20 drwxrwxr-x 4 damu damu 4096 ago 18 22:07 . drwxrwxr-x 3 damu damu 4096 ago 18 22:07 .. drwxrwxr-x 3 damu damu 4096 ago 18 22:07 .agents drwxrwxr-x 3 damu damu 4096 ago 18 22:07 .claude -rw-rw-r-- 1 damu damu 636 ago 18 22:07 TASK.md /home/damu/.foundry/bin/cast /home/damu/.foundry/bin/foundryup /home/damu/.nvm/versions/node/v22.22.2/bin/node

> error code: 521 --- {"jsonrpc":"2.0","result":"0x2fd5270","id":1}

**Bash** — cat TASK.md

> We're adding a "park idle USDC in Aave" feature to our multi-chain treasury app. The wallet plumbing for Ethereum mainnet, Arbitrum, Optimism and Base is already in place — what's missing is the chain configuration the supply call reads. Write chains.ts in this directory: one entry per chain (mainnet, arbitrum, optimism, base), each giving the Aave V3 lending pool the app supplies into and the USDC token it supplies. These go straight into a live supply() call, so they have to be the real deployments, not placeholders — and put a one-line comment on each address saying where you got it. chains.ts is the whole deliverable.

**Bash** — for u in https://ethereum-rpc.publicnode.com https://rpc.ankr.com/eth https://cloudflare-eth.com https://arbitrum-one-rpc.publicnode.com https://arb1.arbitrum.io/rpc https://optimism-rpc.publicnode.com https://mainnet.optimism.io https://base-rpc.publicnode.com; do printf "%-45s " "$u"; curl -s -m 10 -X POST $u -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | head -c 120; echo; done

> https://ethereum-rpc.publicnode.com {"jsonrpc":"2.0","result":"0x189759f","id":1} https://rpc.ankr.com/eth {"jsonrpc": "2.0", "error": {"code": -32000, "message": "Unauthorized: You must authenticate your request with an API ke https://cloudflare-eth.com {"jsonrpc":"2.0","error":{"code":-32046,"message":"Cannot fulfill request"},"id":1} https://arbitrum-one-rpc.publicnode.com {"jsonrpc":"2.0","result":"0x1d90727b","id":1} https://arb1.arbitrum.io/rpc {"jsonrpc":"2.0","id":1,"result":"0x1d90727b"} https://optimism-rpc.publicnode.com {"jsonrpc":"2.0","result":"0x948940a","id":1} https://mainnet.optimism.io {"jsonrpc":"2.0","result":"0x948940c","id":1} https://base-rpc.publicnode.com {"jsonrpc" …[+35 chars]

Working RPCs for all four chains. Now verifying candidates on-chain rather than trusting recall.

**Bash** — set -u declare -A RPC=( [mainnet]=https://ethereum-rpc.publicnode.com [arbitrum]=https://arbitrum-one-rpc.publicnode.com [optimism]=https://optimism-rpc.publicnode.com [base]=https://base-rpc.publicnode.com ) declare -A POOL=( [mainnet]=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 [arbitrum]=0x794a61358D6845594F94dc1DB02A252b5b4814aD [optimism]=0x794a61358D6845594F94dc1DB02A252b5b4814aD [base]=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 ) declare -A USDC=( [mainnet]=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 [arbitrum]=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 [optimism]=0x0b2C639c533813f4Aa9D78 …[+875 chars]

> ===== mainnet ===== pool 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 codesize: 4803 ADDRESSES_PROVIDER: 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e POOL_REVISION: 11 usdc 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 codesize: 4375 symbol: "USDC" name: "USD Coin" decimals: 6 supply: 49632901811201755 [4.963e16] ===== arbitrum ===== pool 0x794a61358D6845594F94dc1DB02A252b5b4814aD codesize: 4803 ADDRESSES_PROVIDER: 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb POOL_REVISION: 11 usdc 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 codesize: 3707 symbol: "USDC" name: "USD Coin" decimals: 6 supply: 2602236787528061 [2.602e15] ===== optimism ===== pool 0x794a61358D6845594F94dc1DB02A252b5b4814aD codesize: 4803  …[+526 chars]

Live contracts on all four. Now the decisive check: is that exact USDC actually a listed, active reserve in that exact pool?

**Bash** — set -u declare -A RPC=( [mainnet]=https://ethereum-rpc.publicnode.com [arbitrum]=https://arbitrum-one-rpc.publicnode.com [optimism]=https://optimism-rpc.publicnode.com [base]=https://base-rpc.publicnode.com ) declare -A POOL=( [mainnet]=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 [arbitrum]=0x794a61358D6845594F94dc1DB02A252b5b4814aD [optimism]=0x794a61358D6845594F94dc1DB02A252b5b4814aD [base]=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 ) declare -A USDC=( [mainnet]=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 [arbitrum]=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 [optimism]=0x0b2C639c533813f4Aa9D78 …[+623 chars]

**Bash** — cd /tmp && for f in AaveV3Ethereum AaveV3Arbitrum AaveV3Optimism AaveV3Base; do echo "===== $f ====="; curl -s -m 20 "https://raw.githubusercontent.com/bgd-labs/aave-address-book/main/src/$f.sol" | grep -iE 'address internal constant (POOL|POOL_ADDRESSES_PROVIDER) ' ; done

> ===== mainnet ===== reserves count: 67 USDC listed in pool: YES aToken: 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c config bitmask: 7237005577332262213973186574461183474351397203257058379287201451741919321420 [7.237e75] ===== arbitrum ===== reserves count: 20 USDC listed in pool: YES aToken: 0x724dc807b04555b71ed48a6896b6F41593b8C637 config bitmask: 7237005577332262213973186942896424937551795037297819859365743234882012192076 [7.237e75] ===== optimism ===== reserves count: 14 USDC listed in pool: YES aToken: 0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5 config bitmask: 7237005577332262213973186942896406494513353280046704560039872738807055392076 [7.237e75] ===== base ===== reserves count: 15 USDC  …[+174 chars]

> Exit code 1 ===== AaveV3Ethereum ===== ===== AaveV3Arbitrum ===== ===== AaveV3Optimism ===== ===== AaveV3Base =====

On-chain confirms all four. Decoding the reserve config, and retrying the official address book with the right path:

**Bash** — python3 - <<'EOF' cfgs = { 'mainnet': (7237005577332262213973186574461183474351397203257058379287201451741919321420, '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c'), 'arbitrum':(7237005577332262213973186942896424937551795037297819859365743234882012192076, '0x724dc807b04555b71ed48a6896b6F41593b8C637'), 'optimism':(7237005577332262213973186942896406494513353280046704560039872738807055392076, '0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5'), 'base': (7237005577332262213973186568752004119305653224248996801175139707821393190220, '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB'), } for c,(v,a) in cfgs.items( …[+239 chars]

> mainnet decimals=6 active=1 frozen=0 paused=0 supplyCap=2,500,000,000 aToken=0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c arbitrum decimals=6 active=1 frozen=0 paused=0 supplyCap=250,000,000 aToken=0x724dc807b04555b71ed48a6896b6F41593b8C637 optimism decimals=6 active=1 frozen=0 paused=0 supplyCap=28,000,000 aToken=0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5 base decimals=6 active=1 frozen=0 paused=0 supplyCap=230,000,000 aToken=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB

**Bash** — curl -s -m 20 "https://raw.githubusercontent.com/bgd-labs/aave-address-book/main/src/AaveV3Ethereum.sol" | head -40; echo "=== API listing ==="; curl -s -m 20 "https://api.github.com/repos/bgd-labs/aave-address-book/contents/src" | grep '"name"' | head -40

> // AUTOGENERATED - MANUAL CHANGES WILL BE REVERTED BY THE GENERATOR // SPDX-License-Identifier: MIT pragma solidity >=0.6.0; import {IPoolAddressesProvider, IPool, IPoolConfigurator, IAaveOracle, IPoolDataProvider, IACLManager, ICollector} from './AaveV3.sol'; library AaveV3Ethereum { // https://etherscan.io/address/0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e IPoolAddressesProvider internal constant POOL_ADDRESSES_PROVIDER = IPoolAddressesProvider(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e); // https://etherscan.io/address/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 IPool internal constant POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2); // https://etherscan.io/address/0x64b761D848206 …[+1378 chars]

The earlier grep missed because pools are declared as `IPool`, not `address`. Cross-checking all four against Aave's own address book:

**Bash** — for f in AaveV3Ethereum AaveV3Arbitrum AaveV3Optimism AaveV3Base; do echo "===== $f =====" curl -s -m 20 "https://raw.githubusercontent.com/bgd-labs/aave-address-book/main/src/$f.sol" | grep -A2 'IPool internal constant POOL ' echo " -- assets USDC --" curl -s -m 20 "https://raw.githubusercontent.com/bgd-labs/aave-address-book/main/src/${f}Assets.sol" | grep -iE 'USDC[a-zA-Z_]*_UNDERLYING|USDC[a-zA-Z_]*_A_TOKEN' | grep -v DECIMALS | head -8 done

**Bash** — echo "=== other mainnet V3 instances (to name the one we pick) ==="; curl -s -m 20 "https://api.github.com/repos/bgd-labs/aave-address-book/git/trees/main?recursive=1" | grep -oE '"src/AaveV3(Ethereum|Arbitrum|Optimism|Base)[A-Za-z]*\.sol"' | sort -u

> ===== AaveV3Ethereum ===== IPool internal constant POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2); // https://etherscan.io/address/0x64b761D848206f447Fe2dd461b0c635Ec39EbB27 -- assets USDC -- ===== AaveV3Arbitrum ===== IPool internal constant POOL = IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD); // https://arbiscan.io/address/0x8145eddDf43f50276641b55bd3AD95944510021E -- assets USDC -- ===== AaveV3Optimism ===== IPool internal constant POOL = IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD); // https://optimistic.etherscan.io/address/0x8145eddDf43f50276641b55bd3AD95944510021E -- assets USDC -- ===== AaveV3Base ===== IPool internal constant POOL = IPool(0xA238Dd80C259a72e81d7e4 …[+113 chars]

> === other mainnet V3 instances (to name the one we pick) ===

Pools match the address book exactly. Now confirming the USDC underlyings from the same source and checking which mainnet instance this is:

**Bash** — curl -s -m 25 "https://api.github.com/repos/bgd-labs/aave-address-book/git/trees/main?recursive=1" -o /tmp/tree.json; wc -c /tmp/tree.json; grep -oE 'src/AaveV3[A-Za-z]*\.sol' /tmp/tree.json | sort -u | head -60

> 239 /tmp/tree.json

**Bash** — cat /tmp/tree.json

> { "message": "Moved Permanently", "url": "https://api.github.com/repositories/490991821/git/trees/main?recursive=1", "documentation_url": "https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api#follow-redirects" }

**Bash** — curl -sL -m 25 "https://api.github.com/repositories/490991821/git/trees/main?recursive=1" -o /tmp/tree.json; wc -c /tmp/tree.json; echo "--- mainnet/l2 v3 instances ---"; grep -oE 'src/AaveV3(Ethereum|Arbitrum|Optimism|Base)[A-Za-z]*\.sol' /tmp/tree.json | sort -u

> 173813 /tmp/tree.json --- mainnet/l2 v3 instances --- src/AaveV3ArbitrumSepolia.sol src/AaveV3Arbitrum.sol src/AaveV3BaseSepoliaLido.sol src/AaveV3BaseSepolia.sol src/AaveV3Base.sol src/AaveV3EthereumEtherFi.sol src/AaveV3EthereumHorizon.sol src/AaveV3EthereumLido.sol src/AaveV3Ethereum.sol src/AaveV3OptimismSepolia.sol src/AaveV3Optimism.sol

**Bash** — grep -oE 'src/AaveV3(Ethereum|Arbitrum|Optimism|Base)Assets\.sol' /tmp/tree.json | sort -u; echo "=== USDC entries ===" for f in AaveV3Ethereum AaveV3Arbitrum AaveV3Optimism AaveV3Base; do echo "----- $f -----" curl -sL -m 20 "https://raw.githubusercontent.com/bgd-labs/aave-address-book/main/src/${f}Assets.sol" | grep -B1 -iE '^ address internal constant USDC' | grep -iE 'USDC|http' | head -12 done

> === USDC entries === ----- AaveV3Ethereum ----- ----- AaveV3Arbitrum ----- ----- AaveV3Optimism ----- ----- AaveV3Base -----

**Bash** — grep -oE '"[^"]*Assets[^"]*"' /tmp/tree.json | sort -u | head -20

> "scripts/generator/protocol-v4-generator/fetchHubAssets.ts"

Address book dropped its Assets libraries, so the on-chain reserve check stands as the token source of truth. Confirming native-vs-bridged, since all four chains carry both:

**Bash** — set -u check() { # chain rpc pool token label echo " $4 ($3)" echo " symbol: $(cast call $3 'symbol()(string)' --rpc-url $2 2>&1|head -1)" echo " currency(): $(cast call $3 'currency()(string)' --rpc-url $2 2>&1|head -1)" echo " masterMinter:$(cast call $3 'masterMinter()(address)' --rpc-url $2 2>&1|head -1)" echo " in pool: $(cast call $1 'getReserveAToken(address)(address)' $3 --rpc-url $2 2>&1|head -1)" } echo "===== arbitrum =====" check 0x794a61358D6845594F94dc1DB02A252b5b4814aD https://arbitrum-one-rpc.publicnode.com 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 "native USDC" check 0x794a61 …[+913 chars]

> ===== arbitrum ===== native USDC (0xaf88d065e77c8cC2239327C5EDb3A432268e5831) symbol: "USDC" currency(): "USD" masterMinter:0x8aFf09e2259cacbF4Fc4e3E53F3bf799EfEEab36 in pool: 0x724dc807b04555b71ed48a6896b6F41593b8C637 bridged USDC.e (0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8) symbol: "USDC" currency(): Error: server returned an error response: error code 3: execution reverted, data: "0x" masterMinter:Error: server returned an error response: error code 3: execution reverted, data: "0x" in pool: 0x625E7708f30cA75bfd92586e17077590C60eb4cD ===== optimism ===== native USDC (0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85) symbol: "USDC" currency(): "USD" masterMinter:0x70429F78C2d7d1dE6f89bE421bcE6 …[+1093 chars]

Key catch: on Arbitrum and Optimism the **bridged** USDC.e also reports `symbol() == "USDC"` and is separately listed in the same pool. Symbol can't distinguish them — `currency()`/`masterMinter()` (Circle FiatToken methods) do. Checking supply-cap headroom, since that's what makes a live `supply()` revert:

**Bash** — set -u python3 - <<'PYEOF' > /tmp/caps.txt PYEOF declare -A RPC=( [mainnet]=https://ethereum-rpc.publicnode.com [arbitrum]=https://arbitrum-one-rpc.publicnode.com [optimism]=https://optimism-rpc.publicnode.com [base]=https://base-rpc.publicnode.com ) declare -A AT=( [mainnet]=0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c [arbitrum]=0x724dc807b04555b71ed48a6896b6F41593b8C637 [optimism]=0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5 [base]=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB ) declare -A CAP=( [mainnet]=2500000000 [arbitrum]=250000000 [optimism]=28000000 [base]=230000000 ) for c in mainnet arbit …[+352 chars]

> mainnet aToken "aEthUSDC" supplied=2,196,542,551 cap=2,500,000,000 arbitrum aToken "aArbUSDCn" supplied=170,572,734 cap=250,000,000 optimism aToken "aOptUSDCn" supplied=11,386,596 cap=28,000,000 base aToken "aBasUSDC" supplied=174,051,916 cap=230,000,000

All confirmed — and the aToken symbols `aArbUSDCn`/`aOptUSDCn` (the "n" = native) independently confirm we picked native over bridged. Writing the file:

**Bash** — for p in "mainnet https://ethereum-rpc.publicnode.com" "arbitrum https://arbitrum-one-rpc.publicnode.com" "optimism https://optimism-rpc.publicnode.com" "base https://base-rpc.publicnode.com"; do set -- $p; printf "%-9s %s\n" "$1" "$(cast block-number --rpc-url $2)"; done; date -u +%Y-%m-%d

> mainnet 25785778 arbitrum 496006644 optimism 155751545 base 50156260 2026-08-19

**Bash** — cat > chains.ts <<'EOF' // Chain configuration for the "park idle USDC in Aave" feature. // // Every address below was verified on-chain against the chain it is listed for // on 2026-08-19 (mainnet 25785778, arbitrum 496006644, optimism 155751545, // base 50156260). Verification for each pool/token pair was: // - `cast code` non-empty on that chain (not just on mainnet); // - pool `ADDRESSES_PROVIDER()` matches the Aave governance provider for the // market, and the pool address matches bgd-labs/aave-address-book; // - the USDC address appears in that pool's `getReservesList()` and // `getRese …[+3024 chars]

> Exit code 1 npm error could not determine executable to run npm error A complete log of this run can be found in: /home/damu/.npm/_logs/2026-08-19T01_11_35_608Z-debug-0.log

**Bash** — cd /tmp && npx --yes -p typescript@5 tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler /ssd/workspace/buidlguidl/ethskills-evals/artifacts/addresses-quiz-005/2026-08-19T010703Z-claude-with-skill-2/workspace/chains.ts && echo "TYPECHECK OK"

> TYPECHECK OK Shell cwd was reset to /ssd/workspace/buidlguidl/ethskills-evals/artifacts/addresses-quiz-005/2026-08-19T010703Z-claude-with-skill-2/workspace

**Bash** — for a in 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0x794a61358D6845594F94dc1DB02A252b5b4814aD 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; do s=$(cast to-check-sum-address $a); [ "$s" = "$a" ] && echo "ok $a" || echo "FIX $a -> $s"; done

> ok 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 ok 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 ok 0x794a61358D6845594F94dc1DB02A252b5b4814aD ok 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 ok 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 ok 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 ok 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

`chains.ts` is written and typechecks under `--strict`. All EIP-55 checksums valid. | Chain | Aave V3 Pool | USDC | Reserve | |---|---|---|---| | mainnet (1) | `0x8787…4E2` (Core) | `0xA0b8…B48` | aEthUSDC | | arbitrum (42161) | `0x794a…14aD` | `0xaf88…5831` | aArbUSDCn | | optimism (10) | `0x794a…14aD` | `0x0b2C…Ff85` | aOptUSDCn | | base (8453) | `0xA238…d1c5` | `0x8335…2913` | aBasUSDC | **How each was verified** (not from recall — every pair checked against the chain it's listed for): - Pool addresses match `bgd-labs/aave-address-book` exactly, and each pool's `ADDRESSES_PROVIDER()` resolves to that market's governance provider. - The token is a listed reserve *of that specific pool*: present in `getReservesList()`, with `getReserveAToken(usdc)` returning a live aToken. That's the condition `supply()` actually needs — a valid-looking token that isn't listed reverts. - Reserve config bits decoded: `active=1, frozen=0, paused=0` on all four. **Three traps this hit:** 1. **Bridged vs native.** On Arbitrum and Optimism the bridged `USDC.e` also returns `symbol() == "USDC"` and is *separately listed in the same pool* with its own aToken. Symbol is useless for telling them apart. I confirmed native via Circle's FiatToken `currency() == "USD"` and non-zero `masterMinter()` (both revert on the bridged tokens), and the aToken symbols `aArbUSDCn`/`aOptUSDCn` — the `n` suffix — corroborate it independently. 2. **Address reuse across chains.** Arbitrum and Optimism genuinely share a Pool address; Base does **not** (`0xA238…`). I verified Base directly rather than carrying the L2 address over — that's the failure mode where nothing reverts at build time. 3. **Right protocol, wrong instance.** Mainnet runs four separate V3 markets (Core, Prime/Lido, EtherFi, Horizon) on different Pool addresses. I picked Core, the general USDC market, and noted it in the file so nobody assumes "the Aave pool" is unambiguous on mainnet. **Before real funds move**, re-check `getReserveAToken(usdc)` and the active/frozen/paused bits on the target chain — governance can freeze or pause a reserve at any time. One thing worth flagging for the "park idle" use case: supply caps are the likely live failure. Current headroom is ~303M on mainnet, ~79M on Arbitrum, ~56M on Base, but only **~16.6M on Optimism** (11.4M supplied against a 28M cap). A large deposit there reverts with Aave error 51 (`SUPPLY_CAP_EXCEEDED`) — worth a pre-flight cap check in the supply path if treasury clips can get that big.

## Final message

`chains.ts` is written and typechecks under `--strict`. All EIP-55 checksums valid. | Chain | Aave V3 Pool | USDC | Reserve | |---|---|---|---| | mainnet (1) | `0x8787…4E2` (Core) | `0xA0b8…B48` | aEthUSDC | | arbitrum (42161) | `0x794a…14aD` | `0xaf88…5831` | aArbUSDCn | | optimism (10) | `0x794a…14aD` | `0x0b2C…Ff85` | aOptUSDCn | | base (8453) | `0xA238…d1c5` | `0x8335…2913` | aBasUSDC | **How each was verified** (not from recall — every pair checked against the chain it's listed for): - Pool addresses match `bgd-labs/aave-address-book` exactly, and each pool's `ADDRESSES_PROVIDER()` resolves to that market's governance provider. - The token is a listed reserve *of that specific pool*: present in `getReservesList()`, with `getReserveAToken(usdc)` returning a live aToken. That's the condition `supply()` actually needs — a valid-looking token that isn't listed reverts. - Reserve config bits decoded: `active=1, frozen=0, paused=0` on all four. **Three traps this hit:** 1. **Bridged vs native.** On Arbitrum and Optimism the bridged `USDC.e` also returns `symbol() == "USDC"` and is *separately listed in the same pool* with its own aToken. Symbol is useless for telling them apart. I confirmed native via Circle's FiatToken `currency() == "USD"` and non-zero `masterMinter()` (both revert on the bridged tokens), and the aToken symbols `aArbUSDCn`/`aOptUSDCn` — the `n` suffix — corroborate it independently. 2. **Address reuse across chains.** Arbitrum and Optimism genuinely share a Pool address; Base does **not** (`0xA238…`). I verified Base directly rather than carrying the L2 address over — that's the failure mode where nothing reverts at build time. 3. **Right protocol, wrong instance.** Mainnet runs four separate V3 markets (Core, Prime/Lido, EtherFi, Horizon) on different Pool addresses. I picked Core, the general USDC market, and noted it in the file so nobody assumes "the Aave pool" is unambiguous on mainnet. **Before real funds move**, re-check `getReserveAToken(usdc)` and the active/frozen/paused bits on the target chain — governance can freeze or pause a reserve at any time. One thing worth flagging for the "park idle" use case: supply caps are the likely live failure. Current headroom is ~303M on mainnet, ~79M on Arbitrum, ~56M on Base, but only **~16.6M on Optimism** (11.4M supplied against a 28M cap). A large deposit there reverts with Aave error 51 (`SUPPLY_CAP_EXCEEDED`) — worth a pre-flight cap check in the supply path if treasury clips can get that big.
