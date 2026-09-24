import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const AAVE_V3_POOL_ADDRESSES_PROVIDER = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e'

const DEFAULT_UNISWAP_FEE = 500
const DEFAULT_DEADLINE_SECONDS = 10 * 60

const entryImplementationAbi = [
  {
    type: 'function',
    name: 'enterWethUsdcAave',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'uniswapFee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'aavePool', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'Entered',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: false, name: 'wethIn', type: 'uint256' },
      { indexed: false, name: 'usdcOut', type: 'uint256' },
      { indexed: true, name: 'aavePool', type: 'address' },
    ],
  },
] as const

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const uniswapV3FactoryAbi = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const

const poolAddressesProviderAbi = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const entryImplementationBytecode =
  '0x6080604052348015600e575f5ffd5b506106e98061001c5f395ff3fe608060405260043610610049575f3560e01c806310975f8f1461004d578063875f54151461008257806389a30271146100c15780638bb4d739146100e8578063ad5c46481461010f575b5f5ffd5b61006061005b366004610573565b610136565b604080519283526001600160a01b039091166020830152015b60405180910390f35b34801561008d575f5ffd5b506100a9732f39d218133afab8f2b819b1066c7e434ad94e9e81565b6040516001600160a01b039091168152602001610079565b3480156100cc575f5ffd5b506100a973a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4881565b3480156100f3575f5ffd5b506100a973e592427a0aece92de3edee1f18e0157c0586156481565b34801561011a575f5ffd5b506100a973c02aaa39b223fe8d0a0e5c4f27ead9083c756cc281565b5f803330146101585760405163029a949d60e31b815260040160405180910390fd5b865f036101785760405163990965c160e01b815260040160405180910390fd5b6101ab73c02aaa39b223fe8d0a0e5c4f27ead9083c756cc273e592427a0aece92de3edee1f18e0157c0586156489610439565b604080516101008101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48602082015262ffffff8716818301523060608201526080810185905260a0810189905260c081018890526001600160a01b03861660e0820152905163414bf38960e01b815273e592427a0aece92de3edee1f18e0157c058615649163414bf3899161025091906004016105c8565b6020604051808303815f875af115801561026c573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102909190610645565b9150815f036102b257604051631125efa160e21b815260040160405180910390fd5b732f39d218133afab8f2b819b1066c7e434ad94e9e6001600160a01b031663026b1d5f6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610302573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610326919061065c565b90506001600160a01b03811661034f5760405163113371f160e31b815260040160405180910390fd5b61036e73a0b86991c6218b36c1d19d4a2e9eb0ce3606eb488284610439565b60405163617ba03760e01b815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018390523060448201525f60648201526001600160a01b0382169063617ba037906084015f604051808303815f87803b1580156103d3575f5ffd5b505af11580156103e5573d5f5f3e3d5ffd5b5050604080518a8152602081018690526001600160a01b03851693503092507f72d63734b7c46d5a18e94a458b5261486e39b0f6e82244a04a1fc57568c9b282910160405180910390a39550959350505050565b61044483835f610454565b61044f838383610454565b505050565b6040516001600160a01b038381166024830152604482018390525f91829186169060640160408051601f198184030181529181526020820180516001600160e01b031663095ea7b360e01b179052516104ad919061067e565b5f604051808303815f865af19150503d805f81146104e6576040519150601f19603f3d011682016040523d82523d5f602084013e6104eb565b606091505b509150915081158061051957508051158015906105195750808060200190518101906105179190610694565b155b1561055557604051636a93d39160e01b81526001600160a01b038087166004830152851660248201526044810184905260640160405180910390fd5b5050505050565b6001600160a01b0381168114610570575f5ffd5b50565b5f5f5f5f5f60a08688031215610587575f5ffd5b8535945060208601359350604086013562ffffff811681146105a7575f5ffd5b925060608601356105b78161055c565b949793965091946080013592915050565b81516001600160a01b03908116825260208084015182169083015260408084015162ffffff169083015260608084015191821690830152610100820190506080830151608083015260a083015160a083015260c083015160c083015260e083015161063e60e08401826001600160a01b03169052565b5092915050565b5f60208284031215610655575f5ffd5b5051919050565b5f6020828403121561066c575f5ffd5b81516106778161055c565b9392505050565b5f82518060208501845e5f920191825250919050565b5f602082840312156106a4575f5ffd5b81518015158114610677575f5ffdfea264697066735822122014e6cfc528b6ef2de767908b28ca0194b0c493d39200187c24b17f4c591f2b9f64736f6c63430008250033' as Hex

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name]
  if (!value) return undefined
  if (!isAddress(value)) throw new Error(`${name} is not an Ethereum address`)
  return getAddress(value)
}

function parsePrivateKey(value: string): Hex {
  const key = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('PRIVATE_KEY must be a 32-byte hex private key')
  return key as Hex
}

function parseUsdcAmount(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error('AMOUNT_OUT_MIN_USDC must be a decimal USDC amount with at most 6 decimals')
  }
  return parseUnits(value, 6)
}

async function main() {
  const rpcUrl = env('RPC_URL')
  const account = privateKeyToAccount(parsePrivateKey(env('PRIVATE_KEY')))
  const amountOutMinimum = parseUsdcAmount(env('AMOUNT_OUT_MIN_USDC'))
  const uniswapFee = Number(process.env.UNISWAP_FEE ?? DEFAULT_UNISWAP_FEE)
  const deadlineSeconds = Number(process.env.DEADLINE_SECONDS ?? DEFAULT_DEADLINE_SECONDS)
  const sendTransaction = process.env.SEND_TRANSACTION === '1'

  if (!Number.isInteger(uniswapFee) || uniswapFee < 0 || uniswapFee > 1_000_000) {
    throw new Error('UNISWAP_FEE must be a uint24 fee tier, for example 500 or 3000')
  }
  if (!Number.isInteger(deadlineSeconds) || deadlineSeconds <= 0) {
    throw new Error('DEADLINE_SECONDS must be a positive integer')
  }

  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })

  const chainId = await publicClient.getChainId()
  if (chainId !== mainnet.id) throw new Error(`RPC is chain ${chainId}, expected Ethereum mainnet chain 1`)

  const implementationAddress =
    optionalAddress('ENTRY_IMPLEMENTATION_ADDRESS') ?? (await deployImplementationIfRequested(walletClient, publicClient, account))

  const [implementationCode, wethBalance, aavePool, uniswapPool] = await Promise.all([
    publicClient.getCode({ address: implementationAddress }),
    publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.readContract({
      address: AAVE_V3_POOL_ADDRESSES_PROVIDER,
      abi: poolAddressesProviderAbi,
      functionName: 'getPool',
    }),
    publicClient.readContract({
      address: UNISWAP_V3_FACTORY,
      abi: uniswapV3FactoryAbi,
      functionName: 'getPool',
      args: [WETH, USDC, uniswapFee],
    }),
  ])

  if (!implementationCode || implementationCode === '0x') {
    throw new Error(`No code at ENTRY_IMPLEMENTATION_ADDRESS ${implementationAddress}`)
  }
  if (wethBalance === 0n) throw new Error(`${account.address} has no WETH`)
  if (uniswapPool === '0x0000000000000000000000000000000000000000') {
    throw new Error(`No Uniswap V3 WETH/USDC pool for fee tier ${uniswapFee}`)
  }

  const [wethRouterAllowance, usdcAaveAllowance] = await Promise.all([
    publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, '0xE592427A0AEce92De3Edee1F18E0157C05861564'],
    }),
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, aavePool],
    }),
  ])

  if (wethRouterAllowance !== 0n || usdcAaveAllowance !== 0n) {
    console.warn('The account already has one or more relevant token allowances; review before proceeding.')
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)
  const data = encodeFunctionData({
    abi: entryImplementationAbi,
    functionName: 'enterWethUsdcAave',
    args: [wethBalance, amountOutMinimum, uniswapFee, 0n, deadline],
  })

  console.log('EOA:', account.address)
  console.log('Entry implementation:', implementationAddress)
  console.log('WETH in:', formatEther(wethBalance))
  console.log('USDC min out:', formatUnits(amountOutMinimum, 6))
  console.log('Uniswap V3 WETH/USDC fee tier:', uniswapFee)
  console.log('Uniswap pool:', uniswapPool)
  console.log('Aave V3 Pool:', aavePool)
  console.log('Deadline:', new Date(Number(deadline) * 1000).toISOString())

  if (!sendTransaction) {
    console.log('Dry run only. Set SEND_TRANSACTION=1 to sign and broadcast the EIP-7702 transaction.')
    return
  }

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: implementationAddress,
    executor: 'self',
  })

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    to: account.address,
    data,
  })

  console.log('Transaction submitted:', hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Status:', receipt.status)

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== account.address.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({ abi: entryImplementationAbi, data: log.data, topics: log.topics })
      if (decoded.eventName === 'Entered') {
        console.log('USDC supplied:', formatUnits(decoded.args.usdcOut, 6))
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
}

async function deployImplementationIfRequested(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  account: PrivateKeyAccount,
): Promise<Address> {
  if (process.env.DEPLOY_ENTRY_IMPLEMENTATION !== '1') {
    throw new Error('Set ENTRY_IMPLEMENTATION_ADDRESS, or set DEPLOY_ENTRY_IMPLEMENTATION=1 for a setup deployment.')
  }

  const hash = await (walletClient as any).deployContract({
    account,
    abi: entryImplementationAbi,
    bytecode: entryImplementationBytecode,
  })
  console.log('Deploying entry implementation:', hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error('Implementation deployment did not return a contract address')
  console.log('Entry implementation deployed:', receipt.contractAddress)
  return receipt.contractAddress
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
