/**
 * One-click, atomic "WETH -> USDC (Uniswap V3) -> supply to Aave V3" for an existing EOA.
 *
 * The user's own address executes a two-call batch in ONE transaction, via EIP-7702:
 *   1. WETH.approve(helper, wethIn)                            // exact amount, consumed in the same tx
 *   2. helper.enter(wethIn, minUsdcOut, fee, deadline)         // swap + supply what the swap returned
 * If anything reverts (swap slippage, Aave paused/cap hit, ...) the whole transaction reverts.
 *
 * Two ways to run it (see NOTES.md):
 *   - CLI, local key (dev / fork testing / a hot key you control):
 *       RPC_URL=... PRIVATE_KEY=... HELPER_ADDRESS=... npx tsx entry.ts
 *     Delegates the EOA to eth-infinitism's audited Simple7702Account and calls executeBatch.
 *   - Browser wallet (the MetaMask user): `enterWithWallet()` sends the same two calls through
 *     EIP-5792 `wallet_sendCalls` with atomicity required; MetaMask performs the 7702 upgrade to
 *     its own delegator and shows one confirmation.
 *
 * One-time developer step: deploy the helper (stateless, ownerless — not an account):
 *       RPC_URL=... DEPLOYER_PRIVATE_KEY=... npx tsx entry.ts deploy-helper
 *
 * Keys are read from the environment only. Never commit them; never paste them into chats/tickets.
 */
import { createInterface } from 'node:readline/promises'
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------------------------
// Ethereum mainnet addresses
// ---------------------------------------------------------------------------------------------
export const WETH = getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
export const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
/** Aave V3 Ethereum (core market) aToken for USDC */
export const A_ETH_USDC = getAddress('0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c')
/** Aave V3 Ethereum (core market) Pool proxy */
export const AAVE_V3_POOL = getAddress('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2')
/** Uniswap V3 SwapRouter02 (used inside the helper) */
export const SWAP_ROUTER_02 = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
/** Uniswap V3 QuoterV2 (off-chain quote for the slippage floor) */
export const QUOTER_V2 = getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e')
/** eth-infinitism Simple7702Account (account-abstraction v0.8) — the 7702 delegate for the CLI path */
export const SIMPLE_7702_ACCOUNT = getAddress('0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9')
/** Uniswap V3 USDC/WETH pool fee tier: 0.05% is the deepest pool */
export const DEFAULT_FEE = 500

// ---------------------------------------------------------------------------------------------
// Helper contract (contracts/WethToAaveUsdc.sol), solc 0.8.20, --optimize --optimize-runs 200
// --evm-version shanghai. The runtime hash is checked against HELPER_ADDRESS before anything is
// signed, so a mistyped or malicious helper address is refused.
// ---------------------------------------------------------------------------------------------
export const HELPER_CREATION_BYTECODE: Hex = '0x608060405234801561000f575f80fd5b506105838061001d5f395ff3fe608060405234801561000f575f80fd5b5060043610610055575f3560e01c80633b3037051461005957806389a3027114610091578063ad5c4648146100ac578063c5c1594e146100c7578063feb29494146100e8575b5f80fd5b6100747387870bca3f3fd6335c3f4ce8392d69350b4fa4e281565b6040516001600160a01b0390911681526020015b60405180910390f35b61007473a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4881565b61007473c02aaa39b223fe8d0a0e5c4f27ead9083c756cc281565b6100da6100d53660046104cd565b610103565b604051908152602001610088565b6100747368b3465833fb72a70ecdf485e0e4c7bd8665fc4581565b5f8142111561012557604051630407b05b60e31b815260040160405180910390fd5b841580610130575083155b1561014e57604051631f2a200560e01b815260040160405180910390fd5b6040516323b872dd60e01b81523360048201523060248201526044810186905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2906323b872dd906064016020604051808303815f875af11580156101a9573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101cd9190610510565b5060405163095ea7b360e01b81527368b3465833fb72a70ecdf485e0e4c7bd8665fc4560048201526024810186905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc29063095ea7b3906044016020604051808303815f875af1158015610237573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061025b9190610510565b506040805160e08101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486020820190815262ffffff8681168385019081523060608501908152608085018b815260a086018b81525f60c0880190815297516304e45aaf60e01b815296516001600160a01b039081166004890152955186166024880152925190931660448601525183166064850152905160848401525160a4830152915190911660c48201527368b3465833fb72a70ecdf485e0e4c7bd8665fc45906304e45aaf9060e4016020604051808303815f875af115801561034f573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103739190610536565b60405163095ea7b360e01b81527387870bca3f3fd6335c3f4ce8392d69350b4fa4e260048201526024810182905290915073a0b86991c6218b36c1d19d4a2e9eb0ce3606eb489063095ea7b3906044016020604051808303815f875af11580156103df573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104039190610510565b5060405163617ba03760e01b815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018290523360448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b158015610474575f80fd5b505af1158015610486573d5f803e3d5ffd5b505060408051888152602081018590523393507f089d0daa5e8466fdfdab1113e8fdd98c06ef26711cafc429dabce354d007364e92500160405180910390a2949350505050565b5f805f80608085870312156104e0575f80fd5b8435935060208501359250604085013562ffffff81168114610500575f80fd5b9396929550929360600135925050565b5f60208284031215610520575f80fd5b8151801515811461052f575f80fd5b9392505050565b5f60208284031215610546575f80fd5b505191905056fea26469706673582212205c341a852c348b1f51059443dc75785f3eede84c0415799130a1d72850d3990064736f6c63430008140033'
export const HELPER_RUNTIME_KECCAK: Hex =
  '0xfdf8bd63955e2f05906d97336b8b7f3572cb7e7d86db5ee8c4ac021c5a514133'

// ---------------------------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

export const helperAbi = parseAbi([
  'function enter(uint256 wethIn, uint256 minUsdcOut, uint24 fee, uint256 deadline) returns (uint256 usdcSupplied)',
  'event Entered(address indexed account, uint256 wethIn, uint256 usdcSupplied)',
])

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

/** Simple7702Account (BaseAccount v0.8): only the account itself or the EntryPoint may call this. */
const simple7702Abi = parseAbi([
  'struct Call { address target; uint256 value; bytes data; }',
  'function executeBatch(Call[] calls)',
])

// ---------------------------------------------------------------------------------------------
// Shared: build the batch
// ---------------------------------------------------------------------------------------------
export type EntryPlan = {
  account: Address
  wethIn: bigint
  quotedUsdc: bigint
  minUsdcOut: bigint
  fee: number
  deadline: bigint
  calls: { to: Address; value: bigint; data: Hex }[]
}

export async function verifyHelper(client: PublicClient, helper: Address) {
  const code = await client.getCode({ address: helper })
  if (!code || code === '0x') throw new Error(`No contract at HELPER_ADDRESS ${helper}`)
  if (keccak256(code) !== HELPER_RUNTIME_KECCAK)
    throw new Error(`Code at ${helper} is not the expected WethToAaveUsdc helper — refusing to approve it`)
}

export async function planEntry(
  client: PublicClient,
  account: Address,
  helper: Address,
  opts: { slippageBps: number; fee?: number; deadlineSeconds?: number },
): Promise<EntryPlan> {
  const chainId = await client.getChainId()
  if (chainId !== mainnet.id) throw new Error(`Expected Ethereum mainnet (1), RPC is on chain ${chainId}`)
  if (!(opts.slippageBps > 0 && opts.slippageBps <= 300))
    throw new Error('SLIPPAGE_BPS must be in (0, 300]')
  await verifyHelper(client, helper)

  const fee = opts.fee ?? DEFAULT_FEE
  // "All the WETH": read the live balance rather than assuming 2e18.
  const wethIn = await client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
  if (wethIn === 0n) throw new Error(`${account} holds no WETH`)

  // QuoterV2 is non-view (it reverts internally to return data), so it must be eth_call'ed.
  const { result } = await client.simulateContract({
    address: QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: WETH, tokenOut: USDC, amountIn: wethIn, fee, sqrtPriceLimitX96: 0n }],
  })
  const quotedUsdc = result[0]
  const minUsdcOut = (quotedUsdc * BigInt(10_000 - opts.slippageBps)) / 10_000n
  if (minUsdcOut === 0n) throw new Error('Quote is zero — pool unusable')

  const block = await client.getBlock()
  const deadline = block.timestamp + BigInt(opts.deadlineSeconds ?? 300)

  const calls = [
    {
      to: WETH,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [helper, wethIn] }),
    },
    {
      to: helper,
      value: 0n,
      data: encodeFunctionData({ abi: helperAbi, functionName: 'enter', args: [wethIn, minUsdcOut, fee, deadline] }),
    },
  ]
  return { account, wethIn, quotedUsdc, minUsdcOut, fee, deadline, calls }
}

/** Reads the 7702 delegation of an address: null = plain EOA, otherwise the delegate address. */
export async function getDelegate(client: PublicClient, address: Address): Promise<Address | null> {
  const code = await client.getCode({ address })
  if (!code || code === '0x') return null
  if (code.length === 48 && code.toLowerCase().startsWith('0xef0100')) return getAddress(`0x${code.slice(8)}`)
  throw new Error(`${address} has contract code that is not a 7702 delegation — not an EOA`)
}

/** After the tx: prove the position exists instead of trusting "status: success". */
async function verifyOutcome(
  client: PublicClient,
  plan: EntryPlan,
  helper: Address,
  receipt: { status: string; logs: { address: Address; data: Hex; topics: [Hex, ...Hex[]] | [] }[] },
  aUsdcBefore: bigint,
) {
  if (receipt.status !== 'success') throw new Error('Transaction reverted — no swap and no supply happened (atomic)')
  const entered = receipt.logs
    .filter((l) => l.address.toLowerCase() === helper.toLowerCase())
    .map((l) => decodeEventLog({ abi: helperAbi, data: l.data, topics: l.topics }))
    .find((e) => e.eventName === 'Entered' && e.args.account === plan.account)
  if (!entered || entered.eventName !== 'Entered')
    throw new Error('Transaction succeeded but no Entered event — the batch did NOT execute (stale authorization?)')
  const aUsdcAfter = await client.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [plan.account] })
  const wethAfter = await client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [plan.account] })
  const allowanceLeft = await client.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [plan.account, helper] })
  console.log(`\nSwapped ${formatEther(entered.args.wethIn)} WETH -> supplied ${formatUnits(entered.args.usdcSupplied, 6)} USDC to Aave V3`)
  console.log(`aEthUSDC balance: ${formatUnits(aUsdcBefore, 6)} -> ${formatUnits(aUsdcAfter, 6)}`)
  console.log(`WETH left: ${formatEther(wethAfter)}   leftover WETH allowance to helper: ${allowanceLeft}`)
}

// ---------------------------------------------------------------------------------------------
// Path A — browser wallet (MetaMask) via EIP-5792. One confirmation, wallet does the 7702 upgrade.
// ---------------------------------------------------------------------------------------------
export async function enterWithWallet(
  wallet: WalletClient,
  client: PublicClient,
  helper: Address,
  slippageBps = 50,
) {
  const [account] = await wallet.getAddresses()
  const plan = await planEntry(client, account, helper, { slippageBps })

  const caps = await wallet.getCapabilities({ account, chainId: mainnet.id })
  const atomic = (caps as { atomic?: { status?: string } }).atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready')
    throw new Error(`Wallet cannot execute atomic batches on mainnet (atomic.status=${atomic}) — refusing to send non-atomic calls`)

  const aUsdcBefore = await client.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
  // forceAtomic => atomicRequired: true. viem throws rather than falling back to sequential txs.
  const { id } = await wallet.sendCalls({ account, chain: mainnet, calls: plan.calls, forceAtomic: true })
  const status = await wallet.waitForCallsStatus({ id, timeout: 600_000 })
  if (status.status !== 'success' || !status.receipts || status.receipts.length !== 1)
    throw new Error(`Batch not confirmed as one successful tx: ${status.status}`)
  await verifyOutcome(client, plan, helper, status.receipts[0] as never, aUsdcBefore)
  return status.receipts[0].transactionHash
}

// ---------------------------------------------------------------------------------------------
// Path B — CLI with a local key: EIP-7702 type-4 tx to self, delegate = Simple7702Account.
// ---------------------------------------------------------------------------------------------
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function loadKey(name: string): Hex {
  const k = requireEnv(name).trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error(`${name} must be a 0x-prefixed 32-byte hex key`)
  return k as Hex
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) throw new Error('Refusing to send without an interactive confirmation (no TTY)')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim().toLowerCase() === 'yes'
}

async function runCli() {
  const rpcUrl = requireEnv('RPC_URL')
  // Optional separate endpoint for broadcasting, e.g. Flashbots Protect (https://rpc.flashbots.net)
  const sendRpcUrl = process.env.SEND_RPC_URL ?? rpcUrl
  const helperEnv = requireEnv('HELPER_ADDRESS')
  if (!isAddress(helperEnv)) throw new Error('HELPER_ADDRESS is not an address')
  const helper = getAddress(helperEnv)
  const slippageBps = Number(process.env.SLIPPAGE_BPS ?? '50')

  const account = privateKeyToAccount(loadKey('PRIVATE_KEY'))
  const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(sendRpcUrl) })

  const plan = await planEntry(client, account.address, helper, { slippageBps })

  const delegate = await getDelegate(client, account.address)
  if (delegate && delegate !== SIMPLE_7702_ACCOUNT)
    throw new Error(
      `${account.address} is already delegated to ${delegate}. Not overwriting another wallet's delegation; ` +
        'use that wallet (enterWithWallet) or clear it deliberately first.',
    )

  const data = encodeFunctionData({
    abi: simple7702Abi,
    functionName: 'executeBatch',
    args: [plan.calls.map((c) => ({ target: c.to, value: c.value, data: c.data }))],
  })

  // Pin the tx nonce; a 7702 authorization signed by the sender must carry nonce + 1.
  const nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const authorizationList = delegate
    ? undefined
    : [
        await wallet.signAuthorization({
          account,
          contractAddress: SIMPLE_7702_ACCOUNT,
          chainId: mainnet.id,
          nonce: nonce + 1,
        }),
      ]

  // Simulate the exact transaction (including the delegation) and price gas live.
  await client.call({ account, to: account.address, data, authorizationList, nonce })
  const gasEstimate = await client.estimateGas({ account, to: account.address, data, authorizationList })
  const gas = (gasEstimate * 13n) / 10n
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas()
  const ethBalance = await client.getBalance({ address: account.address })
  const maxCost = gas * maxFeePerGas
  if (ethBalance < maxCost) throw new Error(`Need up to ${formatEther(maxCost)} ETH for gas, have ${formatEther(ethBalance)}`)
  // Live gas cost in USD terms, derived from this very quote (no remembered ETH price).
  const usdPerEth = Number(formatUnits(plan.quotedUsdc, 6)) / Number(formatEther(plan.wethIn))
  const typicalCost = gasEstimate * maxFeePerGas

  console.log('\n=== One atomic transaction from your own address ===')
  console.log(`From / beneficiary (same address): ${account.address}`)
  console.log(
    delegate
      ? `7702 delegation: already set to Simple7702Account ${SIMPLE_7702_ACCOUNT}`
      : `7702 delegation to set (persists after this tx): Simple7702Account ${SIMPLE_7702_ACCOUNT}`,
  )
  console.log(`1. WETH ${WETH}.approve(${helper}, ${formatEther(plan.wethIn)} WETH)  (exact, used up in this tx)`)
  console.log(`2. Helper ${helper}.enter(): swap ${formatEther(plan.wethIn)} WETH -> USDC on Uniswap V3 (fee ${plan.fee / 10_000}%)`)
  console.log(`     via SwapRouter02 ${SWAP_ROUTER_02}`)
  console.log(`     quoted ${formatUnits(plan.quotedUsdc, 6)} USDC, minimum ${formatUnits(plan.minUsdcOut, 6)} USDC (${slippageBps / 100}% slippage)`)
  console.log(`   then supply ALL USDC received to Aave V3 Pool ${AAVE_V3_POOL} onBehalfOf ${account.address}`)
  console.log(`   deadline: ${new Date(Number(plan.deadline) * 1000).toISOString()}`)
  console.log(`Gas: limit ${gas} (est. ${gasEstimate}), maxFee ${formatUnits(maxFeePerGas, 9)} gwei, tip ${formatUnits(maxPriorityFeePerGas, 9)} gwei`)
  console.log(`Gas cost: ~${formatEther(typicalCost)} ETH (~$${(Number(formatEther(typicalCost)) * usdPerEth).toFixed(2)}), at most ${formatEther(maxCost)} ETH`)
  console.log(`Broadcast via: ${new URL(sendRpcUrl).host}`)

  if (!(await confirm('\nType "yes" to sign and send: '))) {
    console.log('Aborted. Nothing was sent.')
    return
  }

  // Anything else sent from this account since we read the nonce invalidates the authorization
  // (the tx would then "succeed" as a no-op call to a plain EOA). Re-check before broadcasting.
  const nonceNow = await client.getTransactionCount({ address: account.address, blockTag: 'pending' })
  if (nonceNow !== nonce) throw new Error('Account nonce changed while waiting for confirmation — re-run to re-quote')

  const aUsdcBefore = await client.readContract({ address: A_ETH_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
  const hash = await wallet.sendTransaction({
    account,
    chain: mainnet,
    to: account.address,
    data,
    authorizationList,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  console.log(`Sent: https://etherscan.io/tx/${hash}`)
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 600_000 })
  await verifyOutcome(client, plan, helper, receipt, aUsdcBefore)

  const after = await getDelegate(client, account.address)
  console.log(`\nYour address remains delegated to ${after}. To clear it, sign an authorization to 0x0000…0000 ` +
    '(`npx tsx entry.ts revoke-delegation`).')
}

/** Clears the 7702 delegation (authorization to the zero address) — the EOA is a plain EOA again. */
async function revokeDelegation() {
  const account = privateKeyToAccount(loadKey('PRIVATE_KEY'))
  const client = createPublicClient({ chain: mainnet, transport: http(requireEnv('RPC_URL')) })
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(process.env.SEND_RPC_URL ?? requireEnv('RPC_URL')) })
  const delegate = await getDelegate(client, account.address)
  if (!delegate) return console.log(`${account.address} has no delegation.`)
  const nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' })
  console.log(`Clear delegation of ${account.address} (currently -> ${delegate}); a self-tx with no value.`)
  if (!(await confirm('Type "yes" to sign and send: '))) return console.log('Aborted.')
  const authorization = await wallet.signAuthorization({
    account,
    contractAddress: '0x0000000000000000000000000000000000000000',
    chainId: mainnet.id,
    nonce: nonce + 1,
  })
  const hash = await wallet.sendTransaction({ account, chain: mainnet, to: account.address, authorizationList: [authorization], nonce })
  await client.waitForTransactionReceipt({ hash })
  console.log(`Delegation now: ${(await getDelegate(client, account.address)) ?? 'none'}`)
}

/** One-time: deploy the stateless helper. Any funded key works; it gains no privileges. */
async function deployHelper() {
  const account = privateKeyToAccount(loadKey('DEPLOYER_PRIVATE_KEY'))
  const client = createPublicClient({ chain: mainnet, transport: http(requireEnv('RPC_URL')) })
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(requireEnv('RPC_URL')) })
  if ((await client.getChainId()) !== mainnet.id) throw new Error('Not mainnet')
  const gas = await client.estimateGas({ account, data: HELPER_CREATION_BYTECODE })
  const { maxFeePerGas } = await client.estimateFeesPerGas()
  console.log(`Deploy WethToAaveUsdc from ${account.address}: gas ${gas}, up to ${formatEther(gas * maxFeePerGas)} ETH`)
  if (!(await confirm('Type "yes" to deploy: '))) return console.log('Aborted.')
  const hash = await wallet.deployContract({ abi: helperAbi, bytecode: HELPER_CREATION_BYTECODE, account, chain: mainnet })
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error('Deployment failed')
  await verifyHelper(client, receipt.contractAddress)
  console.log(`HELPER_ADDRESS=${receipt.contractAddress}`)
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isMain) {
  const cmd = process.argv[2] ?? 'enter'
  const run = { enter: runCli, 'deploy-helper': deployHelper, 'revoke-delegation': revokeDelegation }[cmd]
  if (!run) {
    console.error('usage: tsx entry.ts [enter | deploy-helper | revoke-delegation]')
    process.exit(1)
  }
  run().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
