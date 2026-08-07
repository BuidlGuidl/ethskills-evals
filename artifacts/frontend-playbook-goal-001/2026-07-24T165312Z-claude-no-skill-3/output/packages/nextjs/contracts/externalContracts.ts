import deployedContracts from "./deployedContracts";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Canonical USDC on Base. The same address is valid on Base mainnet (8453) and on a
 * local Base fork (served under anvil's chain id 31337), so we register it for both.
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
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
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

const usdc = { address: BASE_USDC_ADDRESS, abi: usdcAbi } as const;

// The TipJar ABI is owned by the Foundry package and regenerated into deployedContracts
// on every local deploy. We reuse it here (single source of truth) to expose TipJar on
// Base mainnet for the production build. Set NEXT_PUBLIC_TIPJAR_ADDRESS to the address
// returned by `yarn deploy --network base` before shipping the IPFS build.
const tipJarBase = {
  address: (process.env.NEXT_PUBLIC_TIPJAR_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  abi: deployedContracts[31337].TipJar.abi,
} as const;

const externalContracts = {
  31337: { USDC: usdc },
  8453: { USDC: usdc, TipJar: tipJarBase },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
