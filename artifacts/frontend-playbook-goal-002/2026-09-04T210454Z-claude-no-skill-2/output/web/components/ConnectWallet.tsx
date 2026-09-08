'use client'

import { useState } from 'react'
import { useConnect, useConnection, useDisconnect, useSwitchChain } from 'wagmi'
import { chain, chainLabel } from '@/lib/config'
import { shortenAddress } from '@/lib/usdc'

export function ConnectWallet() {
  const { address, chainId, isConnected, isConnecting, isReconnecting, connector } = useConnection()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [pickerOpen, setPickerOpen] = useState(false)

  if (isConnecting || isReconnecting) {
    return <span className="pill pill--muted">Connecting…</span>
  }

  if (isConnected && address) {
    const wrongNetwork = chainId !== chain.id

    return (
      <div className="wallet">
        {wrongNetwork ? (
          <button
            type="button"
            className="button button--warn"
            onClick={() => switchChain({ chainId: chain.id })}
            disabled={isSwitching}
          >
            {isSwitching ? 'Switching…' : `Switch to ${chainLabel}`}
          </button>
        ) : null}
        <span className="pill" title={address}>
          <span className="dot" aria-hidden />
          {shortenAddress(address)}
        </span>
        <button type="button" className="button button--ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
        <span className="wallet__connector">via {connector?.name}</span>
      </div>
    )
  }

  return (
    <div className="wallet">
      <button
        type="button"
        className="button button--primary"
        onClick={() => setPickerOpen((open) => !open)}
        aria-expanded={pickerOpen}
      >
        {isPending ? 'Check your wallet…' : 'Connect wallet'}
      </button>

      {pickerOpen ? (
        <div className="picker" role="menu">
          <p className="picker__title">Choose a wallet</p>
          {connectors.length === 0 ? <p className="muted">No wallet connectors available.</p> : null}
          {connectors.map((option) => (
            <button
              key={option.uid}
              type="button"
              role="menuitem"
              className="picker__option"
              onClick={() => {
                setPickerOpen(false)
                connect({ connector: option, chainId: chain.id })
              }}
            >
              {option.name}
            </button>
          ))}
          <p className="picker__hint">Connecting to {chainLabel}</p>
        </div>
      ) : null}

      {error ? <p className="error">{error.message}</p> : null}
    </div>
  )
}
