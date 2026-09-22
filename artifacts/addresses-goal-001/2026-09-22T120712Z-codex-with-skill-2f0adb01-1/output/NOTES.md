# Base USDC -> WETH Swap Tool

This tool swaps native Base USDC into WETH using viem and 1inch Pathfinder / Aggregation Router V6.

## Addresses

- Base chain ID: `8453`
- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- 1inch Aggregation Router V6: `0x111111125421cA6dc452d289314280a0f8842A65`

I verified bytecode exists for all three addresses on Base mainnet via `eth_getCode`, and cross-checked the deployment addresses against the local address registry plus 1inch and Uniswap/Aerodrome public documentation.

## Why 1inch

For treasury-sized USDC clips, execution quality is usually better handled by a router that can split across multiple Base liquidity sources instead of forcing a single pool. Base USDC/WETH liquidity is spread across venues such as Aerodrome and Uniswap. The script asks 1inch Pathfinder for the route, but it does not blindly trust the API response:

- It approves USDC to the known Aggregation Router V6 address only.
- It quotes first, calculates an explicit `minReturn` from `SLIPPAGE_BPS`, and asks `/swap` to embed that hard output floor.
- It verifies the returned transaction target is exactly `0x111111125421cA6dc452d289314280a0f8842A65`.
- It rejects any nonzero native ETH `value` for this ERC-20 to ERC-20 swap.
- It runs `eth_call` and gas estimation before broadcasting.
- It defaults to dry-run mode; set `EXECUTE_SWAP=true` only when intentionally sending funds.

## Running

Install dependencies:

```bash
npm install
```

Dry run:

```bash
PRIVATE_KEY=0x... \
BASE_RPC_URL=https://your-base-rpc.example \
ONEINCH_API_KEY=... \
USDC_AMOUNT=250000 \
SLIPPAGE_BPS=30 \
npm run swap
```

Broadcast:

```bash
PRIVATE_KEY=0x... \
BASE_RPC_URL=https://your-base-rpc.example \
ONEINCH_API_KEY=... \
USDC_AMOUNT=250000 \
SLIPPAGE_BPS=30 \
EXECUTE_SWAP=true \
npm run swap
```

Optional settings:

- `RECEIVER`: defaults to the signer.
- `APPROVE_MAX=true`: approve unlimited USDC instead of the exact swap amount. Exact approval is safer and is the default.
- `GAS_BUFFER_BPS`: default `2000` for a 20% gas-limit buffer.

## What must be right before real funds

- Use native Base USDC, not bridged USDbC. The script hard-codes native USDC.
- Use a dedicated, reliable Base RPC. Public RPCs can rate-limit or return stale failures at the worst time.
- Use a 1inch Business Portal API key with production quota. The current endpoint is `https://api.1inch.com/swap/v6.1/8453`.
- Keep `SLIPPAGE_BPS` tight enough for the desk's mandate, but wide enough for the clip size and market volatility. The output floor is hard-enforced on-chain by the router calldata.
- Re-run immediately before execution. Quotes age quickly, especially for six-figure swaps.
- Consider splitting very large trades or using an RFQ/OTC workflow when the quote shows meaningful price impact. A successful on-chain minReturn protects the floor; it does not guarantee the desk got the best possible fill.
- Protect the private key. Prefer a treasury signer, hardware-backed flow, or transaction service over a hot key on a laptop.
- Review the approval policy. Exact approval is safer; max approval is operationally convenient but increases standing risk.
