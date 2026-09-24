import type { Metadata } from 'next';

import { PayCard } from '@/components/PayCard';

export const metadata: Metadata = { title: 'Pay with USDC' };

export default function PayPage() {
  return (
    <main className="page">
      <PayCard />
    </main>
  );
}
