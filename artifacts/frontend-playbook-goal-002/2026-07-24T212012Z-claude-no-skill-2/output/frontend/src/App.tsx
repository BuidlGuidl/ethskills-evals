import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";

import { TIP_JAR_ADDRESS, tipJarAbi, USDC_DECIMALS } from "./contracts";
import { TipForm } from "./components/TipForm";
import { TipFeed } from "./components/TipFeed";

export default function App() {
  const { data: totalTipped } = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "totalTipped",
    query: { refetchInterval: 5000 },
  });

  const { data: tipCount } = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "tipCount",
    query: { refetchInterval: 5000 },
  });

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="jar" aria-hidden>
            🫙
          </span>
          <div>
            <h1>USDC Tip Jar</h1>
            <p className="subtitle">Send a USDC tip on Base</p>
          </div>
        </div>
        <ConnectButton />
      </header>

      <section className="stats">
        <div className="stat">
          <span className="stat-value">
            {totalTipped !== undefined
              ? `$${formatUnits(totalTipped, USDC_DECIMALS)}`
              : "—"}
          </span>
          <span className="stat-label">Total tipped</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {tipCount !== undefined ? tipCount.toString() : "—"}
          </span>
          <span className="stat-label">Tips sent</span>
        </div>
      </section>

      <main className="grid">
        <TipForm />
        <TipFeed />
      </main>

      <footer className="footer">
        Local demo · contract accepts USDC
        (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on Base)
      </footer>
    </div>
  );
}
