/**
 * sweep.ts — move the cycle's CELO revenue from the Celo ops wallet to the Ethereum
 * mainnet treasury, over Celo's canonical L2→L1 withdrawal.
 *
 * Celo is an OP Stack L2 whose gas token (CELO) is a plain ERC-20 on Ethereum, locked in
 * Celo's OptimismPortal. A withdrawal is three transactions on two chains, run days apart:
 *
 *   1. initiate  (Celo)      burn native CELO in L2ToL1MessagePasser, target = treasury
 *   2. prove     (Ethereum)  once a dispute game covering that L2 block is posted (~30-60 min)
 *   3. finalize  (Ethereum)  once the 7-day proof maturity delay has passed since *prove*;
 *                            the portal then transfers CELO (ERC-20) to the treasury
 *
 * Nothing happens by itself between steps. Someone has to run prove, and a week later
 * finalize. `status` tells you which step is due and when.
 *
 *   npx tsx sweep.ts preflight
 *   npx tsx sweep.ts initiate --cycle <label> --amount <CELO> [--execute]
 *   npx tsx sweep.ts initiate --cycle <label> --all-above-reserve [--execute]
 *   npx tsx sweep.ts status   [<l2TxHash>]        # no hash: every sweep in ./sweeps
 *   npx tsx sweep.ts prove    <l2TxHash> [--execute]
 *   npx tsx sweep.ts finalize <l2TxHash> [--execute]
 *
 * Env:
 *   CELO_RPC_URL       Celo RPC (default forno.celo.org — use a dedicated provider in prod)
 *   ETH_RPC_URL        Ethereum mainnet RPC (required)
 *   TREASURY_ADDRESS   mainnet treasury that receives CELO (required)
 *   OPS_PRIVATE_KEY    Celo ops wallet key — initiate --execute only
 *   OPS_ADDRESS        ops wallet address — enough for dry runs / status
 *   L1_PRIVATE_KEY     mainnet key that pays ETH gas for prove + finalize (holds no funds)
 *   CELO_RESERVE       CELO left behind in the ops wallet by --all-above-reserve (default 1)
 *   MAX_SWEEP_CELO     optional hard ceiling on a single sweep
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseEther,
  parseEventLogs,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo as celoBase, mainnet } from 'viem/chains'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'

// ---- addresses -------------------------------------------------------------------------
// viem's `celo` chain ships without its L1 contracts, so the OP Stack actions cannot find
// the portal. These were derived on chain 2026-09-21 (L2CrossDomainMessenger.OTHER_MESSENGER
// → L1CrossDomainMessenger.portal → portal.disputeGameFactory / systemConfig) and are
// re-verified by `checkConfig()` on every run, so a Celo upgrade that moves them aborts
// the script instead of sending to a stale contract.
const L1_CROSS_DOMAIN_MESSENGER: Address = '0x1AC1181fc4e4F877963680587AEAa2C90D7EbB95'
const PORTAL: Address = '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC'
const DISPUTE_GAME_FACTORY: Address = '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683'
const L1_STANDARD_BRIDGE: Address = '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe'
const CELO_ON_L1: Address = '0x057898f3C43F129a17517B9056D23851F124b19f' // SystemConfig.gasPayingToken()
const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'
const L2_CROSS_DOMAIN_MESSENGER: Address = '0x4200000000000000000000000000000000000007'
const PLACEHOLDER_TREASURY: Address = '0x1111111111111111111111111111111111111111'

// Gas limit forwarded to the L1 leg. With empty calldata the portal only does an ERC-20
// transfer to the treasury, so this is headroom, not a cost.
const L1_EXECUTION_GAS = 100_000n

const celo = defineChain({
  ...celoBase,
  sourceId: mainnet.id,
  contracts: {
    ...celoBase.contracts,
    portal: { [mainnet.id]: { address: PORTAL } },
    disputeGameFactory: { [mainnet.id]: { address: DISPUTE_GAME_FACTORY } },
    l1StandardBridge: { [mainnet.id]: { address: L1_STANDARD_BRIDGE } },
  },
})

const messagePasserAbi = parseAbi(['function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable'])
const portalAbi = parseAbi([
  'function paused() view returns (bool)',
  'function version() view returns (string)',
  'function disputeGameFactory() view returns (address)',
  'function systemConfig() view returns (address)',
  'function respectedGameType() view returns (uint32)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function numProofSubmitters(bytes32) view returns (uint256)',
  'function proofSubmitters(bytes32, uint256) view returns (address)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
])

const STATE_DIR = 'sweeps'

type SweepState = {
  cycle: string
  l2TxHash: Hex
  from: Address
  treasury: Address
  amountWei: string
  nonce: number
  raw: Hex
  signedAt: string
  withdrawalHash?: Hex
  l2Block?: string
  proveTxs?: { hash: Hex; prover: Address; at: string }[]
  finalizeTx?: Hex
  finalizedAt?: string
}

// ---- small helpers -----------------------------------------------------------------------
function die(msg: string): never {
  console.error(`\nABORT: ${msg}`)
  process.exit(1)
}
const flag = (n: string) => process.argv.includes(n)
function opt(n: string): string | undefined {
  const i = process.argv.indexOf(n)
  return i === -1 ? undefined : process.argv[i + 1]
}
function env(n: string): string {
  return process.env[n] || die(`${n} is not set`)
}
function eta(seconds: number): string {
  if (seconds <= 0) return 'now'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.ceil((seconds % 3600) / 60)
  const at = new Date(Date.now() + seconds * 1000).toISOString().replace('.000', '')
  return `${d ? `${d}d ` : ''}${h}h ${m}m (≈ ${at})`
}
const statePath = (h: string) => `${STATE_DIR}/${h}.json`
function loadState(h: string): SweepState {
  if (!existsSync(statePath(h))) die(`no sweep record ${statePath(h)}`)
  return JSON.parse(readFileSync(statePath(h), 'utf8'))
}
function saveState(s: SweepState) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(statePath(s.l2TxHash), `${JSON.stringify(s, null, 2)}\n`)
}
function allStates(): SweepState[] {
  if (!existsSync(STATE_DIR)) return []
  return readdirSync(STATE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`${STATE_DIR}/${f}`, 'utf8')))
}

// Load-balanced RPCs (forno included) intermittently answer "not found" for a mined
// receipt. Every decision here that hinges on "not mined" asks several times first.
async function findReceipt<R>(get: () => Promise<R>): Promise<R | undefined> {
  for (let i = 0; i < 4; i++) {
    const r = await get().catch(() => undefined)
    if (r) return r
    await new Promise((ok) => setTimeout(ok, 1500))
  }
  return undefined
}

function treasury(forExecute: boolean): Address {
  const t = env('TREASURY_ADDRESS')
  if (!isAddress(t, { strict: true })) die(`TREASURY_ADDRESS "${t}" is not a valid (checksummed) address`)
  const a = getAddress(t)
  if (a === PLACEHOLDER_TREASURY) {
    if (forExecute) die('TREASURY_ADDRESS is still the 0x1111… placeholder')
    console.warn('WARN: TREASURY_ADDRESS is the 0x1111… placeholder — fine for a dry run only')
  }
  if ([PORTAL, CELO_ON_L1, L1_STANDARD_BRIDGE, L1_CROSS_DOMAIN_MESSENGER].includes(a)) die(`TREASURY_ADDRESS ${a} is a bridge contract`)
  return a
}

// ---- clients -----------------------------------------------------------------------------
const l2 = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL) }).extend(publicActionsL2())
const l1 = createPublicClient({ chain: mainnet, transport: http(env('ETH_RPC_URL')) }).extend(publicActionsL1())

function opsAccount(required: boolean) {
  const key = process.env.OPS_PRIVATE_KEY
  const acct = key ? privateKeyToAccount(key as Hex) : undefined
  if (required && !acct) die('OPS_PRIVATE_KEY is required to --execute an initiate')
  const addr = acct?.address ?? (process.env.OPS_ADDRESS ? getAddress(process.env.OPS_ADDRESS) : die('set OPS_ADDRESS or OPS_PRIVATE_KEY'))
  if (acct && process.env.OPS_ADDRESS && getAddress(process.env.OPS_ADDRESS) !== acct.address)
    die(`OPS_PRIVATE_KEY is for ${acct.address}, but OPS_ADDRESS says ${process.env.OPS_ADDRESS}`)
  return { acct, addr }
}
// When can a proven withdrawal be finalized? Two gates, and the later one wins:
//   - proof maturity: proofMaturityDelaySeconds after the prove tx (7 days on Celo)
//   - game finality:  the dispute game must be resolved in the defender's favour, then
//                     disputeGameFinalityDelaySeconds must pass (3.5 days on Celo)
// viem's getTimeToFinalize only reports the first gate, so this reads both off chain.
const gameAbi = parseAbi([
  'function status() view returns (uint8)',
  'function createdAt() view returns (uint64)',
  'function resolvedAt() view returns (uint64)',
  'function maxChallengeDuration() view returns (uint64)',
])
const iso = (t: number) => new Date(t * 1000).toISOString().replace('.000', '')
async function finalizeGates(withdrawalHash: Hex) {
  const read = <T,>(fn: string, args: unknown[] = []) => l1.readContract({ address: PORTAL, abi: portalAbi, functionName: fn, args } as never) as Promise<T>
  const n = await read<bigint>('numProofSubmitters', [withdrawalHash])
  if (n === 0n) return undefined
  const prover = await read<Address>('proofSubmitters', [withdrawalHash, n - 1n])
  const [game, provenAt] = await read<[Address, bigint]>('provenWithdrawals', [withdrawalHash, prover])
  const [maturity, finality, block] = await Promise.all([read<bigint>('proofMaturityDelaySeconds'), read<bigint>('disputeGameFinalityDelaySeconds'), l1.getBlock()])
  const g = <T,>(fn: 'status' | 'createdAt' | 'resolvedAt' | 'maxChallengeDuration') => l1.readContract({ address: game, abi: gameAbi, functionName: fn }) as Promise<T>
  const [status, createdAt, resolvedAt] = await Promise.all([g<number>('status'), g<bigint>('createdAt'), g<bigint>('resolvedAt')])
  const maturesAt = Number(provenAt + maturity)
  let gameFinalAt: number | undefined
  let gameNote: string
  if (status === 1) {
    gameNote = 'CHALLENGER WON — this proof is void. Re-prove against a newer game; the 7-day clock restarts.'
  } else if (status === 2) {
    gameFinalAt = Number(resolvedAt + finality)
    gameNote = `resolved ${iso(Number(resolvedAt))}; final at ${iso(gameFinalAt)}`
  } else {
    const window = await g<bigint>('maxChallengeDuration').catch(() => 0n)
    const resolvableAt = Number(createdAt + window)
    const now = Number(block.timestamp)
    // earliest possible: resolved the moment it becomes resolvable (or right now, if overdue)
    gameFinalAt = Math.max(resolvableAt, now) + Number(finality)
    gameNote =
      now < resolvableAt
        ? `not resolved yet; resolvable after ${iso(resolvableAt)} (Celo's proposer normally calls resolve()), then +${Number(finality) / 86400}d`
        : `OVERDUE: resolvable since ${iso(resolvableAt)} but nobody has called resolve(). Celo's proposer normally does; anyone can (parent games first). Escalate to Celo.`
  }
  const readyAt = gameFinalAt === undefined ? undefined : Math.max(maturesAt, gameFinalAt)
  return { prover, game, maturesAt, gameNote, readyAt, now: Number(block.timestamp) }
}
function printGates(f: NonNullable<Awaited<ReturnType<typeof finalizeGates>>>) {
  console.log(`  proven by   ${f.prover}`)
  console.log(`  proof       matures ${iso(f.maturesAt)}`)
  console.log(`  game        ${f.game}: ${f.gameNote}`)
  if (f.readyAt !== undefined) console.log(`  finalize in ~${eta(f.readyAt - f.now)}${f.readyAt - f.now <= 0 ? '' : ' (earliest)'}`)
}

function l1Wallet() {
  const acct = privateKeyToAccount(env('L1_PRIVATE_KEY') as Hex)
  return createWalletClient({ account: acct, chain: mainnet, transport: http(env('ETH_RPC_URL')) }).extend(walletActionsL1())
}

// ---- config self-check -------------------------------------------------------------------
async function checkConfig(verbose: boolean) {
  const [l2Id, l1Id] = await Promise.all([l2.getChainId(), l1.getChainId()])
  if (l2Id !== celo.id) die(`CELO_RPC_URL is chain ${l2Id}, expected ${celo.id}`)
  if (l1Id !== mainnet.id) die(`ETH_RPC_URL is chain ${l1Id}, expected ${mainnet.id}`)

  const otherMessenger = await l2.readContract({
    address: L2_CROSS_DOMAIN_MESSENGER,
    abi: parseAbi(['function OTHER_MESSENGER() view returns (address)']),
    functionName: 'OTHER_MESSENGER',
  })
  const portalOfMessenger = await l1.readContract({
    address: otherMessenger,
    abi: parseAbi(['function portal() view returns (address)']),
    functionName: 'portal',
  })
  if (getAddress(portalOfMessenger) !== PORTAL) die(`Celo's L1 portal is now ${portalOfMessenger}, script has ${PORTAL} — update and re-review`)

  const [paused, version, dgf, systemConfig, gameType, maturity, finality] = await Promise.all(
    (['paused', 'version', 'disputeGameFactory', 'systemConfig', 'respectedGameType', 'proofMaturityDelaySeconds', 'disputeGameFinalityDelaySeconds'] as const).map(
      (fn) => l1.readContract({ address: PORTAL, abi: portalAbi, functionName: fn } as never) as Promise<unknown>,
    ),
  )
  if (getAddress(dgf as Address) !== DISPUTE_GAME_FACTORY) die(`portal's DisputeGameFactory is now ${dgf}, script has ${DISPUTE_GAME_FACTORY}`)
  const [gasToken] = await l1.readContract({
    address: systemConfig as Address,
    abi: parseAbi(['function gasPayingToken() view returns (address, uint8)']),
    functionName: 'gasPayingToken',
  })
  if (getAddress(gasToken) !== CELO_ON_L1) die(`Celo gas-paying token on L1 is ${gasToken}, expected CELO ${CELO_ON_L1}`)
  if (paused) console.warn('WARN: the Celo OptimismPortal is PAUSED — prove/finalize will revert until it is unpaused')

  if (verbose) {
    console.log(`Celo portal          ${PORTAL} v${version}${paused ? '  ** PAUSED **' : ''}`)
    console.log(`dispute game type    ${gameType}`)
    console.log(`proof maturity       ${Number(maturity) / 86400} days after prove`)
    console.log(`game finality delay  ${Number(finality) / 86400} days after game resolves`)
    console.log(`CELO on Ethereum     ${CELO_ON_L1} (ERC-20, released by the portal)`)
  }
  return { paused: paused as boolean }
}

// ---- commands ----------------------------------------------------------------------------
async function preflight() {
  await checkConfig(true)
  const t = treasury(false)
  const { addr } = opsAccount(false)
  console.log(`ops wallet (Celo)    ${addr}  ${formatEther(await l2.getBalance({ address: addr }))} CELO`)
  const code = await l1.getCode({ address: t })
  console.log(`treasury (Ethereum)  ${t}  ${code && code !== '0x' ? 'contract' : 'EOA'}`)
  const bal = await l1.readContract({ address: CELO_ON_L1, abi: erc20Abi, functionName: 'balanceOf', args: [t] })
  console.log(`treasury CELO        ${formatEther(bal)}`)
  if (process.env.L1_PRIVATE_KEY) {
    const p = privateKeyToAccount(process.env.L1_PRIVATE_KEY as Hex).address
    console.log(`L1 gas key           ${p}  ${formatEther(await l1.getBalance({ address: p }))} ETH`)
  } else console.log('L1 gas key           (L1_PRIVATE_KEY not set)')
  const open = allStates().filter((s) => !s.finalizedAt)
  console.log(`open sweeps          ${open.length ? open.map((s) => s.l2TxHash).join(', ') : 'none'}`)
}

async function initiate() {
  const execute = flag('--execute')
  await checkConfig(false)
  const to = treasury(execute)
  const { acct, addr } = opsAccount(execute)

  // Sweeps take 7+ days, so several can be open at once (one per cycle). What must never
  // happen is two sweeps for the same cycle, or re-signing a sweep whose fate is unknown.
  const cycle = opt('--cycle') ?? die('--cycle <label> is required (e.g. 2026-09-W38); one sweep per cycle')
  const all = allStates()
  for (const s of all.filter((x) => !x.l2Block)) {
    const rc = await findReceipt(() => l2.getTransactionReceipt({ hash: s.l2TxHash }))
    if (rc) {
      console.log(`sweep ${s.l2TxHash} (cycle ${s.cycle}) was mined but not recorded — recording it`)
      await afterInitiate(s)
      continue
    }
    const confirmed = await l2.getTransactionCount({ address: s.from })
    if (s.nonce < confirmed) die(`sweep ${s.l2TxHash} was signed with nonce ${s.nonce} but never mined, and that nonce is used. Investigate, then move ${statePath(s.l2TxHash)} aside.`)
    if (!execute) die(`sweep ${s.l2TxHash} (cycle ${s.cycle}) was signed but is not on chain; re-run with --execute to rebroadcast it`)
    console.log(`rebroadcasting signed sweep ${s.l2TxHash} (cycle ${s.cycle})`)
    await l2.sendRawTransaction({ serializedTransaction: s.raw }).catch((e) => console.warn(`  node said: ${e.shortMessage}`))
    return afterInitiate(s)
  }
  const dup = all.find((x) => x.cycle === cycle)
  if (dup) die(`cycle ${cycle} already has a sweep: ${dup.l2TxHash}`)

  const balance = await l2.getBalance({ address: addr })
  const fees = await l2.estimateFeesPerGas()
  const reserve = parseEther(process.env.CELO_RESERVE ?? '1')
  let value: bigint
  if (opt('--amount')) {
    const a = opt('--amount')!
    if (!/^\d+(\.\d{1,18})?$/.test(a)) die(`--amount "${a}" is not a plain decimal`)
    value = parseEther(a)
  } else if (flag('--all-above-reserve')) {
    value = balance - reserve
  } else die('give --amount <CELO> (preferred: the figure finance signed off) or --all-above-reserve')
  if (value <= 0n) die(`nothing to sweep: balance ${formatEther(balance)} CELO, reserve ${formatEther(reserve)}`)
  if (process.env.MAX_SWEEP_CELO && value > parseEther(process.env.MAX_SWEEP_CELO)) die(`${formatEther(value)} CELO exceeds MAX_SWEEP_CELO`)

  const data = encodeFunctionData({ abi: messagePasserAbi, functionName: 'initiateWithdrawal', args: [to, L1_EXECUTION_GAS, '0x'] })
  const gas = ((await l2.estimateGas({ account: addr, to: L2_TO_L1_MESSAGE_PASSER, data, value })) * 12n) / 10n
  const l2Fee = gas * fees.maxFeePerGas
  if (value + l2Fee > balance) die(`balance ${formatEther(balance)} CELO cannot cover ${formatEther(value)} + gas ${formatEther(l2Fee)}`)

  console.log(`cycle        ${cycle}`)
  console.log(`sweep        ${formatEther(value)} CELO`)
  console.log(`from (Celo)  ${addr}   balance ${formatEther(balance)} → ~${formatEther(balance - value - l2Fee)} after`)
  console.log(`to (L1)      ${to}   receives CELO ERC-20 ${CELO_ON_L1} at finalize`)
  console.log(`L2 gas       ≤ ${formatEther(l2Fee)} CELO`)
  if (!execute) return console.log('\nDRY RUN — nothing signed. Re-run with --execute to initiate.')

  const wallet = createWalletClient({ account: acct!, chain: celo, transport: http(process.env.CELO_RPC_URL) })
  const nonce = await l2.getTransactionCount({ address: addr, blockTag: 'pending' })
  const raw = await wallet.signTransaction({
    account: acct!,
    chain: celo,
    to: L2_TO_L1_MESSAGE_PASSER,
    data,
    value,
    gas,
    nonce,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  } as never)
  const s: SweepState = {
    cycle,
    l2TxHash: keccak256(raw),
    from: addr,
    treasury: to,
    amountWei: value.toString(),
    nonce,
    raw,
    signedAt: new Date().toISOString(),
  }
  saveState(s) // recorded before broadcast, so a crash cannot lose track of burned CELO
  await l2.sendRawTransaction({ serializedTransaction: raw })
  console.log(`\ninitiated    ${s.l2TxHash}   record: ${statePath(s.l2TxHash)}`)
  await afterInitiate(s)
}

async function afterInitiate(s: SweepState) {
  const receipt = await l2.waitForTransactionReceipt({ hash: s.l2TxHash, timeout: 180_000 })
  if (receipt.status !== 'success') die(`initiate tx ${s.l2TxHash} REVERTED; no CELO left the wallet. Move ${statePath(s.l2TxHash)} aside before retrying.`)
  const [w] = getWithdrawals(receipt)
  if (!w || getAddress(w.target) !== s.treasury || w.value !== BigInt(s.amountWei)) die('withdrawal in receipt does not match the record — investigate')
  s.withdrawalHash = w.withdrawalHash
  s.l2Block = receipt.blockNumber.toString()
  saveState(s)
  console.log(`L2 block     ${receipt.blockNumber}   withdrawalHash ${w.withdrawalHash}`)
  const { seconds } = await l1.getTimeToProve({ receipt, targetChain: celo })
  console.log(`next         prove in ~${eta(seconds)}:  npx tsx sweep.ts prove ${s.l2TxHash} --execute`)
}

async function withdrawalOf(s: SweepState) {
  const receipt = await findReceipt(() => l2.getTransactionReceipt({ hash: s.l2TxHash }))
  if (!receipt) die(`initiate tx ${s.l2TxHash} is not on Celo yet — run \`initiate --execute\` to rebroadcast it`)
  const [withdrawal] = getWithdrawals(receipt)
  return { receipt, withdrawal }
}

async function status(hash?: string) {
  await checkConfig(false)
  const states = hash ? [loadState(hash)] : allStates()
  if (!states.length) return console.log('no sweeps recorded')
  for (const s of states) {
    console.log(`\n[${s.cycle}] ${s.l2TxHash}  ${formatEther(BigInt(s.amountWei))} CELO → ${s.treasury}  (signed ${s.signedAt})`)
    if (s.finalizedAt) {
      console.log(`  finalized   ${s.finalizedAt}  tx ${s.finalizeTx}`)
      continue
    }
    const { receipt } = await withdrawalOf(s)
    const st = await l1.getWithdrawalStatus({ receipt, targetChain: celo })
    console.log(`  status      ${st}`)
    if (st === 'waiting-to-prove') {
      const { seconds } = await l1.getTimeToProve({ receipt, targetChain: celo })
      console.log(`  prove in    ~${eta(seconds)}`)
    } else if (st === 'ready-to-prove') {
      if (s.proveTxs?.length) console.log('  NOTE        was proven before, but that proof no longer counts (game invalidated or game type changed). Re-prove; the 7-day clock restarts.')
      console.log(`  next        npx tsx sweep.ts prove ${s.l2TxHash} --execute`)
    } else if (st === 'waiting-to-finalize') {
      const f = await finalizeGates(s.withdrawalHash!)
      if (f) printGates(f)
    } else if (st === 'ready-to-finalize') {
      console.log(`  next        npx tsx sweep.ts finalize ${s.l2TxHash} --execute`)
    } else if (st === 'finalized') {
      console.log('  finalized on L1 but not recorded here — run `finalize` to reconcile the record')
    }
  }
}

async function prove(hash: string) {
  const execute = flag('--execute')
  const { paused } = await checkConfig(false)
  const s = loadState(hash)
  const { receipt, withdrawal } = await withdrawalOf(s)
  const st = await l1.getWithdrawalStatus({ receipt, targetChain: celo })
  // Proving again from the same key would reset the 7-day maturity clock — only prove when due.
  if (st !== 'ready-to-prove') die(`status is ${st}; nothing to prove now (see \`status\`)`)
  if (paused) die('portal is paused')

  const game = await l1.getGame({ l2BlockNumber: receipt.blockNumber, targetChain: celo })
  const args = await l2.buildProveWithdrawal({ game, withdrawal })
  const wallet = l1Wallet()
  const gas = await l1.estimateProveWithdrawalGas({ ...args, account: wallet.account, targetChain: celo })
  const { maxFeePerGas } = await l1.estimateFeesPerGas()
  console.log(`game         #${game.index} covering L2 block ${game.l2BlockNumber}`)
  console.log(`prover       ${wallet.account.address}`)
  console.log(`L1 gas       ~${gas} gas, ≤ ${formatEther(gas * maxFeePerGas)} ETH at current fees`)
  if (!execute) return console.log('\nDRY RUN — simulated OK. Re-run with --execute to prove.')

  const tx = await wallet.proveWithdrawal({ ...args, account: wallet.account, targetChain: celo, gas: (gas * 12n) / 10n })
  s.proveTxs = [...(s.proveTxs ?? []), { hash: tx, prover: wallet.account.address, at: new Date().toISOString() }]
  saveState(s)
  const rc = await l1.waitForTransactionReceipt({ hash: tx })
  if (rc.status !== 'success') die(`prove tx ${tx} reverted`)
  console.log(`proven       ${tx}`)
  const f = await finalizeGates(withdrawal.withdrawalHash)
  if (f) printGates(f)
  console.log(`next         npx tsx sweep.ts finalize ${s.l2TxHash} --execute  (when \`status\` says ready-to-finalize)`)
}

async function finalize(hash: string) {
  const execute = flag('--execute')
  const { paused } = await checkConfig(false)
  const s = loadState(hash)
  const { receipt, withdrawal } = await withdrawalOf(s)
  const st = await l1.getWithdrawalStatus({ receipt, targetChain: celo })
  if (st === 'finalized') {
    console.log('already finalized on L1 — recording it')
    s.finalizedAt ??= new Date().toISOString()
    return saveState(s)
  }
  if (st !== 'ready-to-finalize') die(`status is ${st}; cannot finalize yet (see \`status\`)`)
  if (paused) die('portal is paused')

  const wallet = l1Wallet()
  // The portal checks the proof recorded for a specific submitter. Proving is
  // permissionless, so use whoever proved last on chain, not just our own record.
  const proofSubmitter = (await finalizeGates(withdrawal.withdrawalHash))?.prover ?? die('no proof on chain for this withdrawal')
  const params = { withdrawal, targetChain: celo, account: wallet.account, ...(proofSubmitter && proofSubmitter !== wallet.account.address ? { proofSubmitter } : {}) }
  const gas = await l1.estimateFinalizeWithdrawalGas(params as never)
  const { maxFeePerGas } = await l1.estimateFeesPerGas()
  const before = await l1.readContract({ address: CELO_ON_L1, abi: erc20Abi, functionName: 'balanceOf', args: [s.treasury] })
  console.log(`finalizer    ${wallet.account.address}${proofSubmitter ? `   proof by ${proofSubmitter}` : ''}`)
  console.log(`L1 gas       ~${gas} gas, ≤ ${formatEther(gas * maxFeePerGas)} ETH at current fees`)
  console.log(`treasury     ${s.treasury} will receive ${formatEther(BigInt(s.amountWei))} CELO`)
  if (!execute) return console.log('\nDRY RUN — simulated OK. Re-run with --execute to finalize.')

  const tx = await wallet.finalizeWithdrawal({ ...(params as object), gas: (gas * 12n) / 10n } as never)
  s.finalizeTx = tx
  saveState(s)
  const rc = await l1.waitForTransactionReceipt({ hash: tx })
  if (rc.status !== 'success') die(`finalize tx ${tx} reverted`)
  const [ev] = parseEventLogs({ abi: portalAbi, eventName: 'WithdrawalFinalized', logs: rc.logs })
  if (!ev?.args.success) die(`finalize tx ${tx} mined but the portal reports success=false — escalate; do not retry blindly`)
  const after = await l1.readContract({ address: CELO_ON_L1, abi: erc20Abi, functionName: 'balanceOf', args: [s.treasury], blockNumber: rc.blockNumber })
  s.finalizedAt = new Date().toISOString()
  saveState(s)
  console.log(`finalized    ${tx}`)
  console.log(`treasury     CELO ${formatUnits(before, 18)} → ${formatUnits(after, 18)} (+${formatUnits(after - before, 18)})`)
}

// ---- main --------------------------------------------------------------------------------
const [cmd, a1] = process.argv.slice(2)
const run: Record<string, () => Promise<unknown>> = {
  preflight,
  initiate,
  status: () => status(a1 && !a1.startsWith('--') ? a1 : undefined),
  prove: () => prove(a1 ?? die('usage: sweep.ts prove <l2TxHash>')),
  finalize: () => finalize(a1 ?? die('usage: sweep.ts finalize <l2TxHash>')),
}
if (!cmd || !run[cmd]) die('usage: sweep.ts preflight | initiate | status | prove | finalize  (see header of sweep.ts)')
run[cmd]().catch((e) => die(e?.shortMessage ?? e?.message ?? String(e)))
