import type { Connector } from 'wagmi'
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { devWalletAddress, localChain } from '../config'
import { describeError } from '../lib/errors'
import { shortenAddress } from '../lib/format'

/**
 * The configured `injected()` connector is always present whether or not a wallet is
 * installed, so a missing wallet is detected from the page instead of the connector list.
 */
function hasBrowserWallet(): boolean {
  return typeof window !== 'undefined' && 'ethereum' in window
}

/** The mock connector is the local anvil dev account; label it as such. */
function connectorLabel(connector: Connector): string {
  return connector.type === 'mock' ? 'local dev wallet' : connector.name
}

export function ConnectWallet() {
  const { address, isConnected, chainId } = useConnection()
  const connectors = useConnectors()
  const { mutate: connect, isPending, error } = useConnect()
  const { mutate: disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div className="wallet">
        <span className="wallet__address" title={address}>
          {shortenAddress(address)}
        </span>
        <button className="button button--ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
        {chainId !== localChain.id && <WrongNetworkPill />}
      </div>
    )
  }

  return (
    <div className="wallet">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          className="button"
          disabled={isPending}
          onClick={() => connect({ connector })}
        >
          {isPending ? 'Connecting…' : `Connect ${connectorLabel(connector)}`}
        </button>
      ))}
      {!hasBrowserWallet() && !devWalletAddress && (
        <p className="wallet__hint">
          No browser wallet detected — install MetaMask (or another injected wallet) to send a tip.
          The feed below still works without one.
        </p>
      )}
      {error && <p className="error">{describeError(error)}</p>}
    </div>
  )
}

/** Shown when the wallet is on a different chain than the jar was deployed to. */
export function WrongNetworkPill() {
  const { mutate: switchChain, isPending, error } = useSwitchChain()

  return (
    <span className="wrong-network">
      <button
        className="button button--warn"
        disabled={isPending}
        onClick={() => switchChain({ chainId: localChain.id })}
      >
        {isPending ? 'Switching…' : `Switch to ${localChain.name}`}
      </button>
      {error && <span className="error">{describeError(error)}</span>}
    </span>
  )
}
