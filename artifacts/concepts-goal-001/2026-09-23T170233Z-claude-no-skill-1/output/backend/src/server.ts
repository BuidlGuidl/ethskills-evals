import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { base, baseSepolia, foundry } from 'viem/chains'
import { getAddress, isAddress, type Address, type Chain } from 'viem'

import { SubscriptionGate } from './gate.js'
import { ApiKeyStore, enrolmentMessage } from './apiKeys.js'

/**
 * A runnable sketch of the weather API with onchain billing in front of it.
 * The three pieces that matter -- enrol, gate, serve -- are all here; swap the
 * plain node http server for whatever framework you already use.
 */

const CHAINS: Record<string, Chain> = { base, 'base-sepolia': baseSepolia, anvil: foundry }

const chain = CHAINS[process.env.CHAIN ?? 'anvil']
if (!chain) throw new Error(`unknown CHAIN: ${process.env.CHAIN}`)

const contract = process.env.BILLING_ADDRESS
if (!contract || !isAddress(contract)) throw new Error('BILLING_ADDRESS must be set')

const gate = new SubscriptionGate({
  address: getAddress(contract),
  chain,
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
})

const keys = new ApiKeyStore()
setInterval(() => keys.sweepNonces(), 60_000).unref()

// Per-plan request budgets. Plan 1 = hobby, plan 2 = pro.
const RATE_LIMITS: Record<number, number> = { 1: 1_000, 2: 20_000 }
const usage = new Map<string, { windowStart: number; count: number }>()

function rateLimit(address: Address, plan: number): boolean {
  const limit = RATE_LIMITS[plan] ?? 0
  const now = Date.now()
  const key = address.toLowerCase()
  const bucket = usage.get(key)
  if (!bucket || now - bucket.windowStart > 86_400_000) {
    usage.set(key, { windowStart: now, count: 1 })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(payload)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 16_384) throw new Error('body too large')
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  try {
    // 1. Customer asks for a nonce to sign.
    if (req.method === 'POST' && url.pathname === '/auth/nonce') {
      const { nonce, issuedAt } = keys.issueNonce()
      const address = String((await readJson(req)).address ?? '')
      if (!isAddress(address)) return json(res, 400, { error: 'valid address required' })
      return json(res, 200, {
        nonce,
        issuedAt,
        message: enrolmentMessage(getAddress(address), nonce, issuedAt),
      })
    }

    // 2. Customer returns the signature; we mint an API key bound to the address.
    if (req.method === 'POST' && url.pathname === '/auth/enrol') {
      const body = await readJson(req)
      const address = String(body.address ?? '')
      if (!isAddress(address)) return json(res, 400, { error: 'valid address required' })
      try {
        const key = await keys.enrol(
          getAddress(address),
          String(body.nonce ?? ''),
          body.signature as `0x${string}`,
        )
        // Shown once. We only keep a hash.
        return json(res, 200, { apiKey: key, address: getAddress(address) })
      } catch (err) {
        return json(res, 401, { error: (err as Error).message })
      }
    }

    // 3. Every real request goes through the gate.
    if (req.method === 'GET' && url.pathname === '/v1/forecast') {
      const address = keys.resolve(req.headers['x-api-key'] as string | undefined)
      if (!address) return json(res, 401, { error: 'unknown API key' })

      let entitlement
      try {
        entitlement = await gate.check(address)
      } catch (err) {
        // The chain is unreachable and we have nothing cached. This is our
        // problem, not the customer's: 503, never 402.
        console.error('[billing] entitlement check failed', err)
        return json(res, 503, { error: 'billing check temporarily unavailable' })
      }

      if (!entitlement.active) {
        return json(res, 402, {
          error: 'no active subscription',
          address,
          topUp: `https://basescan.org/address/${contract}`,
        })
      }

      if (!rateLimit(address, entitlement.plan)) {
        return json(res, 429, { error: 'plan request limit reached', plan: entitlement.plan })
      }

      res.setHeader('x-subscription-plan', String(entitlement.plan))
      res.setHeader('x-subscription-expires', String(entitlement.expiresAt))
      return json(res, 200, {
        city: url.searchParams.get('city') ?? 'london',
        forecast: 'partly cloudy, 14C',
      })
    }

    // Liveness probe that deliberately does not touch the chain.
    if (url.pathname === '/healthz') return json(res, 200, { ok: true })

    return json(res, 404, { error: 'not found' })
  } catch (err) {
    console.error(err)
    return json(res, 500, { error: 'internal error' })
  }
})

// Invalidate cached entitlements the moment a cancel or top-up lands.
const unwatch = gate.watch()
process.on('SIGTERM', () => {
  unwatch()
  server.close()
})

const port = Number(process.env.PORT ?? 8787)
server.listen(port, () => {
  console.log(`weather api listening on :${port} (billing ${contract} on ${chain.name})`)
})
