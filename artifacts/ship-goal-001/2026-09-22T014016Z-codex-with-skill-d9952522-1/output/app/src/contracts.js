export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_EXPECTED_CHAIN_ID || 84532);
export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || BASE_SEPOLIA_USDC;
export const ESCROW_ADDRESS = import.meta.env.VITE_TOOLSHED_ESCROW_ADDRESS || "";

export const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

export const escrowAbi = [
  "function openLoan(bytes32 toolId,address toolOwner,uint64 dueAt,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
  "function settleReturn(uint256 loanId)",
  "function quoteSettlement(uint256 loanId,uint64 returnedAt) view returns (uint256 lateDays,uint256 ownerFee,uint256 borrowerRefund)",
  "event LoanOpened(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address toolOwner,uint64 dueAt,uint256 deposit,uint256 dailyLateFee)",
  "event ReturnSettled(uint256 indexed loanId,address indexed borrower,address indexed toolOwner,uint64 returnedAt,uint256 lateDays,uint256 ownerFee,uint256 borrowerRefund)"
];
