/**
 * One-click entry: swap ALL WETH -> USDC on Uniswap V3, then supply EVERY USDC the swap
 * returned to Aave V3, as ONE atomic transaction sent from the user's existing EOA.
 *
 * How: EIP-7702 (live on mainnet since Pectra, May 2025). The EOA temporarily runs
 * MetaMask's audited EIP7702StatelessDeleGator code, which exposes an ERC-7579 batch
 * `execute`. A single type-4 transaction from the EOA to itself runs the batch; if any call
 * reverts, the whole transaction reverts. Same address, same keys, same history, no new wallet.
 *
 * The amount that reaches Aave is not known at signing time, so the swap sends its output to
 * a tiny stateless helper (contracts/AaveSupplyAll.sol) which supplies its entire balance to
 * Aave with onBehalfOf = msg.sender (the user). See NOTES.md.
 *
 * Usage (see NOTES.md for the full checklist):
 *   RPC_URL=... PRIVATE_KEY=0x... npx tsx entry.ts deploy-helper      # one-time, any account
 *   RPC_URL=... PRIVATE_KEY=0x... SUPPLY_HELPER=0x... npx tsx entry.ts            # dry run (simulate only)
 *   RPC_URL=... PRIVATE_KEY=0x... SUPPLY_HELPER=0x... npx tsx entry.ts --send     # broadcast
 *
 * Browser / MetaMask (no private key leaves the wallet): see `enterViaWallet()` below, which
 * sends the same calls through EIP-5792 `wallet_sendCalls` with atomicity required.
 */
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  concatHex,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  size,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ───────────────────────────── Mainnet addresses ─────────────────────────────
export const ADDR = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  aEthUSDC: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c', // Aave V3 aToken for USDC
  UNI_V3_SWAP_ROUTER02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  UNI_V3_QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  UNI_V3_WETH_USDC_005: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // 0.05% pool (deepest)
  AAVE_V3_POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  CHAINLINK_ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  // MetaMask Delegation Framework v1.3.0 — the same delegate MetaMask uses for its
  // "smart account" upgrade. Stateless: signer is always the EOA itself, no init/storage.
  METAMASK_STATELESS_DELEGATOR: '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B',
} as const satisfies Record<string, Address>

const POOL_FEE = 500 // 0.05%
const USDC_DECIMALS = 6

// ───────────────────────────────── ABIs ──────────────────────────────────────
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
])

// SwapRouter02: exactInputSingle has NO deadline field; the deadline is enforced by
// multicall(uint256 deadline, bytes[] data).
const swapRouter02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
])

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

// ERC-7579 execute as implemented by MetaMask DeleGator (onlyEntryPointOrSelf).
const delegatorAbi = parseAbi(['function execute(bytes32 mode, bytes executionCalldata) payable'])

export const supplyAllAbi = parseAbi([
  'function supplyAll(address asset, uint256 minAmount) returns (uint256 amount)',
  'event SuppliedAll(address indexed asset, address indexed onBehalfOf, uint256 amount)',
])

// solc 0.8.20, --optimize --optimize-runs 200 --evm-version shanghai, contracts/AaveSupplyAll.sol
const SUPPLY_ALL_BYTECODE: Hex = '0x608060405234801561000f575f80fd5b5061041f8061001d5f395ff3fe608060405234801561000f575f80fd5b5060043610610034575f3560e01c80637535d24614610038578063b2422b0514610070575b5f80fd5b6100537387870bca3f3fd6335c3f4ce8392d69350b4fa4e281565b6040516001600160a01b0390911681526020015b60405180910390f35b61008361007e36600461034b565b610091565b604051908152602001610067565b6040516370a0823160e01b81523060048201525f906001600160a01b038416906370a0823190602401602060405180830381865afa1580156100d5573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906100f99190610380565b9050801580159061010a5750818110155b61015b5760405162461bcd60e51b815260206004820152601b60248201527f41617665537570706c79416c6c3a20696e73756666696369656e74000000000060448201526064015b60405180910390fd5b6101658382610226565b60405163617ba03760e01b81526001600160a01b0384166004820152602481018290523360448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b1580156101ca575f80fd5b505af11580156101dc573d5f803e3d5ffd5b50506040518381523392506001600160a01b03861691507f044db236edfbd91f7553c04c5900ce24eb05767410049b34c45490a024cd8b839060200160405180910390a392915050565b6040517387870bca3f3fd6335c3f4ce8392d69350b4fa4e26024820152604481018290525f9081906001600160a01b0385169060640160408051601f198184030181529181526020820180516001600160e01b031663095ea7b360e01b179052516102919190610397565b5f604051808303815f865af19150503d805f81146102ca576040519150601f19603f3d011682016040523d82523d5f602084013e6102cf565b606091505b50915091508180156102f95750805115806102f95750808060200190518101906102f991906103c3565b6103455760405162461bcd60e51b815260206004820152601d60248201527f41617665537570706c79416c6c3a20617070726f7665206661696c65640000006044820152606401610152565b50505050565b5f806040838503121561035c575f80fd5b82356001600160a01b0381168114610372575f80fd5b946020939093013593505050565b5f60208284031215610390575f80fd5b5051919050565b5f82515f5b818110156103b6576020818601810151858301520161039c565b505f920191825250919050565b5f602082840312156103d3575f80fd5b815180151581146103e2575f80fd5b939250505056fea2646970667358221220d8313a80d68a4ba7b918ad9432e36866fe226928f3823b8320474ce3897879c064736f6c63430008140033'

// ERC-7579 ModeCode: callType=0x01 (batch), execType=0x00 (revert on any failure), rest zero.
const MODE_BATCH_REVERT: Hex = '0x0100000000000000000000000000000000000000000000000000000000000000'

// ───────────────────────────── Batch construction ────────────────────────────
export type Call = { to: Address; data: Hex; value: bigint }

/**
 * The three calls that make up the position entry. Executed with msg.sender = user.
 *  1. WETH.approve(SwapRouter02, amountIn)     — exact amount; consumed fully by the swap.
 *  2. SwapRouter02.multicall(deadline, [exactInputSingle(WETH->USDC, recipient = helper)])
 *  3. helper.supplyAll(USDC, minOut)           — supplies the helper's whole USDC balance
 *                                                 (= exactly the swap output) onBehalfOf user.
 * After the batch, every allowance the user granted is back to 0.
 */
export function buildEntryCalls(p: {
  amountIn: bigint
  minUsdcOut: bigint
  deadline: bigint
  helper: Address
}): Call[] {
  const swap = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: ADDR.WETH,
        tokenOut: ADDR.USDC,
        fee: POOL_FEE,
        recipient: p.helper,
        amountIn: p.amountIn,
        amountOutMinimum: p.minUsdcOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  return [
    {
      to: ADDR.WETH,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ADDR.UNI_V3_SWAP_ROUTER02, p.amountIn] }),
    },
    {
      to: ADDR.UNI_V3_SWAP_ROUTER02,
      value: 0n,
      data: encodeFunctionData({ abi: swapRouter02Abi, functionName: 'multicall', args: [p.deadline, [swap]] }),
    },
    {
      to: p.helper,
      value: 0n,
      data: encodeFunctionData({ abi: supplyAllAbi, functionName: 'supplyAll', args: [ADDR.USDC, p.minUsdcOut] }),
    },
  ]
}

/** Calldata for the EOA-to-itself transaction: DeleGator.execute(batch mode, abi.encode(Execution[])). */
export function encodeBatchExecute(calls: Call[]): Hex {
  const executionCalldata = encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    [calls.map((c) => ({ target: c.to, value: c.value, callData: c.data }))],
  )
  return encodeFunctionData({ abi: delegatorAbi, functionName: 'execute', args: [MODE_BATCH_REVERT, executionCalldata] })
}

// ───────────────────────────── Pricing / slippage ────────────────────────────
/**
 * Quote from Uniswap QuoterV2 and cross-check it against Chainlink ETH/USD so a manipulated
 * pool price at quote time cannot silently set a bad minimum.
 */
export async function computeMinOut(
  client: PublicClient,
  amountIn: bigint,
  slippageBps: bigint,
  maxOracleDeviationBps: bigint,
) {
  const { result } = await client.simulateContract({
    address: ADDR.UNI_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: ADDR.WETH, tokenOut: ADDR.USDC, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
  })
  const quoted = result[0]

  const [, answer, , updatedAt] = await client.readContract({
    address: ADDR.CHAINLINK_ETH_USD,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  })
  const ageSec = BigInt(Math.floor(Date.now() / 1000)) - updatedAt
  if (answer <= 0n || ageSec > 3600n + 600n) throw new Error(`Chainlink ETH/USD stale or invalid (age ${ageSec}s)`)
  // answer has 8 decimals; amountIn 18; USDC 6  =>  usdc = amountIn * answer / 1e20
  const oracleOut = (amountIn * BigInt(answer)) / 10n ** 20n
  const deviationBps = ((quoted > oracleOut ? quoted - oracleOut : oracleOut - quoted) * 10_000n) / oracleOut
  if (deviationBps > maxOracleDeviationBps) {
    throw new Error(
      `Uniswap quote ${formatUnits(quoted, USDC_DECIMALS)} deviates ${deviationBps} bps from Chainlink ` +
        `${formatUnits(oracleOut, USDC_DECIMALS)} (max ${maxOracleDeviationBps}). Refusing to trade.`,
    )
  }
  // Floor the minimum on the lower of the two prices, then apply slippage.
  const reference = quoted < oracleOut ? quoted : oracleOut
  const minOut = (reference * (10_000n - slippageBps)) / 10_000n
  return { quoted, oracleOut, deviationBps, minOut }
}

// ─────────────────────────── EIP-7702 delegation state ───────────────────────
type DelegationState = { kind: 'none' } | { kind: 'metamask' } | { kind: 'other'; code: Hex }

export async function getDelegationState(client: PublicClient, eoa: Address): Promise<DelegationState> {
  const code = await client.getCode({ address: eoa })
  if (!code || code === '0x') return { kind: 'none' }
  // EIP-7702 delegation indicator: 0xef0100 || address
  const expected = concatHex(['0xef0100', ADDR.METAMASK_STATELESS_DELEGATOR]).toLowerCase()
  if (size(code) === 23 && code.toLowerCase() === expected) return { kind: 'metamask' }
  return { kind: 'other', code }
}

// ───────────────────────────── Path A: MetaMask (browser) ────────────────────
/**
 * For a dapp talking to MetaMask. MetaMask (>= v12.17 / Pectra support) implements
 * EIP-5792 atomic batches by upgrading the SAME EOA to the DeleGator above via EIP-7702,
 * after showing the user one confirmation. `forceAtomic: true` makes the wallet refuse
 * rather than silently fall back to sending the calls as separate transactions.
 */
export async function enterViaWallet(
  wallet: WalletClient,
  publicClient: PublicClient,
  helper: Address,
  opts = { slippageBps: 50n, maxOracleDeviationBps: 150n, deadlineSec: 300n },
) {
  const [user] = await wallet.getAddresses()
  const caps = await wallet.getCapabilities({ account: user, chainId: mainnet.id })
  const atomic = (caps as { atomic?: { status?: string } }).atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready') {
    throw new Error(`Wallet cannot guarantee atomic batches for ${user} (atomic=${atomic}). Aborting.`)
  }
  const amountIn = await publicClient.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [user] })
  if (amountIn === 0n) throw new Error('No WETH to swap')
  const { minOut } = await computeMinOut(publicClient, amountIn, opts.slippageBps, opts.maxOracleDeviationBps)
  const block = await publicClient.getBlock()
  const calls = buildEntryCalls({ amountIn, minUsdcOut: minOut, deadline: block.timestamp + opts.deadlineSec, helper })

  const { id } = await wallet.sendCalls({ account: user, chain: mainnet, calls, forceAtomic: true })
  const status = await wallet.waitForCallsStatus({ id })
  if (status.status !== 'success' || !status.atomic || (status.receipts?.length ?? 0) !== 1) {
    throw new Error(`Batch not executed atomically in one tx: ${JSON.stringify(status, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`)
  }
  return status.receipts![0]
}

// ─────────────────────── Path B: script with a local key ─────────────────────
function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Missing env ${name}`)
  return v
}

async function main() {
  const args = process.argv.slice(2)
  const rpcUrl = env('RPC_URL')
  // Optional separate endpoint for broadcasting (e.g. https://rpc.flashbots.net) to avoid the public mempool.
  const sendRpcUrl = process.env.SEND_RPC_URL || rpcUrl
  const account = privateKeyToAccount(env('PRIVATE_KEY') as Hex)
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(sendRpcUrl) })

  const chainId = await publicClient.getChainId()
  if (chainId !== mainnet.id && process.env.ALLOW_NON_MAINNET !== '1') throw new Error(`RPC chainId ${chainId} is not mainnet`)

  if (args[0] === 'deploy-helper') {
    // Any account can deploy this; it is a public utility, not the user's account.
    const hash = await wallet.deployContract({ abi: supplyAllAbi, bytecode: SUPPLY_ALL_BYTECODE })
    const r = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`AaveSupplyAll deployed at ${r.contractAddress} (tx ${hash})`)
    return
  }

  const send = args.includes('--send')
  const slippageBps = BigInt(process.env.SLIPPAGE_BPS ?? '50') // 0.5%
  const maxOracleDeviationBps = BigInt(process.env.MAX_ORACLE_DEVIATION_BPS ?? '150') // 1.5%
  const deadlineSec = BigInt(process.env.DEADLINE_SEC ?? '300')
  const helperEnv = env('SUPPLY_HELPER')
  if (!isAddress(helperEnv)) throw new Error('SUPPLY_HELPER is not an address')
  const helper = getAddress(helperEnv)
  const user = account.address

  // 1. Pre-flight checks
  const helperCode = await publicClient.getCode({ address: helper })
  if (!helperCode || helperCode === '0x') throw new Error(`No contract at SUPPLY_HELPER ${helper}`)
  const helperPool = await publicClient.readContract({
    address: helper,
    abi: parseAbi(['function POOL() view returns (address)']),
    functionName: 'POOL',
  })
  if (getAddress(helperPool) !== ADDR.AAVE_V3_POOL) throw new Error(`Helper points at unexpected pool ${helperPool}`)

  const delegation = await getDelegationState(publicClient, user)
  if (delegation.kind === 'other') {
    throw new Error(`${user} is already delegated to other code (${delegation.code}). Refusing to overwrite it.`)
  }

  const [amountIn, ethBal, aBefore] = await Promise.all([
    publicClient.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [user] }),
    publicClient.getBalance({ address: user }),
    publicClient.readContract({ address: ADDR.aEthUSDC, abi: erc20Abi, functionName: 'balanceOf', args: [user] }),
  ])
  if (amountIn === 0n) throw new Error('No WETH to swap')

  // 2. Price + slippage floor
  const q = await computeMinOut(publicClient, amountIn, slippageBps, maxOracleDeviationBps)
  const block = await publicClient.getBlock()
  const deadline = block.timestamp + deadlineSec
  console.log(`User            ${user}`)
  console.log(`Delegation      ${delegation.kind === 'none' ? 'none -> will authorize MetaMask StatelessDeleGator in this tx' : 'already MetaMask StatelessDeleGator'}`)
  console.log(`Swap            ${formatUnits(amountIn, 18)} WETH`)
  console.log(`Quote           ${formatUnits(q.quoted, USDC_DECIMALS)} USDC (Chainlink ${formatUnits(q.oracleOut, USDC_DECIMALS)}, dev ${q.deviationBps} bps)`)
  console.log(`Min USDC out    ${formatUnits(q.minOut, USDC_DECIMALS)} (slippage ${slippageBps} bps)`)

  // 3. Build the batch
  const calls = buildEntryCalls({ amountIn, minUsdcOut: q.minOut, deadline, helper })
  const data = encodeBatchExecute(calls)

  // 4. EIP-7702 authorization (only if not already delegated). executor:'self' makes viem
  //    sign with nonce = currentNonce + 1, because the sender's own nonce is bumped first.
  //    chainId is pinned to 1 (never 0, which would be valid on every chain).
  const authorizationList =
    delegation.kind === 'none'
      ? [
          await wallet.signAuthorization({
            account,
            contractAddress: ADDR.METAMASK_STATELESS_DELEGATOR,
            chainId: mainnet.id,
            executor: 'self',
          }),
        ]
      : undefined

  // 5. Simulate the exact transaction (with the authorization applied) before sending.
  await publicClient.call({ account, to: user, data, authorizationList })
  const gas = await publicClient.estimateGas({ account, to: user, data, authorizationList })
  const fees = await publicClient.estimateFeesPerGas()
  const maxCost = ((gas * 12n) / 10n) * fees.maxFeePerGas
  console.log(`Simulation      OK, gas ~${gas}, max cost ${formatUnits(maxCost, 18)} ETH (have ${formatUnits(ethBal, 18)})`)
  if (ethBal < maxCost) throw new Error('Not enough ETH for gas')

  if (!send) {
    console.log('\nDry run only. Re-run with --send to broadcast.')
    return
  }

  // 6. ONE transaction: type-4 (if authorizing) from the EOA to itself.
  const hash = await wallet.sendTransaction({
    account,
    chain: mainnet,
    to: user,
    data,
    authorizationList,
    gas: (gas * 12n) / 10n,
  })
  console.log(`Sent            ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash} (nothing changed — atomic)`)

  // 7. Verify effects. A type-4 tx whose authorization was invalid (e.g. nonce moved) would be a
  //    no-op call to a codeless EOA and still "succeed", so check real state, not just status.
  const [wethAfter, aAfter, wethAllowance, code] = await Promise.all([
    publicClient.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [user] }),
    publicClient.readContract({ address: ADDR.aEthUSDC, abi: erc20Abi, functionName: 'balanceOf', args: [user] }),
    publicClient.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'allowance', args: [user, ADDR.UNI_V3_SWAP_ROUTER02] }),
    getDelegationState(publicClient, user),
  ])
  const supplied = aAfter - aBefore
  if (supplied + 2n < q.minOut) throw new Error(`Position not opened as expected (aUSDC delta ${supplied}). Inspect ${hash}.`)
  console.log(`Done in block   ${receipt.blockNumber}`)
  console.log(`WETH left       ${formatUnits(wethAfter, 18)}  (router allowance now ${wethAllowance})`)
  console.log(`aEthUSDC +      ${formatUnits(supplied, USDC_DECIMALS)}`)
  console.log(`EOA delegation  ${code.kind}  (same address ${user})`)
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
