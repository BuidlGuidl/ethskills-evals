import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Externally deployed contracts the app talks to but doesn't deploy itself.
 *
 * USDC is the canonical Base USDC token. Because the local dev chain (id 31337)
 * is an Anvil *fork* of Base, this exact contract exists on the fork too, so the
 * same address is registered under 31337.
 */
const USDC_ABI = [
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

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const externalContracts = {
  // Local Anvil fork of Base
  31337: {
    USDC: {
      address: BASE_USDC,
      abi: USDC_ABI,
    },
  },
  // Base mainnet
  8453: {
    USDC: {
      address: BASE_USDC,
      abi: USDC_ABI,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
