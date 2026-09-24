/**
 * One-click entry: swap ALL WETH -> USDC on Uniswap V3 and supply exactly the USDC
 * the swap returns to Aave V3 — as ONE atomic Ethereum mainnet transaction, sent
 * from the user's existing EOA (same address, same ENS, same history).
 *
 * Mechanism (see NOTES.md for the full reasoning):
 *   - EIP-7702 (live on mainnet since Pectra, May 2025) lets the EOA run an atomic
 *     call batch without changing address or moving funds.
 *   - The batch is:  [ WETH.approve(helper, amountIn),
 *                      helper.swapAndSupply(amountIn, fee, minUsdcOut, deadline) ]
 *   - `WethToAaveUsdc` (contracts/WethToAaveUsdc.sol) is a stateless, ownerless helper
 *     that feeds the swap's runtime output straight into Aave `supply(..., onBehalfOf =
 *     msg.sender)`. That is what makes "supply whatever the swap returns" possible.
 *
 * Two ways to send the batch:
 *   1. enterViaWallet(walletClient)  — the real user's path. MetaMask receives an
 *      EIP-5792 `wallet_sendCalls` with atomicRequired=true; MetaMask performs the 7702
 *      upgrade to its own audited delegator and shows ONE confirmation.
 *   2. `tsx entry.ts enter`          — developer path with a local private key: signs a
 *      7702 authorization to MetaMask's EIP7702StatelessDeleGator (v1.3.0) and sends one
 *      type-4 transaction to itself calling `execute(batchMode, calls)`.
 *
 * CLI (Node):
 *   RPC_URL=... PRIVATE_KEY=0x... npx tsx entry.ts deploy          # one-time helper deploy
 *   RPC_URL=... PRIVATE_KEY=0x... HELPER=0x... npx tsx entry.ts quote
 *   RPC_URL=... PRIVATE_KEY=0x... HELPER=0x... npx tsx entry.ts enter
 *   optional: SLIPPAGE_BPS (default 50 = 0.50%), DEADLINE_SECONDS (default 600)
 */
import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
  keccak256,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// Ethereum mainnet addresses (all verified on-chain to have code)
// ---------------------------------------------------------------------------
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const
export const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const
/** Uniswap V3 SwapRouter02 (used by the helper). */
export const UNISWAP_SWAP_ROUTER_02 = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as const
/** Uniswap V3 QuoterV2 (off-chain quoting via eth_call). */
export const UNISWAP_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e' as const
/** Aave V3 Ethereum (core market) Pool proxy. */
export const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as const
/** aEthUSDC — the receipt token the user ends up holding. */
export const A_ETH_USDC = '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c' as const
/** MetaMask Delegation Framework v1.3.0 EIP7702StatelessDeleGator (audited; no storage). */
export const METAMASK_7702_DELEGATOR = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B' as const

/** Fee tiers to quote; the helper uses whichever returns more USDC. */
const FEE_TIERS = [500, 3000] as const

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

export const helperAbi = parseAbi([
  'function swapAndSupply(uint256 amountIn, uint24 fee, uint256 minUsdcOut, uint256 deadline) returns (uint256 usdcOut)',
  'event Entered(address indexed account, uint256 wethIn, uint256 usdcSupplied)',
  'error Expired()',
  'error TransferFailed()',
])

/** MetaMask DeleGatorCore: ERC-7579 style execute, restricted to self / EntryPoint. */
const delegatorAbi = parseAbi(['function execute(bytes32 mode, bytes executionCalldata) payable'])

/**
 * ERC-7579 ModeCode: callType=0x01 (BATCH), execType=0x00 (DEFAULT = revert the whole
 * batch if any call reverts). Do NOT use execType 0x01 (TRY) — that would allow the
 * half-done state this tool exists to prevent.
 */
const BATCH_DEFAULT_MODE = `0x01${'00'.repeat(31)}` as Hex

// ---------------------------------------------------------------------------
// Helper contract artifact (contracts/WethToAaveUsdc.sol, solc 0.8.20,
// --optimize --optimize-runs 200 --evm-version shanghai --metadata-hash none)
// ---------------------------------------------------------------------------
export const HELPER_BYTECODE = '0x608060405234801561000f575f80fd5b506105838061001d5f395ff3fe608060405234801561000f575f80fd5b5060043610610055575f3560e01c806308a01675146100595780630d385bb81461009157806389a30271146100b2578063ad5c4648146100cd578063c6005893146100e8575b5f80fd5b6100747387870bca3f3fd6335c3f4ce8392d69350b4fa4e281565b6040516001600160a01b0390911681526020015b60405180910390f35b6100a461009f3660046104f8565b610103565b604051908152602001610088565b61007473a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4881565b61007473c02aaa39b223fe8d0a0e5c4f27ead9083c756cc281565b6100747368b3465833fb72a70ecdf485e0e4c7bd8665fc4581565b5f8142111561012557604051630407b05b60e31b815260040160405180910390fd5b6040516323b872dd60e01b81523360048201523060248201526044810186905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2906323b872dd906064016020604051808303815f875af1158015610180573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101a49190610539565b6101c1576040516312171d8360e31b815260040160405180910390fd5b60405163095ea7b360e01b81527368b3465833fb72a70ecdf485e0e4c7bd8665fc4560048201526024810186905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc29063095ea7b3906044016020604051808303815f875af115801561022a573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061024e9190610539565b61026b576040516312171d8360e31b815260040160405180910390fd5b6040805160e08101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486020820190815262ffffff8781168385019081523060608501908152608085018b815260a086018a81525f60c0880190815297516304e45aaf60e01b815296516001600160a01b039081166004890152955186166024880152925190931660448601525183166064850152905160848401525160a4830152915190911660c48201527368b3465833fb72a70ecdf485e0e4c7bd8665fc45906304e45aaf9060e4016020604051808303815f875af115801561035e573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610382919061055f565b60405163095ea7b360e01b81527387870bca3f3fd6335c3f4ce8392d69350b4fa4e260048201526024810182905290915073a0b86991c6218b36c1d19d4a2e9eb0ce3606eb489063095ea7b3906044016020604051808303815f875af11580156103ee573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104129190610539565b61042f576040516312171d8360e31b815260040160405180910390fd5b60405163617ba03760e01b815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018290523360448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b15801561049f575f80fd5b505af11580156104b1573d5f803e3d5ffd5b505060408051888152602081018590523393507f089d0daa5e8466fdfdab1113e8fdd98c06ef26711cafc429dabce354d007364e92500160405180910390a2949350505050565b5f805f806080858703121561050b575f80fd5b84359350602085013562ffffff81168114610524575f80fd5b93969395505050506040820135916060013590565b5f60208284031215610549575f80fd5b81518015158114610558575f80fd5b9392505050565b5f6020828403121561056f575f80fd5b505191905056fea164736f6c6343000814000a' as Hex
/** keccak256 of the deployed runtime code; checked before every use. */
export const HELPER_RUNTIME_CODEHASH = '0x6d609922bb9514f7ba5af9988c12adcdd517cfd990a5910a28dd15f1bc2d6077' as Hex

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Call = { to: Address; data: Hex; value: bigint }

export type EntryPlan = {
  account: Address
  helper: Address
  amountIn: bigint
  fee: number
  quotedUsdcOut: bigint
  minUsdcOut: bigint
  deadline: bigint
  calls: Call[]
}

export type EntryOptions = {
  /** Max acceptable slippage vs. the quote, in basis points. Default 50 (0.5%). */
  slippageBps?: bigint
  /** Seconds from the latest block timestamp until the swap expires. Default 600. */
  deadlineSeconds?: bigint
  /** Amount of WETH to enter with. Default: the account's entire WETH balance. */
  amountIn?: bigint
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------
export async function assertHelperIsGenuine(client: PublicClient, helper: Address) {
  const code = await client.getCode({ address: helper })
  if (!code || code === '0x') throw new Error(`Helper ${helper} has no code — deploy it first.`)
  if (keccak256(code) !== HELPER_RUNTIME_CODEHASH) {
    throw new Error(
      `Helper ${helper} runtime codehash ${keccak256(code)} does not match the audited artifact ` +
        `${HELPER_RUNTIME_CODEHASH}. Refusing to approve WETH to unknown code.`,
    )
  }
}

/** Returns the current EIP-7702 delegate of `address`, or null for a plain EOA. */
export async function getDelegation(client: PublicClient, address: Address): Promise<Address | null> {
  const code = await client.getCode({ address })
  if (!code || code === '0x') return null
  // 7702 delegation designator: 0xef0100 || 20-byte address
  if (code.length === 48 && code.toLowerCase().startsWith('0xef0100')) {
    return getAddress(`0x${code.slice(8)}`)
  }
  throw new Error(`${address} is a contract, not an EOA`)
}

// ---------------------------------------------------------------------------
// Plan: quote, slippage bound, and the two calls
// ---------------------------------------------------------------------------
export async function buildEntryPlan(
  client: PublicClient,
  account: Address,
  helper: Address,
  opts: EntryOptions = {},
): Promise<EntryPlan> {
  const slippageBps = opts.slippageBps ?? 50n
  const deadlineSeconds = opts.deadlineSeconds ?? 600n
  if (slippageBps < 0n || slippageBps > 300n) throw new Error('slippageBps must be within 0..300')

  const chainId = await client.getChainId()
  if (chainId !== mainnet.id) throw new Error(`Expected Ethereum mainnet (1), connected to chain ${chainId}`)

  await assertHelperIsGenuine(client, helper)

  const wethBalance = await client.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })
  const amountIn = opts.amountIn ?? wethBalance
  if (amountIn === 0n) throw new Error(`${account} holds no WETH`)
  if (amountIn > wethBalance) throw new Error(`amountIn ${amountIn} exceeds WETH balance ${wethBalance}`)

  // QuoterV2 is non-view (it reverts internally to return data) — use simulateContract.
  const quotes = await Promise.all(
    FEE_TIERS.map(async (fee) => {
      try {
        const { result } = await client.simulateContract({
          address: UNISWAP_QUOTER_V2,
          abi: quoterV2Abi,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: WETH, tokenOut: USDC, amountIn, fee, sqrtPriceLimitX96: 0n }],
        })
        return { fee, amountOut: result[0] }
      } catch {
        return { fee, amountOut: 0n }
      }
    }),
  )
  const best = quotes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a))
  if (best.amountOut === 0n) throw new Error('No Uniswap V3 WETH/USDC quote available')

  const minUsdcOut = (best.amountOut * (10_000n - slippageBps)) / 10_000n
  const block = await client.getBlock()
  const deadline = block.timestamp + deadlineSeconds

  const calls: Call[] = [
    {
      // Exact-amount approval; the helper's transferFrom consumes it fully, so the
      // account ends the transaction with zero outstanding allowances.
      to: WETH,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [helper, amountIn] }),
    },
    {
      to: helper,
      value: 0n,
      data: encodeFunctionData({
        abi: helperAbi,
        functionName: 'swapAndSupply',
        args: [amountIn, best.fee, minUsdcOut, deadline],
      }),
    },
  ]

  return { account, helper, amountIn, fee: best.fee, quotedUsdcOut: best.amountOut, minUsdcOut, deadline, calls }
}

/**
 * Best-effort dry run of the batch with msg.sender = the EOA (eth_simulateV1). This is
 * exactly the context the calls get under 7702, so a revert here means a revert on-chain.
 */
export async function simulatePlan(client: PublicClient, plan: EntryPlan) {
  try {
    const { results } = await client.simulateCalls({ account: plan.account, calls: plan.calls })
    const failed = results.find((r) => r.status !== 'success')
    if (failed) throw new Error(`Simulation reverted: ${failed.error?.message ?? 'unknown error'}`)
    return true
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Simulation reverted')) throw err
    console.warn('eth_simulateV1 unavailable on this RPC; relying on gas estimation / wallet simulation.')
    return false
  }
}

// ---------------------------------------------------------------------------
// Path 1: MetaMask (or any EIP-5792 wallet) — one confirmation in the user's wallet
// ---------------------------------------------------------------------------
/**
 * Browser usage:
 *   const walletClient = createWalletClient({ chain: mainnet, transport: custom(window.ethereum!) })
 *   const publicClient = createPublicClient({ chain: mainnet, transport: http(RPC_URL) })
 *   await enterViaWallet(walletClient, publicClient, HELPER_ADDRESS)
 */
export async function enterViaWallet(
  walletClient: WalletClient,
  publicClient: PublicClient,
  helper: Address,
  opts: EntryOptions = {},
) {
  const [account] = await walletClient.requestAddresses()
  if (!account) throw new Error('No account connected')

  const capabilities = await walletClient.getCapabilities({ account, chainId: mainnet.id })
  const atomic = capabilities.atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready') {
    // Never fall back to sequential transactions: that re-introduces the half-done state.
    throw new Error(`Wallet cannot execute atomic batches on mainnet (atomic status: ${atomic ?? 'none'})`)
  }

  const plan = await buildEntryPlan(publicClient, account, helper, opts)
  await simulatePlan(publicClient, plan)
  const before = await readPosition(publicClient, account, helper)

  const { id } = await walletClient.sendCalls({
    account,
    chain: mainnet,
    calls: plan.calls,
    forceAtomic: true, // => atomicRequired: true; wallet must reject rather than split
    experimental_fallback: false,
  })

  const result = await walletClient.waitForCallsStatus({ id, timeout: 10 * 60_000 })
  if (result.status !== 'success') throw new Error(`Batch ${id} failed: ${JSON.stringify(result)}`)
  if (!result.atomic || result.receipts?.length !== 1) {
    throw new Error(`Wallet did not execute the batch as a single atomic transaction`)
  }
  return reportOutcome(publicClient, plan, before, result.receipts[0]!.transactionHash)
}

// ---------------------------------------------------------------------------
// Path 2: local private key — self-sponsored EIP-7702 type-4 transaction
// ---------------------------------------------------------------------------
export async function enterWithLocalAccount(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Account,
  helper: Address,
  opts: EntryOptions = {},
) {
  if (account.type !== 'local') throw new Error('Local account required to sign a 7702 authorization')

  const delegate = await getDelegation(publicClient, account.address)
  if (delegate && !isAddressEqual(delegate, METAMASK_7702_DELEGATOR)) {
    throw new Error(
      `${account.address} is already delegated to ${delegate}. Refusing to overwrite an existing ` +
        `delegation; review/revoke it first.`,
    )
  }
  const delegatorCode = await publicClient.getCode({ address: METAMASK_7702_DELEGATOR })
  if (!delegatorCode || delegatorCode === '0x') throw new Error('MetaMask delegator not found on this chain')

  const plan = await buildEntryPlan(publicClient, account.address, helper, opts)
  await simulatePlan(publicClient, plan)
  const before = await readPosition(publicClient, account.address, helper)

  // Only authorize when not already delegated. `executor: 'self'` makes viem sign the
  // authorization with nonce = txNonce + 1, as required when the EOA sends it itself.
  const authorizationList = delegate
    ? undefined
    : [
        await walletClient.signAuthorization({
          account,
          contractAddress: METAMASK_7702_DELEGATOR,
          chainId: mainnet.id, // never 0: a chainId-0 authorization is replayable on every chain
          executor: 'self',
        }),
      ]

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
    [plan.calls.map((c) => ({ target: c.to, value: c.value, callData: c.data }))],
  )

  // The EOA calls itself; under 7702 its code is the delegator, whose `execute` only
  // accepts calls from itself (or the 4337 EntryPoint). Gas estimation here doubles as a
  // full simulation of the delegated batch — if any step would revert, this throws.
  const hash = await walletClient.sendTransaction({
    account,
    chain: mainnet,
    to: account.address,
    data: encodeFunctionData({
      abi: delegatorAbi,
      functionName: 'execute',
      args: [BATCH_DEFAULT_MODE, executionCalldata],
    }),
    authorizationList,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Transaction ${hash} reverted — nothing changed`)
  return reportOutcome(publicClient, plan, before, hash)
}

// ---------------------------------------------------------------------------
// Post-trade verification
// ---------------------------------------------------------------------------
async function readPosition(client: PublicClient, account: Address, helper: Address) {
  const [weth, aUsdc, allowance] = await Promise.all([
    client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    client.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [account, helper] }),
  ])
  return { weth, aUsdc, allowance }
}

async function reportOutcome(
  client: PublicClient,
  plan: EntryPlan,
  before: Awaited<ReturnType<typeof readPosition>>,
  hash: Hex,
) {
  const receipt = await client.getTransactionReceipt({ hash })
  const after = await readPosition(client, plan.account, plan.helper)

  const entered = receipt.logs
    .filter((l) => isAddressEqual(l.address, plan.helper))
    .map((l) => {
      try {
        const ev = decodeEventLog({ abi: helperAbi, eventName: 'Entered', data: l.data, topics: l.topics })
        return isAddressEqual(ev.args.account, plan.account) ? ev.args : null
      } catch {
        return null
      }
    })
    .find(Boolean)
  if (!entered) throw new Error(`No Entered event from helper in ${hash}`)

  const summary = {
    txHash: hash,
    account: plan.account,
    wethSwapped: formatUnits(before.weth - after.weth, 18),
    usdcSupplied: formatUnits(entered.usdcSupplied, 6),
    // aTokens accrue interest and round, so this can differ from usdcSupplied by ~1 wei.
    aUsdcDelta: formatUnits(after.aUsdc - before.aUsdc, 6),
    quotedUsdc: formatUnits(plan.quotedUsdcOut, 6),
    minUsdc: formatUnits(plan.minUsdcOut, 6),
    feeTier: plan.fee,
    leftoverWethAllowanceToHelper: after.allowance.toString(),
  }
  if (after.allowance !== 0n) console.warn('WARNING: residual WETH allowance to helper — revoke it.')
  return summary
}

// ---------------------------------------------------------------------------
// One-time helper deployment (any account can deploy it; it is not the user's account)
// ---------------------------------------------------------------------------
export async function deployHelper(walletClient: WalletClient, publicClient: PublicClient, account: Account) {
  const hash = await walletClient.deployContract({
    account,
    chain: mainnet,
    abi: helperAbi,
    bytecode: HELPER_BYTECODE,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error(`Deployment ${hash} failed`)
  await assertHelperIsGenuine(publicClient, receipt.contractAddress)
  return receipt.contractAddress
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function main() {
  const [cmd = 'quote'] = process.argv.slice(2)
  const rpcUrl = process.env.RPC_URL
  const pk = process.env.PRIVATE_KEY as Hex | undefined
  if (!rpcUrl || !pk) throw new Error('Set RPC_URL and PRIVATE_KEY')

  const account = privateKeyToAccount(pk)
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) }) as PublicClient
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })

  if (cmd === 'deploy') {
    console.log('Helper deployed at', await deployHelper(walletClient, publicClient, account))
    return
  }

  const helper = process.env.HELPER ? getAddress(process.env.HELPER) : undefined
  if (!helper) throw new Error('Set HELPER to the deployed WethToAaveUsdc address')
  const opts: EntryOptions = {
    slippageBps: process.env.SLIPPAGE_BPS ? BigInt(process.env.SLIPPAGE_BPS) : undefined,
    deadlineSeconds: process.env.DEADLINE_SECONDS ? BigInt(process.env.DEADLINE_SECONDS) : undefined,
  }

  if (cmd === 'quote') {
    const plan = await buildEntryPlan(publicClient, account.address, helper, opts)
    const simulated = await simulatePlan(publicClient, plan)
    console.log({
      account: plan.account,
      wethIn: formatUnits(plan.amountIn, 18),
      feeTier: plan.fee,
      quotedUsdc: formatUnits(plan.quotedUsdcOut, 6),
      minUsdc: formatUnits(plan.minUsdcOut, 6),
      simulated,
      delegation: await getDelegation(publicClient, account.address),
    })
  } else if (cmd === 'enter') {
    console.log(await enterWithLocalAccount(walletClient, publicClient, account, helper, opts))
  } else {
    throw new Error(`Unknown command ${cmd} (expected deploy | quote | enter)`)
  }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
