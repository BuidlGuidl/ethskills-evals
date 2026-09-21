import type { Metadata } from "next";
import { PayPanel } from "@/components/PayPanel";

export const metadata: Metadata = { title: "Send USDC" };

export default function PayPage() {
  return <PayPanel />;
}
