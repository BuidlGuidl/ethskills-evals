import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Manually added external contracts.
 *
 * Base USDC lives at the same canonical address on Base mainnet (8453) AND on a local
 * Base fork (31337, since the fork copies real Base state), so the app can read/write it
 * with the scaffold hooks in both environments via `contractName: "USDC"`.
 */
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const usdcAbi = [
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
  31337: {
    USDC: { address: USDC_ADDRESS, abi: usdcAbi },
  },
  8453: {
    USDC: { address: USDC_ADDRESS, abi: usdcAbi },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
