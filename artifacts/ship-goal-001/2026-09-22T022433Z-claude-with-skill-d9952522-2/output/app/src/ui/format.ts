import { formatUnits } from 'viem'
import { USDC_DECIMALS } from '@/chain/config'

/** "40" / "2.50" — trailing zeros trimmed, because USDC amounts here are small and human. */
export function usdc(amount: bigint): string {
  const text = formatUnits(amount, USDC_DECIMALS)
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

export function usdcLabel(amount: bigint): string {
  return `${usdc(amount)} USDC`
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function dateTime(unixSeconds: number): string {
  return dateFormat.format(new Date(unixSeconds * 1000))
}

export function dayOnly(unixSeconds: number): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(unixSeconds * 1000),
  )
}

/** "in 3 days" / "2 days ago" — relative to now, rounded to the unit that reads best. */
export function relativeTime(unixSeconds: number, from = Date.now() / 1000): string {
  const seconds = unixSeconds - from
  const absolute = Math.abs(seconds)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (absolute < 3_600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3_600), 'hour')
  return formatter.format(Math.round(seconds / 86_400), 'day')
}

export function reliabilityPercent(reliability: number): string {
  return `${Math.round(reliability * 100)}%`
}
