import express, {type NextFunction, type Request, type Response} from 'express'
import {getAddress, type Address} from 'viem'

import {SubscriptionGate} from './billing.ts'
import {PLAN} from './abi.ts'
import {authenticateSignature, challenge, NonceCache} from './auth.ts'

/**
 * Example weather API with on-chain gating. The only billing-aware part is `requireSubscription`;
 * everything below it is ordinary application code.
 */

const CONTRACT = getAddress(required('BILLING_CONTRACT'))
const RPC_URL = required('RPC_URL')
const HOST = process.env.SERVICE_HOST ?? 'api.example-weather.com'
const PORT = Number(process.env.PORT ?? 3000)

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set`)
  return v
}

const gate = new SubscriptionGate({
  rpcUrl: RPC_URL,
  contract: CONTRACT,
  cacheTtlMs: Number(process.env.GATE_CACHE_TTL_MS ?? 15_000),
  // Default closed. Flip only with a deliberate decision about which failure you prefer; see NOTES.md.
  failOpen: process.env.GATE_FAIL_OPEN === 'true',
})
gate.watch()

/** API keys you issued, mapped to the address that pays for them. Swap for a real datastore. */
const apiKeys = new Map<string, Address>()

const nonces = new NonceCache()

declare global {
  namespace Express {
    interface Request {
      subscriber?: {address: Address; planId: number}
    }
  }
}

const app = express()
app.set('trust proxy', true)

/** Resolve the caller to an address, then ask the chain whether that address is paid up. */
async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  let address: Address | undefined

  const apiKey = req.header('X-Api-Key')
  if (apiKey) {
    address = apiKeys.get(apiKey)
    if (!address) return res.status(401).json({error: 'unknown API key'})
  } else {
    const auth = await authenticateSignature(
      HOST,
      req.header('X-Address'),
      req.header('X-Signature'),
      req.header('X-Timestamp'),
      nonces.asSet(),
    )
    if (!auth.ok) return res.status(401).json({error: auth.reason})
    address = auth.address
  }

  let status
  try {
    status = await gate.statusOf(address)
  } catch {
    return res.status(503).json({error: 'billing lookup unavailable, retry shortly'})
  }

  if (!status.subscribed) {
    // 402 is the honest status code, and it lets a client distinguish "top up" from "bad auth".
    return res.status(402).json({
      error: 'no active subscription',
      address,
      balance: status.balance.toString(),
      hint: 'deposit USDC and call subscribe() on the billing contract',
      contract: CONTRACT,
    })
  }

  // Let clients see a lapse coming rather than discovering it at cutoff.
  res.setHeader('X-Subscription-Expires', String(status.expiresAt))
  res.setHeader('X-Subscription-Plan', status.planId === PLAN.pro ? 'pro' : 'hobby')
  const daysLeft = (status.expiresAt * 1000 - Date.now()) / 86_400_000
  if (daysLeft < 3) res.setHeader('X-Subscription-Warning', `balance runs out in ${daysLeft.toFixed(1)} days`)

  req.subscriber = {address, planId: status.planId}
  next()
}

/** Pro-only endpoints sit behind this as well as the gate above. */
function requirePro(req: Request, res: Response, next: NextFunction) {
  if (req.subscriber?.planId !== PLAN.pro) {
    return res.status(403).json({error: 'this endpoint requires the pro plan'})
  }
  next()
}

/* -------------------------------------------------------------------------- */

/** Unauthenticated: tells a client exactly what to sign. */
app.get('/auth/challenge', (_req, res) => {
  const timestamp = Math.floor(Date.now() / 1000)
  res.json({message: challenge(HOST, timestamp), timestamp, host: HOST})
})

/** Unauthenticated: where to pay, and how much. */
app.get('/billing', (_req, res) => {
  res.json({
    contract: CONTRACT,
    plans: {hobby: {id: PLAN.hobby, usdPerMonth: 5}, pro: {id: PLAN.pro, usdPerMonth: 20}},
  })
})

/** Authenticated but not gated, so a lapsed customer can still see why they were cut off. */
app.get('/account', async (req, res) => {
  const addr = req.header('X-Address')
  if (!addr) return res.status(400).json({error: 'X-Address required'})
  const s = await gate.statusOf(getAddress(addr))
  res.json({...s, balance: s.balance.toString(), accrued: s.accrued.toString()})
})

app.get('/v1/forecast', requireSubscription, (req, res) => {
  res.json({address: req.subscriber!.address, forecast: 'sunny, 21°C'})
})

app.get('/v1/history', requireSubscription, requirePro, (_req, res) => {
  res.json({history: []})
})

/** For your own uptime checks: surfaces gate health, not just process liveness. */
app.get('/healthz', (_req, res) => {
  res.json({ok: true, gate: gate.stats})
})

app.listen(PORT, () => console.log(`weather API listening on :${PORT}, gated by ${CONTRACT}`))
