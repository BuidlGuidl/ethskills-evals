import { useCallback } from 'react'
import { useConnection } from 'wagmi'
import { ConnectWallet } from './components/ConnectWallet'
import { JarStats } from './components/JarStats'
import { NetworkNotice } from './components/NetworkNotice'
import { TipFeed } from './components/TipFeed'
import { TipForm } from './components/TipForm'
import { describeError } from './lib/errors'
import { useJar, useTipEvents, useTipFeed } from './hooks/useTipJar'

export default function App() {
  const { isConnected } = useConnection()
  const jar = useJar()
  const feed = useTipFeed(jar.tipJar, jar.chainId, jar.tipCount)

  const refreshAll = useCallback(() => {
    void jar.refetch()
    void feed.refetch()
  }, [feed, jar])

  // Someone else's tip should show up without a reload.
  useTipEvents(jar.tipJar, jar.chainId, refreshAll)

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>
          <div>
            <h1>USDC Tip Jar</h1>
            <p className="muted small">Tips in USDC on Base, kept on chain with the message attached.</p>
          </div>
        </div>
        {isConnected ? <ConnectWallet /> : null}
      </header>

      <NetworkNotice />
      {jar.error ? <p className="notice error">{describeError(jar.error)}</p> : null}

      <main className="layout">
        <div className="column">
          <TipForm
            tipJar={jar.tipJar}
            usdc={jar.usdc}
            chainId={jar.chainId}
            decimals={jar.decimals}
            symbol={jar.symbol}
            maxNameBytes={jar.maxNameBytes}
            maxMessageBytes={jar.maxMessageBytes}
            onTipped={refreshAll}
          />
          <JarStats
            chainId={jar.chainId}
            tipJar={jar.tipJar}
            owner={jar.owner}
            totalTipped={jar.totalTipped}
            tipCount={jar.tipCount}
            balance={jar.balance}
            decimals={jar.decimals}
            symbol={jar.symbol}
          />
        </div>

        <div className="column">
          <TipFeed
            tips={feed.tips}
            decimals={jar.decimals}
            symbol={jar.symbol}
            isLoading={feed.isLoading}
            hasMore={feed.hasMore}
            onLoadMore={feed.loadMore}
          />
        </div>
      </main>

      <footer className="footer muted small">
        <span>
          Token: <code>{jar.usdc ?? '—'}</code>
        </span>
        <span>Chain {jar.chainId}</span>
      </footer>
    </div>
  )
}
