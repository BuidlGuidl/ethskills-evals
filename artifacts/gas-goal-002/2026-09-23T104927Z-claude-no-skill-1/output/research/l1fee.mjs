import { client, rpc } from './rpc.mjs'
import { encodeFunctionData, concat, toHex, pad } from 'viem'
import { randomBytes } from 'node:crypto'

const ORACLE = '0x420000000000000000000000000000000000000F'
const ABI = [{ name: 'getL1Fee', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes' }], outputs: [{ type: 'uint256' }] }]
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

const addr = () => toHex(randomBytes(20))
// Realistic 6-decimal payout: a few significant digits, so the high bytes are zero.
const amt = () => BigInt(Math.floor(1e6 + Math.random() * 500e6))

const getL1 = d => rpc(() => client.readContract({ address: ORACLE, abi: ABI, functionName: 'getL1Fee', args: [d] }))

// Approximate the non-calldata part of a signed EIP-1559 tx (nonce, fees, gas, to, sig...).
const ENVELOPE = toHex(randomBytes(110))

const single = encodeFunctionData({
  abi: [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] }],
  functionName: 'transfer', args: [addr(), amt()],
})
const fSingle = await getL1(concat([ENVELOPE, single]))
console.log('single transfer      l1Fee =', fSingle.toString(), 'wei  (mainnet measured mean 3,041,214,931)')

const packedAbi = [{ name: 'payFromBalancePacked', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'bytes' }], outputs: [] }]
const arraysAbi = [{ name: 'payFromBalance', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'address[]' }, { type: 'uint256[]' }], outputs: [] }]

console.log('\n n |   packed l1Fee | per-payment |   arrays l1Fee | per-payment')
for (const n of [10, 25, 50, 100, 250]) {
  const tos = Array.from({ length: n }, addr)
  const amts = Array.from({ length: n }, amt)
  const payload = concat(tos.map((t, i) => concat([t, pad(toHex(amts[i]), { size: 12 })])))
  const dP = encodeFunctionData({ abi: packedAbi, functionName: 'payFromBalancePacked', args: [USDC, payload] })
  const dA = encodeFunctionData({ abi: arraysAbi, functionName: 'payFromBalance', args: [USDC, tos, amts] })
  const fP = await getL1(concat([ENVELOPE, dP]))
  const fA = await getL1(concat([ENVELOPE, dA]))
  console.log(String(n).padStart(3), '|', String(fP).padStart(14), '|', String(fP / BigInt(n)).padStart(11), '|', String(fA).padStart(14), '|', String(fA / BigInt(n)).padStart(11))
}
