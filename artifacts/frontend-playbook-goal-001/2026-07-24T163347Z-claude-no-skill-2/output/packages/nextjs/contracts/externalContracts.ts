import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: {
 *       address: "0x...",
 *       abi: [...],
 *     },
 *   },
 * } as const;
 */

// Circle-issued native USDC on Base. The same address is used on the local
// Base fork (chain-id 31337), which mirrors real Base state.
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Minimal ERC-20 surface the tip jar UI needs: read balance/allowance and approve.
const usdcAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const externalContracts = {
  // Local Base fork (anvil `--fork-url base --chain-id 31337`).
  31337: {
    USDC: {
      address: BASE_USDC_ADDRESS,
      abi: usdcAbi,
    },
  },
  // Base mainnet.
  8453: {
    USDC: {
      address: BASE_USDC_ADDRESS,
      abi: usdcAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
