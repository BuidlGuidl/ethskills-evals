import type { Metadata } from "next";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PayForm } from "@/components/PayForm";

export const metadata: Metadata = { title: "Send USDC · USDC Pay" };

export default function PayPage() {
  return (
    <main className="container">
      <header className="header">
        <h1>Send USDC</h1>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>
      <PayForm />
      <p className="footnote muted">
        Ethereum mainnet only. Transfers are final — double-check the recipient before sending.
      </p>
    </main>
  );
}
