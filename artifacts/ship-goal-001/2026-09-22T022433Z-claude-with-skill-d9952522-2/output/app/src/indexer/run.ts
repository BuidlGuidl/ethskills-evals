import { syncOnce } from './sync'

/**
 * `npm run indexer` catches up once and exits (good for cron).
 * `npm run indexer:watch` keeps polling (good for a long-running worker).
 */

const watch = process.argv.includes('--watch')
const intervalMs = Number(process.env.INDEXER_INTERVAL_MS ?? 15_000)

async function tick() {
  const started = Date.now()
  const { from, to, events } = await syncOnce()
  console.log(
    `[indexer] blocks ${from}..${to} · ${events} event(s) · ${Date.now() - started}ms`,
  )
}

async function main() {
  await tick()
  if (!watch) return

  let stopping = false
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      stopping = true
      console.log(`[indexer] ${signal} received, stopping after this pass`)
    })
  }

  while (!stopping) {
    await new Promise((r) => setTimeout(r, intervalMs))
    if (stopping) break
    try {
      await tick()
    } catch (error) {
      // Keep the loop alive: a flaky RPC should not require a restart, and the
      // cursor only advances on ranges that were written successfully.
      console.error('[indexer] pass failed, retrying next tick:', error)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
