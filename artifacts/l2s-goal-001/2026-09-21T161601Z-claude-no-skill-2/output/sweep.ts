// sweep.ts — move the cycle's CELO revenue from the ops wallet on Celo to the
// treasury on Ethereum mainnet, via Celo's canonical (OP Stack) bridge.
//
// This is a multi-day, multi-step process. Each step is a separate command and
// every command is safe to re-run:
//
//   npx tsx sweep.ts plan     --cycle 2026-09              read-only: checks + amount that would be swept
//   npx tsx sweep.ts initiate --cycle 2026-09 --execute    Celo tx: burn CELO on L2, start the withdrawal
//   npx tsx sweep.ts status   --cycle 2026-09              where the withdrawal is, and ETAs
//   npx tsx sweep.ts prove    --cycle 2026-09 --execute    Ethereum tx, ~1h after initiate
//   npx tsx sweep.ts finalize --cycle 2026-09 --execute    Ethereum tx, ~7 days after prove; treasury is paid
//
// Options:
//   --amount <CELO>    sweep this exact amount instead of (balance - CELO_GAS_RESERVE)
//   --confirm <code>   non-interactive confirmation for initiate (code printed by plan)
//   --replace-stuck    fee-bump a stuck initiate tx on its original nonce
//
// What lands in the treasury is CELO as an ERC-20 on Ethereum (CELO_ON_ETHEREUM
// in lib.ts), not ETH. See NOTES.md for timing and operator checklist.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  parseAbi,
  parseEventLogs,
  parseGwei,
} from 'viem'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'
import {
  CELO_DECIMALS,
  CELO_ON_ETHEREUM,
  CeloSender,
  DISPUTE_GAME_FACTORY,
  L2_TO_L1_MESSAGE_PASSER,
  LEDGER_DIR,
  OPTIMISM_PORTAL,
  OpsError,
  SYSTEM_CONFIG,
  type SignedTx,
  acquireLock,
  celoClient,
  celoL2,
  celoWallet,
  env,
  envOpt,
  ethClient,
  ethWallet,
  fmtCelo,
  loadAccount,
  parseAddress,
  parseAmount,
  readJson,
  requireConfirmation,
  runMain,
  writeJsonAtomic,
} from './lib.ts'
import { createHash } from 'node:crypto'

const SWEEP_DIR = join(LEDGER_DIR, 'sweeps')
const PAYOUT_DIR = join(LEDGER_DIR, 'payouts')
const PLACEHOLDER_TREASURY = '0x1111111111111111111111111111111111111111'
// L1 gas forwarded to the target on finalize. With empty calldata Celo's portal only does an
// ERC-20 transfer to the target and makes no call, so this just needs to be non-trivial.
const WITHDRAWAL_L1_GAS_LIMIT = 100_000n

const portalAbi = parseAbi([
  'function paused() view returns (bool)',
  'function systemConfig() view returns (address)',
  'function disputeGameFactory() view returns (address)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function numProofSubmitters(bytes32) view returns (uint256)',
  'function proofSubmitters(bytes32, uint256) view returns (address)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'function finalizedWithdrawals(bytes32) view returns (bool)',
  'struct WithdrawalTransaction { uint256 nonce; address sender; address target; uint256 value; uint256 gasLimit; bytes data; }',
  'function finalizeWithdrawalTransactionExternalProof(WithdrawalTransaction _tx, address _proofSubmitter)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
])
const systemConfigAbi = parseAbi(['function gasPayingToken() view returns (address addr, uint8 decimals)'])
const messagePasserAbi = parseAbi([
  'function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable',
])
const gameAbi = parseAbi([
  'function status() view returns (uint8)',
  'function createdAt() view returns (uint64)',
  'function resolvedAt() view returns (uint64)',
  'function maxChallengeDuration() view returns (uint64)',
])
const GAME_STATUS = ['IN_PROGRESS', 'CHALLENGER_WINS', 'DEFENDER_WINS'] as const

type StoredWithdrawal = {
  nonce: string
  sender: Address
  target: Address
  value: string
  gasLimit: string
  data: Hex
  withdrawalHash: Hash
}

type SweepState = {
  cycle: string
  status: 'initiate-signed' | 'initiated' | 'initiate-reverted' | 'proven' | 'finalized'
  from: Address
  treasury: Address
  amount: string // wei
  celoTx?: SignedTx
  initiateTxHash?: Hash
  l2BlockNumber?: string
  initiatedAt?: string
  withdrawal?: StoredWithdrawal
  proveTxs?: { hash: Hash; submitter: Address; at: string }[]
  finalizeTxHash?: Hash
  finalizedAt?: string
  updatedAt: string
}

const statePath = (cycle: string) => join(SWEEP_DIR, `${cycle}.json`)
const saveState = (s: SweepState) => writeJsonAtomic(statePath(s.cycle), { ...s, updatedAt: new Date().toISOString() })
const days = (seconds: number | bigint) => `${(Number(seconds) / 86400).toFixed(2)} days`
const at = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString()

const reviveWithdrawal = (w: StoredWithdrawal) => ({
  nonce: BigInt(w.nonce),
  sender: w.sender,
  target: w.target,
  value: BigInt(w.value),
  gasLimit: BigInt(w.gasLimit),
  data: w.data,
  withdrawalHash: w.withdrawalHash,
})

function treasuryAddress(): Address {
  const raw = env('TREASURY_L1_ADDRESS')
  if (raw.toLowerCase() === PLACEHOLDER_TREASURY)
    throw new OpsError('TREASURY_L1_ADDRESS is still the placeholder 0x1111…1111. Set the real treasury address.')
  return parseAddress(raw, 'TREASURY_L1_ADDRESS')
}

async function l1Clients() {
  const l1 = (await ethClient()).extend(publicActionsL1())
  return { l1 }
}

/** Fails loudly if the bridge isn't what this code was written against, or is paused. */
async function checkBridge(l1: Awaited<ReturnType<typeof l1Clients>>['l1']) {
  const read = <T>(address: Address, abi: any, functionName: string, args: any[] = []) =>
    l1.readContract({ address, abi, functionName, args }) as Promise<T>
  const [paused, systemConfig, dgf, gasToken, maturity, finality] = await Promise.all([
    read<boolean>(OPTIMISM_PORTAL, portalAbi, 'paused'),
    read<Address>(OPTIMISM_PORTAL, portalAbi, 'systemConfig'),
    read<Address>(OPTIMISM_PORTAL, portalAbi, 'disputeGameFactory'),
    read<readonly [Address, number]>(SYSTEM_CONFIG, systemConfigAbi, 'gasPayingToken'),
    read<bigint>(OPTIMISM_PORTAL, portalAbi, 'proofMaturityDelaySeconds'),
    read<bigint>(OPTIMISM_PORTAL, portalAbi, 'disputeGameFinalityDelaySeconds'),
  ])
  const problems: string[] = []
  if (paused) problems.push('OptimismPortal is PAUSED (Celo guardian action). Do not initiate; wait for unpause.')
  if (systemConfig !== SYSTEM_CONFIG) problems.push(`portal.systemConfig() is ${systemConfig}, expected ${SYSTEM_CONFIG}`)
  if (dgf !== DISPUTE_GAME_FACTORY) problems.push(`portal.disputeGameFactory() is ${dgf}, expected ${DISPUTE_GAME_FACTORY}`)
  if (gasToken[0] !== CELO_ON_ETHEREUM || gasToken[1] !== CELO_DECIMALS)
    problems.push(`SystemConfig.gasPayingToken() is ${gasToken.join('/')}, expected ${CELO_ON_ETHEREUM}/18`)
  if (problems.length)
    throw new OpsError(`Bridge check failed — the Celo bridge has changed or is paused:\n  - ${problems.join('\n  - ')}`)

  const [latest] = await l1.getGames({ targetChain: celoL2, limit: 1 })
  const gameAgeSec = latest ? Math.floor(Date.now() / 1000) - Number(latest.timestamp) : Infinity
  return { maturity, finality, gameAgeSec }
}

function assertNoPayoutInFlight() {
  if (!existsSync(PAYOUT_DIR)) return
  for (const f of readdirSync(PAYOUT_DIR).filter((f) => f.endsWith('.json')))
    if (readJson<{ status: string }>(join(PAYOUT_DIR, f))?.status === 'signed')
      throw new OpsError(`Payout ledger entry ${f} has an unconfirmed tx. Finish that payout run first.`)
}

async function l2Receipt(state: SweepState): Promise<TransactionReceipt> {
  if (!state.initiateTxHash) throw new OpsError(`Cycle ${state.cycle} has not been initiated.`)
  const client = await celoClient()
  for (let i = 0; i < 5; i++) {
    const r = await client.getTransactionReceipt({ hash: state.initiateTxHash }).catch(() => undefined)
    if (r) return r
    await new Promise((res) => setTimeout(res, 2_000))
  }
  throw new OpsError(`Could not fetch Celo receipt for ${state.initiateTxHash} (RPC problem?).`)
}

function loadState(cycle: string): SweepState {
  const s = readJson<SweepState>(statePath(cycle))
  if (!s) throw new OpsError(`No sweep state for cycle ${cycle} at ${statePath(cycle)}.`)
  return s
}

async function assertL1FeesOk(l1: Awaited<ReturnType<typeof l1Clients>>['l1']) {
  const cap = parseGwei(envOpt('L1_MAX_FEE_GWEI') ?? '30')
  const { maxFeePerGas } = await l1.estimateFeesPerGas()
  if (maxFeePerGas > cap)
    throw new OpsError(
      `Ethereum maxFeePerGas is ${formatUnits(maxFeePerGas, 9)} gwei (> L1_MAX_FEE_GWEI). ` +
        `Nothing is lost by waiting; retry later or raise the cap.`,
    )
}

// ---------------------------------------------------------------------------

async function planOrInitiate(cycle: string, opts: { execute: boolean; amount?: string; confirm?: string; replaceStuck: boolean }) {
  const ops = parseAddress(env('OPS_ADDRESS'), 'OPS_ADDRESS')
  const treasury = treasuryAddress()
  const existing = readJson<SweepState>(statePath(cycle))
  if (existing && existing.status !== 'initiate-signed')
    throw new OpsError(
      `Cycle ${cycle} is already ${existing.status} (${statePath(cycle)}). Use \`status\`/\`prove\`/\`finalize\`. ` +
        (existing.status === 'initiate-reverted' ? 'Investigate the revert, then use a new --cycle label.' : ''),
    )

  const client = await celoClient()
  const { l1 } = await l1Clients()
  const bridge = await checkBridge(l1)

  let amount: bigint
  let balance = await client.getBalance({ address: ops })
  const reserve = parseAmount(env('CELO_GAS_RESERVE'), CELO_DECIMALS, 'CELO_GAS_RESERVE')
  if (existing) {
    // Resuming: the amount and target are whatever was signed. Never recompute.
    amount = BigInt(existing.amount)
    if (existing.treasury !== treasury)
      throw new OpsError(`In-flight sweep targets ${existing.treasury} but TREASURY_L1_ADDRESS is ${treasury}.`)
  } else {
    const sweepable = balance > reserve ? balance - reserve : 0n
    amount = opts.amount ? parseAmount(opts.amount, CELO_DECIMALS, '--amount') : sweepable
    const min = parseAmount(envOpt('SWEEP_MIN_CELO') ?? '1', CELO_DECIMALS, 'SWEEP_MIN_CELO')
    if (amount > sweepable)
      throw new OpsError(`Requested ${fmtCelo(amount)} but only ${fmtCelo(sweepable)} is above the gas reserve.`)
    if (amount < min) throw new OpsError(`Sweep amount ${fmtCelo(amount)} is below SWEEP_MIN_CELO; nothing to do.`)
  }

  const call = {
    to: L2_TO_L1_MESSAGE_PASSER,
    value: amount,
    data: encodeFunctionData({
      abi: messagePasserAbi,
      functionName: 'initiateWithdrawal',
      args: [treasury, WITHDRAWAL_L1_GAS_LIMIT, '0x'],
    }),
  }
  if (!existing) await client.call({ account: ops, ...call }) // simulate; throws on revert

  const treasuryCode = await l1.getCode({ address: treasury })
  console.log(`\nSweep plan — cycle ${cycle}`)
  console.log(`  from (ops wallet, Celo):     ${ops}`)
  console.log(`  ops CELO balance:            ${fmtCelo(balance)}`)
  console.log(`  gas reserve kept on Celo:    ${fmtCelo(reserve)}`)
  console.log(`  AMOUNT TO SWEEP:             ${fmtCelo(amount)}`)
  console.log(`  treasury (Ethereum):         ${treasury} (${treasuryCode ? 'contract' : 'EOA'} on Ethereum)`)
  console.log(`  treasury receives:           CELO ERC-20 ${CELO_ON_ETHEREUM} on Ethereum (not ETH)`)
  console.log(`  route:                       Celo canonical bridge (L2ToL1MessagePasser -> OptimismPortal)`)
  console.log(`  proof maturity delay:        ${days(bridge.maturity)} after prove`)
  console.log(`  dispute game finality delay: ${days(bridge.finality)} after game resolution`)
  console.log(`  latest L1 state proposal:    ${Math.round(bridge.gameAgeSec / 60)} min ago`)
  if (bridge.gameAgeSec > 6 * 3600)
    console.log(`\nWARNING: no Celo state proposal on L1 for >6h. Proving will be delayed until proposals resume.`)
  if (existing) console.log(`\n  RESUMING in-flight initiate tx(s): ${existing.celoTx?.hashes.join(', ')}`)

  const code = createHash('sha256')
    .update([cycle, ops, treasury, amount].join('|'))
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
  if (!opts.execute) {
    console.log(`\nDRY RUN — nothing sent. To initiate exactly this sweep:`)
    console.log(`  npx tsx sweep.ts initiate --cycle ${cycle}${opts.amount ? ` --amount ${opts.amount}` : ''} --execute --confirm ${code}`)
    return
  }

  const account = loadAccount('OPS_PRIVATE_KEY', 'OPS_ADDRESS')
  const release = acquireLock(`sweep initiate ${cycle}`)
  try {
    assertNoPayoutInFlight()
    await requireConfirmation(code, opts.confirm)
    const base: SweepState = existing ?? {
      cycle,
      status: 'initiate-signed',
      from: ops,
      treasury,
      amount: amount.toString(),
      updatedAt: '',
    }
    const sender = new CeloSender(client, celoWallet(account), account)
    const receipt = await sender.sendOnce({
      call,
      existing: base.celoTx,
      persist: (celoTx) => saveState({ ...base, status: 'initiate-signed', celoTx }),
      replaceStuck: opts.replaceStuck,
    })
    const state = loadState(cycle)
    if (receipt.status !== 'success') {
      saveState({ ...state, status: 'initiate-reverted', initiateTxHash: receipt.transactionHash })
      throw new OpsError(`Initiate tx ${receipt.transactionHash} reverted. No CELO left the wallet except gas.`)
    }
    const withdrawals = getWithdrawals(receipt)
    const w = withdrawals[0]
    if (withdrawals.length !== 1 || !w || w.target !== treasury || w.value !== amount || w.sender !== ops)
      throw new OpsError(`Tx ${receipt.transactionHash} did not emit the expected withdrawal. Investigate immediately.`)
    const block = await client.getBlock({ blockNumber: receipt.blockNumber })
    saveState({
      ...state,
      status: 'initiated',
      initiateTxHash: receipt.transactionHash,
      l2BlockNumber: receipt.blockNumber.toString(),
      initiatedAt: at(Number(block.timestamp)),
      withdrawal: {
        nonce: w.nonce.toString(),
        sender: w.sender,
        target: w.target,
        value: w.value.toString(),
        gasLimit: w.gasLimit.toString(),
        data: w.data,
        withdrawalHash: w.withdrawalHash,
      },
    })
    console.log(`\nInitiated: ${fmtCelo(amount)} left the ops wallet in ${receipt.transactionHash}`)
    console.log(`Withdrawal hash: ${w.withdrawalHash}`)
    const ttp = await l1.getTimeToProve({ receipt, targetChain: celoL2 }).catch(() => undefined)
    if (ttp) console.log(`Provable in ~${Math.ceil(ttp.seconds / 60)} min. Then: npx tsx sweep.ts prove --cycle ${cycle} --execute`)
  } finally {
    release()
  }
}

async function status(cycle: string) {
  const state = loadState(cycle)
  console.log(`\nCycle ${cycle}: local state = ${state.status}, ${fmtCelo(BigInt(state.amount))} -> ${state.treasury}`)
  if (state.status === 'initiate-signed')
    return console.log(`Initiate tx not yet confirmed. Re-run \`initiate --execute\` to resume it.`)
  if (state.status === 'initiate-reverted') return console.log(`Initiate reverted: ${state.initiateTxHash}`)

  const { l1 } = await l1Clients()
  const receipt = await l2Receipt(state)
  const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoL2 })
  console.log(`On-chain withdrawal status: ${s}`)
  const hash = state.withdrawal!.withdrawalHash

  if (s === 'waiting-to-prove') {
    const t = await l1.getTimeToProve({ receipt, targetChain: celoL2 })
    console.log(`Provable in ~${Math.ceil(t.seconds / 60)} min (L1 state proposals every ~${Math.round(t.interval / 60)} min).`)
  } else if (s === 'ready-to-prove') {
    if (state.status === 'proven')
      console.log(
        `\nWARNING: this withdrawal was proven before but the proof is no longer valid (its dispute game was ` +
          `invalidated or blacklisted). Re-prove; the ${'7-day'} maturity clock restarts from the new proof.`,
      )
    console.log(`Next: npx tsx sweep.ts prove --cycle ${cycle} --execute`)
  } else if (s === 'waiting-to-finalize') {
    const eta = await proofMaturesAt(l1, hash)
    if (eta) console.log(`Latest proof matures at ${at(eta)} (${days(Math.max(0, eta - Date.now() / 1000))} from now).`)
    await describeProofGames(l1, hash)
  } else if (s === 'ready-to-finalize') {
    console.log(`Next: npx tsx sweep.ts finalize --cycle ${cycle} --execute`)
  } else if (s === 'finalized') {
    const bal = await l1.readContract({ address: CELO_ON_ETHEREUM, abi: erc20Abi, functionName: 'balanceOf', args: [state.treasury] })
    console.log(`Done. Treasury CELO (Ethereum) balance: ${fmtCelo(bal)}`)
    if (state.status !== 'finalized') saveState({ ...state, status: 'finalized' })
  }
}

/** Unix time when the most recent proof passes proofMaturityDelaySeconds. */
async function proofMaturesAt(l1: Awaited<ReturnType<typeof l1Clients>>['l1'], hash: Hash) {
  const n = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'numProofSubmitters', args: [hash] })
  if (n === 0n) return undefined
  const submitter = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'proofSubmitters', args: [hash, n - 1n] })
  const [[, provenAt], maturity] = await Promise.all([
    l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'provenWithdrawals', args: [hash, submitter] }),
    l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
  ])
  return Number(provenAt + maturity)
}

/** Shows the dispute game behind each proof; a game must resolve (DEFENDER_WINS) before finalize works. */
async function describeProofGames(l1: Awaited<ReturnType<typeof l1Clients>>['l1'], hash: Hash) {
  const n = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'numProofSubmitters', args: [hash] })
  for (let i = 0n; i < n; i++) {
    const submitter = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'proofSubmitters', args: [hash, i] })
    const [game, provenAt] = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'provenWithdrawals', args: [hash, submitter] })
    const [gs, createdAt, resolvedAt, maxChallenge] = await Promise.all([
      l1.readContract({ address: game, abi: gameAbi, functionName: 'status' }),
      l1.readContract({ address: game, abi: gameAbi, functionName: 'createdAt' }),
      l1.readContract({ address: game, abi: gameAbi, functionName: 'resolvedAt' }),
      l1.readContract({ address: game, abi: gameAbi, functionName: 'maxChallengeDuration' }).catch(() => undefined),
    ])
    console.log(
      `  proof by ${submitter} at ${at(Number(provenAt))}: game ${game} ${GAME_STATUS[gs] ?? gs}` +
        (resolvedAt ? `, resolved ${at(Number(resolvedAt))}` : '') +
        (maxChallenge && !resolvedAt ? `, challenge window ends ~${at(Number(createdAt + maxChallenge))}` : ''),
    )
    if (gs === 1) console.log(`  !! Game was lost by the proposer. This proof can never finalize; re-prove.`)
  }
}

async function prove(cycle: string, execute: boolean) {
  const state = loadState(cycle)
  if (!['initiated', 'proven'].includes(state.status))
    throw new OpsError(`Cycle ${cycle} is ${state.status}; nothing to prove.`)
  const { l1 } = await l1Clients()
  const receipt = await l2Receipt(state)
  const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoL2 })
  if (s === 'waiting-to-prove') {
    const t = await l1.getTimeToProve({ receipt, targetChain: celoL2 })
    throw new OpsError(`Not provable yet; try again in ~${Math.ceil(t.seconds / 60)} min.`)
  }
  if (s !== 'ready-to-prove') throw new OpsError(`Status is ${s}; prove is not needed. Run \`status\`.`)

  // Prove against the newest L1 state proposal that covers the withdrawal. (viem's waitToProve picks a
  // random recent one, which can need Celo state hours old — many RPC nodes have pruned that.)
  const game = await l1.getGame({ targetChain: celoL2, l2BlockNumber: receipt.blockNumber, strategy: 'latest' })
  const withdrawal = getWithdrawals(receipt)[0]
  if (!withdrawal || withdrawal.withdrawalHash !== state.withdrawal!.withdrawalHash)
    throw new OpsError('Receipt does not contain the recorded withdrawal. Investigate.')
  const l2 = (await celoClient(envOpt('CELO_ARCHIVE_RPC_URL'))).extend(publicActionsL2())
  const args = await l2.buildProveWithdrawal({ withdrawal, game }).catch((err) => {
    throw new OpsError(
      `Could not build the proof (eth_getProof at Celo block ${game.l2BlockNumber}): ${err?.details ?? err}\n` +
        `The Celo RPC must serve historical state; set CELO_ARCHIVE_RPC_URL to an archive node.`,
    )
  })
  console.log(`Proving ${withdrawal.withdrawalHash} against L1 game #${game.index} (L2 block ${game.l2BlockNumber}).`)
  if (!execute) return console.log('DRY RUN — add --execute to send the Ethereum prove tx.')

  const account = loadAccount('L1_PRIVATE_KEY', 'L1_ADDRESS')
  await assertL1FeesOk(l1)
  const wallet = ethWallet(account).extend(walletActionsL1())
  const hash = await wallet.proveWithdrawal({ ...args, account, targetChain: celoL2 })
  saveState({ ...state, proveTxs: [...(state.proveTxs ?? []), { hash, submitter: account.address, at: new Date().toISOString() }] })
  console.log(`Prove tx sent: ${hash}`)
  const r = await l1.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 15 * 60_000 })
  if (r.status !== 'success') throw new OpsError(`Prove tx ${hash} reverted. Run \`status\` and retry.`)
  saveState({ ...loadState(cycle), status: 'proven' })
  const eta = await proofMaturesAt(l1, withdrawal.withdrawalHash)
  console.log(`Proven. Finalizable from ~${eta ? at(eta) : '7 days from now'} (if its dispute game has resolved and passed the finality delay).`)
  console.log(`Then: npx tsx sweep.ts finalize --cycle ${cycle} --execute`)
}

async function finalize(cycle: string, execute: boolean) {
  const state = loadState(cycle)
  if (state.status === 'finalized') return console.log(`Cycle ${cycle} already finalized (${state.finalizeTxHash ?? 'see status'}).`)
  if (!state.withdrawal) throw new OpsError(`Cycle ${cycle} has no initiated withdrawal.`)
  const { l1 } = await l1Clients()
  const receipt = await l2Receipt(state)
  const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoL2 })
  if (s === 'finalized') {
    saveState({ ...state, status: 'finalized' })
    return console.log('Already finalized on-chain (possibly by a third party). Treasury has been paid.')
  }
  if (s !== 'ready-to-finalize') throw new OpsError(`Status is ${s}; cannot finalize yet. Run \`status\` for the ETA.`)

  // Anyone's valid proof can be used to finalize. Try the most recent first.
  const withdrawal = reviveWithdrawal(state.withdrawal)
  const { withdrawalHash, ...tx } = withdrawal
  const n = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'numProofSubmitters', args: [withdrawalHash] })
  let proofSubmitter: Address | undefined
  for (let i = n - 1n; i >= 0n && !proofSubmitter; i--) {
    const candidate = await l1.readContract({ address: OPTIMISM_PORTAL, abi: portalAbi, functionName: 'proofSubmitters', args: [withdrawalHash, i] })
    const ok = await l1
      .simulateContract({
        address: OPTIMISM_PORTAL,
        abi: portalAbi,
        functionName: 'finalizeWithdrawalTransactionExternalProof',
        args: [tx, candidate],
        account: parseAddress(env('L1_ADDRESS'), 'L1_ADDRESS'),
      })
      .then(() => true)
      .catch(() => false)
    if (ok) proofSubmitter = candidate
  }
  if (!proofSubmitter) throw new OpsError('No proof currently passes finalize simulation. Run `status`.')
  console.log(`Finalizing ${withdrawalHash} using proof from ${proofSubmitter}: ${fmtCelo(withdrawal.value)} -> ${state.treasury}`)
  if (!execute) return console.log('DRY RUN — add --execute to send the Ethereum finalize tx.')

  const account = loadAccount('L1_PRIVATE_KEY', 'L1_ADDRESS')
  await assertL1FeesOk(l1)
  const wallet = ethWallet(account).extend(walletActionsL1())
  const hash = await wallet.finalizeWithdrawal({ withdrawal, proofSubmitter, account, targetChain: celoL2 })
  saveState({ ...state, finalizeTxHash: hash })
  console.log(`Finalize tx sent: ${hash}`)
  const r = await l1.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 15 * 60_000 })
  if (r.status !== 'success') throw new OpsError(`Finalize tx ${hash} reverted. Run \`status\`.`)

  const finalized = parseEventLogs({ abi: portalAbi, eventName: 'WithdrawalFinalized', logs: r.logs }).find(
    (l) => l.args.withdrawalHash === withdrawalHash,
  )
  const paid = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: r.logs }).find(
    (l) =>
      l.address.toLowerCase() === CELO_ON_ETHEREUM.toLowerCase() &&
      l.args.from === OPTIMISM_PORTAL &&
      l.args.to === state.treasury &&
      l.args.value === withdrawal.value,
  )
  if (!finalized?.args.success || !paid)
    throw new OpsError(`Finalize tx ${hash} mined but the expected CELO transfer to the treasury is missing. Investigate.`)
  saveState({ ...loadState(cycle), status: 'finalized', finalizeTxHash: hash, finalizedAt: new Date().toISOString() })
  console.log(`Finalized. Treasury ${state.treasury} received ${fmtCelo(withdrawal.value)} (CELO ERC-20 on Ethereum).`)
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      cycle: { type: 'string' },
      amount: { type: 'string' },
      execute: { type: 'boolean', default: false },
      confirm: { type: 'string' },
      'replace-stuck': { type: 'boolean', default: false },
    },
  })
  const [command] = positionals
  const cycle = values.cycle
  const usage = 'Usage: npx tsx sweep.ts <plan|initiate|status|prove|finalize> --cycle <label> [--execute]'
  if (!command || positionals.length !== 1) throw new OpsError(usage)
  if (!cycle || !/^[A-Za-z0-9._-]{1,64}$/.test(cycle)) throw new OpsError(`--cycle is required (e.g. 2026-09). ${usage}`)
  if (values.amount && command !== 'plan' && command !== 'initiate') throw new OpsError('--amount only applies to plan/initiate.')

  switch (command) {
    case 'plan':
      return planOrInitiate(cycle, { execute: false, amount: values.amount, replaceStuck: false })
    case 'initiate':
      return planOrInitiate(cycle, {
        execute: values.execute!,
        amount: values.amount,
        confirm: values.confirm,
        replaceStuck: values['replace-stuck']!,
      })
    case 'status':
      return status(cycle)
    case 'prove':
      return prove(cycle, values.execute!)
    case 'finalize':
      return finalize(cycle, values.execute!)
    default:
      throw new OpsError(usage)
  }
}

runMain(main)
