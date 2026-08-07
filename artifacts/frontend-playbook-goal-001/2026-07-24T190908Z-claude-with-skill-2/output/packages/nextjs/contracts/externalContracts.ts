import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * USDC on Base. The same address is used for:
 *  - chain 31337: the local Anvil fork of Base, where the real USDC contract
 *    state is present (so `approve`, `balanceOf`, `transfer` all behave like mainnet).
 *  - chain 8453: Base mainnet, for the production build.
 *
 * Only the ERC-20 methods the tip jar UI needs are included in the ABI.
 */
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
    USDC: {
      address: BASE_USDC_ADDRESS,
      abi: usdcAbi,
    },
  },
  8453: {
    USDC: {
      address: BASE_USDC_ADDRESS,
      abi: usdcAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
