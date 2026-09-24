# One-click WETH -> USDC -> Aave V3 entry

This uses EIP-7702, not a new wallet. The user's existing EOA signs an authorization to temporarily execute code from a deployed delegate implementation, then sends one transaction to itself. During that one transaction, the EOA's address is still `address(this)`, so the delegate can approve and move the EOA's WETH without any pre-existing approvals.

## What happens on-chain

`entry.ts enter` sends a single Ethereum mainnet transaction from the user's EOA to the same EOA with an EIP-7702 `authorizationList`.

The delegated function does this atomically:

1. Reads the EOA's WETH balance and uses all of it when `wethAmountIn == type(uint256).max`.
2. Approves the Uniswap V3 SwapRouter for that exact WETH amount.
3. Calls Uniswap V3 `SwapRouter.exactInputSingle`:
   - WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
   - USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
   - fee tier: `500` (0.05%)
   - router: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
4. Takes the returned `amountOut`, approves Aave V3 Pool for exactly that USDC amount, and calls:
   - `Pool.supply(USDC, amountOut, userEOA, 0)`
   - Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
5. Resets the temporary ERC-20 allowances to zero.

If the swap succeeds but Aave supply fails, the whole transaction reverts. If the slippage check fails, the whole transaction reverts. There is no successful half-state where the user only receives USDC.

## Why this matches the constraints

Same address: Aave receives `onBehalfOf = address(this)`, and under EIP-7702 `address(this)` is the user's original EOA. Their ENS name, address, and on-chain history stay attached to the position.

No new account: the user does not deploy a smart wallet or move funds to a fresh address. The delegate implementation is infrastructure code, deployed once, and the EOA points at it via EIP-7702 for execution.

No prior approvals: WETH does not support native permit, and the user's account starts with no allowances. Because the delegated code executes as the EOA, it can approve Uniswap and Aave inside the same transaction before using them.

Single atomic action: swap and supply happen inside one Ethereum transaction. Ethereum transaction semantics make the sequence all-or-nothing.

## How to run

Install runtime dependencies:

```bash
npm install viem tsx
```

Deploy the delegate implementation once from any funded deployer:

```bash
RPC_URL=https://... PRIVATE_KEY=0x... npx tsx entry.ts deploy-delegate
```

Then run the actual one-click entry for the user's EOA:

```bash
RPC_URL=https://... \
PRIVATE_KEY=0x... \
ENTRY_DELEGATE_ADDRESS=0x... \
SLIPPAGE_BPS=50 \
npx tsx entry.ts enter
```

Optional cleanup, if the user wants their EOA delegation cleared afterward:

```bash
RPC_URL=https://... PRIVATE_KEY=0x... npx tsx entry.ts revoke-delegate
```

## Safety requirements

Set a real `SLIPPAGE_BPS` limit. The script quotes Uniswap V3 QuoterV2 (`0x61fFE014bA17989E743c5F6cB21bF9697530B21e`) and derives `amountOutMinimum`, but the developer must choose a limit appropriate for MEV and market conditions.

Verify the delegate bytecode and deployment address before asking a user to authorize it. An EIP-7702 authorization is powerful and can persist until replaced or revoked.

Use a wallet/RPC path that supports EIP-7702 transaction type `0x04`. For a real MetaMask UX, the wallet should present the EIP-7702 authorization and the self-call as one coherent confirmation.

Do not hardcode or commit private keys. `PRIVATE_KEY` is only a runnable developer convenience here; production should use a wallet UI, hardware wallet flow, or secure signer.

Test on a mainnet fork first, including revert behavior, quote freshness, allowance cleanup, and Aave supply accounting.

References used for addresses and mechanics:

- Uniswap v3 Ethereum deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Aave address book `AaveV3Ethereum.POOL`: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Ethereum.sol
- viem EIP-7702 self-execution docs: https://viem.sh/docs/eip7702/sending-transactions
- ethereum.org EIP-7702 overview: https://ethereum.org/roadmap/pectra/7702/
