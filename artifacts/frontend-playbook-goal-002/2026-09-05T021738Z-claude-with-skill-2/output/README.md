# 🫙 USDC Tip Jar (Base)

A tip jar that accepts **USDC on Base**: an onchain `TipJar` contract that pulls USDC from the tipper
and stores every tip (sender, amount, message, timestamp) onchain, plus a web page with the tip feed,
a tip form, and a connect-wallet flow.

Everything below runs **locally against a fork of Base**, so the app talks to the canonical USDC
contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` without anything being deployed to a live
network.

Built with [Scaffold-ETH 2](https://docs.scaffoldeth.io) (Foundry + Next.js + wagmi/viem + RainbowKit).

![The tip jar running against a local Base fork](docs/screenshot.png)

## What's in here

| Path                                         | What it is                                                        |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `packages/foundry/contracts/TipJar.sol`      | The tip jar contract (ERC20 tips, onchain feed, owner withdrawal) |
| `packages/foundry/script/DeployTipJar.s.sol` | Deploy script, wires the jar to Base USDC                         |
| `packages/foundry/test/TipJar.t.sol`         | Unit tests (mock 6-decimal USDC, no network needed)               |
| `packages/foundry/scripts-js/fork.js`        | `yarn fork` — starts Anvil forked from Base with 1s blocks        |
| `packages/foundry/scripts-js/fundUsdc.js`    | `yarn fund` — moves real USDC to a demo account on the fork       |
| `packages/nextjs/app/page.tsx`               | The tip jar page                                                  |
| `packages/nextjs/components/tipjar/`         | `TipForm`, `TipFeed`, `JarStats`                                  |
| `packages/nextjs/hooks/useUsdc.ts`           | Token address (read from the jar), balance, allowance             |
| `packages/foundry/lib/`                      | Vendored forge-std 1.16.2 and OpenZeppelin Contracts 5.7.0        |

## Requirements

- [Node.js](https://nodejs.org/en/download/) >= v20.18.3 (tested on v25)
- [Yarn](https://yarnpkg.com/getting-started/install) v2+ (the repo pins Yarn 4 via `packageManager`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `cast`, `forge`)
- Git

## Setup

Three terminals: one for the fork, one for the frontend, one for the one-shot commands.

### 1. Install dependencies

```bash
yarn install
```

### 2. Start a local Base fork (terminal 1, keep it running)

```bash
yarn fork --network base
```

This runs `anvil --fork-url base --chain-id 31337 --block-time 1`:

- **Fork, not a bare chain.** The jar is wired to the real USDC contract, so the local chain needs
  Base's state. A bare `yarn chain` has no code at the USDC address and the deploy script will stop
  with a message telling you to fork.
- **Chain id 31337.** The frontend targets `chains.foundry` (see `packages/nextjs/scaffold.config.ts`),
  i.e. the local fork — not Base itself.
- **`--block-time 1`.** Anvil otherwise only mines when a transaction arrives, which freezes
  `block.timestamp` and makes the feed's "2m ago" timestamps stand still between tips.

The fork RPC endpoint is `https://mainnet.base.org` (`[rpc_endpoints]` in `packages/foundry/foundry.toml`);
swap in your own Base RPC there if you hit rate limits.

### 3. Deploy the tip jar (terminal 2)

```bash
yarn deploy
```

Deploys `TipJar` to the fork using Anvil's pre-funded `scaffold-eth-default` account as owner, and
writes the address + ABI into `packages/nextjs/contracts/deployedContracts.ts`.

### 4. Give yourself some USDC (terminal 2)

The fork is a local copy of Base, so we can impersonate an account that already holds USDC and have
it pay a demo account — no mock token needed:

```bash
yarn fund <your-address> --amount 250
```

This sends USDC from a large holder (Morpho Blue) and tops the recipient up with 1 ETH for gas.
To fund the app's built-in burner wallet, copy the address shown in the header after connecting and
pass it here. Anvil's default account works too:

```bash
yarn fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --amount 250
```

### 5. Start the frontend (terminal 3, keep it running)

```bash
yarn start
```

Open <http://localhost:3000>.

### 6. Send a tip

1. **Connect Wallet** in the header. On the local chain the **Burner Wallet** option is the quickest
   (an in-browser key, no extension); MetaMask, WalletConnect, Rainbow, Base, and Ledger are wired up
   too — point your wallet at `http://127.0.0.1:8545`, chain id 31337.
2. Fund that address with `yarn fund <address>` if the form says you have no USDC.
3. Enter an amount and an optional message.
4. **Step 1: Approve** — USDC needs an allowance before the jar can pull the tip.
5. **Send tip** — the feed, the jar stats, and your wallet balance update on the next block.

## Tests

```bash
yarn test
```

12 Foundry tests cover the tip accounting, the feed's newest-first paging, message limits, the owner
withdrawal, and ownership transfer. They use a mock 6-decimal token, so they run without a fork or
any network access.

## The contract

`TipJar` (`packages/foundry/contracts/TipJar.sol`) is immutable-per-token and deliberately small:

| Member                       | What it does                                                      |
| ---------------------------- | ----------------------------------------------------------------- |
| `tip(uint256, string)`       | Pulls `amount` USDC via `transferFrom` and appends to the feed    |
| `latestTips(uint256 limit)`  | Newest-first page of tips — what the feed renders                 |
| `tipCount()` / `tipAt(i)`    | Feed length and a single entry                                    |
| `totalTipped` / `tippedBy`   | Lifetime totals, overall and per tipper                           |
| `jarBalance()`               | USDC currently held                                               |
| `withdraw(address to)`       | Owner-only, moves the whole balance out                           |
| `transferOwnership(address)` | Owner-only                                                        |
| `TipReceived` event          | Emitted per tip, so a frontend can sync without reading the array |

Messages are capped at 200 bytes, tips of 0 are rejected, and the recorded amount is the balance
delta actually received rather than the requested amount.

There is no withdrawal UI — call `withdraw` from the **Debug Contracts** tab at
<http://localhost:3000/debug> while connected as the jar owner (`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`,
the `scaffold-eth-default` keystore account; `yarn account:reveal-pk` prints its private key so you can
import it into a wallet).

## Frontend notes

- `TipFeed` reads `latestTips(25)` through `useScaffoldReadContract`, which re-reads on every new
  block, and also watches the `TipReceived` event to toast tips from other people.
- Tip ages are computed against the **chain's** latest block timestamp, not the browser clock, so
  they stay honest on a fork.
- `useUsdc` reads the token address from `TipJar.token()` rather than hardcoding it, so the UI can
  never disagree with the contract about which token is being tipped.
- The header's faucet button (local chains only) tops up ETH for gas; USDC comes from `yarn fund`.

## Troubleshooting

| Symptom                                                   | Fix                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Error: Address already in use` from `yarn fork`          | An Anvil is already on port 8545 — reuse it, or stop it first                                   |
| Deploy fails with `No USDC found at the expected address` | You are on a bare chain; restart with `yarn fork --network base`                                |
| Frontend shows `not deployed`                             | Run `yarn deploy` (it regenerates `deployedContracts.ts`)                                       |
| Tip reverts with `ERC20InsufficientAllowance`             | Approve first — the form does this in step 1                                                    |
| Feed timestamps never move                                | The fork was started without `--block-time`; `cast rpc anvil_setIntervalMining 1` fixes it live |
| Wallet says "wrong network"                               | Switch it to `localhost:8545` / chain id 31337                                                  |

## Deploying for real (not done here)

This project is intentionally local-only. To take it live later you would point
`packages/nextjs/scaffold.config.ts` at `chains.base`, create a deployer keystore with
`yarn generate`, and run `yarn deploy --network base` — the deploy script already resolves the right
USDC address for Base (`8453`) and Base Sepolia (`84532`).
