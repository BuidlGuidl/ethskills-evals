import { createServer } from 'node:http'
import { SubscriptionGate } from './gate.js'
import { ApiKeyIssuer } from './auth.js'
import { PLANS } from './abi.js'

/**
 * The weather API with onchain billing in front of it.
 *
 * Deliberately dependency-free (node:http, no framework) so it can be lifted into whatever
 * you already run. The two pieces worth copying are the gate check in `serveWeather` and
 * the sign-in flow in `/v1/auth/*`.
 *
 *   RPC_URL=...  BILLING_ADDRESS=0x...  API_SECRET=<32+ chars>  npm run gateway
 */

const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const billingAddress = process.env.BILLING_ADDRESS
const secret = process.env.API_SECRET
const port = Number(process.env.PORT ?? 8787)

if (!billingAddress) throw new Error('set BILLING_ADDRESS')
if (!secret) throw new Error('set API_SECRET (32+ random characters)')

const gate = new SubscriptionGate({ rpcUrl, billingAddress })
const issuer = new ApiKeyIssuer({ secret, rpcUrl })

/** Crude per-plan rate limiting, so a hobby key cannot consume a pro budget. */
const usage = new Map()
function underLimit(address, planId) {
  const limit = PLANS[planId]?.requestsPerDay
  if (!limit) return false
  const day = Math.floor(Date.now() / 86_400_000)
  const key = `${address}:${day}`
  const used = (usage.get(key) ?? 0) + 1
  usage.set(key, used)
  return used <= limit
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })
    if (req.method === 'GET' && url.pathname === '/metrics') return json(res, 200, gate.stats)

    if (req.method === 'POST' && url.pathname === '/v1/auth/challenge') {
      const { address } = await body(req)
      return json(res, 200, issuer.challenge(address))
    }

    if (req.method === 'POST' && url.pathname === '/v1/auth/key') {
      const { address, nonce, signature } = await body(req)
      const { apiKey } = await issuer.redeem({ address, nonce, signature })
      return json(res, 200, { apiKey })
    }

    if (req.method === 'GET' && url.pathname === '/v1/weather') {
      return serveWeather(req, res, url)
    }

    return json(res, 404, { error: 'not found' })
  } catch (err) {
    return json(res, 400, { error: err.message })
  }
})

async function serveWeather(req, res, url) {
  const apiKey = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const address = issuer.addressFor(apiKey)
  if (!address) return json(res, 401, { error: 'unknown API key' })

  let status
  try {
    status = await gate.check(address)
  } catch {
    // The chain is the billing ledger, not the product. If it is unreachable and we have
    // no cached answer, failing closed is the honest choice — but say why, loudly.
    console.error('[gateway] billing lookup failed for', address)
    return json(res, 503, { error: 'billing check unavailable, retry shortly' })
  }

  if (!status.active) {
    return json(res, 402, {
      error: 'no active subscription',
      hint: 'top up USDC and call subscribe(planId) on the billing contract',
      contract: billingAddress,
    })
  }

  if (!underLimit(address, status.planId)) {
    return json(res, 429, { error: `daily limit for the ${status.plan} plan reached` })
  }

  // ---- the actual product ----
  const city = url.searchParams.get('city') ?? 'london'
  return json(res, 200, {
    city,
    tempC: 14.2,
    conditions: 'overcast',
    plan: status.plan,
    subscriptionEndsAt: new Date(status.activeUntil * 1000).toISOString(),
  })
}

function json(res, code, payload) {
  const data = JSON.stringify(payload)
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) })
  res.end(data)
}

async function body(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
    if (chunks.reduce((n, c) => n + c.length, 0) > 64 * 1024) throw new Error('body too large')
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}')
}

server.listen(port, () => console.log(`weather api listening on :${port} (billing ${billingAddress})`))

process.on('SIGTERM', () => {
  gate.close()
  server.close(() => process.exit(0))
})
