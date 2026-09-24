/**
 * entry.ts — one-click, atomic "WETH -> USDC (Uniswap V3) -> supply to Aave V3" from an existing EOA.
 *
 * Mechanism (see NOTES.md for the full reasoning):
 *   - EIP-7702 (live on mainnet since Pectra, May 2025) lets the user's *existing* EOA run the code of
 *     MetaMask's audited EIP7702StatelessDeleGator. Same address, same key, same ENS / history.
 *   - One type-4 transaction, sent by the EOA to itself, calls DeleGator.execute() in ERC-7579 batch
 *     mode. The batch is all-or-nothing: if any call reverts, the whole transaction reverts.
 *   - The batch:
 *       1. WETH.approve(SwapRouter02, amountIn)                (exact amount, consumed by step 2)
 *       2. SwapRouter02.exactInputSingle(WETH->USDC, fee 500, recipient = SupplyAllToAave helper)
 *       3. SupplyAllToAave.supplyAll(USDC, minOut)              (supplies the helper's ENTIRE USDC
 *                                                                balance to Aave, onBehalfOf = EOA)
 *     Step 3 is what makes "supply whatever the swap returned" possible: the amount is read on-chain
 *     at execution time instead of being baked into static calldata.
 *
 * Usage:
 *   RPC_URL=... PRIVATE_KEY=0x... npx tsx entry.ts                 # dry run: quote + simulate only
 *   RPC_URL=... PRIVATE_KEY=0x... npx tsx entry.ts --send          # simulate, confirm, broadcast
 *   RPC_URL=... PRIVATE_KEY=0x... npx tsx entry.ts undelegate --send   # clear the 7702 delegation
 *   RPC_URL=... DEPLOYER_PRIVATE_KEY=0x... npx tsx entry.ts deploy-helper --send
 *                                                     # one-time CREATE2 deploy of the helper (any funded
 *                                                     # key; NOT the user's account; permissionless)
 *   Options: --slippage-bps=50 (default 50 = 0.5%)
 *
 * For a MetaMask user (keys stay in MetaMask) use `sendWithInjectedWallet()` below from a dapp:
 * it sends the same three calls via EIP-5792 wallet_sendCalls with atomic execution required, and
 * MetaMask upgrades the account to the same DeleGator contract inside that one confirmation.
 *
 * Never commit PRIVATE_KEY. Prefer a hardware wallet / MetaMask path for real funds.
 */
import { createInterface } from 'node:readline/promises'
import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type SignedAuthorization,
  type WalletClient,
  concat,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getContractAddress,
  http,
  isAddressEqual,
  parseAbi,
  zeroAddress,
  zeroHash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------------------------
// Ethereum mainnet addresses (all verified on-chain; see NOTES.md for how to re-verify)
// ---------------------------------------------------------------------------------------------
export const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
export const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
/** Uniswap V3 SwapRouter02 */
export const SWAP_ROUTER_02: Address = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
/** Uniswap V3 QuoterV2 */
export const QUOTER_V2: Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
/** Uniswap V3 USDC/WETH 0.05% pool (deepest WETH/USDC pool) — informational */
export const UNI_V3_USDC_WETH_500: Address = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
export const UNI_FEE_TIER = 500
/** Aave V3 Pool (Core market) */
export const AAVE_V3_POOL: Address = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
/** Aave V3 aEthUSDC (aToken the user receives) */
export const A_ETH_USDC: Address = '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c'
/** MetaMask Delegation Framework EIP7702StatelessDeleGator v1.3.0 (what MetaMask itself delegates to) */
export const METAMASK_7702_DELEGATOR: Address = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B'
/** Arachnid deterministic CREATE2 deployer (present on mainnet since 2019) */
export const CREATE2_FACTORY: Address = '0x4e59b44847b379578588920cA78FbF26c0B4956C'

/**
 * Init code of contracts/SupplyAllToAave.sol, compiled with:
 *   forge build --contracts contracts --use 0.8.26 --optimize --optimizer-runs 200 \
 *     --evm-version cancun --no-metadata
 * No constructor args, so the CREATE2 address below commits to this exact code.
 */
export const HELPER_INIT_CODE: Hex =
  '0x6080604052348015600e575f80fd5b506103058061001c5f395ff3fe608060405234801561000f575f80fd5b5060043610610034575f3560e01c80637535d24614610038578063b2422b0514610070575b5f80fd5b6100537387870bca3f3fd6335c3f4ce8392d69350b4fa4e281565b6040516001600160a01b0390911681526020015b60405180910390f35b61008361007e366004610293565b610091565b604051908152602001610067565b6040516370a0823160e01b81523060048201525f906001600160a01b038416906370a0823190602401602060405180830381865afa1580156100d5573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906100f991906102c8565b905080158061010757508181105b1561013357604051630da801c760e31b8152600481018290526024810183905260440160405180910390fd5b60405163095ea7b360e01b81527387870bca3f3fd6335c3f4ce8392d69350b4fa4e26004820152602481018290526001600160a01b0384169063095ea7b3906044016020604051808303815f875af1158015610191573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101b591906102df565b6101d257604051633e3f8f7360e01b815260040160405180910390fd5b60405163617ba03760e01b81526001600160a01b0384166004820152602481018290523360448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b158015610237575f80fd5b505af1158015610249573d5f803e3d5ffd5b50506040518381526001600160a01b03861692503391507f044db236edfbd91f7553c04c5900ce24eb05767410049b34c45490a024cd8b839060200160405180910390a392915050565b5f80604083850312156102a4575f80fd5b82356001600160a01b03811681146102ba575f80fd5b946020939093013593505050565b5f602082840312156102d8575f80fd5b5051919050565b5f602082840312156102ef575f80fd5b815180151581146102fe575f80fd5b939250505056'
export const HELPER_SALT: Hex = zeroHash
export const SUPPLY_ALL_HELPER: Address = getContractAddress({
  opcode: 'CREATE2',
  from: CREATE2_FACTORY,
  salt: HELPER_SALT,
  bytecode: HELPER_INIT_CODE,
})

/** EIP-7702 delegation designator: 0xef0100 || implementation address */
const DELEGATION_PREFIX = '0xef0100'
/** ERC-7579 ModeCode: callType BATCH (0x01), execType DEFAULT/revert-on-failure (0x00), rest zero */
const MODE_BATCH_REVERT: Hex = '0x0100000000000000000000000000000000000000000000000000000000000000'

// ---------------------------------------------------------------------------------------------
// ABIs (only what we call)
// ---------------------------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
])
const swapRouter02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
])
const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const helperAbi = parseAbi([
  'function supplyAll(address asset, uint256 minAmount) returns (uint256 amount)',
  'function POOL() view returns (address)',
])
const delegatorAbi = parseAbi([
  'function execute(bytes32 mode, bytes executionCalldata) payable',
  'function supportsExecutionMode(bytes32 mode) view returns (bool)',
])

export type Call = { to: Address; value: bigint; data: Hex }

// ---------------------------------------------------------------------------------------------
// Batch construction (shared by the private-key path and the MetaMask/EIP-5792 path)
// ---------------------------------------------------------------------------------------------
export function buildEntryCalls(amountIn: bigint, minUsdcOut: bigint): Call[] {
  if (amountIn <= 0n) throw new Error('amountIn must be > 0')
  if (minUsdcOut <= 0n) throw new Error('minUsdcOut must be > 0 (never swap without slippage protection)')
  return [
    {
      to: WETH,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [SWAP_ROUTER_02, amountIn] }),
    },
    {
      to: SWAP_ROUTER_02,
      value: 0n,
      data: encodeFunctionData({
        abi: swapRouter02Abi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: WETH,
            tokenOut: USDC,
            fee: UNI_FEE_TIER,
            recipient: SUPPLY_ALL_HELPER, // output goes straight to the helper, never to a loose balance
            amountIn,
            amountOutMinimum: minUsdcOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }),
    },
    {
      to: SUPPLY_ALL_HELPER,
      value: 0n,
      // supplies helper's full USDC balance (= actual swap output) with aTokens minted to msg.sender = EOA
      data: encodeFunctionData({ abi: helperAbi, functionName: 'supplyAll', args: [USDC, minUsdcOut] }),
    },
  ]
}

/** ERC-7579 batch encoding: abi.encode(Execution[]) with Execution = (address target, uint256 value, bytes callData) */
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

export async function quoteMinOut(client: PublicClient, amountIn: bigint, slippageBps: bigint) {
  const { result } = await client.simulateContract({
    address: QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: WETH, tokenOut: USDC, amountIn, fee: UNI_FEE_TIER, sqrtPriceLimitX96: 0n }],
  })
  const quoted = result[0]
  return { quoted, minOut: (quoted * (10_000n - slippageBps)) / 10_000n }
}

type DelegationState = { kind: 'none' } | { kind: 'metamask' } | { kind: 'other'; impl: Hex }

export async function getDelegationState(client: PublicClient, eoa: Address): Promise<DelegationState> {
  const code = (await client.getCode({ address: eoa })) ?? '0x'
  if (code === '0x') return { kind: 'none' }
  if (code.toLowerCase() === concat([DELEGATION_PREFIX, METAMASK_7702_DELEGATOR]).toLowerCase()) return { kind: 'metamask' }
  return { kind: 'other', impl: code }
}

/** Refuse to run unless every contract we touch is exactly what we expect. */
export async function preflightContracts(client: PublicClient) {
  for (const [name, addr] of Object.entries({ WETH, USDC, SWAP_ROUTER_02, QUOTER_V2, AAVE_V3_POOL, METAMASK_7702_DELEGATOR })) {
    const code = await client.getCode({ address: addr })
    if (!code || code === '0x') throw new Error(`${name} (${addr}) has no code — wrong chain/RPC?`)
  }
  const helperCode = await client.getCode({ address: SUPPLY_ALL_HELPER })
  if (!helperCode || helperCode === '0x')
    throw new Error(`SupplyAllToAave helper not deployed at ${SUPPLY_ALL_HELPER}. Run: npx tsx entry.ts deploy-helper --send`)
  // CREATE2 address commits to HELPER_INIT_CODE (no constructor args), so code here is our code.
  const pool = await client.readContract({ address: SUPPLY_ALL_HELPER, abi: helperAbi, functionName: 'POOL' })
  if (!isAddressEqual(pool, AAVE_V3_POOL)) throw new Error('helper POOL mismatch')
  const ok = await client.readContract({
    address: METAMASK_7702_DELEGATOR,
    abi: delegatorAbi,
    functionName: 'supportsExecutionMode',
    args: [MODE_BATCH_REVERT],
  })
  if (!ok) throw new Error('DeleGator does not support batch mode')
}

// ---------------------------------------------------------------------------------------------
// Path A: local signer (private key / any viem LocalAccount) — one EIP-7702 type-4 transaction
// ---------------------------------------------------------------------------------------------
async function runEntry(publicClient: PublicClient, walletClient: WalletClient, account: Account, slippageBps: bigint, send: boolean) {
  const eoa = account.address
  const chainId = await publicClient.getChainId()
  if (chainId !== mainnet.id) throw new Error(`expected chainId 1, got ${chainId}`)
  await preflightContracts(publicClient)

  const delegation = await getDelegationState(publicClient, eoa)
  if (delegation.kind === 'other')
    throw new Error(`account is already delegated to unknown code (${delegation.impl}); refusing to overwrite it`)

  const amountIn = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [eoa] })
  if (amountIn === 0n) throw new Error('no WETH to swap')
  const strayHelperUsdc = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [SUPPLY_ALL_HELPER] })

  const { quoted, minOut } = await quoteMinOut(publicClient, amountIn, slippageBps)
  const calls = buildEntryCalls(amountIn, minOut)
  const data = encodeBatchExecute(calls)

  // Authorization is only needed if the EOA is not already delegated to the MetaMask DeleGator.
  // executor: 'self' => authorization nonce = tx nonce + 1 (the same account signs and sends).
  let authorizationList: SignedAuthorization[] | undefined
  if (delegation.kind === 'none') {
    authorizationList = [
      await walletClient.signAuthorization({ account, contractAddress: METAMASK_7702_DELEGATOR, chainId: mainnet.id, executor: 'self' }),
    ]
  }

  // Full simulation, including the delegation, before anything is broadcast.
  const gas = await publicClient.estimateGas({ account, to: eoa, data, authorizationList })
  const fees = await publicClient.estimateFeesPerGas()
  const maxGasCost = ((gas * 130n) / 100n) * fees.maxFeePerGas
  const ethBalance = await publicClient.getBalance({ address: eoa })

  console.log(`
Account (unchanged address):  ${eoa}
Delegation:                   ${delegation.kind === 'none' ? `will delegate to MetaMask EIP7702StatelessDeleGator ${METAMASK_7702_DELEGATOR}` : 'already MetaMask DeleGator'}
Swap:                         ${formatEther(amountIn)} WETH -> USDC on Uniswap V3 (fee ${UNI_FEE_TIER})
Quoted output:                ${formatUnits(quoted, 6)} USDC
Minimum output (${slippageBps} bps):     ${formatUnits(minOut, 6)} USDC  (tx reverts entirely below this)
Supply:                       100% of swap output -> Aave V3 Pool ${AAVE_V3_POOL}, aEthUSDC to ${eoa}
${strayHelperUsdc > 0n ? `Note: helper already holds ${formatUnits(strayHelperUsdc, 6)} stray USDC; it will be supplied to you as well.\n` : ''}Gas estimate:                 ${gas} (max cost ~${formatEther(maxGasCost)} ETH, balance ${formatEther(ethBalance)} ETH)`)

  if (ethBalance < maxGasCost) throw new Error('not enough ETH for gas')
  if (!send) {
    console.log('\nDry run only (simulation succeeded). Re-run with --send to broadcast.')
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('\nType "yes" to sign and broadcast this single atomic transaction: ')
  rl.close()
  if (answer.trim() !== 'yes') throw new Error('aborted by user')

  const aBefore = await publicClient.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [eoa] })
  const hash = await walletClient.sendTransaction({
    account,
    chain: mainnet,
    to: eoa, // self-call: DeleGator.execute is onlyEntryPointOrSelf
    data,
    authorizationList,
    gas: (gas * 130n) / 100n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  console.log(`tx: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`transaction reverted in block ${receipt.blockNumber} — nothing was swapped or supplied`)

  const [wethAfter, usdcAfter, aAfter, wethAllowance] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [eoa] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [eoa] }),
    publicClient.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [eoa] }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [eoa, SWAP_ROUTER_02] }),
  ])
  console.log(`Confirmed in block ${receipt.blockNumber}
  WETH left:            ${formatEther(wethAfter)}
  USDC loose in wallet: ${formatUnits(usdcAfter, 6)}
  aEthUSDC gained:      ${formatUnits(aAfter - aBefore, 6)}
  WETH allowance left to router: ${wethAllowance}`)
}

/** Clears the EIP-7702 delegation (designator -> address(0)), returning the account to a plain EOA. */
async function runUndelegate(publicClient: PublicClient, walletClient: WalletClient, account: Account, send: boolean) {
  const delegation = await getDelegationState(publicClient, account.address)
  if (delegation.kind === 'none') return console.log('account has no delegation; nothing to do')
  const authorization = await walletClient.signAuthorization({ account, contractAddress: zeroAddress, chainId: mainnet.id, executor: 'self' })
  if (!send) return console.log('Dry run: would send a type-4 tx delegating to address(0). Re-run with --send.')
  const hash = await walletClient.sendTransaction({ account, chain: mainnet, to: account.address, data: '0x', authorizationList: [authorization] })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`undelegate tx ${hash}: ${receipt.status}; code now ${(await publicClient.getCode({ address: account.address })) ?? '0x'}`)
}

/** One-time, permissionless deployment of the helper via the CREATE2 factory. Use any funded key. */
async function runDeployHelper(publicClient: PublicClient, walletClient: WalletClient, account: Account, send: boolean) {
  const existing = await publicClient.getCode({ address: SUPPLY_ALL_HELPER })
  if (existing && existing !== '0x') return console.log(`helper already deployed at ${SUPPLY_ALL_HELPER}`)
  const data = concat([HELPER_SALT, HELPER_INIT_CODE])
  const gas = await publicClient.estimateGas({ account, to: CREATE2_FACTORY, data })
  if (!send) return console.log(`Dry run: would deploy helper to ${SUPPLY_ALL_HELPER} (gas ${gas}). Re-run with --send.`)
  const hash = await walletClient.sendTransaction({ account, chain: mainnet, to: CREATE2_FACTORY, data, gas: (gas * 120n) / 100n })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`helper deployed at ${SUPPLY_ALL_HELPER} (tx ${hash})`)
}

// ---------------------------------------------------------------------------------------------
// Path B: MetaMask (keys never leave the wallet) — EIP-5792 wallet_sendCalls, atomic required.
// Use from a dapp:  const wc = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) })
// MetaMask shows one confirmation that includes the upgrade of the SAME account to its DeleGator
// (0x63c0…E32B) and executes the three calls atomically in one transaction.
// ---------------------------------------------------------------------------------------------
export async function sendWithInjectedWallet(publicClient: PublicClient, walletClient: WalletClient, slippageBps = 50n) {
  const [eoa] = await walletClient.getAddresses()
  await preflightContracts(publicClient)
  const delegation = await getDelegationState(publicClient, eoa)
  if (delegation.kind === 'other') throw new Error('account delegated to unknown code; refusing')

  const caps = await walletClient.getCapabilities({ account: eoa, chainId: mainnet.id })
  const atomic = (caps as { atomic?: { status?: string } }).atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready')
    throw new Error(`wallet cannot guarantee atomic batch execution on mainnet (atomic=${atomic}); refusing to send non-atomically`)

  const amountIn = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [eoa] })
  const { minOut } = await quoteMinOut(publicClient, amountIn, slippageBps)
  const { id } = await walletClient.sendCalls({
    account: eoa,
    chain: mainnet,
    calls: buildEntryCalls(amountIn, minOut),
    forceAtomic: true, // wallet MUST execute all-or-nothing, or reject the request
  })
  const status = await walletClient.waitForCallsStatus({ id })
  if (status.status !== 'success' || !status.atomic) throw new Error(`batch not confirmed atomically: ${JSON.stringify(status)}`)
  return status
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2)
  const send = args.includes('--send')
  const cmd = args.find((a) => !a.startsWith('--')) ?? 'entry'
  const slippageArg = args.find((a) => a.startsWith('--slippage-bps='))
  const slippageBps = BigInt(slippageArg ? slippageArg.split('=')[1] : '50')
  if (slippageBps < 1n || slippageBps > 300n) throw new Error('slippage-bps must be between 1 and 300')

  const rpcUrl = process.env.RPC_URL
  if (!rpcUrl) throw new Error('set RPC_URL')
  const keyVar = cmd === 'deploy-helper' ? 'DEPLOYER_PRIVATE_KEY' : 'PRIVATE_KEY'
  const pk = process.env[keyVar] as Hex | undefined
  if (!pk) throw new Error(`set ${keyVar} (never commit it)`)
  const account = privateKeyToAccount(pk)

  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) }) as PublicClient
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })

  if (cmd === 'entry') return runEntry(publicClient, walletClient, account, slippageBps, send)
  if (cmd === 'undelegate') return runUndelegate(publicClient, walletClient, account, send)
  if (cmd === 'deploy-helper') return runDeployHelper(publicClient, walletClient, account, send)
  throw new Error(`unknown command ${cmd}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
