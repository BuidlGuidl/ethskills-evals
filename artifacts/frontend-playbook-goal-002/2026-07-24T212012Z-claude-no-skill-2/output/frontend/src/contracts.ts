import type { Address } from "viem";

// --- Deployed addresses ------------------------------------------------------
//
// These defaults are the DETERMINISTIC addresses produced by running the
// Foundry `Deploy` script against a fresh anvil node (deployer = anvil account
// #0, starting from nonce 0). If you redeploy on a non-fresh node, override them
// with a `frontend/.env.local` file:
//
//   VITE_TIP_JAR_ADDRESS=0x...
//   VITE_USDC_ADDRESS=0x...
//
// On Base mainnet, set VITE_USDC_ADDRESS to the real USDC:
//   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export const TIP_JAR_ADDRESS = (import.meta.env.VITE_TIP_JAR_ADDRESS ??
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512") as Address;

export const USDC_ADDRESS = (import.meta.env.VITE_USDC_ADDRESS ??
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as Address;

export const USDC_DECIMALS = 6;

// --- ABIs (only the pieces the UI needs) -------------------------------------

export const tipJarAbi = [
  {
    type: "function",
    name: "tip",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "message", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getRecentTips",
    stateMutability: "view",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "message", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "tipCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalTipped",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "jarBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "NewTip",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "message", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "index", type: "uint256", indexed: false },
    ],
  },
] as const;

export const usdcAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
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
    // Present on the local MockUSDC only. Lets you mint test funds.
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export type Tip = {
  from: Address;
  amount: bigint;
  message: string;
  timestamp: bigint;
};
