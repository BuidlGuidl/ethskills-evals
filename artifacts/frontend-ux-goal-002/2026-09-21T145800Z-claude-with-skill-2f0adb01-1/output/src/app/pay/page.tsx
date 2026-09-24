import type { Metadata } from "next";
import { PayCard } from "@/components/PayCard";

export const metadata: Metadata = {
  title: "Send USDC",
};

export default function PayPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Send USDC</h1>
      <p className="mb-6 text-sm text-muted">
        Transfer USDC on Ethereum mainnet. Transfers are final — double-check the recipient before sending.
      </p>
      <PayCard />
    </>
  );
}
