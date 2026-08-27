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
