import Link from 'next/link'
import { ListToolForm } from '@/components/ListToolForm'
import { currentMember } from '@/server/session'
import { isOnRoster } from '@/server/chainClient'

export const dynamic = 'force-dynamic'

export default async function NewToolPage() {
  const address = await currentMember()
  const onRoster = address ? await isOnRoster(address) : false

  return (
    <>
      <h1>List a tool</h1>
      <p className="muted">
        The photo and notes live on Toolshed&rsquo;s server. Only the deposit terms and the loan
        itself go onchain.
      </p>

      {!address ? (
        <p className="card">Sign in with your wallet first — the button is in the top right.</p>
      ) : !onRoster ? (
        <p className="card">
          Your address is not on the association roster yet. Ask the steward to add{' '}
          <code>{address}</code>, then reload. (See <Link href="/members">Members</Link>.)
        </p>
      ) : (
        <ListToolForm />
      )}
    </>
  )
}
