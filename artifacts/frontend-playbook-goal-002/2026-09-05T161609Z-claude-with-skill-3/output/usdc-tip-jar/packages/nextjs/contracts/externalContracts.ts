import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Contracts that are already deployed and are not part of this project's deploy scripts.
 *
 * USDC is Circle's canonical token on Base. The same address is listed under 31337 because the
 * local chain is an Anvil *fork* of Base (`yarn fork --network base`), so the real token is there
 * at the real address. Only the ERC20 methods the tip jar UI needs are included.
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
      { name: "value", type: "uint256" },
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
    USDC: { address: USDC_ADDRESS, abi: usdcAbi },
  },
  8453: {
    USDC: { address: USDC_ADDRESS, abi: usdcAbi },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
