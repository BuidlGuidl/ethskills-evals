// sweep.ts — move the cycle's CELO revenue from the ops wallet on Celo to the
// treasury wallet on Ethereum mainnet via Celo's canonical OP Stack bridge.
//
// This is NOT a single transfer. Sending CELO to the treasury address on Celo
// leaves it on Celo. Getting it to Ethereum is a 3-step withdrawal:
//
//   1. initiate  (Celo tx, ops key)      burns CELO on Celo, emits a withdrawal
//   2. prove     (Ethereum tx, any key)  ~1h later, once a dispute game covers the block
//   3. finalize  (Ethereum tx, any key)  ≥7 days after prove; releases L1 CELO (ERC-20) to treasury
//
// Commands (all are dry runs unless --execute is given):
//   npx tsx sweep.ts initiate --amount 1234.5   [--execute]
//   npx tsx sweep.ts initiate --max             [--execute]   # balance minus GAS_RESERVE_CELO
//   npx tsx sweep.ts status   <celoTxHash>
//   npx tsx sweep.ts prove    <celoTxHash>      [--execute]
//   npx tsx sweep.ts finalize <celoTxHash>      [--execute]
//
// State for each sweep is written to ./sweeps/<celoTxHash>.json.
// See NOTES.md before running against real money.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack'
import {
  CELO_CHAIN_ID,
  CELO_L1_CONTRACTS,
  L1_CELO_TOKEN,
  MAINNET_CHAIN_ID,
  PLACEHOLDER_TREASURY,
  assertChainId,
  celo,
  celoPublicClient,
  celoRpcUrl,
  confirmPrompt,
  die,
  findReceipt,
  env,
  flag,
  l1RpcUrl,
  loadOpsAccount,
  loadPrivateKey,
  mainnet,
  option,
  parseAddress,
  parseDecimal,
  positionals,
  warn,
} from './common.js'

const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'

// Gas limit for the L1 call to the target. Celo's portal is a custom-gas-token
// portal: on finalize it ERC-20-transfers L1 CELO to the target and, because we
// send empty calldata, makes no call at all. So this only has to be non-zero;
// it is kept generous in case a future portal upgrade reintroduces a call.
const WITHDRAWAL_L1_GAS_LIMIT = 200_000n

const SWEEPS_DIR = 'sweeps'

const messagePasserAbi = parseAbi([
  'function initiateWithdrawal(address _target, uint256 _gasLimit, bytes _data) payable',
])
const portalAbi = parseAbi([
  'function paused() view returns (bool)',
  'function systemConfig() view returns (address)',
  'function disputeGameFactory() view returns (address)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function numProofSubmitters(bytes32) view returns (uint256)',
  'function proofSubmitters(bytes32, uint256) view returns (address)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
])
const systemConfigAbi = parseAbi(['function gasPayingToken() view returns (address addr, uint8 decimals)'])

type SweepState = {
  celoTxHash: Hex
  rawTx: Hex
  withdrawalHash?: Hex
  ops: Address
  treasury: Address
  amountWei: string
  amountCelo: string
  l2BlockNumber?: string
  initiatedAt: string
  proveTxHash?: Hex
  provedAt?: string
  finalizeTxHash?: Hex
  finalizedAt?: string
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function loadTreasury(): Address {
  const treasury = parseAddress(env('TREASURY_ADDRESS'), 'TREASURY_ADDRESS')
  if (treasury === L1_CELO_TOKEN || treasury === CELO_L1_CONTRACTS.portal)
    die('TREASURY_ADDRESS is a bridge/token contract; the portal rejects that target.')
  if (treasury === PLACEHOLDER_TREASURY)
    die('TREASURY_ADDRESS is still the 0x1111… placeholder. Set the real Ethereum mainnet treasury address.')
  return treasury
}

function l2Client() {
  return celoPublicClient().extend(publicActionsL2())
}

function l1Client() {
  return createPublicClient({ chain: mainnet, transport: http(l1RpcUrl()) }).extend(publicActionsL1())
}

/** Verify the pinned bridge addresses against each other on-chain before trusting them. */
async function checkBridge(l1: ReturnType<typeof l1Client>) {
  await assertChainId(l1, MAINNET_CHAIN_ID, 'ETH_RPC_URL')
  const p = CELO_L1_CONTRACTS.portal
  const [paused, sc, dgf] = await Promise.all([
    l1.readContract({ address: p, abi: portalAbi, functionName: 'paused' }),
    l1.readContract({ address: p, abi: portalAbi, functionName: 'systemConfig' }),
    l1.readContract({ address: p, abi: portalAbi, functionName: 'disputeGameFactory' }),
  ])
  if (sc !== CELO_L1_CONTRACTS.systemConfig) die(`Portal systemConfig is ${sc}, expected ${CELO_L1_CONTRACTS.systemConfig}.`)
  if (dgf !== CELO_L1_CONTRACTS.disputeGameFactory)
    die(`Portal disputeGameFactory is ${dgf}, expected ${CELO_L1_CONTRACTS.disputeGameFactory}. Bridge was upgraded; re-verify addresses.`)
  const [token] = await l1.readContract({ address: sc, abi: systemConfigAbi, functionName: 'gasPayingToken' })
  if (token !== L1_CELO_TOKEN) die(`Celo gas-paying token on L1 is ${token}, expected ${L1_CELO_TOKEN}.`)
  if (paused) die('The Celo OptimismPortal on Ethereum is PAUSED. Do not initiate, prove or finalize until it is unpaused.')
}

function statePath(hash: Hex) {
  return `${SWEEPS_DIR}/${hash}.json`
}
function saveState(s: SweepState) {
  mkdirSync(SWEEPS_DIR, { recursive: true })
  writeFileSync(statePath(s.celoTxHash), `${JSON.stringify(s, null, 2)}\n`)
}
function loadState(hash: string): SweepState {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) die(`"${hash}" is not a tx hash.`)
  const path = statePath(hash as Hex)
  if (!existsSync(path)) die(`No state file ${path}. Pass the Celo tx hash printed by "initiate".`)
  return JSON.parse(readFileSync(path, 'utf8')) as SweepState
}

function fmtDuration(seconds: number) {
  if (seconds <= 0) return 'now'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.ceil((seconds % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// initiate
// ---------------------------------------------------------------------------

async function initiate(args: string[], execute: boolean) {
  const amountArg = option(args, '--amount')
  const max = flag(args, '--max')
  if (!!amountArg === max) die('Pass exactly one of --amount <CELO> or --max.')

  const { address: ops, account } = loadOpsAccount(execute)
  const treasury = loadTreasury()
  const reserve = parseDecimal(env('GAS_RESERVE_CELO'), 18, 'GAS_RESERVE_CELO')

  const l2 = l2Client()
  const l1 = l1Client()
  await assertChainId(l2, CELO_CHAIN_ID, 'CELO_RPC_URL')
  await checkBridge(l1)

  const [balance, pending, latest, treasuryCodeL1, treasuryCodeCelo, fees, proofDelay, gameDelay] = await Promise.all([
    l2.getBalance({ address: ops }),
    l2.getTransactionCount({ address: ops, blockTag: 'pending' }),
    l2.getTransactionCount({ address: ops, blockTag: 'latest' }),
    l1.getCode({ address: treasury }),
    l2.getCode({ address: treasury }),
    l2.estimateFeesPerGas(),
    l1.readContract({ address: CELO_L1_CONTRACTS.portal, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
    l1.readContract({ address: CELO_L1_CONTRACTS.portal, abi: portalAbi, functionName: 'disputeGameFinalityDelaySeconds' }),
  ])
  if (pending !== latest) die(`Ops wallet has ${pending - latest} pending tx(s). Wait for them (e.g. a payout run) to clear.`)

  // Gas for the initiate tx itself, with headroom; it comes out of the same CELO balance.
  const data = encodeFunctionData({
    abi: messagePasserAbi,
    functionName: 'initiateWithdrawal',
    args: [treasury, WITHDRAWAL_L1_GAS_LIMIT, '0x'],
  })
  const probeValue = balance > reserve ? 1n : 0n
  const gas = (await l2.estimateGas({ account: ops, to: L2_TO_L1_MESSAGE_PASSER, data, value: probeValue }) * 15n) / 10n
  const maxFeePerGas = fees.maxFeePerGas * 2n
  const gasCost = gas * maxFeePerGas

  const available = balance - reserve - gasCost
  const amount = max ? available : parseDecimal(amountArg!, 18, '--amount')
  if (amount <= 0n)
    die(`Nothing to sweep: balance ${formatEther(balance)} CELO, reserve ${formatEther(reserve)}, gas ~${formatEther(gasCost)}.`)
  if (amount > available)
    die(
      `Sweeping ${formatEther(amount)} CELO would leave less than GAS_RESERVE_CELO (${formatEther(reserve)}) for payout gas. ` +
        `Max sweepable right now: ${formatEther(available > 0n ? available : 0n)}.`,
    )

  // Re-simulate with the real amount.
  await l2.call({ account: ops, to: L2_TO_L1_MESSAGE_PASSER, data, value: amount }).catch((e: Error) =>
    die(`initiateWithdrawal would revert: ${e.message.split('\n')[0]}`),
  )

  console.log(`\nFrom (Celo):        ${ops}`)
  console.log(`To (Ethereum):      ${treasury}  [${treasuryCodeL1 ? 'contract, e.g. Safe' : 'EOA'} on Ethereum]`)
  if (treasuryCodeL1 && !treasuryCodeCelo)
    console.log('                    (no contract at this address on Celo — correct: funds must NOT be sent to it on Celo)')
  console.log(`Amount:             ${formatEther(amount)} CELO  → arrives as ERC-20 ${L1_CELO_TOKEN} on Ethereum`)
  console.log(`Ops balance:        ${formatEther(balance)} CELO → ~${formatEther(balance - amount - gasCost)} left (reserve ${formatEther(reserve)})`)
  console.log(`Bridge:             Celo OptimismPortal ${CELO_L1_CONTRACTS.portal}`)
  console.log(`Timing:             prove after ~1h, finalize ${fmtDuration(Number(proofDelay))} after prove`)
  console.log(`                    (game finality delay ${fmtDuration(Number(gameDelay))}); treasury credited ~7 days from now`)

  if (!execute) {
    console.log(`\nDRY RUN OK. Re-run with --execute to broadcast.`)
    return
  }

  await confirmPrompt(`SWEEP ${formatEther(amount)} CELO TO ${treasury}`)

  const wallet = createWalletClient({ account: account!, chain: celo, transport: http(celoRpcUrl()) })
  const request = await wallet.prepareTransactionRequest({
    to: L2_TO_L1_MESSAGE_PASSER,
    data,
    value: amount,
    gas,
    nonce: latest,
  })
  const rawTx = await wallet.signTransaction(request)
  const celoTxHash = keccak256(rawTx)

  const state: SweepState = {
    celoTxHash,
    rawTx,
    ops,
    treasury,
    amountWei: amount.toString(),
    amountCelo: formatEther(amount),
    initiatedAt: new Date().toISOString(),
  }
  saveState(state) // before broadcast, so the hash is never lost
  console.log(`\nSigned ${celoTxHash}; state in ${statePath(celoTxHash)}. Broadcasting…`)

  await l2.sendRawTransaction({ serializedTransaction: rawTx })
  const receipt = await l2.waitForTransactionReceipt({ hash: celoTxHash, timeout: 180_000 })
  if (receipt.status !== 'success') die(`Initiate tx ${celoTxHash} REVERTED. No CELO left the ops wallet except gas.`)

  const [withdrawal] = getWithdrawals(receipt)
  if (!withdrawal) die(`No MessagePassed event in ${celoTxHash}; investigate.`)
  state.withdrawalHash = withdrawal.withdrawalHash
  state.l2BlockNumber = receipt.blockNumber.toString()
  saveState(state)

  console.log(`\n✓ Initiated in Celo block ${receipt.blockNumber}`)
  console.log(`  withdrawal hash ${withdrawal.withdrawalHash}`)
  console.log(`  Next: npx tsx sweep.ts status ${celoTxHash}   (prove becomes available in ~1h)`)
}

// ---------------------------------------------------------------------------
// status / prove / finalize
// ---------------------------------------------------------------------------

async function loadWithdrawal(hash: string) {
  const state = loadState(hash)
  const l2 = l2Client()
  const l1 = l1Client()
  await assertChainId(l2, CELO_CHAIN_ID, 'CELO_RPC_URL')
  await checkBridge(l1)
  const receipt = await findReceipt(l2, state.celoTxHash)
  if (!receipt)
    die(
      `Celo tx ${state.celoTxHash} not found. If "initiate" crashed right after signing, rebroadcast with:\n` +
        `  cast publish --rpc-url $CELO_RPC_URL ${state.rawTx}\n` +
        '(identical signed bytes, so it cannot double-spend; if the ops nonce has moved past it, it was dropped and nothing left the wallet).',
    )
  if (receipt.status !== 'success') die(`Celo tx ${state.celoTxHash} reverted; nothing to bridge.`)
  if (!state.withdrawalHash) {
    const [w] = getWithdrawals(receipt)
    state.withdrawalHash = w!.withdrawalHash
    state.l2BlockNumber = receipt.blockNumber.toString()
    saveState(state)
  }
  const status = await l1.getWithdrawalStatus({ receipt, targetChain: celo })
  return { state, receipt, l1, l2, status }
}

async function treasuryL1Balance(l1: ReturnType<typeof l1Client>, treasury: Address) {
  return l1.readContract({ address: L1_CELO_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] })
}

async function status(hash: string) {
  const { state, receipt, l1, status } = await loadWithdrawal(hash)
  console.log(`Sweep:      ${state.amountCelo} CELO  ${state.ops} (Celo) → ${state.treasury} (Ethereum)`)
  console.log(`Initiated:  ${state.initiatedAt}  Celo block ${receipt.blockNumber}`)
  console.log(`Status:     ${status}`)
  if (status === 'waiting-to-prove') {
    const t = await l1.getTimeToProve({ receipt, targetChain: celo }).catch(() => undefined)
    console.log(`Prove in:   ${t ? fmtDuration(t.seconds) : 'unknown (waiting for next dispute game)'}`)
  }
  if (status === 'waiting-to-finalize') {
    const t = await timeToFinalize(l1, state.withdrawalHash!)
    console.log(`Finalize:   in ${fmtDuration(t.seconds)} (≈ ${new Date(t.timestamp).toISOString()})`)
  }
  if (status === 'ready-to-prove') console.log(`Next:       npx tsx sweep.ts prove ${state.celoTxHash} --execute`)
  if (status === 'ready-to-finalize') console.log(`Next:       npx tsx sweep.ts finalize ${state.celoTxHash} --execute`)
  console.log(`Treasury L1 CELO balance: ${formatEther(await treasuryL1Balance(l1, state.treasury))}`)
}

/** Seconds until finalize is allowed, based on the first proof (the one finalize uses). */
async function timeToFinalize(l1: ReturnType<typeof l1Client>, withdrawalHash: Hex) {
  const portal = CELO_L1_CONTRACTS.portal
  const submitter = await l1.readContract({ address: portal, abi: portalAbi, functionName: 'proofSubmitters', args: [withdrawalHash, 0n] })
  const [[, provenAt], delay] = await Promise.all([
    l1.readContract({ address: portal, abi: portalAbi, functionName: 'provenWithdrawals', args: [withdrawalHash, submitter] }),
    l1.readContract({ address: portal, abi: portalAbi, functionName: 'proofMaturityDelaySeconds' }),
  ])
  const at = Number(provenAt + delay) + 60 // small buffer for L1 block timestamps
  return { seconds: Math.max(0, at - Math.floor(Date.now() / 1000)), timestamp: at * 1000 }
}

function l1Wallet() {
  const account = privateKeyToAccount(loadPrivateKey('L1_PRIVATE_KEY'))
  return createWalletClient({ account, chain: mainnet, transport: http(l1RpcUrl()) }).extend(walletActionsL1())
}

async function prove(hash: string, execute: boolean) {
  const { state, receipt, l1, l2, status } = await loadWithdrawal(hash)
  if (status !== 'ready-to-prove') die(`Status is "${status}", not "ready-to-prove". Run "status" for timing.`)

  const [withdrawal] = getWithdrawals(receipt)
  const game = await l1.getGame({ l2BlockNumber: receipt.blockNumber, targetChain: celo })
  const args = await l2.buildProveWithdrawal({ game, withdrawal: withdrawal! })

  const proveGas = await l1
    .estimateProveWithdrawalGas({ ...args, targetChain: celo, account: state.treasury })
    .catch((e: Error) => die(`prove would revert: ${e.message.split('\n')[0]}`))

  if (!execute) {
    console.log(`Ready to prove (~${proveGas} gas) ${state.amountCelo} CELO against dispute game #${game.index} (L2 block ${game.l2BlockNumber}).`)
    console.log('DRY RUN OK. Re-run with --execute (needs L1_PRIVATE_KEY with a little ETH).')
    return
  }
  const wallet = l1Wallet()
  await confirmPrompt('PROVE')
  const tx = await wallet.proveWithdrawal({ ...args, targetChain: celo, account: wallet.account })
  console.log(`Prove tx ${tx} sent; waiting…`)
  const rc = await l1.waitForTransactionReceipt({ hash: tx })
  if (rc.status !== 'success') die(`Prove tx ${tx} reverted.`)
  state.proveTxHash = tx
  state.provedAt = new Date().toISOString()
  saveState(state)
  const t = await timeToFinalize(l1, state.withdrawalHash!)
  console.log(`✓ Proven. Finalize available in ${fmtDuration(t.seconds)} (≈ ${new Date(t.timestamp).toISOString()}).`)
}

async function finalize(hash: string, execute: boolean) {
  const { state, receipt, l1, status } = await loadWithdrawal(hash)
  if (status === 'finalized') {
    console.log('Already finalized. Nothing to do.')
    return
  }
  if (status !== 'ready-to-finalize') die(`Status is "${status}", not "ready-to-finalize". Run "status" for timing.`)

  const [withdrawal] = getWithdrawals(receipt)
  // The proof is keyed by whoever submitted it; finalize against that proof so
  // any L1 key can finalize, not only the one that proved.
  const proofSubmitter = await l1.readContract({
    address: CELO_L1_CONTRACTS.portal,
    abi: portalAbi,
    functionName: 'proofSubmitters',
    args: [state.withdrawalHash!, 0n],
  })
  const before = await treasuryL1Balance(l1, state.treasury)

  // Simulate against the live portal so a bad proof/game shows up before we spend L1 gas.
  const finalizeGas = await l1
    .estimateFinalizeWithdrawalGas({ withdrawal: withdrawal!, proofSubmitter, targetChain: celo, account: state.treasury })
    .catch((e: Error) => die(`finalize would revert: ${e.message.split('\n')[0]}`))

  if (!execute) {
    console.log(`Ready to finalize ${state.amountCelo} CELO to ${state.treasury} (proof by ${proofSubmitter}, ~${finalizeGas} gas).`)
    console.log('DRY RUN OK. Re-run with --execute (needs L1_PRIVATE_KEY with a little ETH).')
    return
  }
  const wallet = l1Wallet()
  await confirmPrompt('FINALIZE')
  const tx = await wallet.finalizeWithdrawal({
    withdrawal: withdrawal!,
    proofSubmitter,
    targetChain: celo,
    account: wallet.account,
  })
  console.log(`Finalize tx ${tx} sent; waiting…`)
  const rc = await l1.waitForTransactionReceipt({ hash: tx })
  if (rc.status !== 'success') die(`Finalize tx ${tx} reverted.`)
  state.finalizeTxHash = tx
  state.finalizedAt = new Date().toISOString()
  saveState(state)

  const after = await treasuryL1Balance(l1, state.treasury)
  const delta = after - before
  console.log(`✓ Finalized. Treasury L1 CELO: ${formatEther(before)} → ${formatEther(after)} (+${formatEther(delta)})`)
  if (delta !== BigInt(state.amountWei))
    warn(`Treasury received ${formatEther(delta)} but sweep amount was ${state.amountCelo}. Check other inflows and the finalize tx.`)
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const execute = flag(args, '--execute')
  const [cmd, hash] = positionals(args, ['--amount', '--confirm'])
  switch (cmd) {
    case 'initiate':
      return initiate(args, execute)
    case 'status':
      return status(hash ?? die('usage: sweep.ts status <celoTxHash>'))
    case 'prove':
      return prove(hash ?? die('usage: sweep.ts prove <celoTxHash>'), execute)
    case 'finalize':
      return finalize(hash ?? die('usage: sweep.ts finalize <celoTxHash>'), execute)
    default:
      die('usage: npx tsx sweep.ts <initiate|status|prove|finalize> … (see header of sweep.ts)')
  }
}

main().catch((e) => die((e as Error).stack ?? String(e)))
