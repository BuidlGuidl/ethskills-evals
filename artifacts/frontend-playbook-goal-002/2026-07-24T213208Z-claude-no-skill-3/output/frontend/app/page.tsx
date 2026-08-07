"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TIP_JAR_ADDRESS } from "../contracts";
import { TipJarApp } from "../components/TipJarApp";

const ZERO = "0x0000000000000000000000000000000000000000";

export default function Home() {
  const deployed = TIP_JAR_ADDRESS && TIP_JAR_ADDRESS !== ZERO;

  return (
    <main className="page">
      <header className="header">
        <div className="brand">
          <span className="logo">💙</span>
          <div>
            <h1>USDC Tip Jar</h1>
            <p className="muted subtitle">Tips on Base, in USDC.</p>
          </div>
        </div>
        <ConnectButton />
      </header>

      {!deployed ? (
        <div className="card warn">
          <h2>Contracts not deployed yet</h2>
          <p>
            No deployment was found. Start a local chain and run the deploy step
            from the README, then reload this page.
          </p>
        </div>
      ) : (
        <TipJarApp />
      )}

      <footer className="footer muted">
        <p>
          Local demo. Tip jar contract:{" "}
          <code>{TIP_JAR_ADDRESS}</code>
        </p>
      </footer>
    </main>
  );
}
