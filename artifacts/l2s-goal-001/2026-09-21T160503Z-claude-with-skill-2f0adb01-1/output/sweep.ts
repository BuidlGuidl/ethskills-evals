// Move the cycle's CELO revenue from the ops wallet on Celo to the treasury on
// Ethereum mainnet, via Celo's canonical OP Stack bridge.
//
// This is NOT one transaction. It takes three, spread over about 7 days:
//
//   1. initiate  (Celo)      L2ToL1MessagePasser.initiateWithdrawal{value}. CELO leaves the ops wallet.
//   2. prove     (Ethereum)  about 1h later, once a dispute game covers the L2 block.
//   3. finalize  (Ethereum)  7 days after proving. The portal transfers ERC-20 CELO
//                            (0x0578...b19f) to the treasury.
//
// If step 2 or 3 is skipped, the CELO sits in the bridge indefinitely. It is not
// lost, but it does not reach the treasury. Run `status` daily until finalized.
//
//   npx tsx sweep.ts initiate [--amount <CELO>] [--execute]
//   npx tsx sweep.ts status   [--tx <celo tx hash>]
//   npx tsx sweep.ts prove    --tx <celo tx hash> [--execute]
//   npx tsx sweep.ts finalize --tx <celo tx hash> [--execute]

import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  http,
  keccak256,
  parseAbi,
  parseEther,
  parseEventLogs,
} from 'viem'
import { mainnet } from 'viem/chains'
import {
  type GetWithdrawalStatusReturnType,
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
} from 'viem/op-stack'
import {
  CELO_L1,
  L2_TO_L1_MESSAGE_PASSER,
  PLACEHOLDER_TREASURY,
  acquireLock,
  assertChainId,
  celoL2,
  die,
  env,
  journalAppend,
  journalRead,
  loadAccount,
  optionalEnv,
  parseAddress,
  parseFlags,
} from './common.ts'

const JOURNAL = 'sweeps.jsonl'

/** Gas forwarded to the L1 call at finalization. The target is a plain
 *  address with empty calldata; 200k matches withdrawals observed to succeed. */
const L1_EXECUTION_GAS = 200_000n

const messagePasserAbi = parseAbi([
  'function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable',
])
const portalAbi = parseAbi([
  'function paused() view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function respectedGameType() view returns (uint32)',
  'function proofSubmitters(bytes32, uint256) view returns (address)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
])
const systemConfigAbi = parseAbi(['function gasPayingToken() view returns (address, uint8)'])

type SweepEntry = {
  step: 'initiate-signed' | 'initiated' | 'proven' | 'finalized'
  l2TxHash: Hex
  withdrawalHash?: Hex
  amount?: string
  treasury?: string
  l1TxHash?: Hex
  prover?: Address
}

// ---------------------------------------------------------------------------

const { positional, flags } = parseFlags(process.argv.slice(2))
const command = positional[0]
const execute = flags.has('execute')

const l2 = createPublicClient({ chain: celoL2, transport: http(env('CELO_RPC_URL'), { retryCount: 3, timeout: 30_000 }) })
  .extend(publicActionsL2())
const l1 = createPublicClient({ chain: mainnet, transport: http(env('ETH_RPC_URL'), { retryCount: 3, timeout: 30_000 }) })
  .extend(publicActionsL1())

function treasury(): Address {
  const t = parseAddress(env('TREASURY_ADDRESS'), 'TREASURY_ADDRESS')
  if (t === PLACEHOLDER_TREASURY) die('TREASURY_ADDRESS is still the 0x1111... placeholder')
  return t
}

/** Check the bridge is actually the one we think, and is operating. */
async function checkBridge() {
  const [paused, [gasToken], maturity, airgap, gameType] = await Promise.all([
    l1.readContract({ address: CELO_L1.optimismPortal, abi: portalAbi, functionName: 'paused' }),
    l1.readContract({ address: CELO_L1.systemConfig, abi: systemConfigAbi, functionName: 'gasPayingToken' }),
    l1.readContract({ address: CELO_L1.optimismPortal, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
    l1.readContract({ address: CELO_L1.optimismPortal, abi: portalAbi, functionName: 'disputeGameFinalityDelaySeconds' }),
    l1.readContract({ address: CELO_L1.optimismPortal, abi: portalAbi, functionName: 'respectedGameType' }),
  ])
  if (gasToken.toLowerCase() !== CELO_L1.celoToken.toLowerCase())
    die(`Celo SystemConfig gas token is ${gasToken}, expected ${CELO_L1.celoToken}. Bridge config changed; re-verify addresses.`)
  if (paused) die('OptimismPortal is PAUSED by the Superchain guardian. Do not initiate/prove/finalize until it is unpaused.')
  return { maturity: Number(maturity), airgap: Number(airgap), gameType }
}

function latestEntries(): Map<Hex, SweepEntry & { history: SweepEntry[] }> {
  const m = new Map<Hex, SweepEntry & { history: SweepEntry[] }>()
  for (const e of journalRead<SweepEntry>(JOURNAL)) {
    const prev = m.get(e.l2TxHash)
    m.set(e.l2TxHash, { ...prev, ...e, history: [...(prev?.history ?? []), e] })
  }
  return m
}

async function loadWithdrawal(txHash: Hex) {
  // Load-balanced RPCs sometimes miss older receipts on one backend; retry before giving up.
  let receipt
  for (let attempt = 1; ; attempt++) {
    try { receipt = await l2.getTransactionReceipt({ hash: txHash }); break } catch (e) {
      if (attempt >= 5) throw e
      await new Promise((r) => setTimeout(r, 2_000 * attempt))
    }
  }
  if (receipt.status !== 'success') die(`Celo tx ${txHash} reverted; nothing was withdrawn`)
  const withdrawals = getWithdrawals(receipt)
  if (withdrawals.length !== 1) die(`Celo tx ${txHash} contains ${withdrawals.length} withdrawals, expected 1`)
  return { receipt, withdrawal: withdrawals[0] }
}

function txArg(): Hex {
  const tx = flags.get('tx')
  if (typeof tx !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(tx)) die('--tx <celo initiate tx hash> required')
  return tx as Hex
}

function fmtEta(seconds: number) {
  if (seconds <= 0) return 'now'
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.ceil((seconds % 3600) / 60)
  return `${d ? `${d}d ` : ''}${h}h ${m}m (${new Date(Date.now() + seconds * 1000).toISOString()})`
}

// ---------------------------------------------------------------------------
// 1. initiate (Celo)
// ---------------------------------------------------------------------------

async function initiate() {
  await Promise.all([assertChainId(l2, celoL2.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  const account = loadAccount('OPS_PRIVATE_KEY')
  const to = treasury()
  const { maturity } = await checkBridge()
  if (execute) acquireLock('sweep.ts initiate')

  // Don't stack sweeps: finance reconciles one in-flight withdrawal per cycle.
  const open = [...latestEntries().values()].filter((e) => e.step !== 'finalized')
  if (open.length && !flags.has('allow-concurrent'))
    die(`unfinished sweep(s) in the journal: ${open.map((e) => `${e.l2TxHash} (${e.step})`).join(', ')}\n` +
      'Finish them (status/prove/finalize) or pass --allow-concurrent.')

  // The ops wallet pays payout gas in CELO, so always leave a reserve behind.
  const reserve = parseEther(env('SWEEP_CELO_RESERVE'))
  const minSweep = parseEther(optionalEnv('SWEEP_MIN_CELO') ?? '1')
  const balance = await l2.getBalance({ address: account.address })

  const walletL2 = createWalletClient({ chain: celoL2, transport: http(env('CELO_RPC_URL')), account })
  const data = encodeFunctionData({ abi: messagePasserAbi, functionName: 'initiateWithdrawal', args: [to, L1_EXECUTION_GAS, '0x'] })

  // Fee for this tx itself also comes out of the balance.
  const fees = await l2.estimateFeesPerGas()
  const feeHeadroom = 150_000n * fees.maxFeePerGas!

  const amountFlag = flags.get('amount')
  const amount = typeof amountFlag === 'string'
    ? parseEther(amountFlag)
    : balance - reserve - feeHeadroom

  console.log(`
Ops wallet      ${account.address}
CELO balance    ${formatEther(balance)}
Reserve kept    ${formatEther(reserve)} (SWEEP_CELO_RESERVE)
Sweep amount    ${formatEther(amount > 0n ? amount : 0n)} CELO
Destination     ${to} on Ethereum mainnet, as ERC-20 CELO ${CELO_L1.celoToken}
Route           Celo canonical bridge: L2ToL1MessagePasser -> OptimismPortal ${CELO_L1.optimismPortal}
Arrives         ~${Math.round(maturity / 86400)} days + ~1h after initiation, and only if prove and finalize are run`)

  if (amount < minSweep) die(`sweep amount below SWEEP_MIN_CELO (${formatEther(minSweep)}); nothing to do`)
  if (balance - amount - feeHeadroom < reserve) die('amount would eat into the gas reserve')

  const request = await walletL2.prepareTransactionRequest({ to: L2_TO_L1_MESSAGE_PASSER, data, value: amount })
  await l2.call({ account: account.address, to: L2_TO_L1_MESSAGE_PASSER, data, value: amount }) // simulate

  if (!execute) { console.log('\nDRY RUN: nothing sent. Re-run with --execute.'); return }
  if (flags.get('confirm-treasury') !== to)
    die(`--execute requires --confirm-treasury ${to} (retype it; it must match TREASURY_ADDRESS exactly)`)

  const serialized = await walletL2.signTransaction(request)
  const l2TxHash = keccak256(serialized)
  journalAppend(JOURNAL, { step: 'initiate-signed', l2TxHash, amount, treasury: to })
  await l2.sendRawTransaction({ serializedTransaction: serialized })

  const { withdrawal } = await (async () => {
    const r = await l2.waitForTransactionReceipt({ hash: l2TxHash, timeout: 180_000 })
    if (r.status !== 'success') die(`initiate tx ${l2TxHash} reverted`)
    return loadWithdrawal(l2TxHash)
  })()
  if (withdrawal.target !== to || withdrawal.value !== amount)
    die(`withdrawal event mismatch: target=${withdrawal.target} value=${withdrawal.value}`)

  journalAppend(JOURNAL, { step: 'initiated', l2TxHash, withdrawalHash: withdrawal.withdrawalHash, amount, treasury: to })
  console.log(`
Initiated: ${formatEther(amount)} CELO has left the ops wallet.
  Celo tx         ${celoL2.blockExplorers!.default.url}/tx/${l2TxHash}
  withdrawalHash  ${withdrawal.withdrawalHash}

NEXT: in ~1h run
  npx tsx sweep.ts prove --tx ${l2TxHash} --execute`)
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

async function describe(txHash: Hex): Promise<GetWithdrawalStatusReturnType> {
  const { receipt, withdrawal } = await loadWithdrawal(txHash)
  const status = await l1.getWithdrawalStatus({ receipt, targetChain: celoL2 as any })
  let eta = ''
  if (status === 'waiting-to-prove') {
    const { seconds } = await l1.getTimeToProve({ receipt, targetChain: celoL2 as any })
    eta = `provable in ~${fmtEta(seconds)}`
  } else if (status === 'waiting-to-finalize') {
    const { seconds } = await l1.getTimeToFinalize({ withdrawalHash: withdrawal.withdrawalHash, targetChain: celoL2 as any })
    eta = `proof matures in ~${fmtEta(seconds)} (the dispute game must also be resolved; re-check then)`
  }
  console.log(`${txHash}  ${formatEther(withdrawal.value)} CELO -> ${withdrawal.target}  ${status}${eta ? `  ${eta}` : ''}`)
  return status
}

async function status() {
  await Promise.all([assertChainId(l2, celoL2.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  const tx = flags.get('tx')
  const targets = typeof tx === 'string'
    ? [tx as Hex]
    : [...latestEntries().values()].filter((e) => e.step !== 'finalized').map((e) => e.l2TxHash)
  if (targets.length === 0) { console.log('No unfinished sweeps in the journal.'); return }
  for (const h of targets) await describe(h)
}

// ---------------------------------------------------------------------------
// 2. prove (Ethereum)
// ---------------------------------------------------------------------------

async function prove() {
  await Promise.all([assertChainId(l2, celoL2.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  await checkBridge()
  const txHash = txArg()
  const st = await describe(txHash)
  if (st !== 'ready-to-prove') die(`withdrawal is "${st}", not ready-to-prove`)

  const l1Account = loadAccount('L1_PRIVATE_KEY')
  const { receipt, withdrawal } = await loadWithdrawal(txHash)
  // Newest game covering the withdrawal. (viem's waitToProve picks a random one; an old game
  // means eth_getProof at an old L2 block, which many RPCs refuse outside their proof window.)
  const game = await l1.getGame({ l2BlockNumber: receipt.blockNumber, strategy: 'latest', targetChain: celoL2 as any })
  const args = await l2.buildProveWithdrawal({ account: l1Account, game, withdrawal } as any)

  const ethBal = await l1.getBalance({ address: l1Account.address })
  console.log(`Prover ${l1Account.address} has ${formatEther(ethBal)} ETH. Using dispute game #${game.index} (L2 block ${game.l2BlockNumber}).`)
  if (!execute) { console.log('DRY RUN: re-run with --execute to submit the proof on Ethereum.'); return }

  acquireLock('sweep.ts prove')
  const wallet = createWalletClient({ chain: mainnet, transport: http(env('ETH_RPC_URL')), account: l1Account }).extend(walletActionsL1())
  const l1TxHash = await wallet.proveWithdrawal(args as any)
  const r = await l1.waitForTransactionReceipt({ hash: l1TxHash, timeout: 600_000 })
  if (r.status !== 'success') die(`prove tx ${l1TxHash} reverted`)

  journalAppend(JOURNAL, { step: 'proven', l2TxHash: txHash, withdrawalHash: withdrawal.withdrawalHash, l1TxHash, prover: l1Account.address })
  console.log(`
Proven on Ethereum: https://etherscan.io/tx/${l1TxHash}
NEXT: in ~7 days run
  npx tsx sweep.ts finalize --tx ${txHash} --execute`)
  await describe(txHash)
}

// ---------------------------------------------------------------------------
// 3. finalize (Ethereum)
// ---------------------------------------------------------------------------

async function finalize() {
  await Promise.all([assertChainId(l2, celoL2.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  await checkBridge()
  const txHash = txArg()
  const st = await describe(txHash)
  if (st !== 'ready-to-finalize') die(`withdrawal is "${st}", not ready-to-finalize`)

  const l1Account = loadAccount('L1_PRIVATE_KEY')
  const { withdrawal } = await loadWithdrawal(txHash)

  // Finalize against the proof we submitted. Use the journal's prover, falling back to the first on-chain submitter.
  const journaled = latestEntries().get(txHash)?.prover
  const proofSubmitter: Address = journaled ?? await l1.readContract({
    address: CELO_L1.optimismPortal, abi: portalAbi, functionName: 'proofSubmitters', args: [withdrawal.withdrawalHash, 0n],
  })

  const before = await l1.readContract({ address: CELO_L1.celoToken, abi: erc20Abi, functionName: 'balanceOf', args: [withdrawal.target] })
  console.log(`Finalizing ${formatEther(withdrawal.value)} CELO -> ${withdrawal.target} (proof by ${proofSubmitter}). Treasury CELO now: ${formatEther(before)}`)
  if (!execute) { console.log('DRY RUN: re-run with --execute to finalize on Ethereum.'); return }

  acquireLock('sweep.ts finalize')
  const wallet = createWalletClient({ chain: mainnet, transport: http(env('ETH_RPC_URL')), account: l1Account }).extend(walletActionsL1())
  const l1TxHash = await wallet.finalizeWithdrawal({
    targetChain: celoL2 as any,
    withdrawal,
    proofSubmitter: proofSubmitter === l1Account.address ? undefined : proofSubmitter,
  })
  const r = await l1.waitForTransactionReceipt({ hash: l1TxHash, timeout: 600_000 })
  if (r.status !== 'success') die(`finalize tx ${l1TxHash} reverted; withdrawal is still claimable, investigate and retry`)

  const [fin] = parseEventLogs({ abi: portalAbi, eventName: 'WithdrawalFinalized', logs: r.logs })
  const credited = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: r.logs }).some(
    (l) => l.address.toLowerCase() === CELO_L1.celoToken.toLowerCase() && l.args.to === withdrawal.target && l.args.value === withdrawal.value,
  )
  journalAppend(JOURNAL, { step: 'finalized', l2TxHash: txHash, withdrawalHash: withdrawal.withdrawalHash, l1TxHash, success: fin?.args.success, credited })
  if (!fin?.args.success || !credited)
    die(`finalize tx ${l1TxHash} mined but success=${fin?.args.success} credited=${credited}. Escalate immediately.`)

  const after = await l1.readContract({ address: CELO_L1.celoToken, abi: erc20Abi, functionName: 'balanceOf', args: [withdrawal.target] })
  console.log(`
Finalized: https://etherscan.io/tx/${l1TxHash}
Treasury ${withdrawal.target} CELO (${CELO_L1.celoToken}): ${formatEther(before)} -> ${formatEther(after)}`)
}

// ---------------------------------------------------------------------------

const commands: Record<string, () => Promise<void>> = { initiate, status, prove, finalize }
const fn = commands[command ?? ''] ?? (() => die('usage: sweep.ts <initiate|status|prove|finalize> [--tx <hash>] [--amount <CELO>] [--execute]'))
fn().catch((e) => die(e?.shortMessage ?? e?.message ?? String(e)))
