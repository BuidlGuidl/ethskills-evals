import { useState } from 'react'
import { useConnect, useConnection, useDisconnect } from 'wagmi'
import { describeError } from '../lib/errors'
import { shortAddress } from '../lib/format'

/** Connect / disconnect button with a small connector picker. */
export function ConnectWallet() {
  const { address, isConnected, connector } = useConnection()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)

  if (isConnected && address) {
    return (
      <div className="wallet">
        <span className="wallet-badge" title={address}>
          <span className="dot" aria-hidden="true" />
          {shortAddress(address)}
          {connector?.name ? <span className="wallet-connector">{connector.name}</span> : null}
        </span>
        <button type="button" className="button ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="wallet">
      <button type="button" className="button primary" onClick={() => setOpen((v) => !v)} disabled={isPending}>
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </button>

      {open ? (
        <div className="connector-menu" role="menu">
          {connectors.length === 0 ? <p className="muted">No wallet connectors available.</p> : null}
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              role="menuitem"
              className="connector"
              onClick={() => {
                connect({ connector: c })
                setOpen(false)
              }}
            >
              {c.icon ? <img src={c.icon} alt="" width={18} height={18} /> : <span className="connector-dot" />}
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="error inline">{describeError(error)}</p> : null}
    </div>
  )
}
