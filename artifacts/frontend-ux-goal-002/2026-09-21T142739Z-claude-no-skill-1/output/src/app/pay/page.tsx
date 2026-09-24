import type { Metadata } from 'next'
import { PayForm } from '@/components/PayForm'

export const metadata: Metadata = { title: 'Pay · USDC Pay' }

export default function PayPage() {
  return (
    <>
      <h1>Send USDC</h1>
      <p className="subtitle">On Ethereum mainnet. Transfers are final and cannot be reversed.</p>
      <PayForm />
    </>
  )
}
