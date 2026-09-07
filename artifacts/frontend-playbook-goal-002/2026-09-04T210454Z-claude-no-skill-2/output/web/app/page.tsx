'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ConnectWallet } from '@/components/ConnectWallet'
import { JarStats } from '@/components/JarStats'
import { SetupNotice } from '@/components/SetupNotice'
import { TipFeed } from '@/components/TipFeed'
import { TipForm } from '@/components/TipForm'
import { useRefetchOnNewBlock } from '@/hooks/useTipJar'
import { appConfig, chainLabel } from '@/lib/config'

export default function Home() {
  const queryClient = useQueryClient()
  useRefetchOnNewBlock()

  const refreshJar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['readContract'] })
    queryClient.invalidateQueries({ queryKey: ['readContracts'] })
  }, [queryClient])

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>USDC Tip Jar</h1>
          <p className="muted">
            Tips are paid in USDC and recorded onchain, message and all.
          </p>
          <span className="network">{chainLabel}</span>
        </div>
        {appConfig.ok ? <ConnectWallet /> : null}
      </header>

      {appConfig.ok ? (
        <>
          <JarStats />
          <div className="columns">
            <TipForm onTipped={refreshJar} />
            <TipFeed />
          </div>
        </>
      ) : (
        <SetupNotice missing={appConfig.missing} />
      )}

      <footer className="footer muted">
        Reads come straight from the contract — no indexer, no backend.
      </footer>
    </main>
  )
}
