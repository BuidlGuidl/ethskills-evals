import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { Providers } from './providers'
import { SignIn } from '@/components/SignIn'
import { currentMember } from '@/server/session'
import { chain } from '@/chain/config'

export const metadata: Metadata = {
  title: 'Toolshed',
  description: 'The neighbourhood tool library',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const address = (await currentMember()) ?? null

  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="topbar">
            <Link href="/" className="brand">
              Toolshed
            </Link>
            <nav>
              <Link href="/">Browse</Link>
              <Link href="/requests">Requests</Link>
              <Link href="/loans">My loans</Link>
              <Link href="/members">Members</Link>
              <Link href="/tools/new">List a tool</Link>
              <Link href="/profile">Profile</Link>
            </nav>
            <SignIn sessionAddress={address} />
          </header>
          <main>{children}</main>
          <footer className="muted">
            Deposits are held in USDC on {chain.name}. Late fees come out of the deposit and go to
            the tool&rsquo;s owner.
          </footer>
        </Providers>
      </body>
    </html>
  )
}
