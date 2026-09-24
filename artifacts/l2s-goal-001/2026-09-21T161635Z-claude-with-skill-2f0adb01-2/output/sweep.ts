// Move the cycle's CELO revenue from the ops wallet on Celo to the treasury on
// Ethereum mainnet, via Celo's canonical OP Stack bridge. It takes three
// transactions over about 7+ days:
//
//   1. initiate  (Celo L2, ops key)    burns native CELO into L2ToL1MessagePasser
//   2. prove     (Ethereum, L1 key)    about 1h later, once a dispute game covers the L2 block
//   3. finalize  (Ethereum, L1 key)    7 days after prove; the portal sends L1 CELO (ERC-20) to the treasury
//
//   npx tsx sweep.ts initiate --cycle 2026-09 [--amount <CELO>] [--execute --confirm-to <treasury>]
//   npx tsx sweep.ts status   --cycle 2026-09
//   npx tsx sweep.ts prove    --cycle 2026-09 [--execute]
//   npx tsx sweep.ts finalize --cycle 2026-09 [--execute]
//
// Every command is a dry run unless --execute is passed. See NOTES.md.

import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  type Hex,
  http,
  parseAbi,
  parseEther,
  type TransactionReceipt,
} from 'viem'
import { celo, mainnet } from 'viem/chains'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'
import {
  assertChainId,
  assertNoPendingTxs,
  broadcastAndWait,
  celoWithL1,
  die,
  env,
  flag,
  Journal,
  L1,
  L2_TO_L1_MESSAGE_PASSER,
  main,
  option,
  optionalEnv,
  parseAddress,
  privateKeyAccount,
  resolveSent,
  type SentTx,
  signAndRecord,
} from './common.ts'

const PLACEHOLDER_TREASURY = '0x1111111111111111111111111111111111111111'

// L1 gas forwarded to the target at finalize. With empty calldata the Celo
// portal does a plain ERC-20 transfer and never calls the target, so this is
// only a floor. Kept generous so a Safe/contract treasury is never gas-starved.
const WITHDRAWAL_MIN_GAS_LIMIT = 100_000n

const messagePasserAbi = parseAbi([
  'function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable',
])
const l1Abi = parseAbi([
  'function gasPayingToken() view returns (address addr, uint8 decimals)',
  'function optimismPortal() view returns (address)',
  'function disputeGameFactory() view returns (address)',
  'function paused() view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function numProofSubmitters(bytes32) view returns (uint256)',
  'function proofSubmitters(bytes32, uint256) view returns (address)',
])

type CycleRecord = {
  cycle: string
  target: Address
  amountWei: string
  initiate?: SentTx
  withdrawalHash?: Hex
  proveTx?: Hex
  finalizeTx?: Hex
}
type SweepJournal = { version: 1; cycles: Record<string, CycleRecord> }

// viem's finalize-related types insist on `l2OutputOracle` (legacy proof system) even
// though the fault-proof path never reads it. Celo has no L2OutputOracle.
const celoTargetForFinalize = celoWithL1 as unknown as typeof celoWithL1 & {
  contracts: { l2OutputOracle: { 1: { address: Address } } }
}

const fmtDuration = (s: number) => {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.ceil((s % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}
const at = (s: number) => new Date(Date.now() + s * 1000).toISOString()

function clients() {
  const l2Transport = http(env('CELO_RPC_URL'), { retryCount: 5 })
  const l2 = createPublicClient({ chain: celoWithL1, transport: l2Transport }).extend(publicActionsL2())
  const l1 = createPublicClient({ chain: mainnet, transport: http(env('ETH_RPC_URL'), { retryCount: 5 }) }).extend(
    publicActionsL1(),
  )
  return { l2, l1, l2Transport }
}
type Clients = ReturnType<typeof clients>

/** Ensure our hard-coded L1 addresses still match what Celo's SystemConfig says. */
async function checkL1Config(l1: Clients['l1']) {
  const [[token], portal, dgf, paused, maturity] = await Promise.all([
    l1.readContract({ address: L1.systemConfig, abi: l1Abi, functionName: 'gasPayingToken' }),
    l1.readContract({ address: L1.systemConfig, abi: l1Abi, functionName: 'optimismPortal' }),
    l1.readContract({ address: L1.systemConfig, abi: l1Abi, functionName: 'disputeGameFactory' }),
    l1.readContract({ address: L1.optimismPortal, abi: l1Abi, functionName: 'paused' }),
    l1.readContract({ address: L1.optimismPortal, abi: l1Abi, functionName: 'proofMaturityDelaySeconds' }),
  ])
  if (token.toLowerCase() !== L1.celoToken.toLowerCase()) die(`SystemConfig gas token is ${token}, expected ${L1.celoToken}`)
  if (portal.toLowerCase() !== L1.optimismPortal.toLowerCase()) die(`SystemConfig portal is ${portal}, expected ${L1.optimismPortal}`)
  if (dgf.toLowerCase() !== L1.disputeGameFactory.toLowerCase()) die(`SystemConfig DGF is ${dgf}, expected ${L1.disputeGameFactory}`)
  if (paused) console.warn('WARNING: Celo OptimismPortal on L1 is PAUSED. Prove/finalize will fail until unpaused.')
  return { paused, maturity: Number(maturity) }
}

function cycleId(): string {
  const c = option('--cycle')
  if (!c) die('--cycle <id> is required (e.g. --cycle 2026-09)')
  if (!/^[\w.-]+$/.test(c)) die('--cycle may only contain letters, digits, "_", "-", "."')
  return c
}

function openJournal() {
  return new Journal<SweepJournal>(optionalEnv('SWEEP_JOURNAL') ?? 'sweep.journal.json', { version: 1, cycles: {} })
}

async function l2Receipt(l2: Clients['l2'], rec: CycleRecord | undefined): Promise<TransactionReceipt> {
  if (rec?.initiate?.status !== 'confirmed') die('This cycle has no confirmed initiate tx. Run `initiate` first.')
  return l2.getTransactionReceipt({ hash: rec.initiate.hash })
}

// ---------------------------------------------------------------------------

async function initiate() {
  const cycle = cycleId()
  const execute = flag('--execute')
  const { l2, l1, l2Transport } = clients()
  await Promise.all([assertChainId(l2, celo.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  const { maturity } = await checkL1Config(l1)

  // --- Destination safety. A wrong target here is unrecoverable. ---
  const target = parseAddress(env('TREASURY_ADDRESS'), 'TREASURY_ADDRESS')
  if (target.toLowerCase() === PLACEHOLDER_TREASURY) die('TREASURY_ADDRESS is still the 0x1111… placeholder.')
  if (target === '0x0000000000000000000000000000000000000000') die('TREASURY_ADDRESS is the zero address')
  // The portal reverts on these at prove/finalize time, so funds would be stuck forever.
  if (target.toLowerCase() === L1.celoToken.toLowerCase() || target.toLowerCase() === L1.optimismPortal.toLowerCase()) {
    die('TREASURY_ADDRESS is a bridge contract; the withdrawal could never be finalized')
  }
  const l1Code = await l1.getCode({ address: target })
  const targetKind = l1Code && l1Code !== '0x' ? 'contract on Ethereum (e.g. Safe)' : 'EOA on Ethereum (no code)'

  const account = privateKeyAccount('OPS_PRIVATE_KEY')
  const wallet = createWalletClient({ account, chain: celo, transport: l2Transport })
  const journal = openJournal()
  const rec = journal.data.cycles[cycle]

  if (rec?.initiate) {
    if (rec.initiate.status === 'signed' && execute) {
      console.log(`Reconciling initiate tx from a previous run: ${rec.initiate.hash}`)
      rec.initiate = await resolveSent(l2, account.address, rec.initiate)
      journal.save()
    }
    if (rec.initiate.status === 'confirmed') {
      await recordWithdrawalHash(l2, journal, rec)
      die(`Cycle ${cycle} was already initiated (${formatEther(BigInt(rec.amountWei))} CELO, ${rec.initiate.hash}). Use \`status\`.`)
    }
    if (rec.initiate.status !== 'signed') {
      die(`Cycle ${cycle} initiate is ${rec.initiate.status} (${rec.initiate.hash}). Needs manual review — see NOTES.md.`)
    }
    die(`Cycle ${cycle} has an unconfirmed initiate ${rec.initiate.hash}. Re-run with --execute to reconcile it.`)
  }

  // --- Amount: balance minus operating reserve minus this tx's gas ---
  const reserve = parseEther(env('SWEEP_RESERVE_CELO'))
  const balance = await l2.getBalance({ address: account.address })
  const data = encodeFunctionData({
    abi: messagePasserAbi,
    functionName: 'initiateWithdrawal',
    args: [target, WITHDRAWAL_MIN_GAS_LIMIT, '0x'],
  })
  const fees = await l2.estimateFeesPerGas()
  const gas = await l2.estimateGas({ account, to: L2_TO_L1_MESSAGE_PASSER, data, value: 1n })
  const maxFee = ((gas * 3n) / 2n) * fees.maxFeePerGas!

  const available = balance - reserve - maxFee
  const requested = option('--amount')
  const amount = requested ? parseEther(requested) : available
  if (amount <= 0n) die(`Nothing to sweep: balance ${formatEther(balance)} ≤ reserve ${formatEther(reserve)} + gas`)
  if (amount > available) die(`--amount ${requested} exceeds sweepable ${formatEther(available)} (balance − reserve − gas)`)

  console.log(`Cycle:            ${cycle}`)
  console.log(`From (Celo):      ${account.address}`)
  console.log(`To (Ethereum):    ${target}  [${targetKind}]`)
  console.log(`Ops CELO balance: ${formatEther(balance)}`)
  console.log(`Reserve kept:     ${formatEther(reserve)}`)
  console.log(`SWEEP AMOUNT:     ${formatEther(amount)} CELO → arrives as L1 CELO ERC-20 ${L1.celoToken}`)
  console.log(`Earliest arrival: ~${fmtDuration(maturity + 3600)} after this tx (prove ~1h, then ${maturity / 86400}d maturity)`)

  await l2.call({ account, to: L2_TO_L1_MESSAGE_PASSER, data, value: amount }) // simulate
  if (!execute) {
    console.log(`\nDRY RUN — nothing sent. Re-run with --execute --confirm-to ${target}`)
    return
  }
  if (option('--confirm-to')?.toLowerCase() !== target.toLowerCase()) {
    die('--execute requires --confirm-to <treasury address>, typed out, matching TREASURY_ADDRESS')
  }

  const nonce = await assertNoPendingTxs(l2, account.address)
  const request = await wallet.prepareTransactionRequest({
    account,
    chain: celo,
    to: L2_TO_L1_MESSAGE_PASSER,
    data,
    value: amount,
    nonce,
  })
  const newRec: CycleRecord = { cycle, target, amountWei: amount.toString() }
  journal.data.cycles[cycle] = newRec
  const signed = await signAndRecord(wallet, request, (tx) => {
    newRec.initiate = tx
    journal.save()
  })
  newRec.initiate = await broadcastAndWait(l2, signed)
  journal.save()
  if (newRec.initiate.status !== 'confirmed') die(`Initiate ${newRec.initiate.status}: https://celoscan.io/tx/${signed.hash}`)

  await recordWithdrawalHash(l2, journal, newRec)
  console.log(`\nInitiated: https://celoscan.io/tx/${signed.hash}`)
  console.log(`Withdrawal hash: ${newRec.withdrawalHash}`)
  console.log(`Next: \`npx tsx sweep.ts prove --cycle ${cycle}\` in about 1 hour (check with \`status\`).`)
}

async function recordWithdrawalHash(l2: Clients['l2'], journal: Journal<SweepJournal>, rec: CycleRecord) {
  if (rec.withdrawalHash) return
  const receipt = await l2Receipt(l2, rec)
  const [w] = getWithdrawals(receipt)
  if (!w) die(`No MessagePassed event in ${receipt.transactionHash}`)
  if (w.target.toLowerCase() !== rec.target.toLowerCase() || w.value !== BigInt(rec.amountWei)) {
    die(`Withdrawal event (${w.target}, ${w.value}) does not match journal (${rec.target}, ${rec.amountWei})`)
  }
  rec.withdrawalHash = w.withdrawalHash
  journal.save()
}

async function status() {
  const cycle = cycleId()
  const { l2, l1 } = clients()
  const journal = openJournal()
  const rec = journal.data.cycles[cycle]
  if (!rec) die(`No such cycle "${cycle}" in ${journal.path}`)
  const { maturity } = await checkL1Config(l1)
  const receipt = await l2Receipt(l2, rec)
  const [w] = getWithdrawals(receipt)
  const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoWithL1 })

  console.log(`Cycle ${cycle}: ${formatEther(BigInt(rec.amountWei))} CELO → ${rec.target}`)
  console.log(`Initiated in L2 block ${receipt.blockNumber}: https://celoscan.io/tx/${receipt.transactionHash}`)
  console.log(`Status: ${s}`)
  if (s === 'waiting-to-prove') {
    try {
      const t = await l1.getTimeToProve({ receipt, targetChain: celoWithL1 })
      console.log(`Provable in ~${fmtDuration(t.seconds)} (${at(t.seconds)}). Finalizable ~${maturity / 86400}d after proving.`)
    } catch {
      console.log('Waiting for a dispute game covering this L2 block (normally < 1h).')
    }
  } else if (s === 'waiting-to-finalize') {
    const t = await l1.getTimeToFinalize({ withdrawalHash: w.withdrawalHash, targetChain: celoTargetForFinalize })
    console.log(`Finalizable in ~${fmtDuration(t.seconds)} (${at(t.seconds)}).`)
  } else if (s === 'finalized') {
    const bal = await l1.readContract({ address: L1.celoToken, abi: erc20Abi, functionName: 'balanceOf', args: [rec.target] })
    console.log(`Done. Treasury L1 CELO balance: ${formatEther(bal)}`)
  }
}

async function prove() {
  const cycle = cycleId()
  const execute = flag('--execute')
  const { l2, l1 } = clients()
  await Promise.all([assertChainId(l2, celo.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  await checkL1Config(l1)
  const journal = openJournal()
  const rec = journal.data.cycles[cycle]
  const receipt = await l2Receipt(l2, rec)
  const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoWithL1 })
  if (s !== 'ready-to-prove') die(`Status is "${s}", not ready-to-prove. Run \`status\`.`)

  const account = privateKeyAccount('L1_PRIVATE_KEY')
  const [withdrawal] = getWithdrawals(receipt)
  const game = await l1.getGame({ l2BlockNumber: receipt.blockNumber, targetChain: celoWithL1 })
  const args = await l2.buildProveWithdrawal({ withdrawal, game })
  const gas = await l1.estimateProveWithdrawalGas({ ...args, account, targetChain: celoWithL1 })
  const { maxFeePerGas } = await l1.estimateFeesPerGas()
  console.log(`Proving with dispute game #${game.index} (L2 block ${game.l2BlockNumber}); L1 gas ~${gas}, ≤ ${formatEther(gas * maxFeePerGas!)} ETH`)
  if (!execute) return console.log('DRY RUN — re-run with --execute.')

  const wallet = createWalletClient({ account, chain: mainnet, transport: http(env('ETH_RPC_URL')) }).extend(walletActionsL1())
  const hash = await wallet.proveWithdrawal({ ...args, account, targetChain: celoWithL1, gas: (gas * 6n) / 5n })
  rec!.proveTx = hash
  journal.save()
  const r = await l1.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') die(`Prove reverted: https://etherscan.io/tx/${hash}`)
  const t = await l1.getTimeToFinalize({ withdrawalHash: withdrawal.withdrawalHash, targetChain: celoTargetForFinalize })
  console.log(`Proven: https://etherscan.io/tx/${hash}`)
  console.log(`Finalize after ${at(t.seconds)} with \`npx tsx sweep.ts finalize --cycle ${cycle}\`.`)
}

async function finalize() {
  const cycle = cycleId()
  const execute = flag('--execute')
  const { l2, l1 } = clients()
  await Promise.all([assertChainId(l2, celo.id, 'CELO_RPC_URL'), assertChainId(l1, mainnet.id, 'ETH_RPC_URL')])
  await checkL1Config(l1)
  const journal = openJournal()
  const rec = journal.data.cycles[cycle]
  const receipt = await l2Receipt(l2, rec)
  const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoWithL1 })
  if (s !== 'ready-to-finalize') die(`Status is "${s}", not ready-to-finalize. Run \`status\`.`)

  const account = privateKeyAccount('L1_PRIVATE_KEY')
  const [withdrawal] = getWithdrawals(receipt)
  // The portal keys proofs by submitter; finalize against the latest proof (same one getWithdrawalStatus checked).
  const n = await l1.readContract({ address: L1.optimismPortal, abi: l1Abi, functionName: 'numProofSubmitters', args: [withdrawal.withdrawalHash] })
  const proofSubmitter = await l1.readContract({
    address: L1.optimismPortal,
    abi: l1Abi,
    functionName: 'proofSubmitters',
    args: [withdrawal.withdrawalHash, n - 1n],
  })
  const gas = await l1.estimateFinalizeWithdrawalGas({ withdrawal, proofSubmitter, account, targetChain: celoTargetForFinalize })
  const before = await l1.readContract({ address: L1.celoToken, abi: erc20Abi, functionName: 'balanceOf', args: [rec!.target] })
  console.log(`Finalizing ${formatEther(withdrawal.value)} CELO → ${withdrawal.target}; L1 gas ~${gas}`)
  if (!execute) return console.log('DRY RUN — re-run with --execute.')

  const wallet = createWalletClient({ account, chain: mainnet, transport: http(env('ETH_RPC_URL')) }).extend(walletActionsL1())
  const hash = await wallet.finalizeWithdrawal({ withdrawal, proofSubmitter, account, targetChain: celoTargetForFinalize, gas: (gas * 6n) / 5n })
  rec!.finalizeTx = hash
  journal.save()
  const r = await l1.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') die(`Finalize reverted: https://etherscan.io/tx/${hash}`)
  const after = await l1.readContract({ address: L1.celoToken, abi: erc20Abi, functionName: 'balanceOf', args: [rec!.target] })
  console.log(`Finalized: https://etherscan.io/tx/${hash}`)
  console.log(`Treasury L1 CELO: ${formatEther(before)} → ${formatEther(after)} (+${formatEther(after - before)})`)
}

main(async () => {
  const cmd = process.argv[2]
  const commands: Record<string, () => Promise<void>> = { initiate, status, prove, finalize }
  if (!cmd || !commands[cmd]) die('usage: npx tsx sweep.ts <initiate|status|prove|finalize> --cycle <id> [--execute]')
  await commands[cmd]()
})
