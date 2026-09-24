import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/Header'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'USDC Pay',
  description: 'Send USDC on Ethereum mainnet',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
