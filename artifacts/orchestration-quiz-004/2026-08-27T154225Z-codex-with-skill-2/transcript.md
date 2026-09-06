# Executor transcript — 2026-08-27T154225Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a043e4-d6cd-7060-85ea-b96d7af3fadf
--------
user
This is our Scaffold-ETH 2 (foundry flavor) checkout. We build against a
local fork of Base, because the contract we're about to write reads USDC
on Base at 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.

The onboarding note a teammate wrote says:

    Start the chain with `yarn fork base` — that gives you Base with all
    the real tokens already deployed. Sanity-check it with `cast
    chain-id` against your local node; if you get a chain id back, the
    fork is up and you're on Base.

Two people followed it this week and hit the same thing: the local node
answers fine, transactions mine, but every read of that USDC address
comes back empty, as though the token were not deployed. One of them ran
the chain-id check, got a number, and concluded the fork was healthy and
the problem was our contract.

Sort this out in this checkout and write FORK.md at the repo root:

- what the onboarding note gets wrong, and why the token reads come back
  empty
- the command that actually gives us a fork of Base here
- a check that would have caught this — one that actually distinguishes
  a fork of Base from a fork of some other chain

Ground it in this repo: quote the script, Makefile or config lines you're
relying on. Running things is fine; finished FORK.md in the working tree
is the deliverable, no commit required.

codex
I’m using the repository’s orchestration guidance because this is specifically a local fork configuration issue. I’ll trace the actual fork command and document the Base-specific verification.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md && rg -n --hidden -S \"fork|base|anvil|chain-id|rpc\" Makefile package.json packages . --glob '"'!node_modules'"' --glob '"'!**/.next/**'"'" in /ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004
 exited 2 in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: orchestration
description: Use when a Scaffold-ETH 2 build leaves localhost — planning a launch or the order things go out in, deploying or verifying contracts on a live network, standing up a local fork of a real chain, or fixing a contract bug that is already onchain. Not for frontend implementation (`frontend-ux`), the pre-launch UI audit (`qa`), or IPFS/Vercel deploy mechanics (`frontend-playbook`).
---

# Shipping a dApp

Going live is three moves, never one: contracts local, then contracts live with the frontend still on localhost, then the frontend public. The middle move is the one that gets skipped and the one that catches everything — real chain, real gas, real decimals, a real wallet — while the UI is still yours alone to edit in seconds.

Name a go/no-go condition at each boundary, not just the commands. Three of them:

- **Before deploying to the live network:** contract tests pass and the deploy script runs clean against a local fork.
- **Before the frontend is reachable publicly:** you have walked the entire user journey against the live contracts with a real wallet and real money — $1-10 of your own — and every step worked.
- **After the frontend deploy:** you have loaded the public URL yourself and put one transaction through it.

A runbook that names the commands but not the conditions will keep going after something has already gone wrong.

## Verify in the same breath as deploy

`yarn verify --network base` (or your target chain) belongs immediately after `yarn deploy --network base`, not in a launch checklist weeks out. Until it runs, users and integrators are looking at opaque bytecode, and you are debugging a live contract without source on the explorer.

**Nobody has to go and get a block explorer API key first.** SE-2 ships a working `ETHERSCAN_API_KEY` in `packages/foundry/.env.example` and copies it to `.env` on postinstall, so verification works on a fresh checkout; swap in your own key later if you want one. Verification blocked "waiting on a key" is a ticket to close, not a dependency. One real constraint: `yarn verify` replays `broadcast/run-latest.json`, so run it from the checkout that did the deploy.

## A live contract bug goes back to the start

Deployed bytecode cannot be edited, and the contract is a public API — a guard added in the frontend binds nobody, because direct calls, integrators and other frontends reach the same function. Shipping the UI clamp to buy hours is fine; calling it the fix is not.

The fix is the whole loop, in order: reproduce locally, correct the source, add the regression test that fails without the correction, redeploy (or upgrade in place, if it is behind a proxy), repoint the frontend if the address moved, and handle the state and users already there — migration or comms, your call. The loop is the same whether the bug surfaces before launch or with the app already public.

## SE-2 specifics worth having right

- **Fork the chain you are targeting rather than `yarn chain`** — `yarn fork --network base` gives you Uniswap, USDC, Aave and funded whales already deployed, so you write no mocks of things that exist. The flag is load-bearing: yarn swallows a bare positional argument, so `yarn fork base` silently forks Ethereum mainnet instead. In the hardhat flavor `yarn fork` ignores its argument entirely and always forks mainnet — change `forking.url` in `hardhat.config.ts` to fork anything else. Either way the fork answers chain id 31337, so the chain id never tells you what you forked: check for state only the target chain has, such as code at one of its token addresses.
- **`scaffold.config.ts` is committed.** An RPC or API key pasted into `rpcOverrides` or `alchemyApiKey` is a published key; read it from `process.env` and keep the value in `.env.local`. `wallets/SKILL.md` covers the rest of key handling.
- **A frontend-only ticket deploys nothing.** Do not stand up a chain and redeploy to regenerate `deployedContracts.ts` unless deploying was the ask.
rg: Makefile: No such file or directory (os error 2)
package.json:19:    "fork": "yarn foundry:fork",
package.json:29:    "foundry:fork": "yarn workspace @se-2/foundry fork",
packages/foundry/contracts/YourContract.sol:51:    // Print data to the anvil chain console. Remove when deploying to a live network.
packages/foundry/Makefile:1:.PHONY: build deploy generate-abis get-address account chain compile flatten fork format lint test verify
packages/foundry/Makefile:5:# setup wallet for anvil
packages/foundry/Makefile:6:setup-anvil-wallet:
packages/foundry/Makefile:11:chain: setup-anvil-wallet
packages/foundry/Makefile:12:	anvil
packages/foundry/Makefile:14:# Start a fork
packages/foundry/Makefile:15:fork: setup-anvil-wallet
packages/foundry/Makefile:16:	anvil --fork-url ${FORK_URL} --chain-id 31337
packages/foundry/Makefile:21:	@if [ "$(RPC_URL)" = "localhost" ]; then 		if [ "$(ETH_KEYSTORE_ACCOUNT)" = "scaffold-eth-default" ]; then 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --password localhost --broadcast --ffi; 		else 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --broadcast --ffi; 		fi 	else 		forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --broadcast --ffi; 	fi
packages/foundry/Makefile:60:	forge script script/VerifyAll.s.sol --ffi --rpc-url $(RPC_URL)
packages/foundry/foundry.toml:11:[rpc_endpoints]
packages/foundry/foundry.toml:22:polygonZkEvm = "https://zkevm-rpc.com"
packages/foundry/foundry.toml:23:polygonZkEvmTestnet = "https://rpc.public.zkevm-test.net"
packages/foundry/foundry.toml:24:gnosis = "https://rpc.gnosischain.com"
packages/foundry/foundry.toml:25:chiado = "https://rpc.chiadochain.net"
packages/foundry/foundry.toml:26:base = "https://mainnet.base.org"
packages/foundry/foundry.toml:27:baseSepolia = "https://sepolia.base.org"
packages/foundry/foundry.toml:28:scrollSepolia = "https://sepolia-rpc.scroll.io"
packages/foundry/foundry.toml:29:scroll = "https://rpc.scroll.io"
packages/foundry/foundry.toml:30:pgn = "https://rpc.publicgoods.network"
packages/foundry/scripts-js/parseArgs.js:65:// Check if the network exists in rpc_endpoints
packages/foundry/scripts-js/parseArgs.js:71:  if (!parsedToml.rpc_endpoints[network]) {
packages/foundry/scripts-js/parseArgs.js:74:      "\nPlease check `foundry.toml` for available networks in the [rpc_endpoints] section or add a new network."
packages/foundry/scripts-js/parseArgs.js:153:process.env.RPC_URL = network;
packages/foundry/scripts-js/generateTsAbis.js:114:        if (astNode.baseContracts.length > 0) {
packages/foundry/scripts-js/generateTsAbis.js:115:          inheritedFromContracts = astNode.baseContracts.map(
packages/foundry/scripts-js/generateTsAbis.js:116:            ({ baseName }) => baseName.name
packages/foundry/scripts-js/generateTsAbis.js:227:  // Update contract keys based on deployments if they exist
packages/foundry/scripts-js/checkAccountBalance.js:28:    // Extract rpc_endpoints from parsedToml
packages/foundry/scripts-js/checkAccountBalance.js:29:    const rpcEndpoints = parsedToml.rpc_endpoints;
packages/foundry/scripts-js/checkAccountBalance.js:31:    // Replace placeholders in the rpc_endpoints section
packages/foundry/scripts-js/checkAccountBalance.js:39:    for (const networkName in rpcEndpoints) {
packages/foundry/scripts-js/checkAccountBalance.js:40:      const networkUrl = replaceENVAlchemyKey(rpcEndpoints[networkName]);
packages/foundry/scripts-js/checkAccountBalance.js:44:        const provider = new ethers.providers.JsonRpcProvider(networkUrl);
packages/foundry/package.json:15:    "fork": "make fork FORK_URL=${1:-mainnet}",
packages/foundry/package.json:20:    "verify": "make verify RPC_URL=${1:-localhost}"
packages/foundry/.env.example:9:# On anvil chain the value of it can be empty since we use the prefunded account
packages/foundry/.env.example:10:# which comes with anvil chain to deploy contract.
packages/foundry/.env.example:14:# Alchemy rpc URL is used while deploying the contracts to some testnets/mainnets, checkout `foundry.toml` for it's use.
packages/nextjs/package.json:29:    "kubo-rpc-client": "~6.1.0",
packages/nextjs/scaffold.config.ts:5:export type BaseConfig = {
packages/nextjs/scaffold.config.ts:9:  rpcOverrides?: Record<number, string>;
packages/nextjs/scaffold.config.ts:14:export type ScaffoldConfig = BaseConfig ;
packages/nextjs/scaffold.config.ts:23:  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
packages/nextjs/scaffold.config.ts:30:  // If you want to use a different RPC for a specific network, you can add it here.
packages/nextjs/scaffold.config.ts:31:  // The key is the chain ID, and the value is the HTTP RPC URL
packages/nextjs/scaffold.config.ts:32:  rpcOverrides: {
packages/nextjs/scaffold.config.ts:34:    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
packages/nextjs/scaffold.config.ts:42:  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
packages/foundry/script/DeployHelpers.s.sol:12:    event AnvilSetBalance(address account, uint256 amount);
packages/foundry/script/DeployHelpers.s.sol:13:    event FailedAnvilRequest();
packages/foundry/script/DeployHelpers.s.sol:23:    uint256 constant ANVIL_BASE_BALANCE = 10000 ether;
packages/foundry/script/DeployHelpers.s.sol:44:            try vm.deal(_deployer, ANVIL_BASE_BALANCE) {
packages/foundry/script/DeployHelpers.s.sol:45:                emit AnvilSetBalance(_deployer, ANVIL_BASE_BALANCE);
packages/foundry/script/DeployHelpers.s.sol:47:                emit FailedAnvilRequest();
packages/foundry/script/DeployHelpers.s.sol:85:        string[2][] memory allRpcUrls = vm.rpcUrls();
packages/foundry/script/DeployHelpers.s.sol:86:        for (uint256 i = 0; i < allRpcUrls.length; i++) {
packages/foundry/script/DeployHelpers.s.sol:87:            try vm.createSelectFork(allRpcUrls[i][1]) {
packages/foundry/script/DeployHelpers.s.sol:89:                    return allRpcUrls[i][0];
./.agents/skills/x402/SKILL.md:14:[x402](https://www.x402.org/) is an open payment protocol by Coinbase that uses HTTP status code 402 ("Payment Required") to enable instant stablecoin micropayments over HTTP. When a client requests a protected resource without payment, the server responds with 402 + payment instructions. The client signs a payment, retries the request, and gets access.
./.agents/skills/x402/SKILL.md:16:This skill covers integrating x402 into SE-2 using Next.js middleware. For the full protocol spec and advanced usage, refer to the [x402 docs](https://docs.cdp.coinbase.com/x402/welcome) or the [GitHub repo](https://github.com/coinbase/x402). This skill focuses on SE-2 integration specifics and gotchas.
./.agents/skills/x402/SKILL.md:66:# CAIP-2 network identifier (eip155:84532 = Base Sepolia, eip155:8453 = Base Mainnet)
./.agents/skills/x402/SKILL.md:72:x402 payments happen onchain, so `targetNetworks` must include a supported chain. For development, use `baseSepolia`:
./.agents/skills/x402/SKILL.md:75:targetNetworks: [chains.baseSepolia],
./.agents/skills/x402/SKILL.md:171:| `eip155:84532` | Base Sepolia | Default for development — [Circle faucet](https://faucet.circle.com/) for test USDC |
./.agents/skills/x402/SKILL.md:172:| `eip155:8453` | Base | Recommended for production — lowest fees |
./.agents/skills/x402/SKILL.md:174:Legacy network names (`base-sepolia`, `base`, etc.) may still work for backwards compatibility, but prefer CAIP-2 format. For the full list of supported networks, check the [x402 docs](https://docs.cdp.coinbase.com/x402/welcome).
./.agents/skills/x402/SKILL.md:178:**Facilitator is required.** x402 doesn't do peer-to-peer payments. The facilitator service verifies signatures and executes settlements. For testnet, `https://x402.org/facilitator` works without signup. For production, you may need to run your own — check [x402 docs](https://docs.cdp.coinbase.com/x402/welcome).
./.agents/skills/x402/SKILL.md:218:1. Set `targetNetworks: [chains.baseSepolia]` in `scaffold.config.ts`
./.agents/skills/x402/SKILL.md:223:6. To test paid access: `yarn send402request` (needs funded wallet on Base Sepolia — get test USDC from [Circle faucet](https://faucet.circle.com/))
./.agents/skills/x402/SKILL.md:227:- Switch `NETWORK` to `eip155:8453` (Base mainnet)
./CONTRIBUTING.md:9:Scaffold-ETH 2 is a minimal and forkable repo providing builders with a starter kit to build decentralized applications on Ethereum.
./CONTRIBUTING.md:17:The repo can be forked to include integrations and more features, but we want to keep the master branch simple and minimal.
./CONTRIBUTING.md:65:We follow the ["fork-and-pull" Git workflow](https://github.com/susam/gitpr)
./CONTRIBUTING.md:67:1. Fork the repo
./CONTRIBUTING.md:71:5. Push changes to your fork
packages/foundry/script/DeployYourContract.s.sol:14: * yarn deploy --file DeployYourContract.s.sol  # local anvil chain
packages/foundry/script/DeployYourContract.s.sol:19:     * @dev Deployer setup based on `ETH_KEYSTORE_ACCOUNT` in `.env`:
packages/foundry/script/DeployYourContract.s.sol:20:     *      - "scaffold-eth-default": Uses Anvil's account #9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720), no password prompt
./.agents/skills/eip-5792/SKILL.md:111:- Consider a "switch to Coinbase Wallet" prompt for unsupported wallets
./.agents/skills/eip-5792/SKILL.md:115:**SE-2's burner wallet supports EIP-5792** with sequential (non-atomic) calls. Advanced capabilities like paymasters require a live testnet with a compliant wallet (Coinbase Wallet has the most complete implementation).
packages/nextjs/components/scaffold-eth/Faucet.tsx:44:              - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code> ?
packages/nextjs/components/scaffold-eth/Faucet.tsx:47:              - Or you can change <code className="italic bg-base-300 text-base font-bold">targetNetwork</code> in{" "}
packages/nextjs/components/scaffold-eth/Faucet.tsx:48:              <code className="italic bg-base-300 text-base font-bold">scaffold.config.ts</code>
packages/nextjs/utils/scaffold-eth/getParsedError.ts:1:import { BaseError as BaseViemError, ContractFunctionRevertedError } from "viem";
packages/nextjs/utils/scaffold-eth/getParsedError.ts:11:  if (parsedError instanceof BaseViemError) {
packages/nextjs/app/debug/_components/DebugContracts.tsx:18:        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
packages/nextjs/app/debug/_components/DebugContracts.tsx:47:                      ? "bg-base-300 hover:bg-base-300 no-animation"
packages/nextjs/app/debug/_components/DebugContracts.tsx:48:                      : "bg-base-100 hover:bg-secondary hover:text-secondary-content"
packages/nextjs/app/debug/page.tsx:19:          <code className="italic bg-base-300 text-base font-bold [word-spacing:-0.5rem] px-1">
packages/nextjs/utils/scaffold-eth/notification.tsx:49:        className={`flex flex-row items-start justify-between max-w-sm shadow-center shadow-accent bg-base-200 p-4 transform-gpu relative transition-all duration-500 ease-in-out space-x-2
./.agents/skills/subgraph/SKILL.md:354:**Linux users need `--hostname 0.0.0.0`.** The default Hardhat/Anvil config binds to `127.0.0.1`, which Docker can't reach. Add `--hostname 0.0.0.0` (Hardhat) or `--host 0.0.0.0` (Anvil) to the chain command. You may also need `sudo ufw allow 8545/tcp`.
packages/nextjs/app/not-found.tsx:5:    <div className="flex items-center h-full flex-1 justify-center bg-base-200">
packages/nextjs/app/not-found.tsx:9:        <p className="text-base-content/70 m-0 mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
./.agents/skills/ponder/SKILL.md:88:PONDER_RPC_URL_{chainId}=
./.agents/skills/ponder/SKILL.md:89:DATABASE_SCHEMA=my_schema
./.agents/skills/ponder/SKILL.md:90:DATABASE_URL=
./.agents/skills/ponder/SKILL.md:97:This is the critical integration piece. The config below is a reference implementation that dynamically reads SE-2's deployed contracts and scaffold config so Ponder automatically knows what to index. Adapt it based on the project's actual setup:
./.agents/skills/ponder/SKILL.md:116:    rpc:
./.agents/skills/ponder/SKILL.md:117:      process.env[`PONDER_RPC_URL_${targetNetwork.id}`] ||
./.agents/skills/ponder/SKILL.md:232:- For production, set `PONDER_RPC_URL_{chainId}` with a production RPC, optionally configure `DATABASE_URL` for Postgres (defaults to PGlite in dev), and point `NEXT_PUBLIC_PONDER_URL` to the deployed Ponder URL. See [Ponder deployment docs](https://ponder.sh/docs/production/railway).
packages/nextjs/utils/scaffold-eth/networks.ts:15:// Mapping of chainId to RPC chain name an format followed by alchemy and infura
packages/nextjs/utils/scaffold-eth/networks.ts:16:export const RPC_CHAIN_NAMES: Record<number, string> = {
packages/nextjs/utils/scaffold-eth/networks.ts:32:  [chains.base.id]: "base-mainnet",
packages/nextjs/utils/scaffold-eth/networks.ts:33:  [chains.baseGoerli.id]: "base-goerli",
packages/nextjs/utils/scaffold-eth/networks.ts:34:  [chains.baseSepolia.id]: "base-sepolia",
packages/nextjs/utils/scaffold-eth/networks.ts:40:  return scaffoldConfig.alchemyApiKey && RPC_CHAIN_NAMES[chainId]
packages/nextjs/utils/scaffold-eth/networks.ts:41:    ? `https://${RPC_CHAIN_NAMES[chainId]}.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`
packages/nextjs/components/scaffold-eth/RainbowKitCustomConnectButton/AddressInfoDropdown.tsx:64:        <ul className="dropdown-content menu z-2 p-2 mt-2 shadow-lg bg-base-200 gap-1">
./.agents/skills/siwe/SKILL.md:3:description: "Add Sign-In with Ethereum (SIWE) authentication to a Scaffold-ETH 2 project. Use when the user wants to: add wallet-based login, implement SIWE, authenticate users with their Ethereum wallet, add session management with wallet signing, build sign-in with Ethereum, or add Web3 authentication."
packages/nextjs/utils/scaffold-eth/getMetadata.ts:5:const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
packages/nextjs/utils/scaffold-eth/getMetadata.ts:19:  const imageUrl = `${baseUrl}${imageRelativePath}`;
packages/nextjs/utils/scaffold-eth/getMetadata.ts:22:  metadataBase: new URL(baseUrl),
./packages/foundry/foundry.toml:11:[rpc_endpoints]
./packages/foundry/foundry.toml:22:polygonZkEvm = "https://zkevm-rpc.com"
./packages/foundry/foundry.toml:23:polygonZkEvmTestnet = "https://rpc.public.zkevm-test.net"
./packages/foundry/foundry.toml:24:gnosis = "https://rpc.gnosischain.com"
./packages/foundry/foundry.toml:25:chiado = "https://rpc.chiadochain.net"
./packages/foundry/foundry.toml:26:base = "https://mainnet.base.org"
./packages/foundry/foundry.toml:27:baseSepolia = "https://sepolia.base.org"
./packages/foundry/foundry.toml:28:scrollSepolia = "https://sepolia-rpc.scroll.io"
./packages/foundry/foundry.toml:29:scroll = "https://rpc.scroll.io"
./packages/foundry/foundry.toml:30:pgn = "https://rpc.publicgoods.network"
packages/nextjs/components/scaffold-eth/RainbowKitCustomConnectButton/WrongNetworkDropdown.tsx:14:      <ul tabIndex={0} className="dropdown-content menu p-2 mt-1 shadow-lg bg-base-200 gap-1">
packages/nextjs/utils/scaffold-eth/fetchPriceFromUniswap.ts:8:const rpcFallbacks = alchemyHttpUrl ? [http(alchemyHttpUrl), http()] : [http()];
packages/nextjs/utils/scaffold-eth/fetchPriceFromUniswap.ts:11:  transport: fallback(rpcFallbacks),
./packages/foundry/contracts/YourContract.sol:51:    // Print data to the anvil chain console. Remove when deploying to a live network.
packages/nextjs/app/blockexplorer/_components/SearchBar.tsx:38:        className="border-primary bg-base-100 text-base-content placeholder:text-base-content/50 p-2 mr-2 w-full md:w-1/2 lg:w-1/3 focus:outline-hidden focus:ring-2 focus:ring-accent"
./.agents/skills/erc-721/SKILL.md:52:  "image": "data:image/svg+xml;base64,...",
./.agents/skills/erc-721/SKILL.md:78:### 5. IPFS Base URI Trailing Slash
./.agents/skills/erc-721/SKILL.md:80:OpenZeppelin's `tokenURI()` concatenates `_baseURI() + tokenId.toString()`. If the base URI is `ipfs://QmCID` without a trailing slash, token 42 becomes `ipfs://QmCID42` instead of `ipfs://QmCID/42`.
packages/nextjs/components/Footer.tsx:51:                Fork me
packages/nextjs/app/blockexplorer/_components/AddressComponent.tsx:24:          <div className="bg-base-100 border-base-300 border px-6 lg:px-8 mb-6 space-y-1 py-4 overflow-x-auto">
./.agents/skills/orchestration/SKILL.md:3:description: Use when a Scaffold-ETH 2 build leaves localhost — planning a launch or the order things go out in, deploying or verifying contracts on a live network, standing up a local fork of a real chain, or fixing a contract bug that is already onchain. Not for frontend implementation (`frontend-ux`), the pre-launch UI audit (`qa`), or IPFS/Vercel deploy mechanics (`frontend-playbook`).
./.agents/skills/orchestration/SKILL.md:12:- **Before deploying to the live network:** contract tests pass and the deploy script runs clean against a local fork.
./.agents/skills/orchestration/SKILL.md:20:`yarn verify --network base` (or your target chain) belongs immediately after `yarn deploy --network base`, not in a launch checklist weeks out. Until it runs, users and integrators are looking at opaque bytecode, and you are debugging a live contract without source on the explorer.
./.agents/skills/orchestration/SKILL.md:32:- **Fork the chain you are targeting rather than `yarn chain`** — `yarn fork --network base` gives you Uniswap, USDC, Aave and funded whales already deployed, so you write no mocks of things that exist. The flag is load-bearing: yarn swallows a bare positional argument, so `yarn fork base` silently forks Ethereum mainnet instead. In the hardhat flavor `yarn fork` ignores its argument entirely and always forks mainnet — change `forking.url` in `hardhat.config.ts` to fork anything else. Either way the fork answers chain id 31337, so the chain id never tells you what you forked: check for state only the target chain has, such as code at one of its token addresses.
./.agents/skills/orchestration/SKILL.md:33:- **`scaffold.config.ts` is committed.** An RPC or API key pasted into `rpcOverrides` or `alchemyApiKey` is a published key; read it from `process.env` and keep the value in `.env.local`. `wallets/SKILL.md` covers the rest of key handling.
./.agents/skills/openzeppelin/SKILL.md:29:- Don't implement token transfer hooks manually when the library's base contracts handle it
./.agents/skills/openzeppelin/SKILL.md:44:- `token/{ERC20,ERC721,ERC1155}/` — token standards and their base implementations
./packages/foundry/scripts-js/parseArgs.js:65:// Check if the network exists in rpc_endpoints
./packages/foundry/scripts-js/parseArgs.js:71:  if (!parsedToml.rpc_endpoints[network]) {
./packages/foundry/scripts-js/parseArgs.js:74:      "\nPlease check `foundry.toml` for available networks in the [rpc_endpoints] section or add a new network."
./packages/foundry/scripts-js/parseArgs.js:153:process.env.RPC_URL = network;
./packages/foundry/package.json:15:    "fork": "make fork FORK_URL=${1:-mainnet}",
./packages/foundry/package.json:20:    "verify": "make verify RPC_URL=${1:-localhost}"
packages/nextjs/components/Header.tsx:45:                isActive ? "bg-base-300" : ""
packages/nextjs/components/Header.tsx:46:              } hover:bg-base-300 focus:!bg-base-300 h-full px-4 text-sm gap-2 flex items-center whitespace-nowrap`}
packages/nextjs/components/Header.tsx:71:    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-16 shrink-0 justify-between z-20 border-b-2 border-base-300 p-0 sm:px-2">
packages/nextjs/components/Header.tsx:78:            className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg bg-base-100 w-52"
packages/nextjs/app/blockexplorer/_components/TransactionHash.tsx:16:          className="ml-1.5 text-xl font-normal text-base-content h-5 w-5 cursor-pointer"
./packages/foundry/.env.example:9:# On anvil chain the value of it can be empty since we use the prefunded account
./packages/foundry/.env.example:10:# which comes with anvil chain to deploy contract.
./packages/foundry/.env.example:14:# Alchemy rpc URL is used while deploying the contracts to some testnets/mainnets, checkout `foundry.toml` for it's use.
./packages/foundry/scripts-js/generateTsAbis.js:114:        if (astNode.baseContracts.length > 0) {
./packages/foundry/scripts-js/generateTsAbis.js:115:          inheritedFromContracts = astNode.baseContracts.map(
./packages/foundry/scripts-js/generateTsAbis.js:116:            ({ baseName }) => baseName.name
./packages/foundry/scripts-js/generateTsAbis.js:227:  // Update contract keys based on deployments if they exist
packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:14:      <div className="overflow-x-auto w-full border border-base-300">
packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:16:          <div className="bg-base-100 rounded-xl p-8 text-center text-base-content/70">
packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:20:          <table className="table text-xl bg-base-100 table-zebra w-full md:table-md table-sm">
packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:22:              <tr className="text-sm text-base-content">
./yarn.lock:204:"@base-org/account@npm:2.4.0":
./yarn.lock:206:  resolution: "@base-org/account@npm:2.4.0"
./yarn.lock:208:    "@coinbase/cdp-sdk": "npm:^1.0.0"
./yarn.lock:244:"@coinbase/cdp-sdk@npm:^1.0.0":
./yarn.lock:246:  resolution: "@coinbase/cdp-sdk@npm:1.52.0"
./yarn.lock:264:"@coinbase/wallet-sdk@npm:4.3.6":
./yarn.lock:266:  resolution: "@coinbase/wallet-sdk@npm:4.3.6"
./yarn.lock:1009:"@ethersproject/base64@npm:5.7.0":
./yarn.lock:1011:  resolution: "@ethersproject/base64@npm:5.7.0"
./yarn.lock:1018:"@ethersproject/base64@npm:^5.7.0, @ethersproject/base64@npm:^5.8.0":
./yarn.lock:1020:  resolution: "@ethersproject/base64@npm:5.8.0"
./yarn.lock:1027:"@ethersproject/basex@npm:5.7.0":
./yarn.lock:1029:  resolution: "@ethersproject/basex@npm:5.7.0"
./yarn.lock:1037:"@ethersproject/basex@npm:^5.7.0, @ethersproject/basex@npm:^5.8.0":
./yarn.lock:1039:  resolution: "@ethersproject/basex@npm:5.8.0"
./yarn.lock:1129:    "@ethersproject/base64": "npm:^5.7.0"
./yarn.lock:1146:    "@ethersproject/base64": "npm:^5.8.0"
./yarn.lock:1162:    "@ethersproject/basex": "npm:^5.7.0"
./yarn.lock:1182:    "@ethersproject/basex": "npm:^5.8.0"
./yarn.lock:1336:    "@ethersproject/base64": "npm:^5.7.0"
./yarn.lock:1337:    "@ethersproject/basex": "npm:^5.7.0"
./yarn.lock:1569:    "@ethersproject/base64": "npm:^5.7.0"
./yarn.lock:1582:    "@ethersproject/base64": "npm:^5.8.0"
./yarn.lock:1635:    "@metamask/rpc-errors": "npm:7.0.2"
./yarn.lock:2347:"@metamask/eth-json-rpc-provider@npm:^1.0.0":
./yarn.lock:2349:  resolution: "@metamask/eth-json-rpc-provider@npm:1.0.1"
./yarn.lock:2351:    "@metamask/json-rpc-engine": "npm:^7.0.0"
./yarn.lock:2358:"@metamask/json-rpc-engine@npm:^7.0.0":
./yarn.lock:2360:  resolution: "@metamask/json-rpc-engine@npm:7.3.3"
./yarn.lock:2362:    "@metamask/rpc-errors": "npm:^6.2.1"
./yarn.lock:2369:"@metamask/json-rpc-engine@npm:^8.0.1, @metamask/json-rpc-engine@npm:^8.0.2":
./yarn.lock:2371:  resolution: "@metamask/json-rpc-engine@npm:8.0.2"
./yarn.lock:2373:    "@metamask/rpc-errors": "npm:^6.2.1"
./yarn.lock:2380:"@metamask/json-rpc-middleware-stream@npm:^7.0.1":
./yarn.lock:2382:  resolution: "@metamask/json-rpc-middleware-stream@npm:7.0.2"
./yarn.lock:2384:    "@metamask/json-rpc-engine": "npm:^8.0.2"
./yarn.lock:2415:    "@metamask/json-rpc-engine": "npm:^8.0.1"
./yarn.lock:2416:    "@metamask/json-rpc-middleware-stream": "npm:^7.0.1"
./yarn.lock:2418:    "@metamask/rpc-errors": "npm:^6.2.1"
./yarn.lock:2431:"@metamask/rpc-errors@npm:7.0.2":
./yarn.lock:2433:  resolution: "@metamask/rpc-errors@npm:7.0.2"
./yarn.lock:2441:"@metamask/rpc-errors@npm:^6.2.1":
./yarn.lock:2443:  resolution: "@metamask/rpc-errors@npm:6.4.0"
./yarn.lock:2518:    eth-rpc-errors: "npm:^4.0.3"
./yarn.lock:2545:    "@scure/base": "npm:^1.1.3"
./yarn.lock:2577:    "@scure/base": "npm:^1.1.3"
./yarn.lock:2594:    "@scure/base": "npm:^1.1.3"
./yarn.lock:2933:    agent-base: "npm:^7.1.0"
./yarn.lock:3365:"@protobufjs/base64@npm:^1.1.2":
./yarn.lock:3367:  resolution: "@protobufjs/base64@npm:1.1.2"
./yarn.lock:3787:"@scure/base@npm:^1.1.3, @scure/base@npm:~1.2.2, @scure/base@npm:~1.2.4, @scure/base@npm:~1.2.5":
./yarn.lock:3789:  resolution: "@scure/base@npm:1.2.6"
./yarn.lock:3794:"@scure/base@npm:~1.1.6":
./yarn.lock:3796:  resolution: "@scure/base@npm:1.1.9"
./yarn.lock:3807:    "@scure/base": "npm:~1.1.6"
./yarn.lock:3818:    "@scure/base": "npm:~1.2.2"
./yarn.lock:3829:    "@scure/base": "npm:~1.2.5"
./yarn.lock:3839:    "@scure/base": "npm:~1.1.6"
./yarn.lock:3849:    "@scure/base": "npm:~1.2.4"
./yarn.lock:3859:    "@scure/base": "npm:~1.2.5"
./yarn.lock:3902:    kubo-rpc-client: "npm:~6.1.0"
./yarn.lock:4044:    "@solana/rpc-spec": "npm:5.5.1"
./yarn.lock:4045:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4277:    "@solana/rpc": "npm:5.5.1"
./yarn.lock:4278:    "@solana/rpc-api": "npm:5.5.1"
./yarn.lock:4279:    "@solana/rpc-parsed-types": "npm:5.5.1"
./yarn.lock:4280:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4281:    "@solana/rpc-subscriptions": "npm:5.5.1"
./yarn.lock:4282:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4387:"@solana/rpc-api@npm:5.5.1":
./yarn.lock:4389:  resolution: "@solana/rpc-api@npm:5.5.1"
./yarn.lock:4396:    "@solana/rpc-parsed-types": "npm:5.5.1"
./yarn.lock:4397:    "@solana/rpc-spec": "npm:5.5.1"
./yarn.lock:4398:    "@solana/rpc-transformers": "npm:5.5.1"
./yarn.lock:4399:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4411:"@solana/rpc-parsed-types@npm:5.5.1":
./yarn.lock:4413:  resolution: "@solana/rpc-parsed-types@npm:5.5.1"
./yarn.lock:4423:"@solana/rpc-spec-types@npm:5.5.1":
./yarn.lock:4425:  resolution: "@solana/rpc-spec-types@npm:5.5.1"
./yarn.lock:4435:"@solana/rpc-spec@npm:5.5.1":
./yarn.lock:4437:  resolution: "@solana/rpc-spec@npm:5.5.1"
./yarn.lock:4440:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4450:"@solana/rpc-subscriptions-api@npm:5.5.1":
./yarn.lock:4452:  resolution: "@solana/rpc-subscriptions-api@npm:5.5.1"
./yarn.lock:4456:    "@solana/rpc-subscriptions-spec": "npm:5.5.1"
./yarn.lock:4457:    "@solana/rpc-transformers": "npm:5.5.1"
./yarn.lock:4458:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4470:"@solana/rpc-subscriptions-channel-websocket@npm:5.5.1":
./yarn.lock:4472:  resolution: "@solana/rpc-subscriptions-channel-websocket@npm:5.5.1"
./yarn.lock:4476:    "@solana/rpc-subscriptions-spec": "npm:5.5.1"
./yarn.lock:4488:"@solana/rpc-subscriptions-spec@npm:5.5.1":
./yarn.lock:4490:  resolution: "@solana/rpc-subscriptions-spec@npm:5.5.1"
./yarn.lock:4494:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4505:"@solana/rpc-subscriptions@npm:5.5.1":
./yarn.lock:4507:  resolution: "@solana/rpc-subscriptions@npm:5.5.1"
./yarn.lock:4513:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4514:    "@solana/rpc-subscriptions-api": "npm:5.5.1"
./yarn.lock:4515:    "@solana/rpc-subscriptions-channel-websocket": "npm:5.5.1"
./yarn.lock:4516:    "@solana/rpc-subscriptions-spec": "npm:5.5.1"
./yarn.lock:4517:    "@solana/rpc-transformers": "npm:5.5.1"
./yarn.lock:4518:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4529:"@solana/rpc-transformers@npm:5.5.1":
./yarn.lock:4531:  resolution: "@solana/rpc-transformers@npm:5.5.1"
./yarn.lock:4536:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4537:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4547:"@solana/rpc-transport-http@npm:5.5.1":
./yarn.lock:4549:  resolution: "@solana/rpc-transport-http@npm:5.5.1"
./yarn.lock:4552:    "@solana/rpc-spec": "npm:5.5.1"
./yarn.lock:4553:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4564:"@solana/rpc-types@npm:5.5.1":
./yarn.lock:4566:  resolution: "@solana/rpc-types@npm:5.5.1"
./yarn.lock:4583:"@solana/rpc@npm:5.5.1":
./yarn.lock:4585:  resolution: "@solana/rpc@npm:5.5.1"
./yarn.lock:4590:    "@solana/rpc-api": "npm:5.5.1"
./yarn.lock:4591:    "@solana/rpc-spec": "npm:5.5.1"
./yarn.lock:4592:    "@solana/rpc-spec-types": "npm:5.5.1"
./yarn.lock:4593:    "@solana/rpc-transformers": "npm:5.5.1"
./yarn.lock:4594:    "@solana/rpc-transport-http": "npm:5.5.1"
./yarn.lock:4595:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4648:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4667:    "@solana/rpc": "npm:5.5.1"
./yarn.lock:4668:    "@solana/rpc-subscriptions": "npm:5.5.1"
./yarn.lock:4669:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4693:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4717:    "@solana/rpc-types": "npm:5.5.1"
./yarn.lock:4728:"@stauro/filebase-upload@npm:^1.0.1":
./yarn.lock:4730:  resolution: "@stauro/filebase-upload@npm:1.0.3"
./yarn.lock:5907:    "@base-org/account": "npm:2.4.0"
./yarn.lock:5908:    "@coinbase/wallet-sdk": "npm:4.3.6"
./yarn.lock:5914:    cbw-sdk: "npm:@coinbase/wallet-sdk@3.9.3"
./yarn.lock:5952:    "@walletconnect/jsonrpc-provider": "npm:1.0.14"
./yarn.lock:5953:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:5954:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:5955:    "@walletconnect/jsonrpc-ws-connection": "npm:1.0.16"
./yarn.lock:5977:    "@walletconnect/jsonrpc-provider": "npm:1.0.14"
./yarn.lock:5978:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:5979:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:5980:    "@walletconnect/jsonrpc-ws-connection": "npm:1.0.16"
./yarn.lock:6011:    "@walletconnect/jsonrpc-http-connection": "npm:1.0.8"
./yarn.lock:6012:    "@walletconnect/jsonrpc-provider": "npm:1.0.14"
./yarn.lock:6013:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:6014:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6046:"@walletconnect/jsonrpc-http-connection@npm:1.0.8":
./yarn.lock:6048:  resolution: "@walletconnect/jsonrpc-http-connection@npm:1.0.8"
./yarn.lock:6050:    "@walletconnect/jsonrpc-utils": "npm:^1.0.6"
./yarn.lock:6058:"@walletconnect/jsonrpc-provider@npm:1.0.14":
./yarn.lock:6060:  resolution: "@walletconnect/jsonrpc-provider@npm:1.0.14"
./yarn.lock:6062:    "@walletconnect/jsonrpc-utils": "npm:^1.0.8"
./yarn.lock:6069:"@walletconnect/jsonrpc-types@npm:1.0.4, @walletconnect/jsonrpc-types@npm:^1.0.2, @walletconnect/jsonrpc-types@npm:^1.0.3":
./yarn.lock:6071:  resolution: "@walletconnect/jsonrpc-types@npm:1.0.4"
./yarn.lock:6079:"@walletconnect/jsonrpc-utils@npm:1.0.8, @walletconnect/jsonrpc-utils@npm:^1.0.6, @walletconnect/jsonrpc-utils@npm:^1.0.8":
./yarn.lock:6081:  resolution: "@walletconnect/jsonrpc-utils@npm:1.0.8"
./yarn.lock:6084:    "@walletconnect/jsonrpc-types": "npm:^1.0.3"
./yarn.lock:6090:"@walletconnect/jsonrpc-ws-connection@npm:1.0.16":
./yarn.lock:6092:  resolution: "@walletconnect/jsonrpc-ws-connection@npm:1.0.16"
./yarn.lock:6094:    "@walletconnect/jsonrpc-utils": "npm:^1.0.6"
./yarn.lock:6132:    "@walletconnect/jsonrpc-types": "npm:^1.0.2"
./yarn.lock:6166:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6183:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6208:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:6222:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:6235:    "@walletconnect/jsonrpc-http-connection": "npm:1.0.8"
./yarn.lock:6236:    "@walletconnect/jsonrpc-provider": "npm:1.0.14"
./yarn.lock:6237:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:6238:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6255:    "@walletconnect/jsonrpc-http-connection": "npm:1.0.8"
./yarn.lock:6256:    "@walletconnect/jsonrpc-provider": "npm:1.0.14"
./yarn.lock:6257:    "@walletconnect/jsonrpc-types": "npm:1.0.4"
./yarn.lock:6258:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6277:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6302:    "@walletconnect/jsonrpc-utils": "npm:1.0.8"
./yarn.lock:6515:"agent-base@npm:^7.0.2, agent-base@npm:^7.1.0, agent-base@npm:^7.1.2":
./yarn.lock:6517:  resolution: "agent-base@npm:7.1.4"
./yarn.lock:6971:"base-x@npm:^5.0.0":
./yarn.lock:6973:  resolution: "base-x@npm:5.0.1"
./yarn.lock:6978:"base64-js@npm:^1.3.1":
./yarn.lock:6980:  resolution: "base64-js@npm:1.5.1"
./yarn.lock:6985:"baseline-browser-mapping@npm:^2.10.42, baseline-browser-mapping@npm:^2.9.19":
./yarn.lock:6987:  resolution: "baseline-browser-mapping@npm:2.10.43"
./yarn.lock:6989:    baseline-browser-mapping: dist/cli.cjs
./yarn.lock:7021:    kubo-rpc-client: "npm:^5.0.2"
./yarn.lock:7178:    baseline-browser-mapping: "npm:^2.10.42"
./yarn.lock:7193:    base-x: "npm:^5.0.0"
./yarn.lock:7209:    base64-js: "npm:^1.3.1"
./yarn.lock:7352:"cbw-sdk@npm:@coinbase/wallet-sdk@3.9.3":
./yarn.lock:7354:  resolution: "@coinbase/wallet-sdk@npm:3.9.3"
./yarn.lock:7360:    eth-json-rpc-filters: "npm:^6.0.0"
./yarn.lock:9031:    "@metamask/eth-json-rpc-provider": "npm:^1.0.0"
./yarn.lock:9034:    json-rpc-random-id: "npm:^1.0.1"
./yarn.lock:9040:"eth-json-rpc-filters@npm:^6.0.0":
./yarn.lock:9042:  resolution: "eth-json-rpc-filters@npm:6.0.1"
./yarn.lock:9047:    json-rpc-engine: "npm:^6.1.0"
./yarn.lock:9057:    json-rpc-random-id: "npm:^1.0.0"
./yarn.lock:9063:"eth-rpc-errors@npm:^4.0.2, eth-rpc-errors@npm:^4.0.3":
./yarn.lock:9065:  resolution: "eth-rpc-errors@npm:4.0.3"
./yarn.lock:9092:    "@ethersproject/base64": "npm:5.7.0"
./yarn.lock:9093:    "@ethersproject/basex": "npm:5.7.0"
./yarn.lock:10036:    agent-base: "npm:^7.1.0"
./yarn.lock:10056:    agent-base: "npm:^7.1.2"
./yarn.lock:10375:    "@stauro/filebase-upload": "npm:^1.0.1"
./yarn.lock:10380:    kubo-rpc-client: "npm:^5.0.2"
./yarn.lock:11085:"json-rpc-engine@npm:^6.1.0":
./yarn.lock:11087:  resolution: "json-rpc-engine@npm:6.1.0"
./yarn.lock:11090:    eth-rpc-errors: "npm:^4.0.2"
./yarn.lock:11095:"json-rpc-random-id@npm:^1.0.0, json-rpc-random-id@npm:^1.0.1":
./yarn.lock:11097:  resolution: "json-rpc-random-id@npm:1.0.1"
./yarn.lock:11250:"kubo-rpc-client@npm:^5.0.2":
./yarn.lock:11252:  resolution: "kubo-rpc-client@npm:5.4.1"
./yarn.lock:11291:"kubo-rpc-client@npm:~6.1.0":
./yarn.lock:11293:  resolution: "kubo-rpc-client@npm:6.1.0"
./yarn.lock:12316:    baseline-browser-mapping: "npm:^2.9.19"
./yarn.lock:13273:    agent-base: "npm:^7.1.2"
./yarn.lock:13808:    "@protobufjs/base64": "npm:^1.1.2"
./yarn.lock:13859:    agent-base: "npm:^7.0.2"
./yarn.lock:14954:    agent-base: "npm:^7.1.2"
./yarn.lock:16111:    "@planetscale/database": ^1.19.0
./yarn.lock:16140:    "@planetscale/database":
./packages/foundry/scripts-js/checkAccountBalance.js:28:    // Extract rpc_endpoints from parsedToml
./packages/foundry/scripts-js/checkAccountBalance.js:29:    const rpcEndpoints = parsedToml.rpc_endpoints;
./packages/foundry/scripts-js/checkAccountBalance.js:31:    // Replace placeholders in the rpc_endpoints section
./packages/foundry/scripts-js/checkAccountBalance.js:39:    for (const networkName in rpcEndpoints) {
./packages/foundry/scripts-js/checkAccountBalance.js:40:      const networkUrl = replaceENVAlchemyKey(rpcEndpoints[networkName]);
./packages/foundry/scripts-js/checkAccountBalance.js:44:        const provider = new ethers.providers.JsonRpcProvider(networkUrl);
packages/nextjs/services/web3/wagmiConfig.tsx:20:  client: ({ chain }) => { const mainnetFallbackWithDefaultRPC = [http("https://mainnet.rpc.buidlguidl.com")]; let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()]; const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id]; if (rpcOverrideUrl) { rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks]; } else { const alchemyHttpUrl = getAlchemyHttpUrl(chain.id); if (alchemyHttpUrl) { const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY; rpcFallbacks = isUsingDefaultKey ? [...rpcFallbacks, http(alchemyHttpUrl)] : [http(alchemyHttpUrl), ...rpcFallbacks]; } } return createClient({ chain, transport: fallback(rpcFallbacks), ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}), }); }
./TASK.md:2:local fork of Base, because the contract we're about to write reads USDC
./TASK.md:3:on Base at 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
./TASK.md:7:    Start the chain with `yarn fork base` — that gives you Base with all
./TASK.md:9:    chain-id` against your local node; if you get a chain id back, the
./TASK.md:10:    fork is up and you're on Base.
./TASK.md:15:the chain-id check, got a number, and concluded the fork was healthy and
./TASK.md:18:Sort this out in this checkout and write FORK.md at the repo root:
./TASK.md:22:- the command that actually gives us a fork of Base here
./TASK.md:24:  a fork of Base from a fork of some other chain
./TASK.md:27:relying on. Running things is fine; finished FORK.md in the working tree
./.agents/skills/drizzle-neon/SKILL.md:3:description: "Add a PostgreSQL database with Drizzle ORM to a Scaffold-ETH 2 project. Use when the user wants to: add a database, use Drizzle ORM, integrate Neon PostgreSQL, store off-chain data, build a backend with database, or add persistent storage to their dApp."
./.agents/skills/drizzle-neon/SKILL.md:14:[Drizzle ORM](https://orm.drizzle.team/) is a TypeScript ORM for SQL databases with a type-safe query builder. [Neon](https://neon.tech/) is a serverless PostgreSQL platform. This skill integrates both into SE-2, with a smart database client that auto-detects the environment (local Postgres via Docker, Neon serverless, or Neon HTTP) and uses the optimal driver.
./.agents/skills/drizzle-neon/SKILL.md:27:    "db:seed": "tsx services/database/seed.ts",
./.agents/skills/drizzle-neon/SKILL.md:28:    "db:wipe": "tsx services/database/wipe.ts",
./.agents/skills/drizzle-neon/SKILL.md:32:    "@neondatabase/serverless": "^1.0.0",
./.agents/skills/drizzle-neon/SKILL.md:85:## Database Client Architecture
./.agents/skills/drizzle-neon/SKILL.md:87:The key integration piece is a smart database client at `packages/nextjs/services/database/config/postgresClient.ts` that auto-selects the right Postgres driver based on the connection string and runtime:
./.agents/skills/drizzle-neon/SKILL.md:91:| `neondb` | Next.js (`NEXT_RUNTIME` set) | `drizzle-orm/neon-serverless` | WebSocket-based, works in serverless |
./.agents/skills/drizzle-neon/SKILL.md:100:// packages/nextjs/services/database/config/postgresClient.ts
./.agents/skills/drizzle-neon/SKILL.md:102:import { Pool as NeonPool, neon } from "@neondatabase/serverless";
./.agents/skills/drizzle-neon/SKILL.md:108:export const PRODUCTION_DATABASE_HOSTNAME = "your-production-database-hostname";
./.agents/skills/drizzle-neon/SKILL.md:161:Define tables in `packages/nextjs/services/database/config/schema.ts`:
./.agents/skills/drizzle-neon/SKILL.md:164:// packages/nextjs/services/database/config/schema.ts
./.agents/skills/drizzle-neon/SKILL.md:187:  schema: "./services/database/config/schema.ts",
./.agents/skills/drizzle-neon/SKILL.md:188:  out: "./services/database/migrations",
./.agents/skills/drizzle-neon/SKILL.md:201:Use a repository pattern at `packages/nextjs/services/database/repositories/`. Each entity gets its own file with typed CRUD functions:
./.agents/skills/drizzle-neon/SKILL.md:204:// packages/nextjs/services/database/repositories/users.ts
./.agents/skills/drizzle-neon/SKILL.md:208:import { db } from "~~/services/database/config/postgresClient";
./.agents/skills/drizzle-neon/SKILL.md:227:## Using the Database in Next.js
./.agents/skills/drizzle-neon/SKILL.md:233:import { getAllUsers, createUser } from "~~/services/database/repositories/users";
./.agents/skills/drizzle-neon/SKILL.md:242:import { createUser } from "~~/services/database/repositories/users";
./.agents/skills/drizzle-neon/SKILL.md:253:## Database Workflow
./.agents/skills/drizzle-neon/SKILL.md:274:**Don't import the `db` client in client components.** The database client only works server-side (Server Components, API routes, Server Actions). For client-side mutations, use API routes or Server Actions.
./.agents/skills/drizzle-neon/SKILL.md:276:**Docker must be running for local development.** If `docker compose up` hasn't been run, the database connection will fail. The `.env.development` points to `localhost:5432`.
./.agents/skills/drizzle-neon/SKILL.md:278:**Production safety guard.** The seed/wipe scripts should check if the connection URL points to production (via `PRODUCTION_DATABASE_HOSTNAME`). Update `your-production-database-hostname` in `postgresClient.ts` to your actual Neon project hostname to enable this protection.
./.agents/skills/drizzle-neon/SKILL.md:295:3. Update `PRODUCTION_DATABASE_HOSTNAME` in `postgresClient.ts` to your Neon project hostname
./.agents/skills/drizzle-neon/SKILL.md:297:5. The database client auto-switches to Neon's serverless driver
packages/nextjs/services/web3/wagmiConnectors.tsx:3:  baseAccount,
packages/nextjs/services/web3/wagmiConnectors.tsx:24:  baseAccount,
./package.json:19:    "fork": "yarn foundry:fork",
./package.json:29:    "foundry:fork": "yarn workspace @se-2/foundry fork",
packages/nextjs/app/blockexplorer/page.tsx:34:            <code className="italic bg-base-300 text-base font-bold"> targetNetwork </code> is not localhost
packages/nextjs/app/blockexplorer/page.tsx:37:            - You are on <code className="italic bg-base-300 text-base font-bold">{targetNetwork.name}</code> .This
packages/nextjs/app/blockexplorer/page.tsx:38:            block explorer is only for <code className="italic bg-base-300 text-base font-bold">localhost</code>.
packages/nextjs/app/blockexplorer/page.tsx:63:            - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code> ?
packages/nextjs/app/blockexplorer/page.tsx:66:            - Or you can change <code className="italic bg-base-300 text-base font-bold">targetNetwork</code> in{" "}
packages/nextjs/app/blockexplorer/page.tsx:67:            <code className="italic bg-base-300 text-base font-bold">scaffold.config.ts</code>
./packages/foundry/script/DeployHelpers.s.sol:12:    event AnvilSetBalance(address account, uint256 amount);
./packages/foundry/script/DeployHelpers.s.sol:13:    event FailedAnvilRequest();
./packages/foundry/script/DeployHelpers.s.sol:23:    uint256 constant ANVIL_BASE_BALANCE = 10000 ether;
./packages/foundry/script/DeployHelpers.s.sol:44:            try vm.deal(_deployer, ANVIL_BASE_BALANCE) {
./packages/foundry/script/DeployHelpers.s.sol:45:                emit AnvilSetBalance(_deployer, ANVIL_BASE_BALANCE);
./packages/foundry/script/DeployHelpers.s.sol:47:                emit FailedAnvilRequest();
./packages/foundry/script/DeployHelpers.s.sol:85:        string[2][] memory allRpcUrls = vm.rpcUrls();
./packages/foundry/script/DeployHelpers.s.sol:86:        for (uint256 i = 0; i < allRpcUrls.length; i++) {
./packages/foundry/script/DeployHelpers.s.sol:87:            try vm.createSelectFork(allRpcUrls[i][1]) {
./packages/foundry/script/DeployHelpers.s.sol:89:                    return allRpcUrls[i][0];
packages/nextjs/styles/globals.css:27:  --color-base-100: #ffffff;
packages/nextjs/styles/globals.css:28:  --color-base-200: #f4f8ff;
packages/nextjs/styles/globals.css:29:  --color-base-300: #dae8ff;
packages/nextjs/styles/globals.css:30:  --color-base-content: #212638;
packages/nextjs/styles/globals.css:54:  --color-base-100: #385183;
packages/nextjs/styles/globals.css:55:  --color-base-200: #2a3655;
packages/nextjs/styles/globals.css:56:  --color-base-300: #212638;
packages/nextjs/styles/globals.css:57:  --color-base-content: #f9fbff;
packages/nextjs/styles/globals.css:79:@layer base {
packages/nextjs/styles/globals.css:107:  background: var(--color-base-200);
./.agents/agents/grumpy-carlos-code-reviewer.md:21:   - Code that doesn't "feel" like it belongs in a well-maintained codebase
./.agents/agents/grumpy-carlos-code-reviewer.md:95:  - Use daisyUI color utilities: `btn-primary`, `btn-error`, `badge-success`, `text-base-content`, etc.
./.agents/agents/grumpy-carlos-code-reviewer.md:96:  - Use daisyUI theme variables: `bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content/70`
./.agents/agents/grumpy-carlos-code-reviewer.md:179:- Inconsistent patterns within the same codebase
./AGENTS.md:7:Scaffold-ETH 2 (SE-2) is a starter kit for building dApps on Ethereum. It comes in **two flavors** based on the Solidity framework:
./AGENTS.md:29:yarn chain          # Start local blockchain (Hardhat or Anvil)
./AGENTS.md:50:yarn deploy --network <network>   # e.g., sepolia, mainnet, base
./AGENTS.md:146:**IMPORTANT: Always use hooks from `packages/nextjs/hooks/scaffold-eth` for contract interactions. Always refer to the hook names as they exist in the codebase.**
./AGENTS.md:169:<div className="card bg-base-100 shadow-xl">...</div>
./AGENTS.md:183:Add RPC endpoints in `packages/foundry/foundry.toml` if not present.
./AGENTS.md:241:- **erc-721** — NFT-specific pitfalls: `_safeMint` reentrancy, on-chain SVG stack-too-deep, marketplace metadata `attributes`, IPFS base URI trailing slash
./AGENTS.md:246:- **drizzle-neon** — Drizzle ORM, Neon PostgreSQL, database integration, off-chain storage
./packages/foundry/script/DeployYourContract.s.sol:14: * yarn deploy --file DeployYourContract.s.sol  # local anvil chain
./packages/foundry/script/DeployYourContract.s.sol:19:     * @dev Deployer setup based on `ETH_KEYSTORE_ACCOUNT` in `.env`:
./packages/foundry/script/DeployYourContract.s.sol:20:     *      - "scaffold-eth-default": Uses Anvil's account #9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720), no password prompt
./packages/foundry/Makefile:1:.PHONY: build deploy generate-abis get-address account chain compile flatten fork format lint test verify
./packages/foundry/Makefile:5:# setup wallet for anvil
./packages/foundry/Makefile:6:setup-anvil-wallet:
./packages/foundry/Makefile:11:chain: setup-anvil-wallet
./packages/foundry/Makefile:12:	anvil
./packages/foundry/Makefile:14:# Start a fork
./packages/foundry/Makefile:15:fork: setup-anvil-wallet
./packages/foundry/Makefile:16:	anvil --fork-url ${FORK_URL} --chain-id 31337
./packages/foundry/Makefile:21:	@if [ "$(RPC_URL)" = "localhost" ]; then 		if [ "$(ETH_KEYSTORE_ACCOUNT)" = "scaffold-eth-default" ]; then 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --password localhost --broadcast --ffi; 		else 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --broadcast --ffi; 		fi 	else 		forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --broadcast --ffi; 	fi
./packages/foundry/Makefile:60:	forge script script/VerifyAll.s.sol --ffi --rpc-url $(RPC_URL)
packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts:58: * @deprecated **Recommended only for local (hardhat/anvil) chains and development.**
packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts:59: * It uses getLogs which can overload RPC endpoints (especially on L2s with short block times).
packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts:103:        "⚠️ useScaffoldEventHistory is not optimized for production use. It can overload RPC endpoints (especially on L2s)",
./packages/nextjs/package.json:29:    "kubo-rpc-client": "~6.1.0",
packages/nextjs/app/page.tsx:32:  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
packages/nextjs/app/page.tsx:38:  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
packages/nextjs/app/page.tsx:42:  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
packages/nextjs/app/page.tsx:49:        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
packages/nextjs/app/page.tsx:51:            <div className="flex flex-col bg-base-100 border border-base-300 px-10 py-10 text-center items-center max-w-xs">
packages/nextjs/app/page.tsx:61:            <div className="flex flex-col bg-base-100 border border-base-300 px-10 py-10 text-center items-center max-w-xs">
packages/nextjs/app/blockexplorer/transaction/_components/TransactionComp.tsx:48:          <table className="table bg-base-100 w-full border border-base-300 md:table-lg table-md">
packages/nextjs/app/blockexplorer/transaction/_components/TransactionComp.tsx:148:        <p className="text-2xl text-base-content">Loading...</p>
./packages/nextjs/scaffold.config.ts:5:export type BaseConfig = {
./packages/nextjs/scaffold.config.ts:9:  rpcOverrides?: Record<number, string>;
./packages/nextjs/scaffold.config.ts:14:export type ScaffoldConfig = BaseConfig ;
./packages/nextjs/scaffold.config.ts:23:  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
./packages/nextjs/scaffold.config.ts:30:  // If you want to use a different RPC for a specific network, you can add it here.
./packages/nextjs/scaffold.config.ts:31:  // The key is the chain ID, and the value is the HTTP RPC URL
./packages/nextjs/scaffold.config.ts:32:  rpcOverrides: {
./packages/nextjs/scaffold.config.ts:34:    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
./packages/nextjs/scaffold.config.ts:42:  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
./packages/nextjs/app/page.tsx:32:  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
./packages/nextjs/app/page.tsx:38:  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
./packages/nextjs/app/page.tsx:42:  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
./packages/nextjs/app/page.tsx:49:        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
./packages/nextjs/app/page.tsx:51:            <div className="flex flex-col bg-base-100 border border-base-300 px-10 py-10 text-center items-center max-w-xs">
./packages/nextjs/app/page.tsx:61:            <div className="flex flex-col bg-base-100 border border-base-300 px-10 py-10 text-center items-center max-w-xs">
./packages/nextjs/app/not-found.tsx:5:    <div className="flex items-center h-full flex-1 justify-center bg-base-200">
./packages/nextjs/app/not-found.tsx:9:        <p className="text-base-content/70 m-0 mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
./packages/nextjs/styles/globals.css:27:  --color-base-100: #ffffff;
./packages/nextjs/styles/globals.css:28:  --color-base-200: #f4f8ff;
./packages/nextjs/styles/globals.css:29:  --color-base-300: #dae8ff;
./packages/nextjs/styles/globals.css:30:  --color-base-content: #212638;
./packages/nextjs/styles/globals.css:54:  --color-base-100: #385183;
./packages/nextjs/styles/globals.css:55:  --color-base-200: #2a3655;
./packages/nextjs/styles/globals.css:56:  --color-base-300: #212638;
./packages/nextjs/styles/globals.css:57:  --color-base-content: #f9fbff;
./packages/nextjs/styles/globals.css:79:@layer base {
./packages/nextjs/styles/globals.css:107:  background: var(--color-base-200);
./packages/nextjs/app/debug/_components/DebugContracts.tsx:18:        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
./packages/nextjs/app/debug/_components/DebugContracts.tsx:47:                      ? "bg-base-300 hover:bg-base-300 no-animation"
./packages/nextjs/app/debug/_components/DebugContracts.tsx:48:                      : "bg-base-100 hover:bg-secondary hover:text-secondary-content"
./packages/nextjs/app/debug/page.tsx:19:          <code className="italic bg-base-300 text-base font-bold [word-spacing:-0.5rem] px-1">
./packages/nextjs/utils/scaffold-eth/getParsedError.ts:1:import { BaseError as BaseViemError, ContractFunctionRevertedError } from "viem";
./packages/nextjs/utils/scaffold-eth/getParsedError.ts:11:  if (parsedError instanceof BaseViemError) {
./packages/nextjs/components/scaffold-eth/Faucet.tsx:44:              - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code> ?
./packages/nextjs/components/scaffold-eth/Faucet.tsx:47:              - Or you can change <code className="italic bg-base-300 text-base font-bold">targetNetwork</code> in{" "}
./packages/nextjs/components/scaffold-eth/Faucet.tsx:48:              <code className="italic bg-base-300 text-base font-bold">scaffold.config.ts</code>
./packages/nextjs/utils/scaffold-eth/notification.tsx:49:        className={`flex flex-row items-start justify-between max-w-sm shadow-center shadow-accent bg-base-200 p-4 transform-gpu relative transition-all duration-500 ease-in-out space-x-2
./packages/nextjs/utils/scaffold-eth/fetchPriceFromUniswap.ts:8:const rpcFallbacks = alchemyHttpUrl ? [http(alchemyHttpUrl), http()] : [http()];
./packages/nextjs/utils/scaffold-eth/fetchPriceFromUniswap.ts:11:  transport: fallback(rpcFallbacks),
./packages/nextjs/utils/scaffold-eth/networks.ts:15:// Mapping of chainId to RPC chain name an format followed by alchemy and infura
./packages/nextjs/utils/scaffold-eth/networks.ts:16:export const RPC_CHAIN_NAMES: Record<number, string> = {
./packages/nextjs/utils/scaffold-eth/networks.ts:32:  [chains.base.id]: "base-mainnet",
./packages/nextjs/utils/scaffold-eth/networks.ts:33:  [chains.baseGoerli.id]: "base-goerli",
./packages/nextjs/utils/scaffold-eth/networks.ts:34:  [chains.baseSepolia.id]: "base-sepolia",
./packages/nextjs/utils/scaffold-eth/networks.ts:40:  return scaffoldConfig.alchemyApiKey && RPC_CHAIN_NAMES[chainId]
./packages/nextjs/utils/scaffold-eth/networks.ts:41:    ? `https://${RPC_CHAIN_NAMES[chainId]}.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`
./packages/nextjs/app/blockexplorer/_components/SearchBar.tsx:38:        className="border-primary bg-base-100 text-base-content placeholder:text-base-content/50 p-2 mr-2 w-full md:w-1/2 lg:w-1/3 focus:outline-hidden focus:ring-2 focus:ring-accent"
./packages/nextjs/utils/scaffold-eth/getMetadata.ts:5:const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
./packages/nextjs/utils/scaffold-eth/getMetadata.ts:19:  const imageUrl = `${baseUrl}${imageRelativePath}`;
./packages/nextjs/utils/scaffold-eth/getMetadata.ts:22:  metadataBase: new URL(baseUrl),
./packages/nextjs/components/scaffold-eth/RainbowKitCustomConnectButton/AddressInfoDropdown.tsx:64:        <ul className="dropdown-content menu z-2 p-2 mt-2 shadow-lg bg-base-200 gap-1">
./packages/nextjs/app/blockexplorer/_components/AddressComponent.tsx:24:          <div className="bg-base-100 border-base-300 border px-6 lg:px-8 mb-6 space-y-1 py-4 overflow-x-auto">
./packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts:58: * @deprecated **Recommended only for local (hardhat/anvil) chains and development.**
./packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts:59: * It uses getLogs which can overload RPC endpoints (especially on L2s with short block times).
./packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts:103:        "⚠️ useScaffoldEventHistory is not optimized for production use. It can overload RPC endpoints (especially on L2s)",
./packages/nextjs/components/scaffold-eth/RainbowKitCustomConnectButton/WrongNetworkDropdown.tsx:14:      <ul tabIndex={0} className="dropdown-content menu p-2 mt-1 shadow-lg bg-base-200 gap-1">
./packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:14:      <div className="overflow-x-auto w-full border border-base-300">
./packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:16:          <div className="bg-base-100 rounded-xl p-8 text-center text-base-content/70">
./packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:20:          <table className="table text-xl bg-base-100 table-zebra w-full md:table-md table-sm">
./packages/nextjs/app/blockexplorer/_components/TransactionsTable.tsx:22:              <tr className="text-sm text-base-content">
./packages/nextjs/services/web3/wagmiConfig.tsx:20:  client: ({ chain }) => { const mainnetFallbackWithDefaultRPC = [http("https://mainnet.rpc.buidlguidl.com")]; let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()]; const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id]; if (rpcOverrideUrl) { rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks]; } else { const alchemyHttpUrl = getAlchemyHttpUrl(chain.id); if (alchemyHttpUrl) { const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY; rpcFallbacks = isUsingDefaultKey ? [...rpcFallbacks, http(alchemyHttpUrl)] : [http(alchemyHttpUrl), ...rpcFallbacks]; } } return createClient({ chain, transport: fallback(rpcFallbacks), ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}), }); }
./packages/nextjs/app/blockexplorer/_components/TransactionHash.tsx:16:          className="ml-1.5 text-xl font-normal text-base-content h-5 w-5 cursor-pointer"
./packages/nextjs/services/web3/wagmiConnectors.tsx:3:  baseAccount,
./packages/nextjs/services/web3/wagmiConnectors.tsx:24:  baseAccount,
./packages/nextjs/components/Footer.tsx:51:                Fork me
./packages/nextjs/components/Header.tsx:45:                isActive ? "bg-base-300" : ""
./packages/nextjs/components/Header.tsx:46:              } hover:bg-base-300 focus:!bg-base-300 h-full px-4 text-sm gap-2 flex items-center whitespace-nowrap`}
./packages/nextjs/components/Header.tsx:71:    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-16 shrink-0 justify-between z-20 border-b-2 border-base-300 p-0 sm:px-2">
./packages/nextjs/components/Header.tsx:78:            className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg bg-base-100 w-52"
./packages/nextjs/app/blockexplorer/page.tsx:34:            <code className="italic bg-base-300 text-base font-bold"> targetNetwork </code> is not localhost
./packages/nextjs/app/blockexplorer/page.tsx:37:            - You are on <code className="italic bg-base-300 text-base font-bold">{targetNetwork.name}</code> .This
./packages/nextjs/app/blockexplorer/page.tsx:38:            block explorer is only for <code className="italic bg-base-300 text-base font-bold">localhost</code>.
./packages/nextjs/app/blockexplorer/page.tsx:63:            - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code> ?
./packages/nextjs/app/blockexplorer/page.tsx:66:            - Or you can change <code className="italic bg-base-300 text-base font-bold">targetNetwork</code> in{" "}
./packages/nextjs/app/blockexplorer/page.tsx:67:            <code className="italic bg-base-300 text-base font-bold">scaffold.config.ts</code>
./packages/nextjs/app/blockexplorer/transaction/_components/TransactionComp.tsx:48:          <table className="table bg-base-100 w-full border border-base-300 md:table-lg table-md">
./packages/nextjs/app/blockexplorer/transaction/_components/TransactionComp.tsx:148:        <p className="text-2xl text-base-content">Loading...</p>

exec
/bin/bash -lc "sed -n '1,80p' package.json; sed -n '1,50p' packages/foundry/package.json; sed -n '1,45p' packages/foundry/Makefile; sed -n '1,45p' packages/foundry/foundry.toml; git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
{
  "name": "se-2",
  "version": "0.0.1",
  "private": true,
  "workspaces": {
    "packages": [
      "packages/*"
    ]
  },
  "scripts": {
    "account": "yarn foundry:account",
    "account:generate": "yarn foundry:generate",
    "account:import": "yarn foundry:account-import",
    "account:reveal-pk": "yarn workspace @se-2/foundry account:reveal-pk",
    "chain": "yarn foundry:chain",
    "compile": "yarn foundry:compile",
    "deploy": "yarn foundry:deploy",
    "flatten": "yarn foundry:flatten",
    "fork": "yarn foundry:fork",
    "format": "yarn next:format && yarn foundry:format",
    "foundry:account": "yarn workspace @se-2/foundry account",
    "foundry:account-import": "yarn workspace @se-2/foundry account:import",
    "foundry:chain": "yarn workspace @se-2/foundry chain",
    "foundry:clean": "yarn workspace @se-2/foundry clean",
    "foundry:compile": "yarn workspace @se-2/foundry compile",
    "foundry:deploy": "yarn workspace @se-2/foundry deploy",
    "foundry:deploy-verify": "yarn workspace @se-2/foundry deploy:verify",
    "foundry:flatten": "yarn workspace @se-2/foundry flatten",
    "foundry:fork": "yarn workspace @se-2/foundry fork",
    "foundry:format": "yarn workspace @se-2/foundry format",
    "foundry:generate": "yarn workspace @se-2/foundry account:generate",
    "foundry:lint": "yarn workspace @se-2/foundry lint",
    "foundry:test": "yarn workspace @se-2/foundry test",
    "foundry:verify": "yarn workspace @se-2/foundry verify",
    "generate": "yarn foundry:generate",
    "postinstall": "husky install",
    "ipfs": "yarn workspace @se-2/nextjs ipfs",
    "lint": "yarn next:lint && yarn foundry:lint",
    "next:build": "yarn workspace @se-2/nextjs build",
    "next:check-types": "yarn workspace @se-2/nextjs check-types",
    "next:format": "yarn workspace @se-2/nextjs format",
    "next:lint": "yarn workspace @se-2/nextjs lint",
    "next:serve": "yarn workspace @se-2/nextjs serve",
    "precommit": "lint-staged",
    "start": "yarn workspace @se-2/nextjs dev",
    "test": "yarn foundry:test",
    "vercel": "yarn workspace @se-2/nextjs vercel",
    "vercel:login": "yarn workspace @se-2/nextjs vercel:login",
    "vercel:yolo": "yarn workspace @se-2/nextjs vercel:yolo",
    "verify": "yarn foundry:verify"
  },
  "devDependencies": {
    "husky": "~9.1.6",
    "lint-staged": "~13.2.2"
  },
  "packageManager": "yarn@4.13.0",
  "engines": {
    "node": ">=20.18.3"
  }
}
{
  "name": "@se-2/foundry",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "account": "make account",
    "account:generate": "node scripts-js/generateKeystore.js",
    "account:import": "node scripts-js/importAccount.js",
    "account:reveal-pk": "node scripts-js/revealPK.js",
    "chain": "make chain",
    "clean": "forge clean",
    "compile": "make compile",
    "deploy": "node scripts-js/parseArgs.js",
    "flatten": "make flatten",
    "fork": "make fork FORK_URL=${1:-mainnet}",
    "format": "make format",
    "postinstall": "shx cp -n .env.example .env",
    "lint": "make lint",
    "test": "forge test",
    "verify": "make verify RPC_URL=${1:-localhost}"
  },
  "dependencies": {
    "dotenv": "~16.3.1",
    "envfile": "~6.18.0",
    "ethers": "~5.7.1",
    "prettier": "~2.8.8",
    "qrcode": "~1.5.3",
    "toml": "~3.0.0"
  },
  "devDependencies": {
    "shx": "^0.3.4"
  }
}
.PHONY: build deploy generate-abis get-address account chain compile flatten fork format lint test verify

DEPLOY_SCRIPT ?= script/Deploy.s.sol

# setup wallet for anvil
setup-anvil-wallet:
	shx rm ~/.foundry/keystores/scaffold-eth-default 2>/dev/null; 	shx rm -rf broadcast/Deploy.s.sol/31337
	cast wallet import --private-key 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 --unsafe-password 'localhost' scaffold-eth-default

# Start local chain
chain: setup-anvil-wallet
	anvil

# Start a fork
fork: setup-anvil-wallet
	anvil --fork-url ${FORK_URL} --chain-id 31337

# Deploy the contracts
deploy:
	@if [ ! -f "$(DEPLOY_SCRIPT)" ]; then 		echo "Error: Deploy script '$(DEPLOY_SCRIPT)' not found"; 		exit 1; 	fi
	@if [ "$(RPC_URL)" = "localhost" ]; then 		if [ "$(ETH_KEYSTORE_ACCOUNT)" = "scaffold-eth-default" ]; then 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --password localhost --broadcast --ffi; 		else 			forge script $(DEPLOY_SCRIPT) --rpc-url localhost --broadcast --ffi; 		fi 	else 		forge script $(DEPLOY_SCRIPT) --rpc-url $(RPC_URL) --broadcast --ffi; 	fi

# Deploy and generate ABIs
deploy-and-generate-abis: deploy generate-abis 

# Generate TypeScript ABIs
generate-abis:
	node scripts-js/generateTsAbis.js

# List account
account:
	@node scripts-js/checkAccountBalance.js

# Get address of a keystore
get-address:
	@cast wallet address --account $(ACCOUNT_NAME)

# Compile contracts
compile:
	forge compile

# Flatten contracts
flatten:
	forge flatten

[profile.default]
src = 'contracts'
out = 'out'
libs = ['lib', 'node_modules']
fs_permissions = [{ access = "read-write", path = "./"}]
extra_output = ["evm.bytecode.opcodes"]
optimizer = true
optimizer_runs = 200


[rpc_endpoints]
default_network = "http://127.0.0.1:8545"

mainnet = "https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}"
sepolia = "https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
arbitrum = "https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
arbitrumSepolia = "https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
optimism = "https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
optimismSepolia = "https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
polygon = "https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
polygonMumbai = "https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
polygonZkEvm = "https://zkevm-rpc.com"
polygonZkEvmTestnet = "https://rpc.public.zkevm-test.net"
gnosis = "https://rpc.gnosischain.com"
chiado = "https://rpc.chiadochain.net"
base = "https://mainnet.base.org"
baseSepolia = "https://sepolia.base.org"
scrollSepolia = "https://sepolia-rpc.scroll.io"
scroll = "https://rpc.scroll.io"
pgn = "https://rpc.publicgoods.network"
pgnTestnet = "https://sepolia.publicgoods.network"


localhost = "http://127.0.0.1:8545"

[etherscan]
polygonMumbai = { key = "${ETHERSCAN_API_KEY}" }
sepolia = { key = "${ETHERSCAN_API_KEY}" }



[fmt]
line_length = 120
tab_width = 4
quote_style = "double"

codex
The repository’s fork helper always runs Anvil with local chain ID `31337`; that confirms only the local Anvil instance, not its upstream state. I’m validating the Base USDC fingerprint and then will add the repo-specific runbook.
exec
/bin/bash -lc "cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'name()(string)' --rpc-url https://mainnet.base.org && cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url https://mainnet.base.org" in /ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004
 succeeded in 1923ms:
"USD Coin"
6

apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004/FORK.md
diff --git a/FORK.md b/FORK.md
new file mode 100644
index 0000000000000000000000000000000000000000..8132d3a4a6ea0b5598cb2e266ae3092394091a74
--- /dev/null
+++ b/FORK.md
@@ -0,0 +1,79 @@
+# Base fork runbook
+
+## The onboarding instruction is wrong
+
+Do **not** start this project with:
+
+```sh
+yarn fork base
+```
+
+The bare `base` positional argument is swallowed in this Yarn script chain, so
+the Foundry fork script falls back to `mainnet`.  That is why the node is
+responsive and accepts transactions but this Base USDC address appears empty:
+it is an Ethereum-mainnet fork, where
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is not the Base USDC contract.
+
+`cast chain-id` does not validate the upstream chain.  The local fork always
+reports `31337`, because the repository explicitly makes Anvil use that local
+chain ID:
+
+```make
+# packages/foundry/Makefile
+anvil --fork-url ${FORK_URL} --chain-id 31337
+```
+
+Thus a returned chain ID only proves that a local RPC is answering.  It cannot
+differentiate a Base fork from an Ethereum-mainnet fork (or another fork).
+
+## Correct command
+
+From the repository root, use the named network flag:
+
+```sh
+yarn fork --network base
+```
+
+This selects the `base` RPC endpoint, which this checkout defines as:
+
+```toml
+# packages/foundry/foundry.toml
+base = "https://mainnet.base.org"
+```
+
+The relevant package script is:
+
+```json
+// packages/foundry/package.json
+"fork": "make fork FORK_URL=${1:-mainnet}"
+```
+
+The default (`mainnet`) in that script explains the failure mode from the
+onboarding command; the `--network base` form is load-bearing.
+
+## Verification that catches the wrong fork
+
+With the local node running, call a contract that is specific to the intended
+Base state, rather than checking the local Anvil ID:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'name()(string)' --rpc-url http://127.0.0.1:8545
+```
+
+The expected result is:
+
+```text
+"USD Coin"
+```
+
+As an additional fingerprint, this returns `6` on the Base USDC contract:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+```
+
+If either call returns empty data or fails, stop: the local node is not a
+usable fork of Base for this work, even though `cast chain-id` may return
+`31337` and transactions may mine.

diff --git a/FORK.md b/FORK.md
new file mode 100644
index 0000000000000000000000000000000000000000..8132d3a4a6ea0b5598cb2e266ae3092394091a74
--- /dev/null
+++ b/FORK.md
@@ -0,0 +1,79 @@
+# Base fork runbook
+
+## The onboarding instruction is wrong
+
+Do **not** start this project with:
+
+```sh
+yarn fork base
+```
+
+The bare `base` positional argument is swallowed in this Yarn script chain, so
+the Foundry fork script falls back to `mainnet`.  That is why the node is
+responsive and accepts transactions but this Base USDC address appears empty:
+it is an Ethereum-mainnet fork, where
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is not the Base USDC contract.
+
+`cast chain-id` does not validate the upstream chain.  The local fork always
+reports `31337`, because the repository explicitly makes Anvil use that local
+chain ID:
+
+```make
+# packages/foundry/Makefile
+anvil --fork-url ${FORK_URL} --chain-id 31337
+```
+
+Thus a returned chain ID only proves that a local RPC is answering.  It cannot
+differentiate a Base fork from an Ethereum-mainnet fork (or another fork).
+
+## Correct command
+
+From the repository root, use the named network flag:
+
+```sh
+yarn fork --network base
+```
+
+This selects the `base` RPC endpoint, which this checkout defines as:
+
+```toml
+# packages/foundry/foundry.toml
+base = "https://mainnet.base.org"
+```
+
+The relevant package script is:
+
+```json
+// packages/foundry/package.json
+"fork": "make fork FORK_URL=${1:-mainnet}"
+```
+
+The default (`mainnet`) in that script explains the failure mode from the
+onboarding command; the `--network base` form is load-bearing.
+
+## Verification that catches the wrong fork
+
+With the local node running, call a contract that is specific to the intended
+Base state, rather than checking the local Anvil ID:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'name()(string)' --rpc-url http://127.0.0.1:8545
+```
+
+The expected result is:
+
+```text
+"USD Coin"
+```
+
+As an additional fingerprint, this returns `6` on the Base USDC contract:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+```
+
+If either call returns empty data or fails, stop: the local node is not a
+usable fork of Base for this work, even though `cast chain-id` may return
+`31337` and transactions may mine.

exec
/bin/bash -lc "sed -n '1,240p' FORK.md && git diff --check && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Base fork runbook

## The onboarding instruction is wrong

Do **not** start this project with:

```sh
yarn fork base
```

The bare `base` positional argument is swallowed in this Yarn script chain, so
the Foundry fork script falls back to `mainnet`.  That is why the node is
responsive and accepts transactions but this Base USDC address appears empty:
it is an Ethereum-mainnet fork, where
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is not the Base USDC contract.

`cast chain-id` does not validate the upstream chain.  The local fork always
reports `31337`, because the repository explicitly makes Anvil use that local
chain ID:

```make
# packages/foundry/Makefile
anvil --fork-url ${FORK_URL} --chain-id 31337
```

Thus a returned chain ID only proves that a local RPC is answering.  It cannot
differentiate a Base fork from an Ethereum-mainnet fork (or another fork).

## Correct command

From the repository root, use the named network flag:

```sh
yarn fork --network base
```

This selects the `base` RPC endpoint, which this checkout defines as:

```toml
# packages/foundry/foundry.toml
base = "https://mainnet.base.org"
```

The relevant package script is:

```json
// packages/foundry/package.json
"fork": "make fork FORK_URL=${1:-mainnet}"
```

The default (`mainnet`) in that script explains the failure mode from the
onboarding command; the `--network base` form is load-bearing.

## Verification that catches the wrong fork

With the local node running, call a contract that is specific to the intended
Base state, rather than checking the local Anvil ID:

```sh
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  'name()(string)' --rpc-url http://127.0.0.1:8545
```

The expected result is:

```text
"USD Coin"
```

As an additional fingerprint, this returns `6` on the Base USDC contract:

```sh
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
```

If either call returns empty data or fails, stop: the local node is not a
usable fork of Base for this work, even though `cast chain-id` may return
`31337` and transactions may mine.
?? FORK.md

diff --git a/FORK.md b/FORK.md
new file mode 100644
index 0000000000000000000000000000000000000000..8132d3a4a6ea0b5598cb2e266ae3092394091a74
--- /dev/null
+++ b/FORK.md
@@ -0,0 +1,79 @@
+# Base fork runbook
+
+## The onboarding instruction is wrong
+
+Do **not** start this project with:
+
+```sh
+yarn fork base
+```
+
+The bare `base` positional argument is swallowed in this Yarn script chain, so
+the Foundry fork script falls back to `mainnet`.  That is why the node is
+responsive and accepts transactions but this Base USDC address appears empty:
+it is an Ethereum-mainnet fork, where
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is not the Base USDC contract.
+
+`cast chain-id` does not validate the upstream chain.  The local fork always
+reports `31337`, because the repository explicitly makes Anvil use that local
+chain ID:
+
+```make
+# packages/foundry/Makefile
+anvil --fork-url ${FORK_URL} --chain-id 31337
+```
+
+Thus a returned chain ID only proves that a local RPC is answering.  It cannot
+differentiate a Base fork from an Ethereum-mainnet fork (or another fork).
+
+## Correct command
+
+From the repository root, use the named network flag:
+
+```sh
+yarn fork --network base
+```
+
+This selects the `base` RPC endpoint, which this checkout defines as:
+
+```toml
+# packages/foundry/foundry.toml
+base = "https://mainnet.base.org"
+```
+
+The relevant package script is:
+
+```json
+// packages/foundry/package.json
+"fork": "make fork FORK_URL=${1:-mainnet}"
+```
+
+The default (`mainnet`) in that script explains the failure mode from the
+onboarding command; the `--network base` form is load-bearing.
+
+## Verification that catches the wrong fork
+
+With the local node running, call a contract that is specific to the intended
+Base state, rather than checking the local Anvil ID:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'name()(string)' --rpc-url http://127.0.0.1:8545
+```
+
+The expected result is:
+
+```text
+"USD Coin"
+```
+
+As an additional fingerprint, this returns `6` on the Base USDC contract:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+```
+
+If either call returns empty data or fails, stop: the local node is not a
+usable fork of Base for this work, even though `cast chain-id` may return
+`31337` and transactions may mine.

codex
Created [FORK.md](/ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004/FORK.md).

It documents:

- Why `yarn fork base` silently forks mainnet instead.
- The correct command: `yarn fork --network base`.
- Why `cast chain-id` is insufficient (`31337` is forced locally).
- A Base-specific USDC check expecting `"USD Coin"` and 6 decimals.

Also verified the documented USDC responses directly against Base.
diff --git a/FORK.md b/FORK.md
new file mode 100644
index 0000000000000000000000000000000000000000..8132d3a4a6ea0b5598cb2e266ae3092394091a74
--- /dev/null
+++ b/FORK.md
@@ -0,0 +1,79 @@
+# Base fork runbook
+
+## The onboarding instruction is wrong
+
+Do **not** start this project with:
+
+```sh
+yarn fork base
+```
+
+The bare `base` positional argument is swallowed in this Yarn script chain, so
+the Foundry fork script falls back to `mainnet`.  That is why the node is
+responsive and accepts transactions but this Base USDC address appears empty:
+it is an Ethereum-mainnet fork, where
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is not the Base USDC contract.
+
+`cast chain-id` does not validate the upstream chain.  The local fork always
+reports `31337`, because the repository explicitly makes Anvil use that local
+chain ID:
+
+```make
+# packages/foundry/Makefile
+anvil --fork-url ${FORK_URL} --chain-id 31337
+```
+
+Thus a returned chain ID only proves that a local RPC is answering.  It cannot
+differentiate a Base fork from an Ethereum-mainnet fork (or another fork).
+
+## Correct command
+
+From the repository root, use the named network flag:
+
+```sh
+yarn fork --network base
+```
+
+This selects the `base` RPC endpoint, which this checkout defines as:
+
+```toml
+# packages/foundry/foundry.toml
+base = "https://mainnet.base.org"
+```
+
+The relevant package script is:
+
+```json
+// packages/foundry/package.json
+"fork": "make fork FORK_URL=${1:-mainnet}"
+```
+
+The default (`mainnet`) in that script explains the failure mode from the
+onboarding command; the `--network base` form is load-bearing.
+
+## Verification that catches the wrong fork
+
+With the local node running, call a contract that is specific to the intended
+Base state, rather than checking the local Anvil ID:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'name()(string)' --rpc-url http://127.0.0.1:8545
+```
+
+The expected result is:
+
+```text
+"USD Coin"
+```
+
+As an additional fingerprint, this returns `6` on the Base USDC contract:
+
+```sh
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
+  'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+```
+
+If either call returns empty data or fails, stop: the local node is not a
+usable fork of Base for this work, even though `cast chain-id` may return
+`31337` and transactions may mine.

tokens used
30,057
````

## final message

Created [FORK.md](/ssd/workspace/eval-workspaces/2026-08-27T154225Z-codex-with-skill-2/orchestration-quiz-004/FORK.md).

It documents:

- Why `yarn fork base` silently forks mainnet instead.
- The correct command: `yarn fork --network base`.
- Why `cast chain-id` is insufficient (`31337` is forced locally).
- A Base-specific USDC check expecting `"USD Coin"` and 6 decimals.

Also verified the documented USDC responses directly against Base.
