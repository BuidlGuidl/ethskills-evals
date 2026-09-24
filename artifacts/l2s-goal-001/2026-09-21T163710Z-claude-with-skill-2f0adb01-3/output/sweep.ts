// Move the cycle's CELO revenue from the ops wallet on Celo to the treasury on
// Ethereum mainnet, through Celo's canonical OP Stack bridge.
//
// This is a WITHDRAWAL, not a transfer. A plain CELO transfer to the treasury
// address on Celo leaves the funds on Celo. If the treasury is a Safe or other
// contract that only exists on mainnet, nobody controls that address on Celo and the
// funds are gone. So this script never sends CELO to the treasury on Celo.
//
// It takes three transactions over about 7 days:
//   1. initiate  (Celo,     ops wallet)  locks CELO in the L2ToL1MessagePasser
//   2. prove     (Ethereum, any L1 key)  once a dispute game covers the L2 block (~30-60 min)
//   3. finalize  (Ethereum, SAME L1 key that proved) once the proof has matured (7 days)
// On finalize the OptimismPortal transfers CELO as an ERC-20 (L1_CELO_TOKEN) to the treasury.
//
//   npx tsx sweep.ts initiate --cycle 2026-09 [--amount 1234.5] [--send]
//   npx tsx sweep.ts status   --cycle 2026-09          (or --tx <celo tx hash>)
//   npx tsx sweep.ts prove    --cycle 2026-09 [--send]
//   npx tsx sweep.ts finalize --cycle 2026-09 [--send] [--proof-submitter 0x…]
//
// Without --send every command only reads and simulates.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseEther,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'
import {
  CELO_DISPUTE_GAME_FACTORY,
  CELO_OPTIMISM_PORTAL,
  CELO_SYSTEM_CONFIG,
  L1_CELO_TOKEN,
  L2_TO_L1_MESSAGE_PASSER,
  PLACEHOLDER_TREASURY,
  celo,
  die,
  envAddress,
  mainnet,
  opsAccountOrAddress,
  requireEnv,
  sameAddress,
} from './common.ts'

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cycle: { type: 'string' },
    tx: { type: 'string' },
    amount: { type: 'string' },
    send: { type: 'boolean', default: false },
    'proof-submitter': { type: 'string' },
  },
})
const command = positionals[0]
if (!['initiate', 'status', 'prove', 'finalize'].includes(command ?? '')) {
  die('Usage: sweep.ts <initiate|status|prove|finalize> --cycle <id> [--tx <hash>] [--amount <CELO>] [--send]')
}
const SEND = args.send!

const l2 = createPublicClient({ chain: celo, transport: http(requireEnv('CELO_RPC_URL')) }).extend(publicActionsL2())
const l1 = createPublicClient({ chain: mainnet, transport: http(requireEnv('ETH_RPC_URL')) }).extend(publicActionsL1())

const portalAbi = parseAbi([
  'function systemConfig() view returns (address)',
  'function disputeGameFactory() view returns (address)',
  'function paused() view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function ethLockbox() view returns (address)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'function checkWithdrawal(bytes32, address) view',
  'function numProofSubmitters(bytes32) view returns (uint256)',
  'function proofSubmitters(bytes32, uint256) view returns (address)',
  'error OptimismPortal_Unproven()',
  'error OptimismPortal_ProofNotOldEnough()',
  'error OptimismPortal_InvalidRootClaim()',
  'error OptimismPortal_AlreadyFinalized()',
  'error OptimismPortal_InvalidProofTimestamp()',
  'error OptimismPortal_CallPaused()',
])
const systemConfigAbi = parseAbi(['function gasPayingToken() view returns (address, uint8)'])
const gameAbi = parseAbi([
  'function status() view returns (uint8)',
  'function createdAt() view returns (uint64)',
  'function resolvedAt() view returns (uint64)',
])
const messagePasserAbi = parseAbi(['function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable'])

// ---- state (one file per cycle, so a cycle can't be swept twice by accident) ------------

type SweepState = {
  cycle: string
  treasury: Address
  opsAddress: Address
  amountWei: string
  l2TxHash: Hash
  initiatedAt: string
  withdrawalHash?: Hash
  proveTxHash?: Hash
  prover?: Address
  finalizeTxHash?: Hash
}
const stateDir = 'sweep-state'
mkdirSync(stateDir, { recursive: true })
const statePath = (cycle: string) => `${stateDir}/${cycle.replace(/[^A-Za-z0-9._-]/g, '_')}.json`
const loadState = (cycle: string): SweepState | null =>
  existsSync(statePath(cycle)) ? JSON.parse(readFileSync(statePath(cycle), 'utf8')) : null
const saveState = (s: SweepState) => writeFileSync(statePath(s.cycle), JSON.stringify(s, null, 2) + '\n')

// ---- pre-flight: chains, bridge wiring, treasury ------------------------------------------

const [l1Id, l2Id] = await Promise.all([l1.getChainId(), l2.getChainId()])
if (l1Id !== mainnet.id) die(`ETH_RPC_URL is chain ${l1Id}, expected Ethereum mainnet (1)`)
if (l2Id !== celo.id) die(`CELO_RPC_URL is chain ${l2Id}, expected Celo mainnet (42220)`)

// Re-verify the bridge on every run. If Celo ever upgrades away from "CELO is the custom
// gas token backed by L1_CELO_TOKEN", the payout on L1 would change and we must stop.
const [sysCfg, dgf, paused, maturity, airgap, [gasToken]] = await Promise.all([
  l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'systemConfig' }),
  l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'disputeGameFactory' }),
  l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'paused' }),
  l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
  l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'disputeGameFinalityDelaySeconds' }),
  l1.readContract({ address: CELO_SYSTEM_CONFIG, abi: systemConfigAbi, functionName: 'gasPayingToken' }),
])
if (!sameAddress(sysCfg, CELO_SYSTEM_CONFIG)) die(`Portal systemConfig is ${sysCfg}, expected ${CELO_SYSTEM_CONFIG}. Bridge changed — re-verify before sweeping.`)
if (!sameAddress(dgf, CELO_DISPUTE_GAME_FACTORY)) die(`Portal disputeGameFactory is ${dgf}, expected ${CELO_DISPUTE_GAME_FACTORY}.`)
if (!sameAddress(gasToken, L1_CELO_TOKEN)) die(`Celo gas-paying token on L1 is ${gasToken}, expected ${L1_CELO_TOKEN}. Bridge semantics changed — do not sweep.`)
if (paused) die('OptimismPortal is PAUSED (Celo/Superchain incident response). Do not initiate, prove or finalize until it is unpaused.')

const treasury = envAddress('TREASURY_ADDRESS')
const lockbox = await l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'ethLockbox' }).catch(() => zeroAddress)
const forbiddenTargets: [Address, string][] = [
  [PLACEHOLDER_TREASURY, 'the placeholder from the spec — set the real treasury'],
  [zeroAddress, 'the zero address'],
  [L1_CELO_TOKEN, 'the L1 CELO token (portal rejects it; funds would be stuck)'],
  [CELO_OPTIMISM_PORTAL, 'the portal (rejected; funds would be stuck)'],
]
if (lockbox !== zeroAddress) forbiddenTargets.push([lockbox, 'the ETH lockbox (rejected; funds would be stuck)'])
for (const [bad, why] of forbiddenTargets) if (sameAddress(treasury, bad)) die(`TREASURY_ADDRESS is ${why}.`)

const days = (s: bigint | number) => (Number(s) / 86400).toFixed(2)
console.log(`Treasury (L1)   ${treasury}  [${(await l1.getCode({ address: treasury })) ? 'contract' : 'EOA'}]`)
console.log(`Bridge          portal ${CELO_OPTIMISM_PORTAL}, proof maturity ${days(maturity)}d, game finality air-gap ${days(airgap)}d`)

// ---- resolve which withdrawal we're talking about ------------------------------------------

function currentState(): SweepState | null {
  if (!args.cycle) return null
  return loadState(args.cycle)
}

async function loadWithdrawal() {
  const st = currentState()
  const hash = (args.tx ?? st?.l2TxHash) as Hash | undefined
  if (!hash) die('Pass --cycle <id> (with a saved sweep-state file) or --tx <celo tx hash>.')
  const receipt = await l2.getTransactionReceipt({ hash })
  if (receipt.status !== 'success') die(`Celo tx ${hash} reverted — nothing was withdrawn.`)
  const withdrawals = getWithdrawals(receipt)
  if (withdrawals.length !== 1) die(`Celo tx ${hash} contains ${withdrawals.length} withdrawals, expected 1.`)
  const w = withdrawals[0]
  if (!sameAddress(w.target, treasury)) die(`Withdrawal target is ${w.target} but TREASURY_ADDRESS is ${treasury}.`)
  return { st, receipt, withdrawal: w }
}

async function l1Account() {
  const key = process.env.L1_PRIVATE_KEY?.trim()
  if (key) return privateKeyToAccount(key as `0x${string}`)
  if (SEND) die('L1_PRIVATE_KEY is required with --send (an Ethereum key holding ETH for gas; it never touches the funds).')
  return envAddress('L1_ADDRESS')
}

/** Whoever proved most recently on-chain (finalize must come from them, or name them as proof submitter). */
async function lastProofSubmitter(withdrawalHash: Hash): Promise<Address | undefined> {
  const n = await l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'numProofSubmitters', args: [withdrawalHash] })
  if (n === 0n) return undefined
  return l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'proofSubmitters', args: [withdrawalHash, n - 1n] })
}

// ---- commands -------------------------------------------------------------------------

if (command === 'initiate') {
  if (!args.cycle) die('initiate requires --cycle <id> (e.g. 2026-09) so each cycle is swept exactly once.')
  const existing = loadState(args.cycle)
  if (existing) die(`Cycle ${args.cycle} already initiated in tx ${existing.l2TxHash}. Use "status"/"prove"/"finalize".`)

  const account = opsAccountOrAddress(SEND)
  const ops: Address = typeof account === 'string' ? account : account.address
  const reserve = parseEther(requireEnv('SWEEP_CELO_GAS_RESERVE'))

  const [balance, nLatest, nPending, fees] = await Promise.all([
    l2.getBalance({ address: ops }),
    l2.getTransactionCount({ address: ops, blockTag: 'latest' }),
    l2.getTransactionCount({ address: ops, blockTag: 'pending' }),
    l2.estimateFeesPerGas(),
  ])
  if (nLatest !== nPending) die('Ops wallet has pending transactions (is a payout running?). Wait for them to clear.')

  const sweepable = balance - reserve
  if (sweepable <= 0n) die(`CELO balance ${formatEther(balance)} is not above the gas reserve ${formatEther(reserve)}. Nothing to sweep.`)
  const amount = args.amount ? parseEther(args.amount) : sweepable
  if (amount <= 0n) die('--amount must be positive')
  if (amount > sweepable) die(`--amount ${formatEther(amount)} exceeds balance minus reserve (${formatEther(sweepable)}).`)

  const L1_GAS_LIMIT = 100_000n // unused on L1 for a plain value withdrawal (no calldata), kept non-zero
  const data = encodeFunctionData({ abi: messagePasserAbi, functionName: 'initiateWithdrawal', args: [treasury, L1_GAS_LIMIT, '0x'] })
  const gas = await l2.estimateGas({ account: ops, to: L2_TO_L1_MESSAGE_PASSER, data, value: amount })
  const padded = (gas * 13n) / 10n
  if (amount + padded * fees.maxFeePerGas! > balance) die('Balance does not cover amount + gas.')

  console.log(`Ops wallet (L2) ${ops}`)
  console.log(`CELO balance    ${formatEther(balance)}   reserve kept: ${formatEther(reserve)}`)
  console.log(`Sweep amount    ${formatEther(amount)} CELO  ->  ${formatEther(amount)} L1 CELO (ERC-20 ${L1_CELO_TOKEN}) at ${treasury}`)
  console.log(`Arrives         ~${days(maturity)} days + ~1h after this tx confirms (prove + finalize must be run on L1)`)

  if (!SEND) { console.log('\nDRY RUN OK — initiateWithdrawal simulated. Re-run with --send to broadcast.'); process.exit(0) }
  if (typeof account === 'string') die('unreachable')

  const wallet = createWalletClient({ account, chain: celo, transport: http(requireEnv('CELO_RPC_URL')) })
  const request = await wallet.prepareTransactionRequest({ to: L2_TO_L1_MESSAGE_PASSER, data, value: amount, gas: padded, nonce: nPending })
  const serialized = await wallet.signTransaction(request)
  const l2TxHash = keccak256(serialized)

  // Persist before broadcast: a crash can't cause a second sweep for this cycle.
  const st: SweepState = { cycle: args.cycle, treasury, opsAddress: ops, amountWei: amount.toString(), l2TxHash, initiatedAt: new Date().toISOString() }
  saveState(st)
  await l2.sendRawTransaction({ serializedTransaction: serialized })
  const receipt = await l2.waitForTransactionReceipt({ hash: l2TxHash, timeout: 120_000 })
  if (receipt.status !== 'success') die(`Initiate tx ${l2TxHash} reverted. Delete ${statePath(args.cycle)} after investigating.`)

  const [w] = getWithdrawals(receipt)
  if (!w || w.value !== amount || !sameAddress(w.target, treasury)) die(`Unexpected withdrawal in ${l2TxHash}: ${JSON.stringify(w, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`)
  st.withdrawalHash = w.withdrawalHash
  saveState(st)
  console.log(`\nInitiated: ${l2TxHash} (Celo block ${receipt.blockNumber})`)
  console.log(`Withdrawal hash ${w.withdrawalHash}`)
  console.log(`Next: "sweep.ts prove --cycle ${args.cycle}" in ~1h (run "status" to check).`)
}

if (command === 'status' || command === 'prove' || command === 'finalize') {
  const { st, receipt, withdrawal } = await loadWithdrawal()
  const status = await l1.getWithdrawalStatus({ receipt, targetChain: celo })
  console.log(`Withdrawal      ${withdrawal.withdrawalHash}`)
  console.log(`Amount          ${formatEther(withdrawal.value)} CELO -> ${withdrawal.target}`)
  console.log(`Initiated       Celo tx ${receipt.transactionHash} (block ${receipt.blockNumber})`)
  console.log(`Status          ${status}`)

  if (status === 'waiting-to-prove') {
    const t = await l1.getTimeToProve({ receipt, targetChain: celo })
    console.log(`Provable in     ~${Math.ceil(t.seconds / 60)} min (dispute games every ~${Math.round(t.interval / 60)} min)`)
  }
  if (status === 'waiting-to-finalize' || status === 'ready-to-finalize') {
    const prover = (args['proof-submitter'] as Address | undefined) ?? st?.prover ?? (await lastProofSubmitter(withdrawal.withdrawalHash))
    if (prover) {
      const [game, provenAt] = await l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'provenWithdrawals', args: [withdrawal.withdrawalHash, prover] })
      if (provenAt > 0n) {
        const [gStatus, gResolvedAt] = await Promise.all([
          l1.readContract({ address: game, abi: gameAbi, functionName: 'status' }),
          l1.readContract({ address: game, abi: gameAbi, functionName: 'resolvedAt' }),
        ])
        const matureAt = Number(provenAt + maturity)
        const gameOkAt = gResolvedAt > 0n ? Number(gResolvedAt + airgap) : null
        console.log(`Proven          ${new Date(Number(provenAt) * 1000).toISOString()} by ${prover} against game ${game}`)
        console.log(`Proof matures   ${new Date(matureAt * 1000).toISOString()}`)
        console.log(`Game            status ${['IN_PROGRESS', 'CHALLENGER_WINS', 'DEFENDER_WINS'][gStatus] ?? gStatus}` +
          (gameOkAt ? `, air-gap ends ${new Date(gameOkAt * 1000).toISOString()}` : ' (not resolved yet; resolves ~3.5d after creation if unchallenged)'))
        if (gStatus === 1) console.log('!! The game this withdrawal was proven against was invalidated. Run "prove" again against a newer game (restarts the 7-day clock).')
      }
    }
  }

  if (command === 'prove') {
    if (status !== 'ready-to-prove') die(`Cannot prove: status is ${status}.`)
    const account = await l1Account()
    const from: Address = typeof account === 'string' ? account : account.address
    const game = await l1.getGame({ l2BlockNumber: receipt.blockNumber, targetChain: celo })
    const args_ = await l2.buildProveWithdrawal({ withdrawal, game })
    const gas = await l1.estimateProveWithdrawalGas({ ...args_, account: from, targetChain: celo })
    const fees = await l1.estimateFeesPerGas()
    const ethBal = await l1.getBalance({ address: from })
    console.log(`Prove           against game #${game.index} (L2 block ${game.l2BlockNumber}); gas ~${gas}, up to ${formatEther(gas * fees.maxFeePerGas!)} ETH; L1 key balance ${formatEther(ethBal)} ETH`)
    if (ethBal < gas * fees.maxFeePerGas!) die('L1 key does not have enough ETH for the prove tx.')
    if (!SEND) { console.log('\nDRY RUN OK — prove simulated. Re-run with --send.'); process.exit(0) }
    if (typeof account === 'string') die('unreachable')

    const wallet = createWalletClient({ account, chain: mainnet, transport: http(requireEnv('ETH_RPC_URL')) }).extend(walletActionsL1())
    const hash = await wallet.proveWithdrawal({ ...args_, account, targetChain: celo })
    if (st) { st.proveTxHash = hash; st.prover = account.address; saveState(st) }
    const r = await l1.waitForTransactionReceipt({ hash })
    if (r.status !== 'success') die(`Prove tx ${hash} reverted.`)
    console.log(`\nProven: ${hash}`)
    console.log(`Finalize with the SAME L1 key after ${new Date(Date.now() + Number(maturity) * 1000 + 3600_000).toISOString()} (approx):`)
    console.log(`  sweep.ts finalize --cycle ${st?.cycle ?? '<id>'} --send`)
  }

  if (command === 'finalize') {
    if (status === 'finalized') { console.log('Already finalized.'); process.exit(0) }
    const account = await l1Account()
    const from: Address = typeof account === 'string' ? account : account.address
    const psArg = args['proof-submitter'] ?? st?.prover
    if (psArg && !isAddress(psArg)) die('--proof-submitter is not an address')
    const proofSubmitter = psArg ? getAddress(psArg) : from

    // Portal's own check gives the precise reason if it's not ready (ProofNotOldEnough, game not
    // resolved / in air-gap, InvalidRootClaim, not proven by this submitter, ...).
    try {
      await l1.readContract({ address: CELO_OPTIMISM_PORTAL, abi: portalAbi, functionName: 'checkWithdrawal', args: [withdrawal.withdrawalHash, proofSubmitter] })
    } catch (e: any) {
      const reason = e.cause?.data?.errorName ?? e.shortMessage ?? e.message
      die(`Not finalizable (proof submitter ${proofSubmitter}): ${reason}` +
        (reason === 'OptimismPortal_Unproven' ? ' — run "prove" first, or pass --proof-submitter <address that proved>.' : ''))
    }

    const before = await l1.readContract({ address: L1_CELO_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] })
    const gas = await l1.estimateFinalizeWithdrawalGas({ withdrawal, account: from, targetChain: celo, proofSubmitter: proofSubmitter === from ? undefined : proofSubmitter })
    console.log(`Finalize        gas ~${gas}; treasury L1 CELO balance now ${formatEther(before)}`)
    if (!SEND) { console.log('\nDRY RUN OK — finalize simulated. Re-run with --send.'); process.exit(0) }
    if (typeof account === 'string') die('unreachable')

    const wallet = createWalletClient({ account, chain: mainnet, transport: http(requireEnv('ETH_RPC_URL')) }).extend(walletActionsL1())
    const hash = await wallet.finalizeWithdrawal({ withdrawal, account, targetChain: celo, proofSubmitter: proofSubmitter === from ? undefined : proofSubmitter })
    if (st) { st.finalizeTxHash = hash; saveState(st) }
    const r = await l1.waitForTransactionReceipt({ hash })
    if (r.status !== 'success') die(`Finalize tx ${hash} reverted.`)
    const after = await l1.readContract({ address: L1_CELO_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] })
    console.log(`\nFinalized: ${hash}`)
    console.log(`Treasury L1 CELO ${formatEther(before)} -> ${formatEther(after)} (+${formatEther(after - before)}; expected +${formatEther(withdrawal.value)})`)
    if (after - before !== withdrawal.value) console.log('!! Balance delta does not match the withdrawal amount — reconcile before closing the cycle.')
  }
}
