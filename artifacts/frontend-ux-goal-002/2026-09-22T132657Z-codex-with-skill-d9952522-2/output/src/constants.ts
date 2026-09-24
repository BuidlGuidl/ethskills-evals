import { parseAbi } from "viem";

export const APP_NAME = "USDC Pay";
export const ETHERSCAN_BASE_URL = "https://etherscan.io";

export const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = "USDC";

export const USDC_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
