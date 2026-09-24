import { baseSepolia, localhost, sepolia } from "wagmi/chains";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

export const escrowAddress = import.meta.env.VITE_TOOLSHED_ESCROW_ADDRESS as `0x${string}` | undefined;
export const usdcAddress = import.meta.env.VITE_USDC_ADDRESS as `0x${string}` | undefined;

export const wagmiConfig = createConfig({
  chains: [localhost, baseSepolia, sepolia],
  connectors: [injected()],
  transports: {
    [localhost.id]: http(import.meta.env.VITE_LOCAL_RPC_URL ?? "http://127.0.0.1:8545"),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL),
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL)
  }
});

export const toolshedEscrowAbi = [
  {
    type: "function",
    name: "requestLoan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toolId", type: "bytes32" },
      { name: "toolOwner", type: "address" },
      { name: "depositAmount", type: "uint256" },
      { name: "lateFeePerDay", type: "uint256" },
      { name: "startsAt", type: "uint64" },
      { name: "dueAt", type: "uint64" }
    ],
    outputs: [{ name: "loanId", type: "uint256" }]
  },
  {
    type: "function",
    name: "acceptLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "cancelRequest",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "confirmReturn",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "borrowerStats",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [
      { name: "completedLoans", type: "uint64" },
      { name: "lateReturns", type: "uint64" },
      { name: "totalLateFeesPaid", type: "uint256" }
    ]
  }
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;
