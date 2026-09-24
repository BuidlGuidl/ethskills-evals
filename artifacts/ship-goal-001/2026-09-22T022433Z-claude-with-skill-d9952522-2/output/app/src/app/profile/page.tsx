import { currentMember } from '@/server/session'
import { getProfile } from '@/server/members'
import { trackRecord } from '@/server/reputation'
import { isOnRoster } from '@/server/chainClient'
import { ProfileForm } from '@/components/ProfileForm'
import { TrackRecordBadge } from '@/components/TrackRecordBadge'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const address = await currentMember()
  if (!address) return <p className="card">Sign in to edit your profile.</p>

  const profile = getProfile(address)
  const onRoster = await isOnRoster(address)

  return (
    <>
      <h1>Your profile</h1>
      <p className="muted">
        <code>{address}</code> · {onRoster ? 'on the roster' : 'not on the roster yet'}
      </p>
      <TrackRecordBadge record={trackRecord(address)} showName={false} />
      <ProfileForm displayName={profile?.displayName ?? ''} unitLabel={profile?.unitLabel ?? ''} />
    </>
  )
}
