import { http, createPublicClient, createWalletClient, custom, defineChain, getContract, type Address } from "viem";

export const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 84532);
export const chainName = import.meta.env.VITE_CHAIN_NAME ?? "Base Sepolia";
export const rpcUrl = import.meta.env.VITE_RPC_URL ?? "https://sepolia.base.org";
export const blockExplorer = import.meta.env.VITE_BLOCK_EXPLORER ?? "https://sepolia.basescan.org";
export const escrowAddress = (import.meta.env.VITE_ESCROW_ADDRESS ?? "") as Address;
export const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS ?? "") as Address;

export const appChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: chainName, url: blockExplorer } },
});

export const publicClient = createPublicClient({
  chain: appChain,
  transport: http(rpcUrl),
});

export function walletClient() {
  if (!window.ethereum) {
    throw new Error("No wallet provider found. Install a wallet browser extension.");
  }

  return createWalletClient({
    chain: appChain,
    transport: custom(window.ethereum),
  });
}

export const escrowAbi = [
  {
    type: "function",
    name: "listTool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataURI", type: "string" },
      { name: "depositAmount", type: "uint256" },
      { name: "lateFeePerDay", type: "uint256" },
      { name: "maxLoanDays", type: "uint16" },
    ],
    outputs: [{ name: "toolId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setMember",
    stateMutability: "nonpayable",
    inputs: [
      { name: "member", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requestLoan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toolId", type: "uint256" },
      { name: "requestedDays", type: "uint16" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    type: "function",
    name: "approveLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelPendingLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmReturn",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "reliabilityBps",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
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
] as const;

export function escrowContract() {
  if (!escrowAddress) {
    throw new Error("Set VITE_ESCROW_ADDRESS in .env.local.");
  }

  return getContract({
    address: escrowAddress,
    abi: escrowAbi,
    client: publicClient,
  });
}
