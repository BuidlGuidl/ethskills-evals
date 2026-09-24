#!/usr/bin/env node
/**
 * Reference relayer send path: fee policy + batching, wired together.
 *
 * This is the shape the production relayer should adopt. It reads a JSON array of
 * {to, amount} on stdin and pays it out in batches.
 *
 *   BASE_RPC_URL=... RELAYER_KEY=0x... BATCH_PAY=0x... TOKEN=0x... \
 *     node tools/send-batch.mjs < payments.json [--lenient] [--dry-run]
 */
import { createPublicClient, createWalletClient, http, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { packPayments, chunkPayments, assertFloatCovers, DEFAULT_BATCH_SIZE } from './batch.mjs'
import { buildFees, expectedCostWei } from './fee-policy.mjs'

const BATCH_PAY_ABI = [
  { name: 'payFromBalancePacked', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ type: 'address', name: 'token' }, { type: 'bytes', name: 'payload' }], outputs: [] },
  { name: 'payFromBalancePackedLenient', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ type: 'address', name: 'token' }, { type: 'bytes', name: 'payload' }],
    outputs: [{ type: 'uint256', name: 'failures' }] },
]
const ERC20_ABI = [{ name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }]

const lenient = process.argv.includes('--lenient')
const dryRun = process.argv.includes('--dry-run')
const batchSize = Number(process.env.BATCH_SIZE || DEFAULT_BATCH_SIZE)

const payments = JSON.parse(readFileSync(0, 'utf8')).map(p => ({ to: p.to, amount: BigInt(p.amount) }))
const rpc = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const batchPay = process.env.BATCH_PAY
const token = process.env.TOKEN
if (!batchPay || !token) throw new Error('set BATCH_PAY and TOKEN')

const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
const account = privateKeyToAccount(process.env.RELAYER_KEY)
const wallet = createWalletClient({ account, chain: base, transport: http(rpc) })

const float = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [batchPay] })
const total = assertFloatCovers(payments, float)

const batches = chunkPayments(payments, batchSize)
console.log(`${payments.length} payments, total ${total}, float ${float}, ${batches.length} batch(es) of <=${batchSize}`)

let spent = 0n
for (const [i, batch] of batches.entries()) {
  const payload = packPayments(batch)
  const fees = await buildFees(publicClient)
  const fn = lenient ? 'payFromBalancePackedLenient' : 'payFromBalancePacked'

  const gas = await publicClient.estimateContractGas({
    address: batchPay, abi: BATCH_PAY_ABI, functionName: fn, args: [token, payload], account,
  })
  const estCost = expectedCostWei(fees, gas)
  spent += estCost
  console.log(`  batch ${i + 1}/${batches.length}: ${batch.length} payments, gas ${gas} ` +
    `(${(Number(gas) / batch.length).toFixed(0)}/payment), tip ${fees.maxPriorityFeePerGas} wei, ` +
    `est ${formatEther(estCost)} ETH`)

  if (dryRun) continue
  const hash = await wallet.writeContract({
    address: batchPay, abi: BATCH_PAY_ABI, functionName: fn, args: [token, payload],
    gas: (gas * 12n) / 10n, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`    ${receipt.status} ${hash} gasUsed=${receipt.gasUsed} l1Fee=${receipt.l1Fee ?? 0}`)
}
console.log(`estimated total: ${formatEther(spent)} ETH${dryRun ? ' (dry run, nothing sent)' : ''}`)
