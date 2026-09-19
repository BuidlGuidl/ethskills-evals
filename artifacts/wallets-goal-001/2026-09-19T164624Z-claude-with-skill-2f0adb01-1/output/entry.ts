/**
 * One-click entry: swap ALL of an EOA's WETH -> USDC on Uniswap V3 and supply EVERY USDC the swap
 * returns to Aave V3 — as ONE atomic mainnet transaction, from the user's existing EOA address.
 *
 * Mechanism: EIP-7702 (live since Pectra, May 2025). The EOA signs an authorization that points its
 * code at MetaMask's audited EIP7702StatelessDeleGator, then sends a single type-4 transaction to
 * ITSELF calling `execute(batchMode, calls)`. Every call runs with msg.sender == the EOA; if any call
 * reverts the whole transaction reverts. See NOTES.md.
 *
 * Usage (see NOTES.md for full details — ALWAYS rehearse on an anvil fork first):
 *   RPC_URL=... PRIVATE_KEY=0x... SUPPLY_ALL=0x... npx tsx entry.ts plan        # quote + simulate, sends nothing
 *   RPC_URL=... PRIVATE_KEY=0x... SUPPLY_ALL=0x... npx tsx entry.ts execute     # asks for "yes", then sends
 *   RPC_URL=... PRIVATE_KEY=0x...                  npx tsx entry.ts undelegate  # optional: clear the 7702 delegation
 *
 * In a dapp with MetaMask (key never leaves the wallet) use `sendWithInjectedWallet` below instead.
 */
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  concat,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  maxUint256,
  parseAbi,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ───────────────────────────── Ethereum mainnet addresses ─────────────────────────────
export const ADDR = {
  WETH: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  USDC: getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  /** Uniswap V3 SwapRouter02 */
  SWAP_ROUTER_02: getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'),
  /** Uniswap V3 QuoterV2 */
  QUOTER_V2: getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'),
  /** Aave V3 Pool (Ethereum core market, proxy) */
  AAVE_POOL: getAddress('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'),
  /** Aave V3 aEthUSDC */
  A_USDC: getAddress('0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c'),
  /** Chainlink ETH/USD — independent sanity check on the Uniswap quote */
  CHAINLINK_ETH_USD: getAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'),
  /** MetaMask Delegation Framework v1.3.0 EIP7702StatelessDeleGator (the same code MetaMask's
   *  own "smart account" upgrade delegates to). Verify it yourself before use — see NOTES.md. */
  DELEGATOR: getAddress('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B'),
} as const

/** Uniswap V3 fee tiers to quote; the best one is used (WETH/USDC 0.05% is normally deepest). */
const FEE_TIERS = [500, 3000] as const

/** ERC-7579 ModeCode: callType 0x01 (batch), execType 0x00 (revert on any failure), rest zero. */
const BATCH_REVERT_ON_FAILURE_MODE: Hex = `0x01${'00'.repeat(31)}`

// ───────────────────────────── ABIs (only what we call) ─────────────────────────────
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
])
const swapRouter02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
])
const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const aavePoolAbi = parseAbi([
  'function getConfiguration(address asset) view returns (uint256)',
])
const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])
const supplyAllAbi = parseAbi([
  'function POOL() view returns (address)',
  'function supplyAll(address asset, uint256 minAmount) returns (uint256 amount)',
])
const delegatorAbi = parseAbi([
  'function execute(bytes32 mode, bytes executionCalldata) payable',
])

// ───────────────────────────── Types ─────────────────────────────
export type Call = { to: Address; value: bigint; data: Hex }

export type EntryPlan = {
  account: Address
  wethIn: bigint
  fee: number
  quotedUsdc: bigint
  minUsdc: bigint
  oracleUsdc: bigint
  deadline: bigint
  calls: Call[]
}

export type PlanOptions = {
  supplyAll: Address
  slippageBps?: bigint // default 50 = 0.50%
  maxOracleDeviationBps?: bigint // default 150 = 1.50%
  deadlineSeconds?: bigint // default 600
}

// ───────────────────────────── Planning (pure reads) ─────────────────────────────

/** Quote, sanity-check against Chainlink, and build the atomic call list. Sends nothing. */
export async function planEntry(
  client: PublicClient,
  account: Address,
  opts: PlanOptions,
): Promise<EntryPlan> {
  const slippageBps = opts.slippageBps ?? 50n
  const maxDevBps = opts.maxOracleDeviationBps ?? 150n
  if (slippageBps <= 0n || slippageBps > 300n) throw new Error('slippageBps must be in (0, 300]')

  const supplyAll = getAddress(opts.supplyAll)
  await assertHelperIsSane(client, supplyAll)

  const [wethIn, usdcBefore] = await Promise.all([
    client.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    client.readContract({ address: ADDR.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
  ])
  if (wethIn === 0n) throw new Error(`${account} holds no WETH`)
  // supplyAll() supplies the account's whole USDC balance. The user holds none today, so
  // "whole balance" == "exactly what the swap returned". Refuse if that assumption is false.
  if (usdcBefore !== 0n) {
    throw new Error(
      `${account} already holds ${formatUnits(usdcBefore, 6)} USDC; it would be supplied too. Aborting.`,
    )
  }

  // Best quote across fee tiers (QuoterV2 is non-view: it reverts internally, so simulate it).
  let best: { fee: number; out: bigint } | undefined
  for (const fee of FEE_TIERS) {
    try {
      const { result } = await client.simulateContract({
        address: ADDR.QUOTER_V2,
        abi: quoterV2Abi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: ADDR.WETH, tokenOut: ADDR.USDC, amountIn: wethIn, fee, sqrtPriceLimitX96: 0n }],
      })
      if (!best || result[0] > best.out) best = { fee, out: result[0] }
    } catch {
      /* tier unavailable */
    }
  }
  if (!best) throw new Error('No Uniswap V3 quote available')

  // The pool price can be manipulated at quote time (sandwich setup), in which case a slippage
  // bound derived from that quote protects nothing. Cross-check against Chainlink.
  const [, answer, , updatedAt] = await client.readContract({
    address: ADDR.CHAINLINK_ETH_USD,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  })
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (answer <= 0n || now - updatedAt > 3n * 3600n) throw new Error('Chainlink ETH/USD answer is stale/invalid')
  // WETH 18 dec, feed 8 dec, USDC 6 dec  →  usdc = weth * answer / 1e20
  const oracleUsdc = (wethIn * answer) / 10n ** 20n
  const diff = best.out > oracleUsdc ? best.out - oracleUsdc : oracleUsdc - best.out
  if (diff * 10_000n > oracleUsdc * maxDevBps) {
    throw new Error(
      `Uniswap quote ${formatUnits(best.out, 6)} deviates >${maxDevBps}bps from Chainlink ${formatUnits(oracleUsdc, 6)}; aborting`,
    )
  }

  // Min-out is the tighter of (quote - slippage) and (oracle - slippage - pool fee).
  const fromQuote = (best.out * (10_000n - slippageBps)) / 10_000n
  const fromOracle = (oracleUsdc * (10_000n - slippageBps - BigInt(best.fee / 100))) / 10_000n
  const minUsdc = fromQuote > fromOracle ? fromQuote : fromOracle

  await assertAaveAcceptsUsdc(client)

  const deadline = now + (opts.deadlineSeconds ?? 600n)
  const calls = buildEntryCalls({ account, wethIn, fee: best.fee, minUsdc, deadline, supplyAll })
  return { account, wethIn, fee: best.fee, quotedUsdc: best.out, minUsdc, oracleUsdc, deadline, calls }
}

/**
 * The atomic batch. Every call executes with msg.sender == the user's EOA.
 *  1. WETH.approve(SwapRouter02, wethIn)             — exact; fully consumed by the swap → ends at 0
 *  2. SwapRouter02.multicall(deadline, [exactInputSingle(WETH→USDC, recipient = EOA, minOut)])
 *  3. USDC.approve(SupplyAll, max)                   — needed because the amount is unknown until runtime
 *  4. SupplyAll.supplyAll(USDC, minOut)              — reads EOA's USDC balance ON-CHAIN, supplies all of
 *                                                      it to Aave with onBehalfOf = EOA (aUSDC → EOA)
 *  5. USDC.approve(SupplyAll, 0)                     — revoke in the same tx: no allowance survives
 */
export function buildEntryCalls(p: {
  account: Address
  wethIn: bigint
  fee: number
  minUsdc: bigint
  deadline: bigint
  supplyAll: Address
}): Call[] {
  const swap = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: ADDR.WETH,
        tokenOut: ADDR.USDC,
        fee: p.fee,
        recipient: p.account,
        amountIn: p.wethIn,
        amountOutMinimum: p.minUsdc,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  return [
    {
      to: ADDR.WETH,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ADDR.SWAP_ROUTER_02, p.wethIn] }),
    },
    {
      to: ADDR.SWAP_ROUTER_02,
      value: 0n,
      data: encodeFunctionData({ abi: swapRouter02Abi, functionName: 'multicall', args: [p.deadline, [swap]] }),
    },
    {
      to: ADDR.USDC,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [p.supplyAll, maxUint256] }),
    },
    {
      to: p.supplyAll,
      value: 0n,
      data: encodeFunctionData({ abi: supplyAllAbi, functionName: 'supplyAll', args: [ADDR.USDC, p.minUsdc] }),
    },
    {
      to: ADDR.USDC,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [p.supplyAll, 0n] }),
    },
  ]
}

/** calldata for DeleGator.execute(batchMode, abi.encode(Execution[])) — sent by the EOA to itself. */
export function encodeDelegatorBatch(calls: Call[]): Hex {
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
  return encodeFunctionData({
    abi: delegatorAbi,
    functionName: 'execute',
    args: [BATCH_REVERT_ON_FAILURE_MODE, executionCalldata],
  })
}

// ───────────────────────────── Safety checks ─────────────────────────────

export type DelegationState = 'none' | 'metamask-delegator' | 'other'

/** An EIP-7702-delegated EOA has code 0xef0100 || delegateAddress. */
export async function getDelegationState(client: PublicClient, account: Address): Promise<DelegationState> {
  const code = (await client.getCode({ address: account })) ?? '0x'
  if (code === '0x') return 'none'
  const expected = concat(['0xef0100', ADDR.DELEGATOR]).toLowerCase()
  return code.toLowerCase() === expected ? 'metamask-delegator' : 'other'
}

async function assertHelperIsSane(client: PublicClient, supplyAll: Address) {
  const code = await client.getCode({ address: supplyAll })
  if (!code || code === '0x') throw new Error(`SUPPLY_ALL ${supplyAll} has no code on this chain`)
  const pool = await client.readContract({ address: supplyAll, abi: supplyAllAbi, functionName: 'POOL' })
  if (getAddress(pool) !== ADDR.AAVE_POOL) throw new Error(`SUPPLY_ALL points at pool ${pool}, not Aave V3`)
}

async function assertAaveAcceptsUsdc(client: PublicClient) {
  const cfg = await client.readContract({
    address: ADDR.AAVE_POOL,
    abi: aavePoolAbi,
    functionName: 'getConfiguration',
    args: [ADDR.USDC],
  })
  const bit = (n: bigint) => (cfg >> n) & 1n
  if (bit(56n) !== 1n) throw new Error('Aave USDC reserve is not active')
  if (bit(57n) === 1n) throw new Error('Aave USDC reserve is frozen')
  if (bit(60n) === 1n) throw new Error('Aave USDC reserve is paused')
  // Supply cap (bits 116-151) is enforced on-chain; if hit, the whole batch reverts — nothing half-done.
}

// ───────────────────────────── Path A: local signer (CLI / script) ─────────────────────────────

/**
 * Signs the EIP-7702 authorization (only if the EOA is not already delegated to the DeleGator)
 * and sends ONE type-4 transaction from the EOA to itself.
 */
export async function prepareSelfExecution(
  publicClient: PublicClient,
  walletClient: WalletClient,
  plan: EntryPlan,
) {
  const account = walletClient.account
  if (!account || account.type !== 'local') throw new Error('prepareSelfExecution needs a local account')
  if (getAddress(account.address) !== plan.account) throw new Error('plan was built for a different account')

  const state = await getDelegationState(publicClient, account.address)
  if (state === 'other') {
    throw new Error(
      `${account.address} is already delegated to some other contract. Refusing to overwrite it — ` +
        'inspect that delegation first (see NOTES.md).',
    )
  }
  const authorizationList =
    state === 'none'
      ? [
          await walletClient.signAuthorization({
            account,
            contractAddress: ADDR.DELEGATOR,
            chainId: mainnet.id, // never 0: a chainId-0 authorization is replayable on every chain
            executor: 'self', // the EOA itself sends the tx, so auth nonce = tx nonce + 1
          }),
        ]
      : undefined

  const data = encodeDelegatorBatch(plan.calls)
  // eth_estimateGas executes the whole batch against current state (with the authorization
  // applied); any revert — slippage, deadline, Aave cap, bad helper — throws here, before sending.
  const gas = await publicClient.estimateGas({ account, to: account.address, data, authorizationList })
  const fees = await publicClient.estimateFeesPerGas()
  const gasLimit = (gas * 130n) / 100n
  return { data, authorizationList, gasLimit, fees, delegationState: state }
}

// ───────────────────────────── Path B: MetaMask / any EIP-5792 wallet ─────────────────────────────

/**
 * For a dapp where the key stays in MetaMask. Same calls, one confirmation. `forceAtomic: true`
 * maps to EIP-5792 `atomicRequired: true`: the wallet MUST either execute all calls atomically
 * (MetaMask does this by upgrading the EOA via EIP-7702 to the same DeleGator, with user consent)
 * or reject. Do NOT enable viem's `experimental_fallback` — that sends the calls as separate,
 * non-atomic transactions, which is exactly the half-done state the user forbids.
 */
export async function sendWithInjectedWallet(
  publicClient: PublicClient,
  walletClient: WalletClient,
  opts: PlanOptions,
) {
  const [account] = await walletClient.getAddresses()
  const caps = await walletClient.getCapabilities({ account, chainId: mainnet.id })
  const atomic = (caps as { atomic?: { status?: string } }).atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready') {
    throw new Error(`Wallet cannot guarantee atomic batches on mainnet (atomic.status=${atomic}); aborting`)
  }
  const plan = await planEntry(publicClient, getAddress(account), opts)
  const { id } = await walletClient.sendCalls({
    account,
    chain: mainnet,
    forceAtomic: true,
    calls: plan.calls.map(({ to, data, value }) => ({ to, data, value })),
  })
  const status = await walletClient.waitForCallsStatus({ id })
  if (status.status !== 'success' || status.atomic !== true || (status.receipts?.length ?? 0) !== 1) {
    throw new Error(`Batch not confirmed as a single atomic success: ${JSON.stringify(status)}`)
  }
  return { plan, status }
}

// ───────────────────────────── CLI ─────────────────────────────

function env(name: string, required = true): string | undefined {
  const v = process.env[name]
  if (required && !v) throw new Error(`Missing env var ${name}`)
  return v
}

async function confirm(question: string): Promise<boolean> {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim().toLowerCase() === 'yes'
}

async function snapshot(client: PublicClient, account: Address, supplyAll: Address | undefined) {
  const bal = (token: Address) =>
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
  const allowance = (token: Address, spender: Address) =>
    client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender] })
  return {
    eth: await client.getBalance({ address: account }),
    weth: await bal(ADDR.WETH),
    usdc: await bal(ADDR.USDC),
    aUsdc: await bal(ADDR.A_USDC),
    wethAllowanceRouter: await allowance(ADDR.WETH, ADDR.SWAP_ROUTER_02),
    usdcAllowanceHelper: supplyAll ? await allowance(ADDR.USDC, supplyAll) : 0n,
  }
}

async function main() {
  const cmd = process.argv[2] ?? 'plan'
  if (!['plan', 'execute', 'undelegate'].includes(cmd)) throw new Error(`unknown command ${cmd}`)

  const transport = http(env('RPC_URL'))
  const publicClient = createPublicClient({ chain: mainnet, transport })
  const chainId = await publicClient.getChainId()
  if (chainId !== mainnet.id) throw new Error(`RPC chainId ${chainId} is not Ethereum mainnet (1)`)

  // Testing only — prefer a hardware wallet / keystore / the MetaMask path for real funds.
  const account = privateKeyToAccount(env('PRIVATE_KEY') as Hex)
  const walletClient = createWalletClient({ account, chain: mainnet, transport })

  if (cmd === 'undelegate') {
    // Authorization to address(0) clears the delegation; the EOA becomes a plain EOA again.
    const auth = await walletClient.signAuthorization({
      account,
      contractAddress: zeroAddress,
      chainId: mainnet.id,
      executor: 'self',
    })
    const hash = await walletClient.sendTransaction({ to: account.address, data: '0x', authorizationList: [auth] })
    const r = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`undelegate tx ${hash}: ${r.status}; delegation now: ${await getDelegationState(publicClient, account.address)}`)
    return
  }

  const supplyAll = getAddress(env('SUPPLY_ALL')!)
  const plan = await planEntry(publicClient, account.address, {
    supplyAll,
    slippageBps: process.env.SLIPPAGE_BPS ? BigInt(process.env.SLIPPAGE_BPS) : undefined,
  })
  const prepared = await prepareSelfExecution(publicClient, walletClient, plan)
  const maxGasCost = prepared.gasLimit * prepared.fees.maxFeePerGas
  const ethBal = await publicClient.getBalance({ address: account.address })
  const before = await snapshot(publicClient, account.address, supplyAll)

  console.log(`
Account            ${account.address}   (unchanged — no new wallet, no fund movement to another address)
Delegation         ${prepared.delegationState === 'none' ? `will delegate to MetaMask EIP7702StatelessDeleGator ${ADDR.DELEGATOR}` : 'already delegated to MetaMask DeleGator'}
Swap               ${formatEther(plan.wethIn)} WETH -> USDC on Uniswap V3 (fee tier ${plan.fee / 10_000}%)
Quote              ${formatUnits(plan.quotedUsdc, 6)} USDC   (Chainlink: ${formatUnits(plan.oracleUsdc, 6)})
Minimum accepted   ${formatUnits(plan.minUsdc, 6)} USDC (otherwise EVERYTHING reverts)
Supply             100% of USDC received -> Aave V3 Pool ${ADDR.AAVE_POOL}, aUSDC credited to ${account.address}
Helper             SupplyAll ${supplyAll} (allowance granted and revoked inside the same tx)
Deadline           ${new Date(Number(plan.deadline) * 1000).toISOString()}
Gas                ~${prepared.gasLimit} gas, max cost ${formatEther(maxGasCost)} ETH (balance ${formatEther(ethBal)} ETH)
Simulation         OK (eth_estimateGas executed the full batch without reverting)`)

  if (ethBal < maxGasCost) throw new Error('Not enough ETH to cover worst-case gas')
  if (cmd === 'plan') {
    console.log('\nplan only — nothing sent. Run with `execute` to send.')
    return
  }
  if (!(await confirm('\nType "yes" to send this ONE atomic transaction: '))) {
    console.log('Aborted; nothing sent.')
    return
  }

  const hash = await walletClient.sendTransaction({
    to: account.address, // EOA calls itself; its code is now the DeleGator
    data: prepared.data,
    authorizationList: prepared.authorizationList,
    gas: prepared.gasLimit,
    maxFeePerGas: prepared.fees.maxFeePerGas,
    maxPriorityFeePerGas: prepared.fees.maxPriorityFeePerGas,
  })
  console.log(`sent ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const after = await snapshot(publicClient, account.address, supplyAll)
  console.log(`status ${receipt.status}, block ${receipt.blockNumber}, gasUsed ${receipt.gasUsed}`)
  console.log(`WETH  ${formatEther(before.weth)} -> ${formatEther(after.weth)}`)
  console.log(`USDC  ${formatUnits(before.usdc, 6)} -> ${formatUnits(after.usdc, 6)}`)
  console.log(`aUSDC ${formatUnits(before.aUsdc, 6)} -> ${formatUnits(after.aUsdc, 6)}`)
  console.log(`allowances left: WETH->router ${after.wethAllowanceRouter}, USDC->helper ${after.usdcAllowanceHelper}`)
  if (receipt.status !== 'success') throw new Error('Transaction reverted — no swap and no supply happened (atomic)')
  if (after.usdc !== 0n || after.wethAllowanceRouter !== 0n || after.usdcAllowanceHelper !== 0n) {
    throw new Error('Post-condition failed: leftover USDC or allowance — investigate')
  }
}

const isMain = import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href
if (isMain) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
