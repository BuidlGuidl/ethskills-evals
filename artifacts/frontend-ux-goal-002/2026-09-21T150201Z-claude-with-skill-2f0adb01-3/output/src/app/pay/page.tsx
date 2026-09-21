import type { Metadata } from "next";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PayForm } from "@/components/PayForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Send USDC",
  alternates: { canonical: "/pay" },
};

export default function PayPage() {
  return (
    <>
      <header className="header">
        <span className="brand">
          <img src="/icon.svg" alt="" width={24} height={24} /> {SITE_NAME}
        </span>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </header>
      <main className="main">
        <PayForm />
        <p className="small muted footer">
          Sends{" "}
          <a
            href="https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
            target="_blank"
            rel="noopener noreferrer"
          >
            USDC by Circle
          </a>{" "}
          on Ethereum mainnet. Prices from Chainlink.
        </p>
      </main>
    </>
  );
}
