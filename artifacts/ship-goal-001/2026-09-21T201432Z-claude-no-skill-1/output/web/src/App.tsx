import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi'
import { erc20Abi } from './abis/erc20'
import { memberRegistryAbi } from './abis/memberRegistry'
import { Browse } from './components/Browse'
import { Members } from './components/Members'
import { MyLoans } from './components/MyLoans'
import { MyShed } from './components/MyShed'
import { Badge } from './components/ui'
import { addresses, chain } from './lib/config'
import { useNeighbourhood } from './lib/data'
import { formatUsdc, shortAddress } from './lib/format'

const TABS = ['Browse', 'My shed', 'My loans', 'Members'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const [tab, setTab] = useState<Tab>('Browse')
  const hood = useNeighbourhood()

  return (
    <div className="app">
      <Header />
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {hood.error ? (
        <p className="error">
          Could not read the contracts on {chain.name}. Check VITE_RPC_URL and the addresses in .env.
        </p>
      ) : null}
      <main>
        {tab === 'Browse' && <Browse hood={hood} />}
        {tab === 'My shed' && <MyShed hood={hood} />}
        {tab === 'My loans' && <MyLoans hood={hood} />}
        {tab === 'Members' && <Members hood={hood} />}
      </main>
      <footer className="muted small">
        Toolshed · deposits settle in USDC on {chain.name} · late fees are capped at the deposit
      </footer>
    </div>
  )
}

function Header() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const { data: balance } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const { data: isMember } = useReadContract({
    address: addresses.memberRegistry,
    abi: memberRegistryAbi,
    functionName: 'isActiveMember',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  return (
    <header className="topbar">
      <div>
        <h1>Toolshed</h1>
        <p className="muted small">The neighbourhood association's lending library</p>
      </div>
      <div className="row">
        {isConnected && address ? (
          <>
            <span className="muted small">${formatUsdc((balance as bigint) ?? 0n)} USDC</span>
            {isMember === false ? (
              <Badge tone="bad">not a member</Badge>
            ) : (
              <Badge tone="good">member</Badge>
            )}
            <button onClick={() => disconnect()}>{shortAddress(address)}</button>
          </>
        ) : (
          connectors.map((c) => (
            <button key={c.uid} className="primary" disabled={isPending} onClick={() => connect({ connector: c })}>
              Connect {c.name}
            </button>
          ))
        )}
      </div>
    </header>
  )
}
