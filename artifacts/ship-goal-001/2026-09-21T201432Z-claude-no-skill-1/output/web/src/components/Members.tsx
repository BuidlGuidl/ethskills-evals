import { useMemo, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { isAddress } from 'viem'
import { memberRegistryAbi } from '../abis/memberRegistry'
import { addresses } from '../lib/config'
import { type Neighbourhood } from '../lib/data'
import { shortAddress } from '../lib/format'
import { useTx } from '../lib/tx'
import { Badge, Empty, ErrorNote, TrackRecord } from './ui'

export function Members({ hood }: { hood: Neighbourhood }) {
  const { address } = useAccount()
  const { data: steward } = useReadContract({
    address: addresses.memberRegistry,
    abi: memberRegistryAbi,
    functionName: 'steward',
  })
  const isSteward = !!address && !!steward && address.toLowerCase() === (steward as string).toLowerCase()

  const ranked = useMemo(
    () =>
      [...hood.members].sort(
        (a, b) =>
          b.reliabilityBps - a.reliabilityBps ||
          b.loansBorrowed + b.loansLent - (a.loansBorrowed + a.loansLent),
      ),
    [hood.members],
  )

  return (
    <section className="stack">
      {isSteward ? <AddMember onDone={hood.refetch} /> : null}
      <div>
        <h2>The roster</h2>
        <p className="muted small">
          {hood.members.length} members, ranked by how reliably borrowed tools come back.
        </p>
        {ranked.length === 0 ? <Empty>No members yet.</Empty> : null}
        <ul className="list">
          {ranked.map((m) => (
            <li key={m.address} className="row-item">
              <div>
                <strong>{m.displayName || shortAddress(m.address)}</strong>{' '}
                <span className="muted small">{shortAddress(m.address)}</span>
                <div className="small">
                  <TrackRecord member={m} /> · lent out {m.loansLent}
                </div>
              </div>
              {m.active ? <Badge tone="good">member</Badge> : <Badge tone="bad">removed</Badge>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Only the association steward sees this: adding neighbours to the roster. */
function AddMember({ onDone }: { onDone: () => void }) {
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const { send, pending, error, clearError } = useTx(() => {
    setAddress('')
    setName('')
    onDone()
  })
  const valid = isAddress(address)

  return (
    <div className="panel">
      <h2>Steward: add a member</h2>
      <div className="row">
        <label className="field">
          Wallet address
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
        </label>
        <label className="field">
          Name on the roster
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marisol (12 Oak)" />
        </label>
        <button
          className="primary"
          disabled={!valid || !!pending}
          onClick={() =>
            send('Adding', {
              address: addresses.memberRegistry,
              abi: memberRegistryAbi,
              functionName: 'addMember',
              args: [address as `0x${string}`, name],
            })
          }
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      <ErrorNote error={error} onDismiss={clearError} />
    </div>
  )
}
