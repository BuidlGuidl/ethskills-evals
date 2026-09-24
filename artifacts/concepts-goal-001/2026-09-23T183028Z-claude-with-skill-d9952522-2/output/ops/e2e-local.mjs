#!/usr/bin/env node
/**
 * End-to-end rehearsal against a local anvil: deploy, subscribe, bill, cancel, refund,
 * sweep — driven through the *same* backend/subscription-gate.mjs the API will use.
 *
 * The forge tests cover the contract. This covers the seam the forge tests cannot: that
 * the gate module, the ABI the ops scripts carry, and the deployed bytecode agree.
 *
 *   forge build && node ops/e2e-local.mjs
 *
 * Spawns and kills its own anvil on port 8546.
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSubscriptionGate } from '../backend/subscription-gate.mjs'
import { BILLING_ABI } from './abi.mjs'

const PORT = 8546
const RPC = `http://127.0.0.1:${PORT}`
const chain = defineChain({
  id: 31337,
  name: 'anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})

// anvil's first two deterministic accounts
const OWNER = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const ALICE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')

const MONTH = 2_592_000
const usd = (v) => `$${Number(formatUnits(v, 6)).toFixed(4)}`
const artifact = (f, c) => JSON.parse(readFileSync(new URL(`../out/${f}/${c}.json`, import.meta.url)))

let failures = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}
// The hobby plan accrues ~1.93 token units per real second, and this script takes a
// few real seconds to run, so exact equality would be flaky. 1000 units is $0.001.
const SLOP = 1_000n
const near = (a, b, tol = SLOP) => (a > b ? a - b : b - a) <= tol

const anvil = spawn('anvil', ['--port', String(PORT), '--silent'], { stdio: 'inherit' })
process.on('exit', () => anvil.kill())

async function main() {
  const pub = createPublicClient({ chain, transport: http(RPC) })
  for (let i = 0; i < 50; i++) {
    try { await pub.getBlockNumber(); break } catch { await new Promise((r) => setTimeout(r, 100)) }
  }

  const owner = createWalletClient({ account: OWNER, chain, transport: http(RPC) })
  const alice = createWalletClient({ account: ALICE, chain, transport: http(RPC) })
  const mined = (hash) => pub.waitForTransactionReceipt({ hash })

  // ---- deploy ------------------------------------------------------------
  const usdcArt = artifact('MockUSDC.sol', 'MockUSDC')
  const billArt = artifact('SubscriptionBilling.sol', 'SubscriptionBilling')

  const usdc = (await mined(await owner.deployContract({ abi: usdcArt.abi, bytecode: usdcArt.bytecode.object })))
    .contractAddress
  const billing = (
    await mined(
      await owner.deployContract({
        abi: billArt.abi,
        bytecode: billArt.bytecode.object,
        args: [usdc, OWNER.address],
      }),
    )
  ).contractAddress
  console.log(`\nusdc ${usdc}\nbilling ${billing}\n`)

  const write = (w, address, abi, functionName, args) =>
    w.writeContract({ address, abi, functionName, args }).then(mined)
  const read = (functionName, args = []) =>
    pub.readContract({ address: billing, abi: BILLING_ABI, functionName, args })

  const erc20 = parseAbi([
    'function mint(address,uint256)',
    'function approve(address,uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
  ])
  const fullAbi = billArt.abi

  await write(owner, billing, fullAbi, 'setPlan', [1, 5_000_000n, true])
  await write(owner, billing, fullAbi, 'setPlan', [2, 20_000_000n, true])
  await write(owner, usdc, erc20, 'mint', [ALICE.address, 1_000_000_000n])
  await write(alice, usdc, erc20, 'approve', [billing, 2n ** 255n])

  // ---- the gate the API will actually run --------------------------------
  const gate = createSubscriptionGate({ rpcUrl: RPC, contract: billing, chain, maxTtlMs: 50, negativeTtlMs: 50 })

  check('unknown address is refused', (await gate.isSubscribed(OWNER.address)) === false)

  // ---- subscribe ---------------------------------------------------------
  await write(alice, billing, fullAbi, 'depositAndSubscribe', [60_000_000n, 1]) // $60 hobby
  await new Promise((r) => setTimeout(r, 60))
  check('subscriber is served', (await gate.isSubscribed(ALICE.address)) === true)

  const acct = await gate.accountOf(ALICE.address)
  check('dashboard reports the plan', acct.planId === 1 && acct.monthlyUsdc === 5, `plan ${acct.planId}, $${acct.monthlyUsdc}/mo`)
  check('12 months of runway on $60', Math.abs((acct.activeUntil - Date.now()) / 1000 - 12 * MONTH) < 120)

  const cachedHits = gate.stats().rpcCalls
  for (let i = 0; i < 25; i++) await gate.isSubscribed(ALICE.address)
  check('25 API requests cost 0 extra RPC calls', gate.stats().rpcCalls === cachedHits, `${gate.stats().rpcCalls} calls total`)

  // ---- a month passes, nobody sends a transaction -------------------------
  await pub.request({ method: 'evm_increaseTime', params: [`0x${MONTH.toString(16)}`] })
  await pub.request({ method: 'evm_mine', params: [] })

  const accruedNow = (await read('accountOf', [ALICE.address]))[2]
  check('one month billed with no keeper transaction', near(accruedNow, 5_000_000n), usd(accruedNow))
  check('still served', (await gate.isSubscribed(ALICE.address)) === true)

  // ---- operator sweeps ----------------------------------------------------
  const untilBefore = await read('activeUntil', [ALICE.address])
  await write(owner, billing, fullAbi, 'settle', [[ALICE.address]])
  check('settle did not move the subscriber expiry', near(await read('activeUntil', [ALICE.address]), untilBefore, 2n))
  check('revenue is claimable', near(await read('collectedRevenue'), 5_000_000n), usd(await read('collectedRevenue')))

  await write(owner, billing, fullAbi, 'withdrawRevenue', [OWNER.address, 0n])
  const paid = await pub.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [OWNER.address] })
  check('operator was paid', near(paid, 5_000_000n), usd(paid))

  // ---- cancel and refund --------------------------------------------------
  const before = await pub.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [ALICE.address] })
  await write(alice, billing, fullAbi, 'cancelAndWithdraw', [ALICE.address])
  const after = await pub.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [ALICE.address] })
  check('unused 11 months refunded', near(after - before, 55_000_000n), usd(after - before))

  gate.invalidate(ALICE.address)
  check('gate closes after cancellation', (await gate.isSubscribed(ALICE.address)) === false)

  // ---- books balance ------------------------------------------------------
  check('contract owes nothing and holds nothing extra', (await read('solvencySurplus')) === 0n)
  check('no customer float stranded', (await read('totalSubscriberBalance')) === 0n)

  console.log(failures === 0 ? '\nall checks passed\n' : `\n${failures} CHECK(S) FAILED\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
