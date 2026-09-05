import { useChainId, useConnection, useSwitchChain } from 'wagmi'
import { deploymentFor } from '../config'
import { describeError } from '../lib/errors'

/**
 * Warns when the wallet is on a chain where no jar exists, and offers to
 * switch to one where it does.
 */
export function NetworkNotice() {
  const { isConnected, chainId: walletChainId } = useConnection()
  const appChainId = useChainId()
  const { chains, switchChain, isPending, error } = useSwitchChain()

  const activeChainId = walletChainId ?? appChainId
  const deployment = deploymentFor(activeChainId)
  const target = chains.find((chain) => deploymentFor(chain.id)?.tipJar)

  if (deployment?.tipJar) return null

  const chainName = chains.find((chain) => chain.id === activeChainId)?.name ?? `chain ${activeChainId}`

  return (
    <div className="notice warning" role="status">
      <div>
        <strong>No tip jar on {chainName}.</strong>{' '}
        {target ? (
          <>Switch to {target.name} to send a tip.</>
        ) : (
          <>
            Deploy one locally with <code>npm run deploy:local</code>, then reload.
          </>
        )}
      </div>
      {target && isConnected ? (
        <button type="button" className="button" onClick={() => switchChain({ chainId: target.id })} disabled={isPending}>
          {isPending ? 'Switching…' : `Switch to ${target.name}`}
        </button>
      ) : null}
      {error ? <p className="error inline">{describeError(error)}</p> : null}
    </div>
  )
}
