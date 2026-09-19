/**
 * One-click entry: swap ALL WETH -> USDC on Uniswap V3, then supply EVERY USDC the swap returned
 * to Aave V3, as ONE atomic Ethereum mainnet transaction sent from the user's existing EOA.
 *
 * How (see NOTES.md for the full reasoning):
 *   - EIP-7702 (live since the Pectra upgrade, May 2025) lets the EOA run code at its own address.
 *     The EOA delegates to MetaMask's audited EIP7702StatelessDeleGator. That is the same contract
 *     MetaMask's "smart account" upgrade uses. The address, ENS name, history, and key stay the same.
 *   - The EOA calls itself with an ERC-7579 batch of two calls:
 *       1. WETH.approve(helper, amountIn)                (exact amount, fully used in step 2)
 *       2. helper.enter(amountIn, minUsdcOut, deadline)  (swap, then supply the real output
 *                                                         onBehalfOf the EOA)
 *     If anything reverts, the whole transaction reverts. You can't end up with the swap done but
 *     no supply.
 *   - `WethToAaveUsdc` (contracts/WethToAaveUsdc.sol) is a stateless, ownerless helper. It is needed
 *     because a static call batch can't pass the swap's return value into Aave `supply`.
 *
 * Usage (Node >= 20):
 *   RPC_URL=... DEPLOYER_KEY=0x... npx tsx entry.ts deploy-helper   # once, from ANY funded account
 *   RPC_URL=... PRIVATE_KEY=0x...  npx tsx entry.ts enter          # the user's EOA
 *   RPC_URL=... PRIVATE_KEY=0x...  DRY_RUN=1 npx tsx entry.ts enter
 *   RPC_URL=... PRIVATE_KEY=0x...  npx tsx entry.ts revoke         # optional: clear the 7702 delegation
 *
 * In a browser dApp with MetaMask, call `enterWithInjectedWallet` instead. It uses EIP-5792
 * `wallet_sendCalls` with atomicity required, so the key never leaves MetaMask.
 */
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  concat,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getContractAddress,
  http,
  keccak256,
  parseAbi,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------------------------
// Mainnet addresses (all checked on-chain; see NOTES.md)
// ---------------------------------------------------------------------------------------------
export const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
export const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const A_ETH_USDC: Address = '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c' // Aave V3 aEthUSDC
export const AAVE_V3_POOL: Address = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
export const UNI_V3_SWAP_ROUTER_02: Address = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
export const UNI_V3_QUOTER_V2: Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
export const UNI_V3_WETH_USDC_500: Address = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
export const POOL_FEE = 500 // 0.05% tier: the deepest WETH/USDC V3 pool
/** MetaMask Delegation Framework v1.3.0 EIP7702StatelessDeleGator (NAME()/VERSION() checked on-chain). */
export const METAMASK_7702_DELEGATOR: Address = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B'
/** Arachnid deterministic CREATE2 deployer (present on mainnet). */
const CREATE2_DEPLOYER: Address = '0x4e59b44847b379578588920ca78fbf26c0b4956c'
const HELPER_SALT: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'

/**
 * Creation bytecode of contracts/WethToAaveUsdc.sol, built with:
 *   solc 0.8.20 --optimize --optimize-runs 200 --evm-version shanghai --bin
 * Rebuild it yourself and compare before you trust it.
 */
const HELPER_BYTECODE: Hex =
  '0x608060405234801561000f575f80fd5b506105b98061001d5f395ff3fe608060405234801561000f575f80fd5b5060043610610060575f3560e01c80633b3037051461006457806389a302711461009c578063ad5c4648146100b7578063bc208057146100d2578063dd1b9c4a146100f3578063feb2949414610110575b5f80fd5b61007f7387870bca3f3fd6335c3f4ce8392d69350b4fa4e281565b6040516001600160a01b0390911681526020015b60405180910390f35b61007f73a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4881565b61007f73c02aaa39b223fe8d0a0e5c4f27ead9083c756cc281565b6100e56100e036600461051d565b61012b565b604051908152602001610093565b6100fc6101f481565b60405162ffffff9091168152602001610093565b61007f7368b3465833fb72a70ecdf485e0e4c7bd8665fc4581565b5f8142111561014d57604051630407b05b60e31b815260040160405180910390fd5b6040516323b872dd60e01b81523360048201523060248201526044810185905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2906323b872dd906064016020604051808303815f875af11580156101a8573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101cc9190610546565b6101e9576040516312171d8360e31b815260040160405180910390fd5b60405163095ea7b360e01b81527368b3465833fb72a70ecdf485e0e4c7bd8665fc4560048201526024810185905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc29063095ea7b3906044016020604051808303815f875af1158015610252573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102769190610546565b610293576040516312171d8360e31b815260040160405180910390fd5b6040805160e08101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48602082019081526101f482840190815230606084019081526080840189815260a085018981525f60c0870190815296516304e45aaf60e01b815295516001600160a01b039081166004880152945185166024870152925162ffffff1660448601529051831660648501525160848401525160a4830152915190911660c48201527368b3465833fb72a70ecdf485e0e4c7bd8665fc45906304e45aaf9060e4016020604051808303815f875af1158015610384573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103a8919061056c565b60405163095ea7b360e01b81527387870bca3f3fd6335c3f4ce8392d69350b4fa4e260048201526024810182905290915073a0b86991c6218b36c1d19d4a2e9eb0ce3606eb489063095ea7b3906044016020604051808303815f875af1158015610414573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104389190610546565b610455576040516312171d8360e31b815260040160405180910390fd5b60405163617ba03760e01b815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018290523360448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b1580156104c5575f80fd5b505af11580156104d7573d5f803e3d5ffd5b505060408051878152602081018590523393507f089d0daa5e8466fdfdab1113e8fdd98c06ef26711cafc429dabce354d007364e92500160405180910390a29392505050565b5f805f6060848603121561052f575f80fd5b505081359360208301359350604090920135919050565b5f60208284031215610556575f80fd5b81518015158114610565575f80fd5b9392505050565b5f6020828403121561057c575f80fd5b505191905056fea2646970667358221220c77971290016020cbb949afad36569aef95e593a63af4bccb34fdb17d88f253b64736f6c63430008140033'

/** keccak256 of the helper's runtime code; used to refuse to route funds through anything else. */
const HELPER_RUNTIME_CODEHASH: Hex = '0x0198b789ffcd93c154132ce12a889038a9ca5e81c09b9d2800c4daeef84e5316'

export const HELPER_ADDRESS: Address = getContractAddress({
  opcode: 'CREATE2',
  from: CREATE2_DEPLOYER,
  salt: HELPER_SALT,
  bytecode: HELPER_BYTECODE,
})

// ---------------------------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function totalSupply() view returns (uint256)',
])
const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const aavePoolAbi = parseAbi([
  'function getConfiguration(address asset) view returns ((uint256 data))',
])
const helperAbi = parseAbi([
  'function enter(uint256 amountIn, uint256 minUsdcOut, uint256 deadline) returns (uint256 usdcOut)',
  'event Entered(address indexed account, uint256 wethIn, uint256 usdcSupplied)',
])
const delegatorAbi = parseAbi(['function execute(bytes32 mode, bytes executionCalldata) payable'])

/** ERC-7579 mode: callType BATCH (0x01), execType DEFAULT (0x00 = revert on any failure). */
const MODE_BATCH_REVERT_ON_FAILURE: Hex = '0x0100000000000000000000000000000000000000000000000000000000000000'
/** EIP-7702 delegation designator prefix. */
const DELEGATION_PREFIX = '0xef0100'

export type Call = { to: Address; data: Hex; value?: bigint }

// ---------------------------------------------------------------------------------------------
// Planning (read-only)
// ---------------------------------------------------------------------------------------------
export type EntryPlan = {
  account: Address
  amountIn: bigint
  quotedUsdc: bigint
  minUsdcOut: bigint
  deadline: bigint
  calls: [Call, Call]
}

export async function planEntry(
  client: PublicClient,
  account: Address,
  opts: { slippageBps?: bigint; deadlineSeconds?: bigint } = {},
): Promise<EntryPlan> {
  const slippageBps = opts.slippageBps ?? 50n // 0.50%
  const deadlineSeconds = opts.deadlineSeconds ?? 300n
  if (slippageBps < 0n || slippageBps > 300n) throw new Error('slippageBps must be in [0, 300]')

  const chainId = await client.getChainId()
  if (chainId !== 1) throw new Error(`Expected Ethereum mainnet (chainId 1), got ${chainId}`)

  await assertHelperDeployed(client)

  const amountIn = await client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
  if (amountIn === 0n) throw new Error(`${account} holds no WETH`)

  // Quote the exact swap the helper will run (same pool, same amount).
  const { result } = await client.simulateContract({
    address: UNI_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: WETH, tokenOut: USDC, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
  })
  const quotedUsdc = result[0]
  const minUsdcOut = (quotedUsdc * (10_000n - slippageBps)) / 10_000n

  await assertAaveCanAccept(client, quotedUsdc)

  const block = await client.getBlock()
  const deadline = block.timestamp + deadlineSeconds

  const calls: [Call, Call] = [
    {
      to: WETH,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [HELPER_ADDRESS, amountIn] }),
    },
    {
      to: HELPER_ADDRESS,
      data: encodeFunctionData({ abi: helperAbi, functionName: 'enter', args: [amountIn, minUsdcOut, deadline] }),
    },
  ]
  return { account, amountIn, quotedUsdc, minUsdcOut, deadline, calls }
}

async function assertHelperDeployed(client: PublicClient) {
  const code = await client.getCode({ address: HELPER_ADDRESS })
  if (!code || code === '0x') {
    throw new Error(`Helper not deployed at ${HELPER_ADDRESS}. Run: npx tsx entry.ts deploy-helper`)
  }
  if (keccak256(code) !== HELPER_RUNTIME_CODEHASH) {
    throw new Error(`Code at ${HELPER_ADDRESS} does not match the audited WethToAaveUsdc runtime; refusing`)
  }
}

/** Preflight Aave's USDC reserve: active, not frozen/paused, and has supply-cap headroom. */
async function assertAaveCanAccept(client: PublicClient, usdcAmount: bigint) {
  const { data } = await client.readContract({
    address: AAVE_V3_POOL,
    abi: aavePoolAbi,
    functionName: 'getConfiguration',
    args: [USDC],
  })
  const bit = (n: bigint) => ((data >> n) & 1n) === 1n
  if (!bit(56n)) throw new Error('Aave USDC reserve is not active')
  if (bit(57n)) throw new Error('Aave USDC reserve is frozen')
  if (bit(60n)) throw new Error('Aave USDC reserve is paused')
  const supplyCap = (data >> 116n) & ((1n << 36n) - 1n) // whole tokens; 0 = no cap
  if (supplyCap > 0n) {
    const supplied = await client.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'totalSupply' })
    // A rough check (it ignores accruedToTreasury); the on-chain supply is the real guard, and it reverts atomically.
    if (supplied + usdcAmount > supplyCap * 10n ** 6n) throw new Error('Aave USDC supply cap would be exceeded')
  }
}

// ---------------------------------------------------------------------------------------------
// Path A: developer-run (Node, local key). Type-4 (EIP-7702) tx, EOA -> itself.
// ---------------------------------------------------------------------------------------------
export function encodeBatchExecute(calls: readonly Call[]): Hex {
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
    [calls.map((c) => ({ target: c.to, value: c.value ?? 0n, callData: c.data }))],
  )
  return encodeFunctionData({
    abi: delegatorAbi,
    functionName: 'execute',
    args: [MODE_BATCH_REVERT_ON_FAILURE, executionCalldata],
  })
}

/** Returns 'none' for a plain EOA or 'metamask' if already delegated to the MetaMask delegator. Throws otherwise. */
async function delegationState(client: PublicClient, account: Address): Promise<'none' | 'metamask'> {
  const code = (await client.getCode({ address: account })) ?? '0x'
  if (code === '0x') return 'none'
  const expected = concat([DELEGATION_PREFIX, METAMASK_7702_DELEGATOR]).toLowerCase()
  if (code.toLowerCase() === expected) return 'metamask'
  throw new Error(
    `${account} already has code ${code}. It is delegated to a different contract or is not an EOA. ` +
      'Refusing to continue; review that delegation first.',
  )
}

async function assertDelegatorIsMetaMask(client: PublicClient) {
  const name = await client.readContract({
    address: METAMASK_7702_DELEGATOR,
    abi: parseAbi(['function NAME() view returns (string)']),
    functionName: 'NAME',
  })
  if (name !== 'EIP7702StatelessDeleGator') throw new Error(`Unexpected delegator NAME(): ${name}`)
}

async function enterWithLocalKey(rpcUrl: string, privateKey: Hex, dryRun: boolean, slippageBps?: bigint) {
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })

  const plan = await planEntry(publicClient, account.address, { slippageBps })
  const state = await delegationState(publicClient, account.address)
  await assertDelegatorIsMetaMask(publicClient)

  console.log(`account        ${account.address}`)
  console.log(`delegation     ${state === 'none' ? 'plain EOA -> will delegate via EIP-7702 in this tx' : 'already MetaMask delegator'}`)
  console.log(`helper         ${HELPER_ADDRESS}`)
  console.log(`swap           ${formatUnits(plan.amountIn, 18)} WETH -> ~${formatUnits(plan.quotedUsdc, 6)} USDC (fee ${POOL_FEE})`)
  console.log(`min USDC out   ${formatUnits(plan.minUsdcOut, 6)}`)
  console.log(`deadline       ${new Date(Number(plan.deadline) * 1000).toISOString()}`)

  // Only sign an authorization if one is needed. It binds chainId=1 and this account's nonce.
  // executor:'self' because the same EOA sends the tx, so its nonce is bumped before the
  // authorization is checked.
  const authorizationList =
    state === 'none'
      ? [await walletClient.signAuthorization({ address: METAMASK_7702_DELEGATOR, executor: 'self' })]
      : undefined
  if (authorizationList && authorizationList[0].chainId !== 1) throw new Error('authorization must be chain-specific (1)')

  const request = {
    account,
    to: account.address, // call ourselves: the delegator's execute() is onlyEntryPointOrSelf
    data: encodeBatchExecute(plan.calls),
    value: 0n,
    authorizationList,
  } as const

  // Gas estimation runs the full tx (delegation included) against the latest state. A revert
  // here means nothing gets broadcast.
  const gas = await publicClient.estimateGas(request)
  console.log(`gas estimate   ${gas}`)
  if (dryRun) {
    console.log('DRY_RUN=1: simulated successfully, not broadcasting.')
    return
  }

  const hash = await walletClient.sendTransaction({ ...request, gas: (gas * 12n) / 10n })
  console.log(`tx             ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`)

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== HELPER_ADDRESS.toLowerCase()) continue
    const ev = decodeEventLog({ abi: helperAbi, data: log.data, topics: log.topics })
    if (ev.eventName === 'Entered') {
      console.log(`supplied       ${formatUnits(ev.args.usdcSupplied, 6)} USDC to Aave V3 for ${ev.args.account}`)
    }
  }
  const [aUsdc, wethLeft, helperAllowance] = await Promise.all([
    publicClient.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [account.address, HELPER_ADDRESS] }),
  ])
  console.log(`aEthUSDC bal   ${formatUnits(aUsdc, 6)}`)
  console.log(`WETH left      ${formatUnits(wethLeft, 18)}   leftover WETH allowance to helper: ${helperAllowance}`)
}

/** Optional: point the EOA's delegation back to address(0), which makes it a plain EOA again. */
async function revokeDelegation(rpcUrl: string, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })
  const authorization = await walletClient.signAuthorization({ address: zeroAddress, executor: 'self' })
  const hash = await walletClient.sendTransaction({ to: account.address, data: '0x', authorizationList: [authorization] })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`revoked; code now: ${(await publicClient.getCode({ address: account.address })) ?? '0x'}`)
}

// ---------------------------------------------------------------------------------------------
// Path B: the user's MetaMask, in a dApp. EIP-5792 atomic batch; MetaMask signs the 7702 upgrade
// (to the same METAMASK_7702_DELEGATOR) as part of the same confirmation.
// ---------------------------------------------------------------------------------------------
export async function enterWithInjectedWallet(
  walletClient: WalletClient, // e.g. createWalletClient({ chain: mainnet, transport: custom(window.ethereum) })
  publicClient: PublicClient,
  opts: { slippageBps?: bigint } = {},
) {
  const [account] = await walletClient.requestAddresses()
  const capabilities = await walletClient.getCapabilities({ account, chainId: 1 })
  const atomic = (capabilities as { atomic?: { status?: string } }).atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready') {
    throw new Error(`Wallet cannot execute an atomic batch on mainnet (atomic status: ${atomic ?? 'unavailable'})`)
  }
  await delegationState(publicClient, account) // refuse if some other delegate is already installed

  const plan = await planEntry(publicClient, account, opts)
  const { id } = await walletClient.sendCalls({
    account,
    chain: mainnet,
    calls: plan.calls,
    forceAtomic: true, // atomicRequired: true. The wallet must fail rather than send the calls as separate txs.
  })
  const status = await walletClient.waitForCallsStatus({ id, throwOnFailure: true })
  if (status.status !== 'success' || status.receipts?.length !== 1) {
    throw new Error(`Batch not confirmed as a single successful tx: ${JSON.stringify(status, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`)
  }
  return { plan, txHash: status.receipts[0].transactionHash }
}

// ---------------------------------------------------------------------------------------------
// One-time helper deployment (any funded account; deterministic address via CREATE2).
// ---------------------------------------------------------------------------------------------
async function deployHelper(rpcUrl: string, deployerKey: Hex) {
  const account = privateKeyToAccount(deployerKey)
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })
  const existing = await publicClient.getCode({ address: HELPER_ADDRESS })
  if (existing && existing !== '0x') {
    await assertHelperDeployed(publicClient)
    console.log(`helper already deployed at ${HELPER_ADDRESS}`)
    return
  }
  const hash = await walletClient.sendTransaction({ to: CREATE2_DEPLOYER, data: concat([HELPER_SALT, HELPER_BYTECODE]) })
  await publicClient.waitForTransactionReceipt({ hash })
  await assertHelperDeployed(publicClient)
  console.log(`helper deployed at ${HELPER_ADDRESS} (tx ${hash})`)
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
async function main() {
  const cmd = process.argv[2]
  const rpcUrl = process.env.RPC_URL
  if (!rpcUrl) throw new Error('Set RPC_URL (a private/MEV-protected mainnet RPC is recommended)')
  const env = (k: string) => {
    const v = process.env[k]
    if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`Set ${k} to a 0x-prefixed 32-byte private key`)
    return v as Hex
  }
  const slippage = process.env.SLIPPAGE_BPS ? BigInt(process.env.SLIPPAGE_BPS) : undefined

  if (cmd === 'deploy-helper') return deployHelper(rpcUrl, env('DEPLOYER_KEY'))
  if (cmd === 'enter') return enterWithLocalKey(rpcUrl, env('PRIVATE_KEY'), process.env.DRY_RUN === '1', slippage)
  if (cmd === 'revoke') return revokeDelegation(rpcUrl, env('PRIVATE_KEY'))
  console.log('usage: npx tsx entry.ts <deploy-helper|enter|revoke>')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
