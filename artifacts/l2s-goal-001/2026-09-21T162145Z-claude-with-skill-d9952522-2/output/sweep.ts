/**
 * sweep.ts — move the cycle's CELO revenue from the ops wallet on Celo to the Ethereum
 * mainnet treasury through Celo's canonical L2→L1 withdrawal (OP Stack OptimismPortal).
 *
 * THIS IS NOT ONE TRANSACTION. It is three, on two chains, spread over ~7 days:
 *   1. initiate  (Celo)     burns CELO on L2 via L2ToL1MessagePasser; value leaves the ops wallet now
 *   2. prove     (Ethereum) once a dispute game covering that L2 block is posted (~tens of minutes)
 *   3. finalize  (Ethereum) once the proof is > proofMaturityDelaySeconds old (7 days, read live)
 *                           AND the game's claim is valid (resolved + finality delay)
 * Nothing lands in the treasury until step 3, and steps 2 and 3 only happen if someone runs
 * `advance`. The treasury receives CELO as the L1 ERC-20 (0x0578…b19f), transferred by the portal.
 *
 * Commands (all dry-run unless --execute):
 *   npx tsx sweep.ts plan     --cycle 2026-09 --reserve 25        # read-only preview + timeline
 *   npx tsx sweep.ts initiate --cycle 2026-09 --reserve 25 --execute
 *   npx tsx sweep.ts advance  --cycle 2026-09 --execute           # proves / finalizes when ready; safe to cron
 *   npx tsx sweep.ts status   --cycle 2026-09
 *
 * Env: CELO_RPC_URL, ETH_RPC_URL, OPS_PRIVATE_KEY (initiate), L1_RELAYER_PRIVATE_KEY (prove/finalize),
 *      TREASURY_ADDRESS. See NOTES.md.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseEther,
  parseEventLogs,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'

// ---------------------------------------------------------------------------
// Celo mainnet L1 contracts — from ethereum-optimism/superchain-registry
// (superchain/configs/mainnet/celo.toml). Cross-checked against each other on-chain at startup.
// ---------------------------------------------------------------------------
const OPTIMISM_PORTAL: Address = '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC'
const DISPUTE_GAME_FACTORY: Address = '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683'
const SYSTEM_CONFIG: Address = '0x89E31965D844a309231B1f17759Ccaf1b7c09861'
// CELO on Ethereum: what the treasury actually receives. Must equal SystemConfig.gasPayingToken().
const L1_CELO: Address = '0x057898f3C43F129a17517B9056D23851F124b19f'
const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'
const PLACEHOLDER_TREASURY: Address = '0x1111111111111111111111111111111111111111'

// Gas limit carried in the withdrawal for the L1 call to the target. With empty calldata the
// Celo portal only does an ERC-20 transfer and makes no call, so this is headroom, not cost.
const WITHDRAWAL_L1_GAS_LIMIT = 100_000n

// viem's built-in `celo` chain has no L1 contract addresses; the op-stack actions need them.
const celoL2 = defineChain({
  ...celo,
  sourceId: mainnet.id,
  contracts: {
    ...celo.contracts,
    portal: { [mainnet.id]: { address: OPTIMISM_PORTAL } },
    disputeGameFactory: { [mainnet.id]: { address: DISPUTE_GAME_FACTORY } },
  },
})

const portalAbi = parseAbi([
  'function paused() view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function respectedGameType() view returns (uint32)',
  'function disputeGameFactory() view returns (address)',
  'function systemConfig() view returns (address)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
])
const dgfAbi = parseAbi([
  'function gameCount() view returns (uint256)',
  'function gameAtIndex(uint256) view returns (uint32 gameType, uint64 timestamp, address proxy)',
  'function gameImpls(uint32) view returns (address)',
])
const l2ToL1Abi = parseAbi(['function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable'])

// ---------------------------------------------------------------------------
// CLI / env
// ---------------------------------------------------------------------------
const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cycle: { type: 'string' },
    amount: { type: 'string' }, // exact CELO to sweep
    reserve: { type: 'string' }, // or: sweep everything above this CELO balance
    'state-dir': { type: 'string', default: 'state/sweeps' },
    execute: { type: 'boolean', default: false },
  },
  strict: true,
})
const command = positionals[0]

function die(msg: string): never {
  console.error(`\nABORT: ${msg}`)
  process.exit(1)
}
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) die(`${name} is not set`)
  return v
}
const fmtDur = (s: number) => {
  if (s <= 0) return 'now'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.ceil((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ')
}
const fmtTs = (unix: number) => new Date(unix * 1000).toISOString().replace('.000', '')
const nowSec = () => Math.floor(Date.now() / 1000)

function treasuryFromEnv(): Address {
  const t = requireEnv('TREASURY_ADDRESS')
  if (!isAddress(t, { strict: true })) die(`TREASURY_ADDRESS "${t}" is not a valid (checksummed) address`)
  const a = getAddress(t)
  if (isAddressEqual(a, PLACEHOLDER_TREASURY)) die('TREASURY_ADDRESS is still the 0x1111… placeholder')
  if (isAddressEqual(a, zeroAddress)) die('TREASURY_ADDRESS is the zero address')
  // The portal rejects these targets at finalize. The CELO would already be burned on L2 and
  // could never be released — so refuse up front.
  if (isAddressEqual(a, L1_CELO) || isAddressEqual(a, OPTIMISM_PORTAL))
    die('TREASURY_ADDRESS is the CELO token or the portal; the withdrawal could never be finalized')
  return a
}

// ---------------------------------------------------------------------------
// Per-cycle state file. Written (and fsync'd) before every broadcast.
// ---------------------------------------------------------------------------
type SweepState = {
  cycle: string
  treasury: Address
  sender: Address
  amountWei: string
  l2: { hash: Hash; nonce: number; raw?: Hex; block?: string; at: string }
  withdrawalHash?: Hash
  prove?: { hash: Hash; submitter: Address; at: string; confirmed?: boolean }
  finalize?: { hash: Hash; at: string; confirmed?: boolean }
}

function statePath(): string {
  if (!args.cycle || !/^[A-Za-z0-9._-]{1,64}$/.test(args.cycle)) die('--cycle <id> is required (e.g. 2026-09)')
  return `${args['state-dir']}/${args.cycle}.json`
}
function loadState(): SweepState | undefined {
  const p = statePath()
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as SweepState) : undefined
}
function saveState(s: SweepState) {
  const p = statePath()
  mkdirSync(args['state-dir']!, { recursive: true })
  const tmp = `${p}.tmp`
  const fd = openSync(tmp, 'w')
  writeSync(fd, JSON.stringify(s, null, 2) + '\n')
  fsyncSync(fd)
  closeSync(fd)
  renameSync(tmp, p)
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const l2Public = createPublicClient({
  chain: celoL2,
  transport: http(requireEnv('CELO_RPC_URL'), { retryCount: 3, timeout: 20_000 }),
}).extend(publicActionsL2())
const l1Transport = http(requireEnv('ETH_RPC_URL'), { retryCount: 3, timeout: 30_000 })
const l1Public = createPublicClient({ chain: mainnet, transport: l1Transport }).extend(publicActionsL1())

function l1Wallet() {
  const account = privateKeyToAccount(requireEnv('L1_RELAYER_PRIVATE_KEY') as Hex)
  return createWalletClient({ chain: mainnet, transport: l1Transport, account }).extend(walletActionsL1())
}

// ---------------------------------------------------------------------------
// Preflight: confirm the RPCs and every pinned address agree with each other on-chain.
// ---------------------------------------------------------------------------
async function preflight() {
  const [l1Id, l2Id] = await Promise.all([l1Public.getChainId(), l2Public.getChainId()])
  if (l1Id !== mainnet.id) die(`ETH_RPC_URL is chain ${l1Id}, expected 1`)
  if (l2Id !== celo.id) die(`CELO_RPC_URL is chain ${l2Id}, expected ${celo.id}`)

  const read = <T>(address: Address, abi: any, functionName: string, args: any[] = []) =>
    l1Public.readContract({ address, abi, functionName, args }) as Promise<T>
  const [dgf, sysCfg, paused, maturity, finalityDelay, gameType, gasToken] = await Promise.all([
    read<Address>(OPTIMISM_PORTAL, portalAbi, 'disputeGameFactory'),
    read<Address>(OPTIMISM_PORTAL, portalAbi, 'systemConfig'),
    read<boolean>(OPTIMISM_PORTAL, portalAbi, 'paused'),
    read<bigint>(OPTIMISM_PORTAL, portalAbi, 'proofMaturityDelaySeconds'),
    read<bigint>(OPTIMISM_PORTAL, portalAbi, 'disputeGameFinalityDelaySeconds'),
    read<number>(OPTIMISM_PORTAL, portalAbi, 'respectedGameType'),
    read<readonly [Address, number]>(SYSTEM_CONFIG, parseAbi(['function gasPayingToken() view returns (address, uint8)']), 'gasPayingToken'),
  ])
  if (!isAddressEqual(dgf, DISPUTE_GAME_FACTORY)) die(`portal points at DisputeGameFactory ${dgf}, expected ${DISPUTE_GAME_FACTORY}`)
  if (!isAddressEqual(sysCfg, SYSTEM_CONFIG)) die(`portal points at SystemConfig ${sysCfg}, expected ${SYSTEM_CONFIG}`)
  if (!isAddressEqual(gasToken[0], L1_CELO)) die(`Celo gas-paying token on L1 is ${gasToken[0]}, expected ${L1_CELO}`)

  const impl = await read<Address>(DISPUTE_GAME_FACTORY, dgfAbi, 'gameImpls', [gameType])
  const maxChallenge = await read<bigint>(impl, parseAbi(['function maxChallengeDuration() view returns (uint64)']), 'maxChallengeDuration').catch(() => undefined)
  const count = await read<bigint>(DISPUTE_GAME_FACTORY, dgfAbi, 'gameCount')
  const recent: bigint[] = []
  for (let i = count - 1n; i >= 0n && recent.length < 6; i--) {
    const [t, ts] = await read<readonly [number, bigint, Address]>(DISPUTE_GAME_FACTORY, dgfAbi, 'gameAtIndex', [i])
    if (t === gameType) recent.push(ts)
  }
  const gaps = recent.slice(0, -1).map((t, i) => Number(t - recent[i + 1]))
  const avgGameGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : undefined

  return { paused, maturity: Number(maturity), finalityDelay: Number(finalityDelay), gameType, maxChallenge, lastGameAt: Number(recent[0] ?? 0n), avgGameGap }
}

function printGates(g: Awaited<ReturnType<typeof preflight>>) {
  console.log(`Portal ${OPTIMISM_PORTAL}  paused=${g.paused}
  proofMaturityDelaySeconds        ${g.maturity} (${fmtDur(g.maturity)}) — counted from YOUR prove tx
  disputeGameFinalityDelaySeconds  ${g.finalityDelay} (${fmtDur(g.finalityDelay)}) — after the game resolves
  respected game type              ${g.gameType}${g.maxChallenge !== undefined ? `, maxChallengeDuration ${g.maxChallenge} (${fmtDur(Number(g.maxChallenge))})` : ''}
  latest game posted               ${g.lastGameAt ? fmtTs(g.lastGameAt) : 'n/a'}${g.avgGameGap ? `, recent cadence ~${fmtDur(g.avgGameGap)}` : ''}`)
  if (g.paused) console.log('  !! PORTAL IS PAUSED — proving and finalizing are blocked until the Celo guardian unpauses.')
}

// ---------------------------------------------------------------------------
// plan / initiate
// ---------------------------------------------------------------------------
async function sweepAmount(sender: Address): Promise<{ balance: bigint; amount: bigint }> {
  const balance = await l2Public.getBalance({ address: sender })
  if (!!args.amount === !!args.reserve) die('pass exactly one of --amount <CELO> or --reserve <CELO to leave on the ops wallet>')
  let amount: bigint
  if (args.amount) {
    amount = parseEther(args.amount)
  } else {
    // Keep the reserve plus a fixed cushion for this tx's own gas; the ops wallet pays payout gas in CELO.
    amount = balance - parseEther(args.reserve!) - parseEther('0.1')
  }
  if (amount <= 0n) die(`nothing to sweep: balance ${formatEther(balance)} CELO`)
  if (amount > balance) die(`amount ${formatEther(amount)} exceeds balance ${formatEther(balance)} CELO`)
  return { balance, amount }
}

async function planOrInitiate(execute: boolean) {
  const ops = privateKeyToAccount(requireEnv('OPS_PRIVATE_KEY') as Hex)
  const treasury = treasuryFromEnv()
  const existing = loadState()
  if (existing)
    die(`cycle ${existing.cycle} already has a sweep (${existing.l2.hash}). Use \`advance\`/\`status\`; use a new --cycle for a new sweep.`)

  const gates = await preflight()
  const { balance, amount } = await sweepAmount(ops.address)
  const [treasuryCode, l1Gas] = await Promise.all([l1Public.getCode({ address: treasury }), l1Public.getGasPrice()])

  // Rough L1 gas for prove (~350-500k; Merkle proof) and finalize (~150-200k). Real cost is estimated at send time.
  const l1CostWei = (500_000n + 200_000n) * l1Gas
  const gameWait = gates.avgGameGap ?? 3600
  const eta = nowSec() + gameWait + gates.maturity + 3600

  console.log(`
Ops wallet (L2 sender)   ${ops.address}
Treasury (L1 receiver)   ${treasury}  ${describeTreasury(treasuryCode)}
Ops CELO balance         ${formatEther(balance)}
Sweep amount             ${formatEther(amount)} CELO
Left on ops wallet       ${formatEther(balance - amount)} CELO
Treasury receives        ${formatEther(amount)} CELO as ERC-20 ${L1_CELO} on Ethereum
L1 relayer gas (approx)  ~${formatEther(l1CostWei)} ETH for prove + finalize at current ${Number(l1Gas) / 1e9} gwei
`)
  printGates(gates)
  console.log(`
Expected timeline if \`advance\` is run promptly at each step:
  T0              initiate on Celo (seconds)
  T0 + ~${fmtDur(gameWait)}     next dispute game covers the block → prove on Ethereum
  prove + >${fmtDur(gates.maturity)}   finalize on Ethereum → CELO in treasury
  ≈ ${fmtTs(eta)} if initiated now (earliest; every late \`advance\` run adds its delay)
`)

  const sim = await l2Public.simulateContract({
    account: ops,
    address: L2_TO_L1_MESSAGE_PASSER,
    abi: l2ToL1Abi,
    functionName: 'initiateWithdrawal',
    args: [treasury, WITHDRAWAL_L1_GAS_LIMIT, '0x'],
    value: amount,
  }).catch((e) => die(`simulation of initiateWithdrawal failed: ${e.shortMessage ?? e.message}`))
  void sim
  console.log('Simulated initiateWithdrawal on Celo: OK.')

  if (!execute) {
    console.log('\nDRY RUN — nothing signed or broadcast.')
    return
  }
  if (gates.paused) die('portal is paused; not initiating (funds would leave L2 with no way to prove until unpaused)')

  const wallet = createWalletClient({ chain: celoL2, transport: http(requireEnv('CELO_RPC_URL')), account: ops })
  const nonce = await l2Public.getTransactionCount({ address: ops.address, blockTag: 'pending' })
  const request = await wallet.prepareTransactionRequest({
    to: L2_TO_L1_MESSAGE_PASSER,
    data: encodeFunctionData({ abi: l2ToL1Abi, functionName: 'initiateWithdrawal', args: [treasury, WITHDRAWAL_L1_GAS_LIMIT, '0x'] }),
    value: amount,
    nonce,
  })
  const raw = await wallet.signTransaction(request as any)
  const hash = keccak256(raw)

  // Persist before broadcast so a crash can never lead to a second, duplicate sweep.
  const state: SweepState = {
    cycle: args.cycle!,
    treasury,
    sender: ops.address,
    amountWei: amount.toString(),
    l2: { hash, nonce, raw, at: new Date().toISOString() },
  }
  saveState(state)
  await l2Public.sendRawTransaction({ serializedTransaction: raw })
  console.log(`Initiated on Celo: ${hash}\nState: ${statePath()}\nWaiting for receipt…`)
  await l2Receipt(state)
  console.log(`\nNext: run \`npx tsx sweep.ts advance --cycle ${state.cycle} --execute\` (cron it hourly). It proves when a game is posted.`)
}

function describeTreasury(code: Hex | undefined): string {
  if (!code || code === '0x') return '(EOA)'
  if (code.startsWith('0xef0100')) return `(EOA with EIP-7702 delegation to 0x${code.slice(8)} — confirm this is expected)`
  return '(contract — receives a plain ERC-20 transfer; no call is made)'
}

// Returns the L2 receipt, rebroadcasting the identical signed tx if a crash left it unsent.
async function l2Receipt(state: SweepState): Promise<TransactionReceipt> {
  let receipt = await l2Public.getTransactionReceipt({ hash: state.l2.hash }).catch(() => null)
  if (!receipt) {
    const mined = await l2Public.getTransactionCount({ address: state.sender, blockTag: 'latest' })
    if (mined > state.l2.nonce) die(`nonce ${state.l2.nonce} was used by a different tx; withdrawal ${state.l2.hash} never landed. Manual review.`)
    if (!state.l2.raw) die('no raw tx stored to rebroadcast')
    await l2Public.sendRawTransaction({ serializedTransaction: state.l2.raw }).catch((err) => {
      if (!/already known|nonce too low/i.test(String(err?.details ?? err?.message))) throw err
    })
    receipt = await l2Public.waitForTransactionReceipt({ hash: state.l2.hash, timeout: 120_000 })
  }
  if (receipt.status !== 'success') die(`L2 withdrawal tx ${state.l2.hash} reverted; no CELO left the wallet. Delete ${statePath()} and re-plan.`)
  if (!state.withdrawalHash) {
    const [w] = getWithdrawals(receipt)
    if (!w || !isAddressEqual(w.target, state.treasury) || w.value !== BigInt(state.amountWei))
      die(`MessagePassed event in ${state.l2.hash} does not match the state file (target/value). Stop and investigate.`)
    state.withdrawalHash = w.withdrawalHash
    state.l2 = { ...state.l2, raw: undefined, block: receipt.blockNumber.toString() }
    saveState(state)
    console.log(`L2 withdrawal confirmed in Celo block ${receipt.blockNumber}; withdrawal hash ${w.withdrawalHash}`)
  }
  return receipt
}

// ---------------------------------------------------------------------------
// status / advance
// ---------------------------------------------------------------------------
async function advance(execute: boolean) {
  const state = loadState() ?? die(`no sweep state for cycle ${args.cycle} at ${statePath()}`)
  if (process.env.TREASURY_ADDRESS && !isAddressEqual(getAddress(process.env.TREASURY_ADDRESS), state.treasury))
    console.warn(`WARNING: TREASURY_ADDRESS env differs from this sweep's recorded target ${state.treasury}. The recorded target is immutable.`)

  const gates = await preflight()
  const receipt = await l2Receipt(state)
  const [withdrawal] = getWithdrawals(receipt)
  const status = await l1Public.getWithdrawalStatus({ receipt, targetChain: celoL2 })

  console.log(`
Cycle ${state.cycle}: ${formatEther(BigInt(state.amountWei))} CELO → ${state.treasury}
  L2 tx          ${state.l2.hash} (block ${state.l2.block})
  withdrawal     ${state.withdrawalHash}
  prove tx       ${state.prove?.hash ?? '-'}
  finalize tx    ${state.finalize?.hash ?? '-'}
  STATUS         ${status}
`)
  printGates(gates)
  if (gates.paused && status !== 'finalized') return console.log('\nPortal paused — nothing to do until it is unpaused.')

  switch (status) {
    case 'waiting-to-prove': {
      const t = await l1Public.getTimeToProve({ receipt, targetChain: celoL2 })
      console.log(`\nNo dispute game covers L2 block ${receipt.blockNumber} yet. Estimated ${fmtDur(t.seconds)} (≈ ${fmtTs(nowSec() + t.seconds)}). Re-run advance then.`)
      return
    }

    case 'ready-to-prove': {
      if (state.prove?.confirmed)
        console.log('\nNOTE: this withdrawal was proven before but must be proven again (game invalidated, challenged, or retired). The 7-day clock restarts.')
      const { game } = await l1Public.waitToProve({ receipt, targetChain: celoL2 })
      const proveArgs = await l2Public.buildProveWithdrawal({ game, withdrawal })
      if (!execute) return console.log(`\nDRY RUN — ready to prove against game #${game.index}. Re-run with --execute.`)
      const wallet = l1Wallet()
      const hash = await wallet.proveWithdrawal({ ...proveArgs, account: wallet.account, chain: mainnet } as any)
      state.prove = { hash, submitter: wallet.account.address, at: new Date().toISOString() }
      saveState(state)
      console.log(`Prove tx sent: ${hash}`)
      const r = await l1Public.waitForTransactionReceipt({ hash, timeout: 600_000 })
      if (r.status !== 'success') die(`prove tx ${hash} reverted`)
      state.prove.confirmed = true
      saveState(state)
      const matures = await proofMaturesAt(state, gates.maturity)
      console.log(`Proven in L1 block ${r.blockNumber}. Earliest finalize ≈ ${fmtTs(matures)} (${fmtDur(matures - nowSec())}).`)
      return
    }

    case 'waiting-to-finalize': {
      const matures = await proofMaturesAt(state, gates.maturity)
      console.log(
        matures > nowSec()
          ? `\nProof maturing: ${fmtDur(matures - nowSec())} left (≈ ${fmtTs(matures)}).`
          : '\nProof is mature but the dispute game has not resolved/finalized yet. Re-run later.',
      )
      return
    }

    case 'ready-to-finalize': {
      const submitter = state.prove?.submitter
      if (!execute) return console.log('\nDRY RUN — ready to finalize. Re-run with --execute.')
      const wallet = l1Wallet()
      // Pass the recorded proof submitter so any funded relayer key can finalize, not only the prover.
      const hash = await wallet.finalizeWithdrawal({
        targetChain: celoL2,
        withdrawal,
        ...(submitter ? { proofSubmitter: submitter } : {}),
        account: wallet.account,
        chain: mainnet,
      } as any)
      state.finalize = { hash, at: new Date().toISOString() }
      saveState(state)
      console.log(`Finalize tx sent: ${hash}`)
      const r = await l1Public.waitForTransactionReceipt({ hash, timeout: 600_000 })
      if (r.status !== 'success') die(`finalize tx ${hash} reverted`)
      verifyDelivery(state, r)
      state.finalize.confirmed = true
      saveState(state)
      return
    }

    case 'finalized':
      console.log(`\nFinalized. ${formatEther(BigInt(state.amountWei))} CELO delivered to ${state.treasury}.`)
      if (state.finalize?.hash) verifyDelivery(state, await l1Public.getTransactionReceipt({ hash: state.finalize.hash }))
      return
  }
}

// The portal's check is strict (> maturity), counted from the recorded submitter's prove timestamp.
async function proofMaturesAt(state: SweepState, maturity: number): Promise<number> {
  if (!state.prove?.submitter || !state.withdrawalHash) die('no recorded proof submitter; was this proven outside sweep.ts?')
  const [, provenAt] = await l1Public.readContract({
    address: OPTIMISM_PORTAL,
    abi: portalAbi,
    functionName: 'provenWithdrawals',
    args: [state.withdrawalHash, state.prove.submitter],
  })
  return Number(provenAt) + maturity + 1
}

// The finalize receipt must show the portal reporting success AND the exact CELO transfer to the treasury.
function verifyDelivery(state: SweepState, r: TransactionReceipt) {
  const fin = parseEventLogs({ abi: portalAbi, logs: r.logs, eventName: 'WithdrawalFinalized' })
    .find((l) => l.args.withdrawalHash === state.withdrawalHash)
  const xfer = parseEventLogs({ abi: erc20Abi, logs: r.logs, eventName: 'Transfer' }).find(
    (l) => isAddressEqual(l.address, L1_CELO) && isAddressEqual(l.args.from, OPTIMISM_PORTAL) && isAddressEqual(l.args.to, state.treasury),
  )
  if (!fin?.args.success) die(`finalize ${r.transactionHash}: WithdrawalFinalized missing or success=false`)
  if (!xfer || xfer.args.value !== BigInt(state.amountWei))
    die(`finalize ${r.transactionHash}: expected CELO transfer of ${state.amountWei} wei to ${state.treasury} not found`)
  console.log(`Verified: ${formatEther(xfer.args.value)} CELO (ERC-20 ${L1_CELO}) transferred to ${state.treasury} in L1 block ${r.blockNumber}.`)
}

// ---------------------------------------------------------------------------
switch (command) {
  case 'plan':
    await planOrInitiate(false)
    break
  case 'initiate':
    await planOrInitiate(args.execute!)
    break
  case 'advance':
    await advance(args.execute!)
    break
  case 'status':
    await advance(false)
    break
  default:
    die('usage: sweep.ts <plan|initiate|advance|status> --cycle <id> [--amount X | --reserve Y] [--execute]')
}
