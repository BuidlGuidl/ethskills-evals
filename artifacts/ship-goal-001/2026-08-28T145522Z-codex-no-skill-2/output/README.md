# Toolshed

Toolshed is a neighborhood tool-lending MVP for a private association of roughly 300 members. Members list tools, borrowers escrow a USDC deposit, owners accept or reject requests, and returns settle the deposit. Late fees are paid to the owner and the remainder goes back to the borrower.

The app includes:

- an admin-managed member allowlist;
- tool listings with a photo URL, description, condition, deposit, and daily late fee;
- a request/accept/return lifecycle with USDC held by the contract;
- late fees rounded up per started late day and capped at the deposit;
- completed-loan and late-return reputation;
- an owner request inbox ranked by lowest late-return rate, then most completed loans;
- a three-day fallback allowing a borrower to settle a return if an owner does not respond.

## Architecture

`contracts/Toolshed.sol` is the source of truth. It stores membership, tools, loans, and reputation, and escrows one ERC-20 token chosen at deployment. It has no external library dependencies. `contracts/MockUSDC.sol` is a six-decimal development token only.

`src/` is a React/Vite single-page client. It talks directly to the contracts through the injected browser wallet using ethers. There is no server or database: this keeps the operational surface appropriate for a small association and makes the audit trail public. Photos are stored as URLs, not uploaded on-chain; use IPFS, Arweave, or an association-controlled image host in production.

The main lifecycle is:

1. An allowlisted member lists a tool.
2. Another member approves and escrows the exact deposit while requesting 1–30 days. The tool is reserved immediately.
3. The owner accepts (starting the due-date clock) or rejects (immediate refund). A borrower can cancel before acceptance.
4. The borrower marks the tool returned. This timestamp fixes the fee calculation.
5. The owner confirms; the contract sends late fees to the owner and refunds the balance. After three days without confirmation, the borrower can finalize the same calculation.

For an MVP, identity is a wallet address and the admin is a single immutable wallet. See “Production notes” before managing meaningful value.

## Run locally

Requirements: Node.js 20+, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.

Install and test:

```bash
npm install
npm test
```

In terminal one, start a local chain:

```bash
anvil
```

In terminal two, deploy the development contracts with one of Anvil's printed private keys:

```bash
export PRIVATE_KEY=<anvil-private-key>
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Copy the two deployed addresses printed under `Contract Address` into `.env` (the first is MockUSDC and the second is Toolshed):

```bash
cp .env.example .env
# edit VITE_TOOLSHED_ADDRESS and VITE_USDC_ADDRESS
npm run dev
```

Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and an Anvil account to the wallet. The deployer is already a member. From the **Members** tab, allowlist other account addresses.

For local deposits, mint mock USDC and then add the mock token address to the wallet:

```bash
cast send "$VITE_USDC_ADDRESS" "mint(address,uint256)" <member-address> 1000000000 \
  --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY"
```

Replace `$VITE_USDC_ADDRESS` with the address from `.env` (or export it in the shell first). `1000000000` is 1,000 mock USDC because USDC has six decimals.

## Deploy

Choose an EVM network where the association and USDC are available. Obtain the official USDC contract address for that network from Circle's current documentation; do not deploy or use `MockUSDC` in production.

Deploy `Toolshed` with the production USDC address:

```bash
export RPC_URL=<network-rpc-url>
export PRIVATE_KEY=<deployer-private-key>
export USDC_ADDRESS=<official-usdc-address>

forge create contracts/Toolshed.sol:Toolshed \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$USDC_ADDRESS"
```

Set the returned contract address and the same USDC address in the frontend host's environment:

```bash
VITE_TOOLSHED_ADDRESS=<deployed-toolshed-address>
VITE_USDC_ADDRESS=<official-usdc-address>
VITE_CHAIN_ID=<network-chain-id>
npm run build
```

Deploy the generated `dist/` directory to any static host (Cloudflare Pages, Netlify, S3, etc.). Build-time variables are embedded in the bundle, so rebuild after changing addresses. Keep the deployer wallet secure; it is the only wallet that can change membership.

## Contract tests

Run `forge test -vv`. Tests in `test/Toolshed.t.sol` cover full on-time refunds, rounded-up/capped late-fee settlement and reputation, rejected-request refunds, and borrower finalization after the owner response window.

## Production notes

This is a first version, not an audited custody system. Before real deposits, commission an independent smart-contract review and test on a public testnet. In particular:

- move admin authority to an association multisig (the current admin cannot be changed);
- decide how disputes about damage or whether a physical return actually occurred are resolved—the contract deliberately does not attempt to adjudicate them;
- pin photo assets and add content moderation/privacy rules;
- add event indexing if full-history reads become slow;
- document wallet recovery, member offboarding, deposit limits, and local legal/tax treatment;
- use only the canonical, six-decimal USDC token on the selected network.

Late fees are based on the on-chain `markReturned` timestamp and are capped at the escrowed deposit. Removing a member prevents new listings and requests but intentionally does not strand an existing loan; its return and settlement actions remain available.
