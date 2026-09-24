'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { type Address, encodeFunctionData, formatUnits } from 'viem'
import {
  useAccount,
  useBytecode,
  useEnsAddress,
  useEstimateFeesPerGas,
  useEstimateGas,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { Balances } from './Balances'
import { formatTxError } from '@/lib/errors'
import { etherscanAddress, etherscanTx, formatEth, formatUsdc, shortAddress } from '@/lib/format'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { usePayerBalances } from '@/lib/usePayerBalances'
import { USDC_ABI, USDC_ADDRESS, USDC_DECIMALS } from '@/lib/usdc'
import { classifyRecipient, parseUsdcAmount, recipientProblem, sanitizeAmountInput } from '@/lib/validation'

// Details of the submitted payment, frozen at submit time so the result panel
// can't drift if the form state changes.
type Payment = { to: Address; label: string; amount: bigint }

// EIP-7702 delegated EOAs carry this bytecode prefix but are still regular accounts.
const EIP7702_PREFIX = '0xef0100'

export function PayForm() {
  const { address: account, chainId, isConnected, status } = useAccount()
  const onMainnet = chainId === mainnet.id
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const balances = usePayerBalances(account)
  const usdcBalance = balances.usdc.data
  const ethBalance = balances.eth.data?.value
  const refetchEth = balances.eth.refetch
  const refetchUsdc = balances.usdc.refetch

  const [recipientInput, setRecipientInput] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [replaced, setReplaced] = useState(false)

  // --- Recipient ---
  const recipient = useMemo(() => classifyRecipient(recipientInput), [recipientInput])
  const ensName = recipient.kind === 'ens' ? recipient.name : undefined
  const debouncedEnsName = useDebouncedValue(ensName, 400)
  const ensSettled = ensName !== undefined && debouncedEnsName === ensName
  const ens = useEnsAddress({
    name: debouncedEnsName,
    chainId: mainnet.id,
    query: { enabled: !!debouncedEnsName },
  })

  const toAddress: Address | undefined =
    recipient.kind === 'address'
      ? recipient.address
      : ensSettled && ens.data
        ? ens.data
        : undefined
  const ensLoading = recipient.kind === 'ens' && (!ensSettled || ens.isLoading)

  let recipientError: string | null = null
  if (recipient.kind === 'invalid') recipientError = recipient.error
  else if (ensSettled && ens.isError) recipientError = 'Could not resolve this ENS name'
  else if (ensSettled && ens.isSuccess && !ens.data) recipientError = `${ensName} does not point to an address`
  else if (toAddress) recipientError = recipientProblem(toAddress, account)

  const bytecode = useBytecode({
    address: toAddress,
    chainId: mainnet.id,
    query: { enabled: !!toAddress && !recipientError },
  })
  const recipientIsContract =
    !!bytecode.data && bytecode.data !== '0x' && !bytecode.data.startsWith(EIP7702_PREFIX)

  // --- Amount ---
  const amount = useMemo(() => parseUsdcAmount(amountInput), [amountInput])
  let amountError = amount.ok ? null : amount.error
  if (amount.ok && usdcBalance !== undefined && amount.value > usdcBalance) {
    amountError = 'Amount exceeds your USDC balance'
  }

  // --- Pre-flight: simulate the transfer and estimate the network fee ---
  const transferArgs =
    isConnected && onMainnet && toAddress && !recipientError && amount.ok && !amountError && usdcBalance !== undefined
      ? ([toAddress, amount.value] as const)
      : undefined

  const simulation = useSimulateContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: transferArgs,
    account,
    chainId: mainnet.id,
    query: { enabled: !!transferArgs },
  })
  const gas = useEstimateGas({
    account,
    to: USDC_ADDRESS,
    data: transferArgs ? encodeFunctionData({ abi: USDC_ABI, functionName: 'transfer', args: transferArgs }) : undefined,
    chainId: mainnet.id,
    query: { enabled: !!transferArgs },
  })
  const fees = useEstimateFeesPerGas({
    chainId: mainnet.id,
    query: { enabled: !!transferArgs, refetchInterval: 12_000 },
  })
  // Upper bound the wallet will require the account to hold.
  const maxNetworkFee =
    gas.data !== undefined && fees.data?.maxFeePerGas !== undefined ? gas.data * fees.data.maxFeePerGas : undefined
  const noEth = ethBalance === 0n
  const notEnoughEth =
    noEth || (ethBalance !== undefined && maxNetworkFee !== undefined && ethBalance < maxNetworkFee)

  // --- Send ---
  const write = useWriteContract()
  const receipt = useWaitForTransactionReceipt({
    hash: write.data,
    chainId: mainnet.id,
    onReplaced: (r) => {
      // "repriced" = same tx sped up; anything else means the payment was cancelled/replaced.
      if (r.reason !== 'repriced') setReplaced(true)
    },
  })

  const awaitingWallet = write.isPending
  const mining = !!write.data && !receipt.data && !receipt.error
  const finished = !!write.data && (!!receipt.data || !!receipt.error)
  const busy = awaitingWallet || mining
  const succeeded = receipt.data?.status === 'success' && !replaced

  useEffect(() => {
    if (receipt.data) {
      refetchEth()
      refetchUsdc()
    }
  }, [receipt.data, refetchEth, refetchUsdc])

  const canSend = !!simulation.data && !notEnoughEth && !busy

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSend || !simulation.data || !transferArgs) return
    setPayment({
      to: transferArgs[0],
      label: recipient.kind === 'ens' ? recipient.name : transferArgs[0],
      amount: transferArgs[1],
    })
    setReplaced(false)
    write.writeContract(simulation.data.request)
  }

  function startOver() {
    if (succeeded) {
      setRecipientInput('')
      setAmountInput('')
    }
    setPayment(null)
    setReplaced(false)
    write.reset()
  }

  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <section className="card center">
        <p className="hint">Connecting wallet…</p>
      </section>
    )
  }

  if (!isConnected || !account) {
    return (
      <section className="card center">
        <p>Connect a wallet to send USDC on Ethereum.</p>
        <ConnectButton />
      </section>
    )
  }

  // --- Result panel (after a tx was broadcast) ---
  if (payment && write.data && (mining || finished)) {
    return (
      <section className="card">
        <Balances {...balances} />
        <TxStatus
          payment={payment}
          hash={write.data}
          mining={mining}
          succeeded={succeeded}
          reverted={receipt.data?.status === 'reverted'}
          replaced={replaced}
          receiptError={receipt.error}
          onDone={startOver}
        />
      </section>
    )
  }

  let buttonLabel = 'Send USDC'
  if (awaitingWallet) buttonLabel = 'Confirm in your wallet…'
  else if (ensLoading) buttonLabel = 'Resolving name…'
  else if (transferArgs && (simulation.isFetching || gas.isFetching)) buttonLabel = 'Checking…'
  else if (amount.ok && !amountError) buttonLabel = `Send ${formatUsdc(amount.value)} USDC`

  return (
    <section className="card">
      <Balances {...balances} />
      {noEth && (
        <p className="notice warn">
          You have no ETH. Every Ethereum transaction needs a little ETH to pay the network fee.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Recipient</span>
          <input
            type="text"
            placeholder="0x… or name.eth"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            disabled={busy}
            aria-invalid={!!recipientError}
          />
          {recipientError ? (
            <small className="error">{recipientError}</small>
          ) : ensLoading ? (
            <small className="hint">Resolving…</small>
          ) : recipient.kind === 'ens' && toAddress ? (
            <small className="hint">
              Resolves to{' '}
              <a href={etherscanAddress(toAddress)} target="_blank" rel="noreferrer" className="mono">
                {toAddress}
              </a>
            </small>
          ) : null}
          {!recipientError && recipientIsContract && (
            <small className="warn-text">
              This address is a smart contract. Make sure it can receive USDC, or the funds may be lost.
            </small>
          )}
        </label>

        <label className="field">
          <span>Amount (USDC)</span>
          <div className="amount-row">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              value={amountInput}
              onChange={(e) => setAmountInput(sanitizeAmountInput(e.target.value))}
              disabled={busy}
              aria-invalid={!!amountError}
            />
            <button
              type="button"
              className="secondary"
              disabled={busy || !usdcBalance}
              onClick={() => usdcBalance && setAmountInput(formatUnits(usdcBalance, USDC_DECIMALS))}
            >
              Max
            </button>
          </div>
          {amountError && <small className="error">{amountError}</small>}
        </label>

        {maxNetworkFee !== undefined && (
          <p className="hint">Network fee: up to {formatEth(maxNetworkFee)} ETH</p>
        )}
        {transferArgs && notEnoughEth && !noEth && (
          <p className="notice warn">Not enough ETH to pay the network fee for this transfer.</p>
        )}
        {transferArgs && simulation.error && (
          <p className="notice error">{formatTxError(simulation.error)}</p>
        )}
        {write.error && <p className="notice error">{formatTxError(write.error)}</p>}

        {onMainnet ? (
          <button type="submit" className="primary" disabled={!canSend}>
            {buttonLabel}
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: mainnet.id })}
          >
            {isSwitching ? 'Switching…' : 'Switch to Ethereum mainnet'}
          </button>
        )}
      </form>
    </section>
  )
}

type TxStatusProps = {
  payment: Payment
  hash: `0x${string}`
  mining: boolean
  succeeded: boolean
  reverted: boolean
  replaced: boolean
  receiptError: Error | null
  onDone: () => void
}

function TxStatus({ payment, hash, mining, succeeded, reverted, replaced, receiptError, onDone }: TxStatusProps) {
  const what = `${formatUsdc(payment.amount)} USDC to ${
    payment.label === payment.to ? shortAddress(payment.to) : payment.label
  }`
  const link = (
    <a href={etherscanTx(hash)} target="_blank" rel="noreferrer">
      View on Etherscan
    </a>
  )

  if (mining) {
    return (
      <div className="status" role="status" aria-live="polite">
        <p>Sending {what}…</p>
        <p className="hint">Waiting for the transaction to be confirmed. {link}</p>
      </div>
    )
  }
  if (succeeded) {
    return (
      <div className="status success" role="status">
        <p>Sent {what}.</p>
        <p className="hint">{link}</p>
        <button type="button" className="primary" onClick={onDone}>
          Send another payment
        </button>
      </div>
    )
  }
  let message = 'The transaction failed. No USDC was sent.'
  if (replaced) message = 'The transaction was cancelled or replaced in your wallet. Check Etherscan before retrying.'
  else if (!reverted && receiptError) {
    message = 'Could not confirm the transaction status. Check Etherscan before sending again to avoid paying twice.'
  }
  return (
    <div className="status failed" role="alert">
      <p>{message}</p>
      <p className="hint">{link}</p>
      <button type="button" className="primary" onClick={onDone}>
        Back
      </button>
    </div>
  )
}
