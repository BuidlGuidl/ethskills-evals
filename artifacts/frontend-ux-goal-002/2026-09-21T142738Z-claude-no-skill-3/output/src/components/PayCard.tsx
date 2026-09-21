'use client';

import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import { encodeFunctionData, formatUnits, type Address, type Hash } from 'viem';
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
} from 'wagmi';
import { mainnet } from 'wagmi/chains';

import { useBalances } from '@/hooks/useBalances';
import { useDebounce } from '@/hooks/useDebounce';
import { errorMessage } from '@/lib/errors';
import { formatToken, shortAddress } from '@/lib/format';
import { parseAmount, parseRecipient } from '@/lib/parse';
import { USDC_ADDRESS, USDC_DECIMALS, USDC_SYMBOL, usdcAbi } from '@/lib/usdc';

const EXPLORER = mainnet.blockExplorers.default.url;

type Sent = { to: Address; label: string; amount: bigint };
type Replacement = 'cancelled' | 'replaced' | undefined;

export function PayCard() {
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const balances = useBalances(address);

  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [sent, setSent] = useState<Sent>();
  const [replacement, setReplacement] = useState<Replacement>();
  const [trackedHash, setTrackedHash] = useState<Hash>();

  // --- Recipient ---
  const recipientField = parseRecipient(recipientInput);
  const debouncedRecipient = parseRecipient(useDebounce(recipientInput));
  const ensName =
    recipientField.kind === 'ens' && debouncedRecipient.kind === 'ens' && debouncedRecipient.name === recipientField.name
      ? recipientField.name
      : undefined;
  const ens = useEnsAddress({ name: ensName, chainId: mainnet.id, query: { enabled: !!ensName } });

  const recipient: Address | undefined =
    recipientField.kind === 'address' ? recipientField.address : ensName ? (ens.data ?? undefined) : undefined;

  const code = useBytecode({ address: recipient, chainId: mainnet.id, query: { enabled: !!recipient } });
  // EIP-7702 delegated EOAs carry code prefixed with 0xef0100 but are still regular accounts.
  const isContract = !!code.data && code.data !== '0x' && !code.data.startsWith('0xef0100');

  let recipientError: string | undefined;
  if (recipientField.kind === 'invalid') recipientError = recipientField.error;
  else if (ensName && ens.isError) recipientError = 'Could not resolve ENS name.';
  else if (ensName && ens.isSuccess && !ens.data) recipientError = 'ENS name does not point to an address.';
  else if (recipient && address && recipient.toLowerCase() === address.toLowerCase()) {
    recipientError = 'This is your own address.';
  }

  // --- Amount ---
  const amountField = parseAmount(amountInput);
  const amountSettled = useDebounce(amountInput) === amountInput;
  const amount = amountField.kind === 'ok' ? amountField.value : undefined;

  let amountError: string | undefined;
  if (amountField.kind === 'invalid') amountError = amountField.error;
  else if (amount !== undefined && balances.usdc !== undefined && amount > balances.usdc) {
    amountError = `Exceeds your balance of ${formatToken(balances.usdc, USDC_DECIMALS)} ${USDC_SYMBOL}.`;
  }

  // --- Pre-flight checks against mainnet (catches blacklisted accounts, paused token, etc.) ---
  const canCheck =
    !!address && !!recipient && amount !== undefined && !recipientError && !amountError && amountSettled;

  const simulation = useSimulateContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: 'transfer',
    args: recipient && amount !== undefined ? [recipient, amount] : undefined,
    account: address,
    chainId: mainnet.id,
    query: { enabled: canCheck },
  });

  const gas = useEstimateGas({
    account: address,
    to: USDC_ADDRESS,
    data:
      recipient && amount !== undefined
        ? encodeFunctionData({ abi: usdcAbi, functionName: 'transfer', args: [recipient, amount] })
        : undefined,
    chainId: mainnet.id,
    query: { enabled: canCheck && simulation.isSuccess },
  });
  const fees = useEstimateFeesPerGas({ chainId: mainnet.id, query: { enabled: canCheck } });
  const maxFee = gas.data !== undefined && fees.data?.maxFeePerGas ? gas.data * fees.data.maxFeePerGas : undefined;
  const notEnoughGas = maxFee !== undefined && balances.eth !== undefined && balances.eth < maxFee;

  // --- Send ---
  const write = useWriteContract();
  const hash = trackedHash ?? write.data;
  const receipt = useWaitForTransactionReceipt({
    hash,
    chainId: mainnet.id,
    onReplaced: (r) => {
      if (r.reason === 'repriced') setTrackedHash(r.transaction.hash);
      else setReplacement(r.reason);
    },
  });

  const isConfirming = !!hash && receipt.isLoading;
  const isBusy = write.isPending || isConfirming;
  const isDone = !!hash && (receipt.isSuccess || receipt.isError);
  const succeeded = receipt.data?.status === 'success' && !replacement;

  function send() {
    if (!simulation.data || !recipient || amount === undefined) return;
    setSent({ to: recipient, label: ensName ?? shortAddress(recipient), amount });
    write.writeContract(simulation.data.request);
  }

  function reset() {
    if (succeeded) {
      setRecipientInput('');
      setAmountInput('');
    }
    write.reset();
    setSent(undefined);
    setReplacement(undefined);
    setTrackedHash(undefined);
    balances.refetch();
  }

  // Refresh balances once the transfer is mined.
  const { refetch: refetchBalances } = balances;
  useEffect(() => {
    if (isDone) refetchBalances();
  }, [isDone, refetchBalances]);

  // --- Primary button state ---
  const wrongChain = isConnected && chainId !== mainnet.id;
  let button: { label: string; onClick?: () => void; disabled?: boolean };
  if (!isConnected) button = { label: 'Connect wallet', onClick: openConnectModal };
  else if (wrongChain) {
    button = {
      label: isSwitching ? 'Switching…' : 'Switch to Ethereum',
      onClick: () => switchChain({ chainId: mainnet.id }),
      disabled: isSwitching,
    };
  } else if (write.isPending) button = { label: 'Confirm in your wallet…', disabled: true };
  else if (isConfirming) button = { label: 'Sending…', disabled: true };
  else if (recipientField.kind === 'empty') button = { label: 'Enter a recipient', disabled: true };
  else if (amountField.kind === 'empty') button = { label: 'Enter an amount', disabled: true };
  else if (recipientError || amountError) button = { label: 'Fix the errors above', disabled: true };
  else if (ensName && ens.isLoading) button = { label: 'Resolving name…', disabled: true };
  else if (simulation.isError) button = { label: 'Transfer would fail', disabled: true };
  else if (notEnoughGas) button = { label: 'Not enough ETH for gas', disabled: true };
  else if (!simulation.isSuccess || !amountSettled) button = { label: 'Checking…', disabled: true };
  else button = { label: `Send ${formatToken(amount!, USDC_DECIMALS)} ${USDC_SYMBOL}`, onClick: send };

  return (
    <section className="card">
      <header className="card-header">
        <h1>Send USDC</h1>
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
      </header>

      {isConnected && (
        <dl className="balances">
          <div>
            <dt>USDC balance</dt>
            <dd>{balances.usdc !== undefined ? formatToken(balances.usdc, USDC_DECIMALS) : '—'}</dd>
          </div>
          <div>
            <dt>ETH balance (for gas)</dt>
            <dd>{balances.eth !== undefined ? formatToken(balances.eth, 18, 6) : '—'}</dd>
          </div>
        </dl>
      )}
      {balances.isError && <p className="notice error">Could not load balances. Retrying…</p>}
      {balances.eth === 0n && (
        <p className="notice warning">You have no ETH. Sending USDC requires ETH to pay the network fee.</p>
      )}

      {isDone && sent ? (
        <Result
          sent={sent}
          hash={hash!}
          succeeded={succeeded}
          replacement={replacement}
          error={receipt.error}
          onReset={reset}
        />
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!button.disabled) button.onClick?.();
          }}
        >
          <label className="field">
            <span>Recipient</span>
            <input
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="0x… or name.eth"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={isBusy}
              aria-invalid={!!recipientError}
            />
            {recipientError ? (
              <small className="error">{recipientError}</small>
            ) : ensName && ens.data ? (
              <small className="hint mono">{ens.data}</small>
            ) : null}
            {!recipientError && isContract && (
              <small className="warning">
                This address is a smart contract. Only continue if you know it can receive USDC — tokens sent to a
                contract that can’t handle them are lost.
              </small>
            )}
          </label>

          <label className="field">
            <span>Amount ({USDC_SYMBOL})</span>
            <div className="amount">
              <input
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                disabled={isBusy}
                aria-invalid={!!amountError}
              />
              {balances.usdc !== undefined && balances.usdc > 0n && (
                <button
                  type="button"
                  className="max"
                  disabled={isBusy}
                  onClick={() => setAmountInput(formatUnits(balances.usdc!, USDC_DECIMALS))}
                >
                  Max
                </button>
              )}
            </div>
            {amountError && <small className="error">{amountError}</small>}
          </label>

          {simulation.isError && canCheck && <p className="notice error">{errorMessage(simulation.error)}</p>}
          {write.isError && <p className="notice error">{errorMessage(write.error)}</p>}
          {maxFee !== undefined && !simulation.isError && (
            <p className={notEnoughGas ? 'notice error' : 'hint'}>
              Network fee: up to {formatToken(maxFee, 18, 6)} ETH
              {notEnoughGas && ` — you have ${formatToken(balances.eth!, 18, 6)} ETH`}
            </p>
          )}

          <button type="submit" className="primary" disabled={button.disabled}>
            {button.label}
          </button>

          {isConfirming && hash && (
            <p className="hint">
              Waiting for confirmation…{' '}
              <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
                View on Etherscan
              </a>
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function Result({
  sent,
  hash,
  succeeded,
  replacement,
  error,
  onReset,
}: {
  sent: Sent;
  hash: Hash;
  succeeded: boolean;
  replacement: Replacement;
  error: Error | null;
  onReset: () => void;
}) {
  let message: string;
  if (succeeded) message = `Sent ${formatToken(sent.amount, USDC_DECIMALS)} ${USDC_SYMBOL} to ${sent.label}.`;
  else if (replacement === 'cancelled') message = 'The transfer was cancelled in your wallet. No USDC was sent.';
  else if (replacement === 'replaced') message = 'The transfer was replaced by another transaction from your wallet.';
  else if (error) {
    message = `Could not confirm the transaction status (${errorMessage(error)}). Check Etherscan before sending again.`;
  }
  else message = 'The transfer failed on-chain. No USDC was sent.';

  return (
    <div className={`result ${succeeded ? 'success' : 'error'}`} role="status">
      <p>{message}</p>
      <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
        View on Etherscan
      </a>
      <button type="button" className="primary" onClick={onReset}>
        {succeeded ? 'Send another payment' : 'Back'}
      </button>
    </div>
  );
}
