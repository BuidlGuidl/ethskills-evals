import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * USDC, the deposit currency. Addresses verified onchain (symbol/decimals) — see README.
 * 31337 is a local anvil *fork of Base* (`yarn fork --network base`), so it has real USDC
 * at the Base address.
 */
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
      { name: "value", type: "uint256" },
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
  31337: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abi: usdcAbi },
  },
  8453: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abi: usdcAbi },
  },
  84532: {
    USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", abi: usdcAbi },
  },
  1: {
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", abi: usdcAbi },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
