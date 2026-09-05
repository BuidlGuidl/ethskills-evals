import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Contracts the app talks to but does not deploy.
 *
 * Circle's native USDC lives at the same address on Base and on a Base fork, because a fork is a
 * copy of Base state — so the entry below is correct for `yarn fork --network base` (chain id
 * 31337) and for Base mainnet (chain id 8453) alike.
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
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const externalContracts = {
  // Local Base fork (anvil runs the fork under chain id 31337, not 8453)
  31337: {
    USDC: {
      address: USDC_ADDRESS,
      abi: usdcAbi,
    },
  },
  // Base mainnet, for when targetNetworks is pointed at the real chain
  8453: {
    USDC: {
      address: USDC_ADDRESS,
      abi: usdcAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
