import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Manually added external contracts.
 *
 * USDC is registered under both chain ids the app targets:
 *  - 31337: the local Anvil fork of Base (same canonical USDC address as Base)
 *  - 8453:  Base mainnet (production IPFS build)
 *
 * The address is identical because the local network is a fork of Base.
 */
const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
  31337: {
    USDC: { address: usdcAddress, abi: usdcAbi },
  },
  8453: {
    USDC: { address: usdcAddress, abi: usdcAbi },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
