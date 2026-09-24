import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
const URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
export const client = createPublicClient({
  chain: base,
  transport: http(URL, { retryCount: 8, retryDelay: 800, batch: false }),
})
let last = 0
const MIN_MS = Number(process.env.RPC_MIN_MS || 110)
export async function throttle() {
  const wait = last + MIN_MS - Date.now()
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  last = Date.now()
}
export async function rpc(fn) { await throttle(); return fn() }
