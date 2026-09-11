import { ConnectWallet } from './components/ConnectWallet'
import { JarStats } from './components/JarStats'
import { TipFeed } from './components/TipFeed'
import { TipForm } from './components/TipForm'
import { localChain, rpcUrl, tipJarAddress, usdcAddress } from './config'
import { useTipJar } from './hooks/useTipJar'
import { useConnection } from 'wagmi'

export function App() {
  if (!tipJarAddress) return <SetupNotice />
  return <TipJarPage />
}

function TipJarPage() {
  const { address } = useConnection()
  const { tipCount, totalTipped, balance, owner, tips, isLoading, error, refresh } = useTipJar()

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1 className="header__title">USDC Tip Jar</h1>
          <p className="header__subtitle">
            Tips in USDC on {localChain.name} · jar <span className="mono">{tipJarAddress}</span>
          </p>
        </div>
        <ConnectWallet />
      </header>

      {error && (
        <p className="error error--block">
          Could not read the jar at {tipJarAddress}. Is the local chain running at {rpcUrl}?
        </p>
      )}

      <JarStats tipCount={tipCount} totalTipped={totalTipped} balance={balance} owner={owner} />

      <main className="layout">
        <TipForm onTipped={refresh} />
        <TipFeed tips={tips} isLoading={isLoading} connectedAddress={address} />
      </main>

      <footer className="footer">
        USDC <span className="mono">{usdcAddress}</span> · RPC <span className="mono">{rpcUrl}</span>
      </footer>
    </div>
  )
}

/** Shown when web/.env.local has no jar address, i.e. before the first local deploy. */
function SetupNotice() {
  return (
    <div className="page">
      <header className="header">
        <h1 className="header__title">USDC Tip Jar</h1>
      </header>
      <section className="card">
        <h2>Almost there</h2>
        <p className="hint">
          No contract address configured. From the project root run:
        </p>
        <pre className="code">
{`npm run chain     # terminal 1: anvil forking Base
npm run setup     # terminal 2: deploy + fund + seed
npm run web       # terminal 3: this app`}
        </pre>
        <p className="hint">
          <code>npm run setup</code> writes <code>web/.env.local</code>; restart the dev server
          afterwards so Vite picks it up.
        </p>
      </section>
    </div>
  )
}
