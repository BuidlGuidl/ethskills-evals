// sweep.ts: move the cycle's CELO revenue from the ops wallet on Celo to the
// treasury on Ethereum mainnet via Celo's canonical (OP Stack) bridge.
//
// A plain CELO transfer to TREASURY_ADDRESS on Celo would NOT reach Ethereum.
// It would sit at that address on Celo, and if the treasury is a Safe that
// only exists on mainnet, nobody could get it back. This script therefore does
// a native L2→L1 withdrawal, which takes three transactions over about 7 days:
//
//   1. initiate  (Celo)      burns CELO on L2 and emits a withdrawal to TREASURY_ADDRESS
//   2. prove     (Ethereum)  once a dispute game covers that L2 block (~30–120 min)
//   3. finalize  (Ethereum)  after the 7-day proof maturity delay; the portal
//                            then transfers CELO (ERC-20 0x0578…b19f) to the treasury
//
// Each step is dry-run unless --execute is passed. State lives in sweeps/<cycle>.json.
//
//   npx tsx sweep.ts initiate --cycle 2026-09 --amount 15000          # dry run
//   npx tsx sweep.ts initiate --cycle 2026-09 --amount 15000 --execute
//   npx tsx sweep.ts status   --cycle 2026-09
//   npx tsx sweep.ts prove    --cycle 2026-09 --execute
//   npx tsx sweep.ts finalize --cycle 2026-09 --execute

import { mkdirSync } from 'node:fs'
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
  http,
  keccak256,
  parseAbi,
  parseEther,
  parseEventLogs,
} from 'viem'
import { celo, mainnet } from 'viem/chains'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'
import {
  CELO_CHAIN_ID,
  CELO_L1,
  ETH_CHAIN_ID,
  assertNotPlaceholder,
  die,
  env,
  loadAccount,
  optionalEnv,
  parseAddress,
  parseArgs,
  readJournal,
  writeJournal,
} from './common.ts'

const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'
/** L1 execution gas for the withdrawal. Calldata is empty, so the portal only
 *  does the ERC-20 transfer; this just needs to be comfortably non-zero. */
const WITHDRAWAL_L1_GAS = 100_000n

const l1Abi = parseAbi([
  'function systemConfig() view returns (address)',
  'function disputeGameFactory() view returns (address)',
  'function paused() view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function l2ChainId() view returns (uint256)',
  'function gasPayingToken() view returns (address, uint8)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
])
const messagePasserAbi = parseAbi([
  'function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable',
])

/** viem's `celo` chain has no L1 contract config, so we attach the pinned, verified ones. */
const celoWithL1 = defineChain({
  ...celo,
  sourceId: ETH_CHAIN_ID,
  contracts: {
    ...celo.contracts,
    portal: { [ETH_CHAIN_ID]: { address: CELO_L1.optimismPortal } },
    disputeGameFactory: { [ETH_CHAIN_ID]: { address: CELO_L1.disputeGameFactory } },
  },
})

type SweepJournal = {
  kind: 'celo-l1-sweep'
  cycle: string
  from: Address
  treasury: Address
  amount: bigint
  createdAt: string
  treasuryL1BalanceBefore: bigint
  initiate: { nonce: number; hash: Hash; raw: Hex; blockNumber?: bigint; status?: 'success' | 'reverted' }
  withdrawalHash?: Hash
  prove?: { hash: Hash; submitter: Address; at: string; status?: 'success' | 'reverted' }
  finalize?: { hash: Hash; at: string; status?: 'success' | 'reverted'; portalSuccess?: boolean; treasuryDelta?: bigint }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const cmd = positional[0]
  const cycleFlag = flags.cycle
  if (!cmd || typeof cycleFlag !== 'string' || !/^[\w.-]+$/.test(cycleFlag))
    die('usage: sweep.ts <initiate|status|prove|finalize> --cycle <id> [--amount <celo> | --all-above-reserve] [--execute]')
  const cycle: string = cycleFlag
  const execute = flags.execute === true
  mkdirSync('sweeps', { recursive: true })
  const journalPath = `sweeps/${cycle}.json`
  let journal = readJournal<SweepJournal>(journalPath)

  const treasury = parseAddress(env('TREASURY_ADDRESS'), 'TREASURY_ADDRESS')
  assertNotPlaceholder(treasury, 'TREASURY_ADDRESS')
  if (treasury.toLowerCase() === CELO_L1.celoToken.toLowerCase()) die('TREASURY_ADDRESS cannot be the L1 CELO token (portal rejects it)')

  const l2 = createPublicClient({ chain: celoWithL1, transport: http(env('CELO_RPC_URL'), { retryCount: 3 }) }).extend(publicActionsL2())
  const l1Transport = http(env('ETH_RPC_URL'), { retryCount: 3 })
  const l1 = createPublicClient({ chain: mainnet, transport: l1Transport }).extend(publicActionsL1())

  // --- Verify we are pointed at the right networks and bridge -------------
  const [l2Id, l1Id] = await Promise.all([l2.getChainId(), l1.getChainId()])
  if (l2Id !== CELO_CHAIN_ID) die(`CELO_RPC_URL is chain ${l2Id}, expected ${CELO_CHAIN_ID}`)
  if (l1Id !== ETH_CHAIN_ID) die(`ETH_RPC_URL is chain ${l1Id}, expected ${ETH_CHAIN_ID}`)
  const read = (address: Address, functionName: any) => l1.readContract({ address, abi: l1Abi, functionName } as any) as Promise<any>
  const [sysCfg, dgf, portalPaused, cfgChainId, [gasToken]] = await Promise.all([
    read(CELO_L1.optimismPortal, 'systemConfig'),
    read(CELO_L1.optimismPortal, 'disputeGameFactory'),
    read(CELO_L1.optimismPortal, 'paused'),
    read(CELO_L1.systemConfig, 'l2ChainId'),
    read(CELO_L1.systemConfig, 'gasPayingToken'),
  ])
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  if (!eq(sysCfg, CELO_L1.systemConfig) || !eq(dgf, CELO_L1.disputeGameFactory) || cfgChainId !== BigInt(CELO_CHAIN_ID) || !eq(gasToken, CELO_L1.celoToken))
    die('On-chain Celo bridge config does not match the pinned addresses in common.ts. Do not proceed; re-verify against docs.celo.org.')

  const treasuryL1Balance = () =>
    l1.readContract({ address: CELO_L1.celoToken, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] })

  switch (cmd) {
    case 'initiate':
      return initiate()
    case 'status':
      return status()
    case 'prove':
      return prove()
    case 'finalize':
      return finalize()
    default:
      die(`unknown command ${cmd}`)
  }

  // =========================================================================
  async function initiate() {
    const account = execute || optionalEnv('OPS_PRIVATE_KEY') ? loadAccount('OPS_PRIVATE_KEY') : undefined
    const from = account?.address ?? parseAddress(env('OPS_ADDRESS'), 'OPS_ADDRESS')

    if (journal) {
      if (!eq(journal.treasury, treasury)) die(`Journal for ${cycle} targets ${journal.treasury}, env has ${treasury}`)
      const receipt = await l2.getTransactionReceipt({ hash: journal.initiate.hash }).catch(() => undefined)
      if (receipt) {
        console.log(`Cycle ${cycle} already initiated in ${journal.initiate.hash} (${receipt.status}). Use "status".`)
        return recordInitiateReceipt(receipt)
      }
      // Signed but not yet mined (e.g. crash after broadcast): rebroadcast the same bytes. Cannot double-spend.
      if (!execute) die(`Cycle ${cycle} has an unmined initiate tx ${journal.initiate.hash}; re-run with --execute to rebroadcast it.`)
      const latest = await l2.getTransactionCount({ address: from, blockTag: 'latest' })
      if (latest > journal.initiate.nonce)
        die(`Nonce ${journal.initiate.nonce} was consumed by another tx and ${journal.initiate.hash} never mined. Reconcile manually before retrying.`)
      await broadcast(journal.initiate.raw)
      return recordInitiateReceipt(await l2.waitForTransactionReceipt({ hash: journal.initiate.hash, timeout: 180_000 }))
    }

    const reserveRaw = env('SWEEP_GAS_RESERVE_CELO')
    const reserve = parseEther(reserveRaw)
    const [balance, fees, pendingNonce, latestNonce] = await Promise.all([
      l2.getBalance({ address: from }),
      l2.estimateFeesPerGas(),
      l2.getTransactionCount({ address: from, blockTag: 'pending' }),
      l2.getTransactionCount({ address: from, blockTag: 'latest' }),
    ])
    if (pendingNonce !== latestNonce) die('Ops wallet has pending transactions. Wait for them (or payout.ts) to finish.')

    const gasCeiling = 200_000n * fees.maxFeePerGas
    let amount: bigint
    if (typeof flags.amount === 'string') {
      if (!/^\d+(\.\d{1,18})?$/.test(flags.amount)) die('--amount must be a plain decimal CELO amount')
      amount = parseEther(flags.amount)
    } else if (flags['all-above-reserve'] === true) {
      amount = balance - reserve - gasCeiling
    } else die('Specify --amount <celo> (the cycle revenue figure from finance) or --all-above-reserve')
    if (amount <= 0n) die(`Nothing to sweep: balance ${formatEther(balance)} CELO, reserve ${reserveRaw}`)
    const cap = optionalEnv('MAX_SWEEP_CELO')
    if (cap && amount > parseEther(cap)) die(`Amount ${formatEther(amount)} exceeds MAX_SWEEP_CELO=${cap}`)

    const data = encodeFunctionData({ abi: messagePasserAbi, functionName: 'initiateWithdrawal', args: [treasury, WITHDRAWAL_L1_GAS, '0x'] })
    const gas = (await l2.estimateGas({ account: from, to: L2_TO_L1_MESSAGE_PASSER, data, value: amount }) * 130n) / 100n
    const gasCost = gas * fees.maxFeePerGas
    const after = balance - amount - gasCost
    const treasuryCode = await l1.getCode({ address: treasury })
    const before = await treasuryL1Balance()

    console.log(`
Cycle             ${cycle}
From (Celo)       ${from}
Ops CELO balance  ${formatEther(balance)}
Sweep amount      ${formatEther(amount)} CELO
Max gas cost      ${formatEther(gasCost)} CELO
Left after sweep  ${formatEther(after)} CELO   (reserve required: ${reserveRaw})
Treasury (L1)     ${treasury}  [${treasuryCode && treasuryCode !== '0x' ? 'has code: contract/Safe or EIP-7702' : 'EOA'}]
Treasury receives CELO ERC-20 ${CELO_L1.celoToken} on Ethereum, current balance ${formatEther(before)}
Route             Celo L2ToL1MessagePasser → OptimismPortal ${CELO_L1.optimismPortal}
Timing            prove in ~0.5–2h, finalize ≥ 7 days after prove`)
    if (after < reserve) die('Sweep would leave the ops wallet below SWEEP_GAS_RESERVE_CELO (needed for payout gas).')
    if (portalPaused) die('The Celo OptimismPortal on L1 is paused. Withdrawals cannot be proven/finalized; do not initiate now.')

    if (!execute) {
      console.log('\nDRY RUN: nothing broadcast. Re-run with --execute.')
      return
    }
    if (!account) die('OPS_PRIVATE_KEY required for --execute')
    const wallet = createWalletClient({ account, chain: celo, transport: http(env('CELO_RPC_URL')) })
    const raw = await wallet.signTransaction({
      account,
      chain: celo,
      to: L2_TO_L1_MESSAGE_PASSER,
      data,
      value: amount,
      gas,
      nonce: latestNonce,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    })
    const j: SweepJournal = {
      kind: 'celo-l1-sweep',
      cycle,
      from,
      treasury,
      amount,
      createdAt: new Date().toISOString(),
      treasuryL1BalanceBefore: before,
      initiate: { nonce: latestNonce, hash: keccak256(raw), raw },
    }
    journal = j
    writeJournal(journalPath, j) // persisted BEFORE broadcast
    await broadcast(raw)
    console.log(`Broadcast ${j.initiate.hash}; waiting for receipt...`)
    await recordInitiateReceipt(await l2.waitForTransactionReceipt({ hash: j.initiate.hash, timeout: 180_000 }))
  }

  async function broadcast(raw: Hex) {
    try {
      await l2.sendRawTransaction({ serializedTransaction: raw })
    } catch (e: any) {
      if (!/already known|known transaction|already imported/i.test(String(e?.details ?? e?.message))) throw e
    }
  }

  async function recordInitiateReceipt(receipt: TransactionReceipt) {
    const j = journal!
    j.initiate.blockNumber = receipt.blockNumber
    j.initiate.status = receipt.status
    if (receipt.status !== 'success') {
      writeJournal(journalPath, j)
      die(`Initiate tx reverted: ${celo.blockExplorers.default.url}/tx/${receipt.transactionHash}. No CELO left the wallet except gas. Delete ${journalPath} only after confirming this.`)
    }
    const [w] = getWithdrawals(receipt)
    if (!w || !eq(w.target, j.treasury) || w.value !== j.amount || !eq(w.sender, j.from))
      die('Initiate receipt does not contain the expected withdrawal (target/value/sender mismatch). Escalate.')
    j.withdrawalHash = w.withdrawalHash
    writeJournal(journalPath, j)
    console.log(`Initiated: ${formatEther(w.value)} CELO → ${w.target} (withdrawal ${w.withdrawalHash})
  ${celo.blockExplorers.default.url}/tx/${receipt.transactionHash}
Next: "sweep.ts prove --cycle ${cycle} --execute" once status shows ready-to-prove.`)
  }

  // =========================================================================
  async function loadInitiated() {
    if (!journal?.initiate.hash) die(`No sweep journal for cycle ${cycle} (${journalPath})`)
    const receipt = await l2.getTransactionReceipt({ hash: journal.initiate.hash })
    if (receipt.status !== 'success') die('Initiate tx reverted; nothing to prove.')
    const [withdrawal] = getWithdrawals(receipt)
    if (!withdrawal) die('No withdrawal in initiate receipt')
    return { receipt, withdrawal }
  }

  async function status() {
    const { receipt, withdrawal } = await loadInitiated()
    const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoWithL1 })
    console.log(`Cycle ${cycle}: ${formatEther(journal!.amount)} CELO → ${journal!.treasury}\nStatus: ${s}`)
    if (s === 'waiting-to-prove') {
      const t = await l1.getTimeToProve({ receipt, targetChain: celoWithL1 })
      console.log(`Provable in ~${Math.ceil(t.seconds / 60)} min`)
    }
    if (s === 'waiting-to-finalize' || s === 'ready-to-finalize') {
      // Portal v5 reads only the portal; viem types still demand l2OutputOracle, hence the cast.
      const t = await l1.getTimeToFinalize({ withdrawalHash: withdrawal.withdrawalHash, targetChain: celoWithL1 } as any)
      // Proof maturity only; the covering dispute game must also be resolved + past its
      // finality delay. getWithdrawalStatus (above) accounts for both.
      console.log(`Proof matures at ${new Date(t.timestamp).toISOString()} (${(t.seconds / 86400).toFixed(2)} days)`)
    }
    if (journal!.finalize) console.log(`Finalized in ${journal!.finalize.hash}; treasury delta ${formatEther(journal!.finalize.treasuryDelta ?? 0n)} CELO`)
  }

  function l1Wallet() {
    const account = loadAccount(optionalEnv('L1_PRIVATE_KEY') ? 'L1_PRIVATE_KEY' : 'OPS_PRIVATE_KEY')
    return createWalletClient({ account, chain: mainnet, transport: l1Transport }).extend(walletActionsL1())
  }

  async function prove() {
    const { receipt } = await loadInitiated()
    const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoWithL1 })
    if (s !== 'ready-to-prove') die(`Status is ${s}, not ready-to-prove. Run "status".`)
    const { game, withdrawal } = await l1.waitToProve({ receipt, targetChain: celoWithL1 })
    const proveArgs = await l2.buildProveWithdrawal({ game, withdrawal } as any)
    if (!execute) {
      console.log(`DRY RUN: proof built against dispute game #${game.index} (L2 block ${game.l2BlockNumber}). Re-run with --execute.`)
      return
    }
    const wallet = l1Wallet()
    const hash = await wallet.proveWithdrawal({ ...proveArgs, account: wallet.account, targetChain: celoWithL1 } as any)
    journal!.prove = { hash, submitter: wallet.account.address, at: new Date().toISOString() }
    writeJournal(journalPath, journal)
    console.log(`Prove tx ${mainnet.blockExplorers.default.url}/tx/${hash}; waiting...`)
    const r = await l1.waitForTransactionReceipt({ hash, timeout: 600_000 })
    journal!.prove.status = r.status
    writeJournal(journalPath, journal)
    if (r.status !== 'success') die('Prove tx reverted. Check status and retry.')
    console.log('Proven. The 7-day proof maturity delay starts now. Finalize after it elapses.')
  }

  async function finalize() {
    const { receipt, withdrawal } = await loadInitiated()
    const s = await l1.getWithdrawalStatus({ receipt, targetChain: celoWithL1 })
    if (s === 'finalized') die('Already finalized. Run "status".')
    if (s !== 'ready-to-finalize') die(`Status is ${s}, not ready-to-finalize. Run "status".`)
    if (!execute) {
      console.log('DRY RUN: withdrawal is ready to finalize. Re-run with --execute.')
      return
    }
    const wallet = l1Wallet()
    const before = await treasuryL1Balance()
    const submitter = journal!.prove?.submitter
    const hash = await wallet.finalizeWithdrawal({
      account: wallet.account,
      targetChain: celoWithL1,
      withdrawal,
      // Portal v3+ keys proofs by submitter; finalize against whoever proved.
      proofSubmitter: submitter && !eq(submitter, wallet.account.address) ? submitter : undefined,
    } as any)
    journal!.finalize = { hash, at: new Date().toISOString() }
    writeJournal(journalPath, journal)
    console.log(`Finalize tx ${mainnet.blockExplorers.default.url}/tx/${hash}; waiting...`)
    const r = await l1.waitForTransactionReceipt({ hash, timeout: 600_000 })
    const ev = parseEventLogs({ abi: l1Abi, eventName: 'WithdrawalFinalized', logs: r.logs }).find((l) => l.args.withdrawalHash === journal!.withdrawalHash)
    const delta = (await treasuryL1Balance()) - before
    Object.assign(journal!.finalize, { status: r.status, portalSuccess: ev?.args.success, treasuryDelta: delta })
    writeJournal(journalPath, journal)
    if (r.status !== 'success' || !ev?.args.success || delta < journal!.amount)
      die(`Finalize did not deliver as expected (status=${r.status}, portalSuccess=${ev?.args.success}, treasury delta=${formatEther(delta)}). Escalate.`)
    console.log(`Done: treasury received ${formatEther(delta)} CELO on Ethereum.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
