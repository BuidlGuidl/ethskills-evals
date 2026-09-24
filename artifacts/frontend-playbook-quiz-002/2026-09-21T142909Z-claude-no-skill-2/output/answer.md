# Fork vs. `targetNetworks`: why the vault "isn't deployed"

## Where things actually are

| | Chain | Chain ID | RPC |
|---|---|---|---|
| **Vault lives on** | local Anvil fork of Base (`yarn fork --network base`) | **31337** | `http://127.0.0.1:8545` |
| **Frontend talks to** (`chains.base`) | real Base mainnet | **8453** | public/Alchemy Base RPC |

`yarn fork` starts Anvil with `--fork-url <base rpc> --chain-id 31337`. That makes a **local** chain. It starts with a copy of Base's state (USDC, Aerodrome, etc. at their real addresses), but it is a separate chain with its own ID, 31337, and its own RPC on localhost.
`yarn deploy` sends the vault to that local chain (8545), and `generateTsAbis` writes it into `packages/nextjs/contracts/deployedContracts.ts` under key `31337`. Nothing was ever deployed to 8453.

## Why each symptom happens

The frontend looks up contracts by the chain ID of its target network: `deployedContracts[targetNetwork.id]`.

- **"Contract not deployed"**: `deployedContracts[8453]` doesn't exist. The only entry is `31337`.
- **Reads return nothing**: wagmi/viem send reads to the real Base RPC. There's no vault code at that address on mainnet, so reads fail or come back empty.
- **Write prompts for real gas on Base mainnet**: the wallet is told to switch to chain 8453 and sign a real mainnet tx. That tx would go to an address with no vault contract, and you'd still pay real ETH for gas. Dangerous.
- Side effect: with a non-local target, SE-2 also hides the burner wallet and the local faucet (`onlyLocalBurnerWallet`), so you're pushed toward a real wallet.

## Why the teammate's line looked logical

"We're forking Base, so the network is Base." But a fork only copies Base's **state**. It doesn't give you Base's **identity**. `targetNetworks` doesn't mean "which chain's state am I simulating". It means "which chain ID and RPC should the frontend connect to and look up contracts for". The fork's answer is 31337 @ localhost:8545, not 8453 @ Base RPC. `chains.base` sends the whole app past your fork to mainnet.

## One-line fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],
```

`chains.foundry` = ID 31337, RPC `http://127.0.0.1:8545`. That matches the fork and the `deployedContracts` key. Burner wallet and faucet come back, and gas is fake fork ETH. (If you use a browser wallet, add a network pointing to localhost:8545 with chain ID 31337.)

## When `chains.base` becomes right

Switch only once the vault is **actually deployed to Base mainnet**:

1. `yarn deploy --network base` (real deployer key, real ETH), and optionally `yarn verify --network base`.
2. `deployedContracts.ts` now has an `8453` entry with the real vault address.
3. **Then** set `targetNetworks: [chains.base]` for the production frontend build (`yarn vercel` / `yarn ipfs`).

Rule of thumb: `targetNetworks` must point at a chain ID that has a matching key in `deployedContracts.ts`. While developing on the fork that's `chains.foundry` (31337). After a real Base deploy it's `chains.base` (8453). (Ideally go through Base Sepolia, 84532 via `chains.baseSepolia`, before mainnet.)
