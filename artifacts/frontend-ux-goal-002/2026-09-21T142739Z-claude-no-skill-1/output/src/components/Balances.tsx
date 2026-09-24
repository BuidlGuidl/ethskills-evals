'use client'

import { formatEth, formatUsdc } from '@/lib/format'
import type { usePayerBalances } from '@/lib/usePayerBalances'

type Props = ReturnType<typeof usePayerBalances>

export function Balances({ eth, usdc }: Props) {
  return (
    <dl className="balances">
      <div className="balance">
        <dt>USDC</dt>
        <dd>{usdc.data !== undefined ? formatUsdc(usdc.data) : usdc.isError ? 'Unavailable' : '…'}</dd>
      </div>
      <div className="balance">
        <dt>ETH (for gas)</dt>
        <dd>{eth.data ? formatEth(eth.data.value) : eth.isError ? 'Unavailable' : '…'}</dd>
      </div>
    </dl>
  )
}
