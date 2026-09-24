import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  type Address,
  type Hex,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { stdin as input, stdout as output } from 'node:process'
import * as readline from 'node:readline/promises'

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNISWAP_V3_SWAP_ROUTER_02 = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
const UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

const DEFAULT_WETH_USDC_FEE = 500
const DEFAULT_SLIPPAGE_BPS = 50n
const REFERRAL_CODE = 0
const BPS = 10_000n

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const quoterV2Abi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

const entryAbi = [
  {
    type: 'function',
    name: 'enter',
    stateMutability: 'payable',
    inputs: [
      { name: 'wethAmount', type: 'uint256' },
      { name: 'minUsdcOut', type: 'uint256' },
      { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    outputs: [{ name: 'usdcSupplied', type: 'uint256' }],
  },
] as const

const implementationSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IV3SwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract WethUsdcAaveEntry {
    address public constant WETH = ${WETH};
    address public constant USDC = ${USDC};
    address public constant UNISWAP_V3_SWAP_ROUTER_02 = ${UNISWAP_V3_SWAP_ROUTER_02};
    address public constant AAVE_V3_POOL = ${AAVE_V3_POOL};

    error ApproveFailed(address token, address spender);
    error InsufficientWeth(uint256 balance, uint256 requested);
    error OnlySelf();
    error Slippage(uint256 received, uint256 minimum);
    error ZeroAmount();

    event Entered(uint256 wethSold, uint256 usdcSupplied);

    function enter(
        uint256 wethAmount,
        uint256 minUsdcOut,
        uint24 fee,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 usdcSupplied) {
        if (msg.sender != address(this)) revert OnlySelf();
        if (wethAmount == 0) revert ZeroAmount();

        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        if (wethAmount > wethBalance) revert InsufficientWeth(wethBalance, wethAmount);

        uint256 usdcBefore = IERC20(USDC).balanceOf(address(this));

        _forceApprove(WETH, UNISWAP_V3_SWAP_ROUTER_02, wethAmount);
        IV3SwapRouter02(UNISWAP_V3_SWAP_ROUTER_02).exactInputSingle(
            IV3SwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: fee,
                recipient: address(this),
                amountIn: wethAmount,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        usdcSupplied = IERC20(USDC).balanceOf(address(this)) - usdcBefore;
        if (usdcSupplied < minUsdcOut) revert Slippage(usdcSupplied, minUsdcOut);

        _forceApprove(USDC, AAVE_V3_POOL, usdcSupplied);
        IAaveV3Pool(AAVE_V3_POOL).supply(USDC, usdcSupplied, address(this), ${REFERRAL_CODE});

        emit Entered(wethAmount, usdcSupplied);
    }

    function _forceApprove(address token, address spender, uint256 amount) internal {
        _approve(token, spender, 0);
        _approve(token, spender, amount);
    }

    function _approve(address token, address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.approve, (spender, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ApproveFailed(token, spender);
    }
}
`

let account: ReturnType<typeof privateKeyToAccount>
let publicClient: ReturnType<typeof createPublicClient>
let walletClient: ReturnType<typeof createWalletClient>

async function main() {
  const command = process.argv[2] ?? 'enter'
  if (command === 'compile') return compileOnly()

  initClients()
  const chainId = await publicClient.getChainId()
  if (chainId !== mainnet.id) throw new Error(`RPC_URL is chain ${chainId}, expected Ethereum mainnet chain 1`)

  if (command === 'deploy') return deployImplementation()
  if (command === 'enter') return enterPosition()
  if (command === 'clear') return clearDelegation()

  throw new Error(`Unknown command "${command}". Use "compile", "deploy", "enter", or "clear".`)
}

function initClients() {
  const rpcUrl = mustEnv('RPC_URL')
  const privateKey = mustEnv('PRIVATE_KEY') as Hex
  account = privateKeyToAccount(privateKey)
  publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  })
  walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  })
}

async function compileOnly() {
  const bytecode = await compileImplementation()
  console.log(`Compiled WethUsdcAaveEntry bytecode: ${(bytecode.length - 2) / 2} bytes`)
}

async function deployImplementation() {
  const bytecode = await compileImplementation()
  console.log(`Deploying WethUsdcAaveEntry from ${account.address}`)

  const hash = await walletClient.deployContract({
    account,
    abi: [],
    bytecode,
    chain: mainnet,
  })
  console.log(`Deployment transaction: ${hash}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error('Deployment succeeded but no contract address was returned')

  console.log(`Implementation deployed at: ${receipt.contractAddress}`)
  console.log('Set IMPLEMENTATION_ADDRESS to this value before running: tsx entry.ts enter')
}

async function enterPosition() {
  const implementation = getAddress(mustEnv('IMPLEMENTATION_ADDRESS'))
  const implementationCode = await publicClient.getCode({ address: implementation })
  if (!implementationCode || implementationCode === '0x') {
    throw new Error(`No contract code at IMPLEMENTATION_ADDRESS ${implementation}`)
  }

  await assertDelegationCanProceed(implementation)

  const wethAmount = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (wethAmount === 0n) throw new Error(`${account.address} has no WETH`)

  const fee = Number(process.env.UNISWAP_V3_FEE ?? DEFAULT_WETH_USDC_FEE)
  const sqrtPriceLimitX96 = 0n
  const quote = await quoteUsdcOut(wethAmount, fee, sqrtPriceLimitX96)
  const slippageBps = BigInt(process.env.SLIPPAGE_BPS ?? DEFAULT_SLIPPAGE_BPS)
  if (slippageBps >= BPS) throw new Error('SLIPPAGE_BPS must be below 10000')

  const minUsdcOut = process.env.MIN_USDC_OUT
    ? BigInt(process.env.MIN_USDC_OUT)
    : (quote * (BPS - slippageBps)) / BPS

  const data = encodeFunctionData({
    abi: entryAbi,
    functionName: 'enter',
    args: [wethAmount, minUsdcOut, fee, sqrtPriceLimitX96],
  })

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: implementation,
    executor: 'self',
  })

  const ethBalance = await publicClient.getBalance({ address: account.address })
  const gas = await publicClient.estimateGas({
    account: account.address,
    authorizationList: [authorization],
    data,
    to: account.address,
  })
  const fees = await publicClient.estimateFeesPerGas()
  const worstCaseGas = gas * (fees.maxFeePerGas ?? 0n)

  console.log('About to send one EIP-7702 transaction:')
  console.log(`  account:        ${account.address}`)
  console.log(`  delegate code:  ${implementation}`)
  console.log(`  sell:           ${formatUnits(wethAmount, 18)} WETH`)
  console.log(`  quoted:         ${formatUnits(quote, 6)} USDC`)
  console.log(`  minimum:        ${formatUnits(minUsdcOut, 6)} USDC`)
  console.log(`  Uniswap fee:    ${fee}`)
  console.log(`  gas estimate:   ${gas.toString()} gas`)
  console.log(`  max gas cost:   ${formatEther(worstCaseGas)} ETH`)
  console.log(`  ETH balance:    ${formatEther(ethBalance)} ETH`)
  console.log('')
  console.log('The transaction will approve WETH to SwapRouter02, swap WETH to USDC, approve USDC to Aave V3 Pool,')
  console.log('and supply the exact USDC received from the swap to Aave on behalf of the same address.')

  await requireTypedConfirmation('EXECUTE')

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    chain: mainnet,
    data,
    to: account.address,
  })
  console.log(`Transaction sent: ${hash}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`Mined in block ${receipt.blockNumber}; status: ${receipt.status}`)
  if (receipt.status !== 'success') throw new Error('Entry transaction reverted')
  console.log('Delegation remains set. Run "tsx entry.ts clear" after the position is open if you want to remove it.')
}

async function clearDelegation() {
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: zeroAddress,
    executor: 'self',
  })

  console.log(`Clearing EIP-7702 delegation for ${account.address}`)
  await requireTypedConfirmation('CLEAR')

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    chain: mainnet,
    to: account.address,
  })
  console.log(`Clear transaction sent: ${hash}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`Mined in block ${receipt.blockNumber}; status: ${receipt.status}`)
}

async function quoteUsdcOut(wethAmount: bigint, fee: number, sqrtPriceLimitX96: bigint) {
  const { result } = await publicClient.simulateContract({
    address: UNISWAP_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        amountIn: wethAmount,
        fee,
        sqrtPriceLimitX96,
      },
    ],
  })
  return result[0]
}

async function assertDelegationCanProceed(implementation: Address) {
  const code = await publicClient.getCode({ address: account.address })
  const delegatedTo = getDelegationTarget(code)
  if (!delegatedTo) return
  if (delegatedTo.toLowerCase() === implementation.toLowerCase()) return
  if (process.env.ALLOW_REDELEGATE === 'true') return

  throw new Error(
    `${account.address} is already delegated to ${delegatedTo}. Set ALLOW_REDELEGATE=true only if replacing it is intended.`,
  )
}

function getDelegationTarget(code: Hex | undefined): Address | undefined {
  if (!code || code === '0x') return undefined
  if (code.length === 48 && code.toLowerCase().startsWith('0xef0100')) {
    return getAddress(`0x${code.slice(8)}`)
  }
  throw new Error(`Account has non-delegation code: ${code.slice(0, 18)}...`)
}

async function compileImplementation(): Promise<Hex> {
  const solc = await import('solc')
  const input = {
    language: 'Solidity',
    sources: {
      'WethUsdcAaveEntry.sol': { content: implementationSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 1_000_000 },
      outputSelection: {
        '*': {
          '*': ['evm.bytecode.object'],
        },
      },
    },
  }
  const output = JSON.parse(solc.default.compile(JSON.stringify(input)))
  const errors = output.errors?.filter((error: { severity: string }) => error.severity === 'error') ?? []
  if (errors.length > 0) {
    throw new Error(errors.map((error: { formattedMessage: string }) => error.formattedMessage).join('\n'))
  }
  const object = output.contracts['WethUsdcAaveEntry.sol'].WethUsdcAaveEntry.evm.bytecode.object
  return `0x${object}` as Hex
}

async function requireTypedConfirmation(word: string) {
  if (process.env.CONFIRM === word) return

  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`Type ${word} to continue: `)
  rl.close()
  if (answer !== word) throw new Error('Cancelled')
}

function mustEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
