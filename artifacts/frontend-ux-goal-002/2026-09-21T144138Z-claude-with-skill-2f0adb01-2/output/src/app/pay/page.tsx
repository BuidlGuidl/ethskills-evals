import type { Metadata } from "next";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PayForm } from "@/components/PayForm";

export const metadata: Metadata = { title: "Pay" };

export default function PayPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">USDC Pay</h1>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>
      <PayForm />
      <p className="mt-6 text-center text-xs text-muted">
        Sends native USDC on Ethereum mainnet (
        <a
          href="https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          0xA0b8…eB48
        </a>
        ). Prices from Chainlink.
      </p>
    </main>
  );
}
