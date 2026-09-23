import { parseAbi } from "viem";

export const batcherAbi = parseAbi([
  "function batchTransfer(address token, address[] recipients, uint256[] amounts) returns (uint256)",
  "event Failed(address indexed token, address indexed to, uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
