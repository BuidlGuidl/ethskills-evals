import type { Metadata } from "next";
import { PayForm } from "@/components/PayForm";

export const metadata: Metadata = {
  title: "Send USDC",
};

export default function PayPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Send USDC</h1>
      <p className="mb-6 text-sm text-muted">
        Pay anyone on Ethereum by address or ENS name. You&apos;ll need a little ETH for the network fee.
      </p>
      <PayForm />
    </>
  );
}
