export const toolshedEscrowAbi = [
  {
    type: "function",
    name: "requestLoan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toolId", type: "bytes32" },
      { name: "listingHash", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "dueAt", type: "uint64" },
      { name: "depositAmount", type: "uint256" },
      { name: "dailyLateFee", type: "uint256" }
    ],
    outputs: [{ name: "loanId", type: "uint256" }]
  }
] as const;

export const erc20Abi = [
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
