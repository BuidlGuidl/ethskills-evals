// Moves CELO from the ops wallet on Celo to the treasury on Ethereum mainnet
// through Celo's canonical L2→L1 withdrawal. That is three transactions over
// ~7 days, not one send:
//
//   1. initiate  (Celo)      ops wallet → L2ToL1MessagePasser, value = CELO amount
//   2. prove     (Ethereum)  once a dispute game covers the L2 block (~30–60 min)
//   3. finalize  (Ethereum)  ≥7 days after prove; portal transfers L1 CELO ERC-20 to treasury
//
//   npx tsx sweep.ts plan                                   # read-only overview
//   npx tsx sweep.ts initiate --amount 1234.5 [--execute --confirm-treasury 0x…]
//   npx tsx sweep.ts initiate --all          [--execute --confirm-treasury 0x…]
//   npx tsx sweep.ts status                                 # read-only, all open sweeps
//   npx tsx sweep.ts advance [--execute]                    # prove / resolve / finalize whatever is due
//
// Steps 2–3 are sent by the RELAYER key (holds only ETH for L1 gas). Neither
// step can redirect funds: the recipient is fixed at step 1.
import {
  type Address,
  type Hash,
  type Hex,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  isAddressEqual,
  parseAbi,
  parseEther,
  parseEventLogs,
} from 'viem'
import { getWithdrawals, publicActionsL1, publicActionsL2 } from 'viem/op-stack'
import {
  CELO_PORTAL_L1,
  CELO_SYSTEM_CONFIG_L1,
  CELO_TOKEN_L1,
  L2_TO_L1_MESSAGE_PASSER,
  PLACEHOLDER_TREASURY,
  type SignedTx,
  acquireLock,
  assertNoPendingTxs,
  broadcast,
  celoClient,
  celoWithL1,
  die,
  envAddress,
  feeCurrencyFor,
  flag,
  fmtDuration,
  fmtTime,
  gasCurrency,
  l1Client,
  loadSigner,
  option,
  readJson,
  reconcile,
  signTx,
  waitMined,
  writeJson,
} from './shared/ops.ts'

const JOURNAL = 'sweeps.json'
/** L1 gas the portal must forward to the treasury call. Data is empty, so this is ample. */
const WITHDRAWAL_MIN_GAS_LIMIT = 100_000n
const L2_TIMEOUT_MS = 120_000
const L1_TIMEOUT_MS = 15 * 60_000

const messagePasserAbi = parseAbi(['function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable'])
const WithdrawalTx = '(uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data)'
const portalAbi = parseAbi([
  `function proveWithdrawalTransaction(${WithdrawalTx} _tx, uint256 _disputeGameIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof)`,
  `function finalizeWithdrawalTransactionExternalProof(${WithdrawalTx} _tx, address _proofSubmitter)`,
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'function finalizedWithdrawals(bytes32) view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function respectedGameType() view returns (uint32)',
  'function paused() view returns (bool)',
])
const gameAbi = parseAbi([
  'function status() view returns (uint8)',
  'function createdAt() view returns (uint64)',
  'function resolvedAt() view returns (uint64)',
  'function maxChallengeDuration() view returns (uint64)',
  'function l2BlockNumber() view returns (uint256)',
  'function resolve() returns (uint8)',
])
const GAME_STATUS = ['IN_PROGRESS', 'CHALLENGER_WINS', 'DEFENDER_WINS'] as const

type Withdrawal = {
  nonce: bigint
  sender: Address
  target: Address
  value: bigint
  gasLimit: bigint
  data: Hex
  withdrawalHash: Hash
}

type Sweep = {
  id: string
  amount: bigint
  treasury: Address
  status: 'initiating' | 'initiated' | 'proving' | 'proven' | 'finalizing' | 'finalized' | 'failed'
  initiate: SignedTx & { blockNumber?: bigint; minedAt?: number }
  // Captured from the initiate receipt and never re-fetched: public Celo RPCs
  // stop serving receipts after a few weeks, and a sweep that sits unproven
  // must still be recoverable.
  withdrawal?: Withdrawal
  prove?: SignedTx & { game?: Address; blockNumber?: bigint; provenAt?: number }
  finalize?: SignedTx & { blockNumber?: bigint; finalizedAt?: number }
  resolve?: SignedTx
  note?: string
}

const l2 = () => celoClient().extend(publicActionsL2())
const l1 = () => l1Client().extend(publicActionsL1())
const load = () => readJson<Sweep[]>(JOURNAL, [])
const save = (s: Sweep[]) => writeJson(JOURNAL, s)
const celo = (wei: bigint) => formatEther(wei)

async function main() {
  const cmd = process.argv[2]
  switch (cmd) {
    case 'plan':
      return plan()
    case 'initiate':
      return initiate()
    case 'status':
      return status()
    case 'advance':
      return advance()
    default:
      die('usage: npx tsx sweep.ts <plan|initiate|status|advance> [options] — see NOTES.md')
  }
}

// ---------------------------------------------------------------------------
// Pre-flight shared by plan and initiate
// ---------------------------------------------------------------------------

async function preflight() {
  const treasury = envAddress('TREASURY_ADDRESS')
  if (isAddressEqual(treasury, PLACEHOLDER_TREASURY) || /^0x0{40}$/i.test(treasury))
    die(`TREASURY_ADDRESS is still the placeholder ${treasury}. Set the real mainnet treasury.`)
  const ops = envAddress('OPS_ADDRESS')
  const relayer = envAddress('RELAYER_ADDRESS')
  const c2 = l2()
  const c1 = l1()

  const [id2, id1] = await Promise.all([c2.getChainId(), c1.getChainId()])
  if (id2 !== 42220) die(`CELO_RPC_URL is chain ${id2}, expected 42220`)
  if (id1 !== 1) die(`ETH_RPC_URL is chain ${id1}, expected Ethereum mainnet (1)`)

  // Confirm the L1 wiring hasn't moved under us since these addresses were pinned.
  const [gasToken, paused, proofDelay, gameFinalityDelay, treasuryCode, relayerEth, opsCelo, l1Fees] =
    await Promise.all([
      c1.readContract({
        address: CELO_SYSTEM_CONFIG_L1,
        abi: parseAbi(['function gasPayingToken() view returns (address, uint8)']),
        functionName: 'gasPayingToken',
      }),
      c1.readContract({ address: CELO_PORTAL_L1, abi: portalAbi, functionName: 'paused' }),
      c1.readContract({ address: CELO_PORTAL_L1, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
      c1.readContract({ address: CELO_PORTAL_L1, abi: portalAbi, functionName: 'disputeGameFinalityDelaySeconds' }),
      c1.getCode({ address: treasury }),
      c1.getBalance({ address: relayer }),
      c2.getBalance({ address: ops }),
      c1.estimateFeesPerGas(),
    ])
  if (!isAddressEqual(gasToken[0], CELO_TOKEN_L1))
    die(`SystemConfig.gasPayingToken is ${gasToken[0]}, expected ${CELO_TOKEN_L1}. Celo's L1 config changed — stop and re-verify.`)

  // If the treasury is a contract (e.g. a Safe), make sure the portal's empty
  // call to it at finalize will not revert.
  if (treasuryCode && treasuryCode !== '0x') {
    await c1
      .call({ account: CELO_PORTAL_L1, to: treasury, data: '0x', gas: WITHDRAWAL_MIN_GAS_LIMIT })
      .catch(() =>
        die(`TREASURY_ADDRESS ${treasury} is a contract that reverts on an empty call; the withdrawal could fail at finalize.`),
      )
  }

  // Rough L1 cost of prove (~360k gas) + finalize (~200k gas) at today's price.
  const l1Cost = 600_000n * l1Fees.maxFeePerGas
  return {
    treasury,
    ops,
    relayer,
    c1,
    c2,
    paused,
    proofDelay: Number(proofDelay),
    gameFinalityDelay: Number(gameFinalityDelay),
    treasuryIsContract: !!treasuryCode && treasuryCode !== '0x',
    relayerEth,
    opsCelo,
    l1Cost,
  }
}

async function plan() {
  const p = await preflight()
  const open = load().filter((s) => s.status !== 'finalized' && s.status !== 'failed')
  console.log('Sweep plan (read-only)')
  console.log(`  ops wallet (Celo)          ${p.ops}`)
  console.log(`  ops CELO balance           ${celo(p.opsCelo)}`)
  console.log(`  treasury (Ethereum)        ${p.treasury}${p.treasuryIsContract ? '  [contract]' : '  [EOA]'}`)
  console.log(`  delivered as               L1 CELO ERC-20 ${CELO_TOKEN_L1}`)
  console.log(`  relayer (Ethereum)         ${p.relayer}  ${formatEther(p.relayerEth)} ETH`)
  console.log(`  est. L1 gas prove+finalize ${formatEther(p.l1Cost)} ETH at current fees`)
  console.log(`  portal paused              ${p.paused}`)
  console.log(`  proofMaturityDelaySeconds  ${p.proofDelay} (${fmtDuration(p.proofDelay)})  — clock starts at PROVE`)
  console.log(`  gameFinalityDelaySeconds   ${p.gameFinalityDelay} (${fmtDuration(p.gameFinalityDelay)})  — after the game resolves`)
  console.log(`  open sweeps                ${open.length}`)
  if (p.relayerEth < p.l1Cost) console.log(`\n  WARNING: relayer ETH is below the estimated L1 cost. Fund it before prove.`)
  if (p.paused) console.log(`\n  WARNING: the Celo portal is PAUSED. Prove/finalize will fail until it is unpaused.`)
}

// ---------------------------------------------------------------------------
// Step 1 — initiate on Celo
// ---------------------------------------------------------------------------

async function initiate() {
  const execute = flag('--execute')
  const gas = gasCurrency()
  const feeCurrency = feeCurrencyFor(gas)
  const p = await preflight()
  if (p.paused) die('Celo portal is paused on L1. Do not initiate until it is unpaused.')

  const amountArg = option('--amount')
  if (!!amountArg === flag('--all')) die('pass exactly one of --amount <CELO> or --all')
  let amount: bigint
  if (amountArg) {
    if (!/^\d+(\.\d{1,18})?$/.test(amountArg)) die(`--amount "${amountArg}" must be a plain decimal CELO amount`)
    amount = parseEther(amountArg)
  } else if (feeCurrency) {
    amount = p.opsCelo // gas is paid in USDC, so the whole CELO balance can go
  } else {
    die('--all requires GAS_CURRENCY=USDC (otherwise the tx needs CELO for its own gas). Use --amount.')
  }
  if (amount <= 0n) die('nothing to sweep: amount is 0')
  if (amount > p.opsCelo) die(`ops wallet holds ${celo(p.opsCelo)} CELO, asked to sweep ${celo(amount)}`)

  const sweeps = load()
  const unsettled = sweeps.find((s) => s.status === 'initiating')
  if (unsettled) die(`sweep ${unsettled.id} is still "initiating" — run \`sweep.ts status\` to settle it first`)

  const data = encodeFunctionData({
    abi: messagePasserAbi,
    functionName: 'initiateWithdrawal',
    args: [p.treasury, WITHDRAWAL_MIN_GAS_LIMIT, '0x'],
  })
  // Simulate now; also gives the gas figure for the summary.
  const gasEst = await p.c2.estimateGas({
    account: p.ops,
    to: L2_TO_L1_MESSAGE_PASSER,
    data,
    value: amount,
    ...(feeCurrency ? { feeCurrency } : {}),
  } as any)

  console.log('Initiate withdrawal Celo → Ethereum')
  console.log(`  amount          ${celo(amount)} CELO`)
  console.log(`  from (Celo)     ${p.ops}`)
  console.log(`  to (Ethereum)   ${p.treasury}  as L1 CELO ERC-20 ${CELO_TOKEN_L1}`)
  console.log(`  L2 gas          ~${gasEst} gas, paid in ${gas}`)
  console.log(`  then            prove in ~30–60 min, finalize ≥${fmtDuration(p.proofDelay)} after prove`)
  if (p.relayerEth < p.l1Cost)
    console.log(`  WARNING         relayer has ${formatEther(p.relayerEth)} ETH, est. need ${formatEther(p.l1Cost)}`)

  if (!execute) {
    console.log(`\nDry run OK. To send: npx tsx sweep.ts initiate ${amountArg ? `--amount ${amountArg}` : '--all'} --execute --confirm-treasury ${p.treasury}`)
    return
  }
  const confirm = option('--confirm-treasury')
  if (!confirm || confirm.toLowerCase() !== p.treasury.toLowerCase())
    die(`--confirm-treasury must repeat TREASURY_ADDRESS (${p.treasury}). This address is irreversible. Nothing was sent.`)

  acquireLock('sweep')
  const account = loadSigner('OPS')
  const nonce = await assertNoPendingTxs(p.c2, p.ops)
  const tx = await signTx(p.c2, account, { to: L2_TO_L1_MESSAGE_PASSER, data, value: amount, feeCurrency }, nonce)
  const sweep: Sweep = {
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    amount,
    treasury: p.treasury,
    status: 'initiating',
    initiate: tx,
  }
  sweeps.push(sweep)
  save(sweeps) // persisted before broadcast
  await broadcast(p.c2, tx)
  const res = await waitMined(p.c2, tx.hash, L2_TIMEOUT_MS)
  if (res.state !== 'mined') die(`${tx.hash} not mined yet. Run \`sweep.ts status\` to settle it — it will not send twice.`)
  await recordInitiate(sweep, res.receipt, p.c2)
  save(sweeps)
  console.log(`\nInitiated sweep ${sweep.id}: ${tx.hash} (Celo block ${res.receipt.blockNumber}).`)
  console.log('Next: `sweep.ts advance --execute` once status says ready-to-prove (usually within the hour).')
}

async function recordInitiate(s: Sweep, receipt: any, c2: ReturnType<typeof l2>) {
  if (receipt.status !== 'success') {
    s.status = 'failed'
    s.note = `initiate reverted in ${receipt.transactionHash}; no CELO left the ops wallet`
    return
  }
  const w = getWithdrawals(receipt)[0]
  if (!w) die(`${receipt.transactionHash} succeeded but emitted no MessagePassed — investigate`)
  // The one irreversible step: make sure the chain recorded what we meant.
  if (!isAddressEqual(w.target, s.treasury) || w.value !== s.amount || !isAddressEqual(w.sender, s.initiate.from))
    die(`withdrawal ${w.withdrawalHash} does not match the sweep (target ${w.target}, value ${w.value}) — investigate`)
  const block = await c2.getBlock({ blockNumber: receipt.blockNumber })
  s.withdrawal = { ...w, data: w.data as Hex }
  s.initiate.blockNumber = receipt.blockNumber
  s.initiate.minedAt = Number(block.timestamp)
  s.status = 'initiated'
}

// ---------------------------------------------------------------------------
// Status and the prove / resolve / finalize driver
// ---------------------------------------------------------------------------

type Phase =
  | 'waiting-to-prove'
  | 'ready-to-prove'
  | 'waiting-to-finalize'
  | 'ready-to-finalize'
  | 'finalized'

async function withdrawalPhase(s: Sweep, c1: ReturnType<typeof l1>): Promise<Phase> {
  const w = s.withdrawal!
  return c1.getWithdrawalStatus({
    targetChain: celoWithL1,
    l2BlockNumber: s.initiate.blockNumber!,
    sender: w.sender,
    withdrawalHash: w.withdrawalHash,
    gameLimit: 500,
  } as any)
}

/** Both finality gates, read live. The later one decides when finalize works. */
async function timeline(s: Sweep, c1: ReturnType<typeof l1>) {
  const [proofDelay, gameDelay] = await Promise.all([
    c1.readContract({ address: CELO_PORTAL_L1, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
    c1.readContract({ address: CELO_PORTAL_L1, abi: portalAbi, functionName: 'disputeGameFinalityDelaySeconds' }),
  ])
  const [game, provenAt] = await c1.readContract({
    address: CELO_PORTAL_L1,
    abi: portalAbi,
    functionName: 'provenWithdrawals',
    args: [s.withdrawal!.withdrawalHash, s.prove?.from ?? envAddress('RELAYER_ADDRESS')],
  })
  if (provenAt === 0n) return undefined
  const [status, createdAt, resolvedAt, maxChallenge] = await Promise.all([
    c1.readContract({ address: game, abi: gameAbi, functionName: 'status' }),
    c1.readContract({ address: game, abi: gameAbi, functionName: 'createdAt' }),
    c1.readContract({ address: game, abi: gameAbi, functionName: 'resolvedAt' }),
    c1.readContract({ address: game, abi: gameAbi, functionName: 'maxChallengeDuration' }).catch(() => 0n),
  ])
  const proofMatureAt = Number(provenAt) + Number(proofDelay)
  // Unresolved: assume it resolves right at its challenge deadline.
  const resolveBy = Number(createdAt) + Number(maxChallenge)
  const gameFinalAt = (resolvedAt > 0n ? Number(resolvedAt) : resolveBy) + Number(gameDelay)
  return {
    game,
    gameStatus: GAME_STATUS[status] ?? `UNKNOWN(${status})`,
    provenAt: Number(provenAt),
    proofMatureAt,
    resolveBy,
    resolvedAt: Number(resolvedAt),
    gameFinalAt,
    finalizeAt: Math.max(proofMatureAt, gameFinalAt),
  }
}

async function settlePending(s: Sweep, c1: ReturnType<typeof l1>, c2: ReturnType<typeof l2>) {
  if (s.status === 'initiating') {
    const r = await reconcile(c2, s.initiate, L2_TIMEOUT_MS)
    if (r.state === 'mined') await recordInitiate(s, r.receipt, c2)
    else if (r.state === 'nonce-consumed-elsewhere')
      die(
        `sweep ${s.id}: initiate ${s.initiate.hash} has no receipt but its nonce is used. Check the ops wallet on celoscan.io.\n` +
          `If the tx is absent, no CELO moved: set this sweep's status to "failed" in ${JOURNAL}.`,
      )
  }
  for (const step of ['prove', 'finalize'] as const) {
    const tx = s[step]
    if (!tx || s.status !== (step === 'prove' ? 'proving' : 'finalizing')) continue
    const r = await reconcile(c1, tx, L1_TIMEOUT_MS)
    if (r.state === 'pending') continue
    if (r.state === 'nonce-consumed-elsewhere') {
      // L1 steps are safe to redo — the portal state is the source of truth.
      s.status = step === 'prove' ? 'initiated' : 'proven'
      s.note = `${step} tx ${tx.hash} was dropped; will be re-sent`
      continue
    }
    if (r.receipt.status !== 'success') {
      s.status = step === 'prove' ? 'initiated' : 'proven'
      s.note = `${step} tx ${tx.hash} reverted; will re-check portal state`
      continue
    }
    tx.blockNumber = r.receipt.blockNumber
    if (step === 'prove') {
      s.status = 'proven'
      s.prove!.provenAt = Number((await c1.getBlock({ blockNumber: r.receipt.blockNumber })).timestamp)
    } else {
      assertDelivered(s, r.receipt)
      s.status = 'finalized'
      s.finalize!.finalizedAt = Number((await c1.getBlock({ blockNumber: r.receipt.blockNumber })).timestamp)
    }
  }
}

/** Finalize must show the portal moving exactly `amount` L1 CELO to the treasury. */
function assertDelivered(s: Sweep, receipt: { logs: any[]; transactionHash: Hash }) {
  const ok = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).some(
    (l) =>
      isAddressEqual(l.address, CELO_TOKEN_L1) &&
      isAddressEqual(l.args.from, CELO_PORTAL_L1) &&
      isAddressEqual(l.args.to, s.treasury) &&
      l.args.value === s.amount,
  )
  if (!ok)
    die(`finalize ${receipt.transactionHash} succeeded but has no CELO Transfer portal → treasury of ${celo(s.amount)}. Investigate.`)
}

async function status() {
  const sweeps = load()
  if (sweeps.length === 0) return console.log('No sweeps in the journal.')
  const c1 = l1()
  const c2 = l2()
  const now = Math.floor(Date.now() / 1000)
  for (const s of sweeps) {
    await settlePending(s, c1, c2)
    save(sweeps)
    console.log(`\nSweep ${s.id}  ${celo(s.amount)} CELO → ${s.treasury}`)
    console.log(`  journal state   ${s.status}${s.note ? `  (${s.note})` : ''}`)
    console.log(`  initiate        ${s.initiate.hash}${s.initiate.minedAt ? `  at ${fmtTime(s.initiate.minedAt)}` : ''}`)
    if (!s.withdrawal || s.status === 'failed') continue
    const phase = await withdrawalPhase(s, c1)
    console.log(`  portal says     ${phase}`)
    if (s.prove) console.log(`  prove tx        ${s.prove.hash}`)
    if (s.finalize) console.log(`  finalize tx     ${s.finalize.hash}`)
    if (phase === 'waiting-to-prove') {
      const t = await c1
        .getTimeToNextGame({ targetChain: celoWithL1, l2BlockNumber: s.initiate.blockNumber! })
        .catch(() => undefined)
      console.log(`  provable in     ${t ? `~${fmtDuration(t.seconds)}` : 'next dispute game (~30–60 min)'}`)
    }
    const t = phase === 'waiting-to-finalize' || phase === 'ready-to-finalize' ? await timeline(s, c1) : undefined
    if (t) {
      console.log(`  proven          ${fmtTime(t.provenAt)}; proof matures ${fmtTime(t.proofMatureAt)}`)
      console.log(
        `  dispute game    ${t.game} ${t.gameStatus}` +
          (t.resolvedAt ? `, resolved ${fmtTime(t.resolvedAt)}` : `, resolvable after ${fmtTime(t.resolveBy)}`) +
          `; final ${fmtTime(t.gameFinalAt)}`,
      )
      console.log(`  finalizable     ${fmtTime(t.finalizeAt)}  (in ${fmtDuration(t.finalizeAt - now)})`)
      if (!t.resolvedAt && now > t.resolveBy)
        console.log('  NOTE            game is past its deadline but unresolved — `advance --execute` will try resolve()')
    }
  }
}

async function advance() {
  const execute = flag('--execute')
  if (execute) acquireLock('sweep')
  const sweeps = load()
  const c1 = l1()
  const c2 = l2()
  const relayerAddr = envAddress('RELAYER_ADDRESS')
  const relayer = execute ? loadSigner('RELAYER') : undefined
  let nonce = execute ? await assertNoPendingTxs(c1, relayerAddr) : 0
  const paused = await c1.readContract({ address: CELO_PORTAL_L1, abi: portalAbi, functionName: 'paused' })
  if (paused) die('Celo portal is paused on L1; prove/finalize cannot proceed. Nothing sent.')
  const now = Math.floor(Date.now() / 1000)

  const send = async (label: string, to: Address, data: Hex): Promise<SignedTx | undefined> => {
    if (!execute || !relayer) {
      console.log(`  [dry run] would ${label}`)
      return undefined
    }
    return signTx(c1, relayer, { to, data }, nonce)
  }
  const finish = async (s: Sweep, tx: SignedTx) => {
    save(sweeps) // persisted before broadcast
    await broadcast(c1, tx)
    nonce++
    await settlePending(s, c1, c2)
    save(sweeps)
  }

  for (const s of sweeps) {
    if (s.status === 'finalized' || s.status === 'failed') continue
    await settlePending(s, c1, c2)
    save(sweeps)
    if (!s.withdrawal || s.status === 'initiating' || s.status === 'proving' || s.status === 'finalizing') {
      console.log(`sweep ${s.id}: ${s.status}, waiting on a pending tx — run again later`)
      continue
    }
    const phase = await withdrawalPhase(s, c1)
    const w = s.withdrawal
    const wTuple = { nonce: w.nonce, sender: w.sender, target: w.target, value: w.value, gasLimit: w.gasLimit, data: w.data }
    console.log(`sweep ${s.id} (${celo(s.amount)} CELO): ${phase}`)

    if (phase === 'finalized') {
      // Finalized by someone else, or our receipt was lost; the portal is authoritative.
      s.status = 'finalized'
      s.note ??= 'portal reports finalized'
      save(sweeps)
      continue
    }

    if (phase === 'ready-to-prove') {
      const game = await c1.getGame({ targetChain: celoWithL1, l2BlockNumber: s.initiate.blockNumber!, limit: 500 })
      const args = await c2.buildProveWithdrawal({ account: relayerAddr, game, withdrawal: w } as any)
      const data = encodeFunctionData({
        abi: portalAbi,
        functionName: 'proveWithdrawalTransaction',
        args: [wTuple, args.l2OutputIndex, args.outputRootProof, args.withdrawalProof],
      })
      const tx = await send(`prove against game #${game.index} (L2 block ${game.l2BlockNumber})`, CELO_PORTAL_L1, data)
      if (!tx) continue
      s.prove = { ...tx }
      s.status = 'proving'
      await finish(s, tx)
      console.log(`  proved: ${tx.hash}. Finalize opens ≥7 days from now — \`sweep.ts status\` shows the exact time.`)
      continue
    }

    if (phase === 'waiting-to-finalize') {
      const t = await timeline(s, c1)
      if (t && !t.resolvedAt && now > t.resolveBy && t.gameStatus === 'IN_PROGRESS') {
        // Resolution is permissionless; don't let an idle proposer hold up the close.
        const data = encodeFunctionData({ abi: gameAbi, functionName: 'resolve' })
        const ok = await c1.call({ account: relayerAddr, to: t.game, data }).then(() => true, () => false)
        if (ok) {
          const tx = await send(`resolve() dispute game ${t.game}`, t.game, data)
          if (tx) {
            s.resolve = tx
            save(sweeps)
            await broadcast(c1, tx)
            nonce++
            await waitMined(c1, tx.hash, L1_TIMEOUT_MS)
            console.log(`  resolved game: ${tx.hash}`)
          }
        } else console.log('  game past deadline but resolve() would revert (parent game unresolved?) — retry later')
      }
      if (t) console.log(`  finalizable at ${fmtTime(t.finalizeAt)} (in ${fmtDuration(t.finalizeAt - now)})`)
      continue
    }

    if (phase === 'ready-to-finalize') {
      const prover = s.prove?.from ?? relayerAddr
      const data = encodeFunctionData({
        abi: portalAbi,
        functionName: 'finalizeWithdrawalTransactionExternalProof',
        args: [wTuple, prover],
      })
      const tx = await send(`finalize → ${celo(s.amount)} L1 CELO to ${s.treasury}`, CELO_PORTAL_L1, data)
      if (!tx) continue
      s.finalize = { ...tx }
      s.status = 'finalizing'
      await finish(s, tx)
      if ((s.status as Sweep['status']) === 'finalized') console.log(`  FINALIZED: ${tx.hash}. ${celo(s.amount)} CELO delivered to ${s.treasury}.`)
      continue
    }
  }
}

main().catch((e) => die(process.env.DEBUG ? String((e as Error).stack ?? e) : (e as any).shortMessage ?? (e as Error).stack ?? String(e)))
