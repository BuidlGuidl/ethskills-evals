// Generated from contracts/src/Streak.sol — regenerate with `npm run sync-abi`.
export const StreakAbi = [
  {
    "type": "function",
    "name": "DAY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_NOTE_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "checkIn",
    "inputs": [
      {
        "name": "note",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "day",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "streak",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "currentDay",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentStreakOf",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasCheckedInToday",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "memberOf",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Streak.Member",
        "components": [
          {
            "name": "lastDay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "firstDay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "streak",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "longestStreak",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "total",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "profileOf",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "currentStreak",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "longestStreak",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "total",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "firstDay",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "lastDay",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalCheckIns",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalMembers",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "CheckedIn",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "day",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "streak",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "total",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "note",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyCheckedIn",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "day",
        "type": "uint32",
        "internalType": "uint32"
      }
    ]
  },
  {
    "type": "error",
    "name": "NoteTooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;
