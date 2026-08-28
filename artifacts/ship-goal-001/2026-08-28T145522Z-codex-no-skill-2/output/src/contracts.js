export const toolshedAbi = [
  "function admin() view returns (address)",
  "function members(address) view returns (bool)",
  "function toolCount() view returns (uint256)",
  "function loanCount() view returns (uint256)",
  "function tools(uint256) view returns (uint256 id,address owner,string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee,bool available,bool active)",
  "function loans(uint256) view returns (uint256 id,uint256 toolId,address borrower,uint32 durationDays,uint64 startedAt,uint64 dueAt,uint64 returnMarkedAt,uint8 status)",
  "function reputation(address) view returns (uint32 completedLoans,uint32 lateReturns)",
  "function setMember(address member,bool enabled)",
  "function listTool(string name,string photoURI,string condition,uint256 deposit,uint256 dailyLateFee) returns (uint256)",
  "function requestLoan(uint256 toolId,uint32 durationDays) returns (uint256)",
  "function acceptLoan(uint256 id)",
  "function rejectLoan(uint256 id)",
  "function cancelRequest(uint256 id)",
  "function markReturned(uint256 id)",
  "function confirmReturned(uint256 id)",
  "function finalizeUnconfirmedReturn(uint256 id)",
];

export const usdcAbi = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

export const STATUS = ["None", "Requested", "Active", "Return marked", "Complete", "Rejected", "Cancelled"];
