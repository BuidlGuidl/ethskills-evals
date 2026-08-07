import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Base USDC. This exact address is live on Base mainnet (chain 8453) AND on a
 * `yarn fork --network base` fork (chain 31337), so the frontend can read balances
 * and drive the approve flow against the real USDC contract in every environment.
 */
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const erc20Abi = [
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
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const externalContracts = {
  31337: {
    USDC: { address: USDC_ADDRESS, abi: erc20Abi },
  },
  8453: {
    USDC: { address: USDC_ADDRESS, abi: erc20Abi },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
