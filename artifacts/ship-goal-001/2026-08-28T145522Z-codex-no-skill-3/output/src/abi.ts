export const toolshedAbi = [
  { type:'function', name:'toolCount', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
  { type:'function', name:'loanCount', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
  { type:'function', name:'isMember', stateMutability:'view', inputs:[{name:'',type:'address'}], outputs:[{type:'bool'}] },
  { type:'function', name:'tools', stateMutability:'view', inputs:[{name:'',type:'uint256'}], outputs:[{name:'id',type:'uint256'},{name:'owner',type:'address'},{name:'name',type:'string'},{name:'description',type:'string'},{name:'imageURI',type:'string'},{name:'condition',type:'string'},{name:'deposit',type:'uint256'},{name:'dailyLateFee',type:'uint256'},{name:'available',type:'bool'}] },
  { type:'function', name:'loans', stateMutability:'view', inputs:[{name:'',type:'uint256'}], outputs:[{name:'id',type:'uint256'},{name:'toolId',type:'uint256'},{name:'borrower',type:'address'},{name:'durationDays',type:'uint64'},{name:'dueAt',type:'uint64'},{name:'returnedAt',type:'uint64'},{name:'status',type:'uint8'}] },
  { type:'function', name:'reputation', stateMutability:'view', inputs:[{name:'',type:'address'}], outputs:[{name:'completedLoans',type:'uint32'},{name:'lateReturns',type:'uint32'}] },
  { type:'function', name:'listTool', stateMutability:'nonpayable', inputs:[{name:'name',type:'string'},{name:'description',type:'string'},{name:'imageURI',type:'string'},{name:'condition',type:'string'},{name:'deposit',type:'uint256'},{name:'dailyLateFee',type:'uint256'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'requestLoan', stateMutability:'nonpayable', inputs:[{name:'toolId',type:'uint256'},{name:'durationDays',type:'uint64'}], outputs:[{type:'uint256'}] },
  ...['acceptLoan','rejectLoan','cancelRequest','markReturned','confirmReturn'].map(name => ({ type:'function', name, stateMutability:'nonpayable', inputs:[{name:'loanId',type:'uint256'}], outputs:[] } as const))
] as const

export const erc20Abi = [
  { type:'function', name:'approve', stateMutability:'nonpayable', inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}], outputs:[{type:'bool'}] }
] as const

