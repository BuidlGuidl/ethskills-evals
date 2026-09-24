// Shared mainnet constants for rebalance.ts and roles-setup.ts.
// Every address here is a public, immutable mainnet contract. Nothing secret lives in this file.

import { encodeKey } from "zodiac-roles-sdk";
import { getAddress, parseAbi } from "viem";

export const CHAIN_ID = 1;

// Tokens
export const WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"); // 18 decimals
export const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"); // 6 decimals (Circle, upgradeable proxy, has a blacklist)

// Uniswap V3
// SwapRouter (v1). Used instead of SwapRouter02 because its exactInputSingle carries
// `deadline` inside the params struct, so the whole call can be scoped by the Roles modifier
// without also having to scope multicall(deadline, bytes[]).
export const SWAP_ROUTER = getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564");
export const QUOTER_V2 = getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e");
export const POOL_FEE = 500; // 0.05% tier
export const WETH_USDC_POOL_500 = getAddress("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640");

// Chainlink
export const CHAINLINK_ETH_USD = getAddress("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"); // 8 dec, 1h heartbeat / 0.5% deviation
export const CHAINLINK_USDC_USD = getAddress("0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"); // 8 dec, 24h heartbeat / 0.25% deviation

// Roles modifier: role + allowance keys (bytes32). The keys are labels, not secrets.
export const ROLE_KEY = encodeKey("rebalancer");
export const ALLOWANCE_KEY_WETH = encodeKey("rebalancer-weth-in");
export const ALLOWANCE_KEY_USDC = encodeKey("rebalancer-usdc-in");

// Hard limits enforced ON-CHAIN by the Roles modifier (roles-setup.ts). Changing them takes the Safe threshold.
// These bound what a stolen agent key can push through the pool per day. Size them to what you accept losing.
export const ONCHAIN_MAX_WETH_PER_TRADE = 20n * 10n ** 18n; // 20 WETH
export const ONCHAIN_MAX_USDC_PER_TRADE = 60_000n * 10n ** 6n; // 60k USDC
export const ONCHAIN_DAILY_WETH_IN = 45n * 10n ** 18n; // 45 WETH sold per 24h
export const ONCHAIN_DAILY_USDC_IN = 150_000n * 10n ** 6n; // 150k USDC sold per 24h
export const ALLOWANCE_PERIOD_SECONDS = 86_400n;

export const exactInputSingleParamsType =
  "(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)";

export const swapRouterAbi = parseAbi([
  `function exactInputSingle(${exactInputSingleParamsType} params) payable returns (uint256 amountOut)`,
]);

export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
]);

export const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)",
]);

export const safeAbi = parseAbi([
  "function isModuleEnabled(address module) view returns (bool)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
]);
