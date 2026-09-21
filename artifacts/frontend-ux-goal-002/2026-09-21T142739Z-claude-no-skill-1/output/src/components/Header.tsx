'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

export function Header() {
  return (
    <header className="header">
      <Link href="/pay" className="brand">
        USDC Pay
      </Link>
      <ConnectButton showBalance={false} chainStatus="icon" />
    </header>
  )
}
