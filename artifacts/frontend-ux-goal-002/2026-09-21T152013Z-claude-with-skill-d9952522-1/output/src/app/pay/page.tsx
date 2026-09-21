import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { PayForm } from "@/components/PayForm";

export const metadata: Metadata = {
  title: "Pay",
  description: "Send USDC on Ethereum to any address or ENS name.",
};

export default function PayPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Send USDC</h1>
          <p className="mb-6 mt-1 text-sm text-muted">On Ethereum mainnet. Transfers are final — double-check the recipient.</p>
          <PayForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Settle never holds your funds. Transactions are signed in your wallet and sent directly to the USDC contract.
        </p>
      </main>
    </>
  );
}
