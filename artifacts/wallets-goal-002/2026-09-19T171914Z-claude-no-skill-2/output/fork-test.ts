/**
 * fork-test.ts — end-to-end rehearsal on an anvil fork of mainnet.
 *
 *   FORK_RPC_URL=https://... tsx fork-test.ts
 *
 * Deploys a real Safe v1.4.1 (2-of-3), executes the exact setup batch from
 * setup-roles.ts through the Safe (MultiSendCallOnly), funds the Safe, then:
 *   - runs preflight
 *   - executes real swaps through rebalance.ts (both directions)
 *   - proves idempotency and the HALT switch
 *   - proves the agent key CANNOT: change recipient, change pool fee, use another
 *     token, skip minOut, exceed the daily allowance, delegatecall, call other
 *     contracts, or trade at all after the revoke batch.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type Address,
  type Hex,
  concat,
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  http,
  keccak256,
  pad,
  parseAbi,
  parseEther,
  parseEventLogs,
  parseUnits,
  size,
  toHex,
  zeroAddress,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { type Config, DEFAULT_ROLE_KEY, MAINNET, erc20Abi, executeRebalance, loadConfig, preflight, rolesAbi, swapRouterAbi } from './rebalance.ts'
import { buildRevokeBatch, buildSetupBatch, type SafeTx } from './setup-roles.ts'

const PORT = 8547
const ANVIL = `http://127.0.0.1:${PORT}`
const SAFE141 = {
  FACTORY: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  SINGLETON: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  FALLBACK: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
  MULTISEND_CALL_ONLY: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
} as const
// anvil default dev keys (public, test only)
const OWNER_KEYS: Hex[] = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3faf5c5f4b3e8a4d',
]

const safeAbi = parseAbi([
  'function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function approveHash(bytes32 hashToApprove)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)',
  'event ExecutionFailure(bytes32 txHash, uint256 payment)',
])
const factoryAbi = parseAbi([
  'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'event ProxyCreation(address indexed proxy, address singleton)',
])

let failures = 0
function check(name: string, ok: boolean, extra: unknown = '') {
  console.log(`${ok ? '  ✔' : '  ✘'} ${name} ${extra === '' ? '' : JSON.stringify(extra, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`)
  if (!ok) failures++
}

async function main() {
  const forkUrl = process.env.FORK_RPC_URL ?? 'https://ethereum-rpc.publicnode.com'
  const anvil = spawn('anvil', ['--fork-url', forkUrl, '--port', String(PORT), '--silent', '--chain-id', '1'], { stdio: 'inherit' })
  const stateDir = mkdtempSync(join(tmpdir(), 'rebalancer-'))
  try {
    const pub = createPublicClient({ chain: mainnet, transport: http(ANVIL) })
    const test = createTestClient({ chain: mainnet, mode: 'anvil', transport: http(ANVIL) })
    for (let i = 0; ; i++) {
      try {
        await pub.getBlockNumber()
        break
      } catch {
        if (i > 60) throw new Error('anvil did not start')
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    const owners = OWNER_KEYS.map((k) => privateKeyToAccount(k))
    const wallet = (i: number) => createWalletClient({ chain: mainnet, account: owners[i], transport: http(ANVIL) })
    const agentKey = generatePrivateKey()
    const agent = privateKeyToAccount(agentKey)
    const attacker = privateKeyToAccount(generatePrivateKey()).address
    for (const o of owners) await test.setBalance({ address: o.address, value: parseEther('10') })

    // ── 1. Treasury Safe (2-of-3) ────────────────────────────────────────────
    console.log('1. deploy Safe 2-of-3')
    const init = encodeFunctionData({ abi: safeAbi, functionName: 'setup', args: [owners.map((o) => o.address), 2n, zeroAddress, '0x', SAFE141.FALLBACK, zeroAddress, 0n, zeroAddress] })
    const h = await wallet(0).writeContract({ address: SAFE141.FACTORY, abi: factoryAbi, functionName: 'createProxyWithNonce', args: [SAFE141.SINGLETON, init, BigInt(Date.now())] })
    const rc = await pub.waitForTransactionReceipt({ hash: h })
    const safe = parseEventLogs({ abi: factoryAbi, logs: rc.logs, eventName: 'ProxyCreation' })[0].args.proxy
    console.log('   safe', safe)

    async function execAsSafe(txs: SafeTx[]) {
      const packed = concat(txs.map((t) => encodePacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [0, t.to, BigInt(t.value), BigInt(size(t.data)), t.data])))
      const data = encodeFunctionData({ abi: parseAbi(['function multiSend(bytes transactions)']), functionName: 'multiSend', args: [packed] })
      const nonce = await pub.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' })
      const args = [SAFE141.MULTISEND_CALL_ONLY, 0n, data, 1, 0n, 0n, 0n, zeroAddress, zeroAddress] as const
      const txHash = await pub.readContract({ address: safe, abi: safeAbi, functionName: 'getTransactionHash', args: [...args, nonce] })
      const signers = [owners[0], owners[1]].sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1))
      for (const s of signers) await pub.waitForTransactionReceipt({ hash: await wallet(owners.indexOf(s)).writeContract({ address: safe, abi: safeAbi, functionName: 'approveHash', args: [txHash] }) })
      // approved-hash signatures: r = owner, s = 0, v = 1
      const sigs = concat(signers.map((s) => concat([pad(s.address, { size: 32 }), pad('0x00', { size: 32 }), '0x01'])))
      const eh = await wallet(2).writeContract({ address: safe, abi: safeAbi, functionName: 'execTransaction', args: [...args, sigs], gas: 3_000_000n })
      const r = await pub.waitForTransactionReceipt({ hash: eh })
      const failed = parseEventLogs({ abi: safeAbi, logs: r.logs, eventName: 'ExecutionFailure' }).length > 0
      if (r.status !== 'success' || failed) throw new Error('Safe batch failed')
      return r
    }

    // ── 2. Setup batch, exactly as owners would sign it ──────────────────────
    console.log('2. execute setup batch through the Safe')
    const block = await pub.getBlock()
    const { roles, txs } = buildSetupBatch({ safe, agent: agent.address, wethPerDay: parseUnits('40', 18), usdcPerDay: parseUnits('100000', 6), saltNonce: 1n, nowSec: block.timestamp })
    const setupRc = await execAsSafe(txs)
    console.log(`   roles ${roles}, gas used ${setupRc.gasUsed}`)
    check('Roles proxy deployed at predicted address', !!(await pub.getCode({ address: roles })))

    // ── 3. Fund treasury and agent gas ───────────────────────────────────────
    console.log('3. fund Safe with 100 WETH + 300k USDC, agent with 0.5 ETH')
    await test.setBalance({ address: safe, value: parseEther('101') })
    await test.impersonateAccount({ address: safe })
    await pub.waitForTransactionReceipt({
      hash: await createWalletClient({ chain: mainnet, transport: http(ANVIL) }).sendTransaction({ account: safe, to: MAINNET.WETH, value: parseEther('100'), data: '0xd0e30db0' }),
    })
    await test.stopImpersonatingAccount({ address: safe })
    // USDC (FiatTokenV2_2): balanceAndBlacklistStates mapping at slot 9
    const usdcSlot = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [safe, 9n]))
    await test.setStorageAt({ address: MAINNET.USDC, index: usdcSlot, value: pad(toHex(parseUnits('300000', 6)), { size: 32 }) })
    await test.setBalance({ address: agent.address, value: parseEther('0.5') })
    const bal = async () => ({
      weth: await pub.readContract({ address: MAINNET.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [safe] }),
      usdc: await pub.readContract({ address: MAINNET.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [safe] }),
    })
    const b0 = await bal()
    check('Safe funded', b0.weth === parseEther('100') && b0.usdc === parseUnits('300000', 6), { weth: formatUnits(b0.weth, 18), usdc: formatUnits(b0.usdc, 6) })

    // ── 4. rebalance.ts against the fork ─────────────────────────────────────
    Object.assign(process.env, {
      READ_RPC_URL: ANVIL,
      SUBMIT_RPC_URL: ANVIL, // on mainnet: Flashbots Protect
      AGENT_PRIVATE_KEY: agentKey,
      TREASURY_SAFE: safe,
      ROLES_MODIFIER: roles,
      STATE_DIR: stateDir,
      MIN_AGENT_ETH: '0.05',
    })
    const cfg: Config = loadConfig()
    console.log('4. preflight')
    check('preflight passes', await preflight(cfg))

    console.log('5. trades')
    const r1 = await executeRebalance({ direction: 'SELL_WETH', amountIn: parseEther('5'), id: 'sig-1', reason: 'fork test' }, { cfg })
    check('SELL 5 WETH executed', r1.status === 'executed', r1)
    const r2 = await executeRebalance({ direction: 'BUY_WETH', amountIn: parseUnits('20000', 6), id: 'sig-2', reason: 'fork test' }, { cfg })
    check('BUY with 20k USDC executed', r2.status === 'executed', r2)
    const r3 = await executeRebalance({ direction: 'SELL_WETH', amountIn: parseEther('5'), id: 'sig-1' }, { cfg })
    check('same decision id is not executed twice', r3.status === 'skipped', r3)
    const r4 = await executeRebalance({ direction: 'SELL_WETH', amountIn: parseEther('50') }, { cfg })
    check('oversized trade refused off-chain', r4.status === 'skipped', r4)
    const r5 = await executeRebalance({ direction: 'SELL_WETH', amountIn: parseEther('2') }, { cfg, dryRun: true })
    check('dry run simulates without sending', r5.status === 'dry-run', r5)
    const b1 = await bal()
    console.log('   Safe after trades:', { weth: formatUnits(b1.weth, 18), usdc: formatUnits(b1.usdc, 6) })

    writeFileSync(join(stateDir, 'HALT'), 'test halt')
    const r6 = await executeRebalance({ direction: 'SELL_WETH', amountIn: parseEther('1') }, { cfg })
    check('HALT file stops trading', r6.status === 'skipped', r6)
    rmSync(join(stateDir, 'HALT'))

    // ── 6. What a stolen agent key can NOT do (on-chain enforcement) ─────────
    console.log('6. on-chain permission boundaries (simulated from the agent key, bypassing rebalance.ts)')
    const now = (await pub.getBlock()).timestamp
    const swap = (o: Partial<{ tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint; amountOutMinimum: bigint }>) =>
      encodeFunctionData({
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [{ tokenIn: MAINNET.WETH, tokenOut: MAINNET.USDC, fee: 500, recipient: safe, deadline: now + 7n * 86_400n, amountIn: parseEther('1'), amountOutMinimum: 1n, sqrtPriceLimitX96: 0n, ...o }],
      })
    const tryExec = async (to: Address, data: Hex, operation = 0, from: Address = agent.address) => {
      try {
        await pub.simulateContract({ account: from, address: roles, abi: rolesAbi, functionName: 'execTransactionWithRole', args: [to, 0n, data, operation, DEFAULT_ROLE_KEY, true] })
        return 'ALLOWED'
      } catch (e: any) {
        return (e.walk?.((x: any) => x?.data?.errorName)?.data?.errorName as string) ?? e.shortMessage ?? 'reverted'
      }
    }
    check('control: a valid 1 WETH swap to the Safe is allowed', (await tryExec(MAINNET.SWAP_ROUTER, swap({}))) === 'ALLOWED')
    for (const [name, to, data, op] of [
      ['recipient = attacker', MAINNET.SWAP_ROUTER, swap({ recipient: attacker }), 0],
      ['fee tier 3000 (other pool)', MAINNET.SWAP_ROUTER, swap({ fee: 3000 }), 0],
      ['fee tier 10000 (thin pool)', MAINNET.SWAP_ROUTER, swap({ fee: 10000 }), 0],
      ['tokenOut = DAI', MAINNET.SWAP_ROUTER, swap({ tokenOut: '0x6B175474E89094C44Da98b954EedeAC495271d0F' }), 0],
      ['amountOutMinimum = 0', MAINNET.SWAP_ROUTER, swap({ amountOutMinimum: 0n }), 0],
      ['amountIn above remaining daily WETH allowance (36 WETH)', MAINNET.SWAP_ROUTER, swap({ amountIn: parseEther('36') }), 0],
      ['delegatecall to router', MAINNET.SWAP_ROUTER, swap({}), 1],
      ['WETH.transfer to attacker', MAINNET.WETH, encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256)']), functionName: 'transfer', args: [attacker, 1n] }), 0],
      ['USDC.approve attacker', MAINNET.USDC, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [attacker, 1n] }), 0],
    ] as const) {
      const res = await tryExec(to, data, op)
      check(`blocked: ${name}`, res !== 'ALLOWED', res)
    }
    check('blocked: non-member address', (await tryExec(MAINNET.SWAP_ROUTER, swap({}), 0, attacker)) !== 'ALLOWED')
    check('allowed: 35 WETH (remaining allowance after 5 used)', (await tryExec(MAINNET.SWAP_ROUTER, swap({ amountIn: parseEther('35') }))) === 'ALLOWED')

    // allowance refills after 24h
    await test.increaseTime({ seconds: 86_400 })
    await test.mine({ blocks: 1 })
    check('after 24h: 40 WETH allowed again', (await tryExec(MAINNET.SWAP_ROUTER, swap({ amountIn: parseEther('40'), amountOutMinimum: 1n }))) === 'ALLOWED')

    // ── 7. Emergency revoke ──────────────────────────────────────────────────
    console.log('7. emergency revoke batch')
    await execAsSafe(buildRevokeBatch({ roles, agent: agent.address }))
    check('after revoke: agent cannot trade', (await tryExec(MAINNET.SWAP_ROUTER, swap({}))) !== 'ALLOWED')
  } finally {
    anvil.kill()
    rmSync(stateDir, { recursive: true, force: true })
  }
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e?.shortMessage ?? e, e?.metaMessages ?? '')
  process.exit(1)
})
