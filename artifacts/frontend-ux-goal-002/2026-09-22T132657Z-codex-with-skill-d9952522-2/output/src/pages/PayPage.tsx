import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Fuel,
  Loader2,
  LogOut,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  Address,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import { mainnet } from "viem/chains";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useEnsAddress,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import {
  APP_NAME,
  ETHERSCAN_BASE_URL,
  USDC_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_SYMBOL,
} from "../constants";
import { isRpcConfigured, wagmiConfig } from "../config/wagmi";
import { useDebounce } from "../hooks/useDebounce";
import { useTokenPrices } from "../hooks/useTokenPrices";
import {
  compactAddress,
  formatDateTime,
  formatTokenAmount,
  formatUsd,
  userFriendlyError,
} from "../lib/format";

type ParsedAmount =
  | { ok: true; value: bigint; decimalAmount: number }
  | { ok: false; error: string };

function parseUsdcInput(amount: string, availableBalance: bigint | undefined): ParsedAmount {
  const normalized = amount.trim();

  if (!normalized) {
    return { ok: false, error: "Enter an amount." };
  }

  if (!/^\d+(\.\d*)?$/.test(normalized)) {
    return { ok: false, error: "Use a plain decimal number." };
  }

  const decimals = normalized.split(".")[1]?.length ?? 0;
  if (decimals > USDC_DECIMALS) {
    return { ok: false, error: `${USDC_SYMBOL} supports up to ${USDC_DECIMALS} decimal places.` };
  }

  try {
    const value = parseUnits(normalized, USDC_DECIMALS);

    if (value <= 0n) {
      return { ok: false, error: "Amount must be greater than zero." };
    }

    if (availableBalance !== undefined && value > availableBalance) {
      return { ok: false, error: "Amount is higher than your USDC balance." };
    }

    return { ok: true, value, decimalAmount: Number(normalized) };
  } catch {
    return { ok: false, error: "Enter a valid USDC amount." };
  }
}

function useRecipient(input: string) {
  const debouncedInput = useDebounce(input.trim(), 350);
  const directAddress = isAddress(debouncedInput) ? getAddress(debouncedInput) : undefined;
  const shouldResolveEns = Boolean(debouncedInput && !directAddress && debouncedInput.includes("."));

  const ensAddress = useEnsAddress({
    name: shouldResolveEns ? debouncedInput : "",
    chainId: mainnet.id,
    query: {
      enabled: shouldResolveEns && isRpcConfigured,
      staleTime: 60_000,
    },
  });

  const resolvedAddress = directAddress ?? (ensAddress.data ? getAddress(ensAddress.data) : undefined);

  const error = useMemo(() => {
    if (!input.trim()) {
      return "Enter a recipient address or ENS name.";
    }

    if (directAddress) {
      return undefined;
    }

    if (!debouncedInput.includes(".")) {
      return "Enter a valid Ethereum address or ENS name.";
    }

    if (!isRpcConfigured) {
      return "Configure VITE_ETHEREUM_RPC_URL to resolve ENS names.";
    }

    if (ensAddress.isFetching) {
      return undefined;
    }

    if (ensAddress.error) {
      return "ENS lookup failed. Check your RPC connection and try again.";
    }

    if (debouncedInput && ensAddress.data === null) {
      return "That ENS name does not resolve to an address.";
    }

    return undefined;
  }, [debouncedInput, directAddress, ensAddress.data, ensAddress.error, ensAddress.isFetching, input]);

  return {
    error,
    isResolving: ensAddress.isFetching,
    resolvedAddress,
  };
}

export function PayPage() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const prices = useTokenPrices();
  const recipientState = useRecipient(recipient);
  const isOnMainnet = chainId === mainnet.id;

  const ethBalance = useBalance({
    address,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address) && isRpcConfigured,
      refetchInterval: 15_000,
    },
  });

  const usdcBalance = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address) && isRpcConfigured,
      refetchInterval: 15_000,
    },
  });

  const parsedAmount = parseUsdcInput(amount, usdcBalance.data);
  const ethBalanceNumber = ethBalance.data ? Number(formatEther(ethBalance.data.value)) : undefined;
  const usdcBalanceNumber = usdcBalance.data ? Number(formatUnits(usdcBalance.data, USDC_DECIMALS)) : undefined;
  const inputUsd =
    parsedAmount.ok && prices.data?.usdcUsd ? parsedAmount.decimalAmount * prices.data.usdcUsd : undefined;
  const ethUsd =
    ethBalanceNumber !== undefined && prices.data?.ethUsd ? ethBalanceNumber * prices.data.ethUsd : undefined;
  const balanceUsd =
    usdcBalanceNumber !== undefined && prices.data?.usdcUsd
      ? usdcBalanceNumber * prices.data.usdcUsd
      : undefined;

  const priceUpdatedAt = Math.min(
    prices.data?.ethUpdatedAt ?? Number.POSITIVE_INFINITY,
    prices.data?.usdcUpdatedAt ?? Number.POSITIVE_INFINITY,
  );
  const hasPriceTimestamp = Number.isFinite(priceUpdatedAt);
  const isPriceStale = hasPriceTimestamp ? Date.now() / 1000 - priceUpdatedAt > 180 : true;

  const canSubmit =
    isConnected &&
    isOnMainnet &&
    isRpcConfigured &&
    Boolean(recipientState.resolvedAddress) &&
    parsedAmount.ok &&
    !isSending;

  async function handleSwitchNetwork() {
    setFormError("");

    try {
      await switchChainAsync({ chainId: mainnet.id });
    } catch (error) {
      setFormError(userFriendlyError(error));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setTxHash(undefined);

    if (!isConnected) {
      setFormError("Connect a wallet before sending USDC.");
      return;
    }

    if (!isOnMainnet) {
      setFormError("Switch to Ethereum mainnet before sending real USDC.");
      return;
    }

    if (!isRpcConfigured) {
      setFormError("Set VITE_ETHEREUM_RPC_URL to a dedicated Ethereum mainnet RPC before sending.");
      return;
    }

    if (!recipientState.resolvedAddress) {
      setFormError(recipientState.error ?? "Enter a valid recipient.");
      return;
    }

    if (!parsedAmount.ok) {
      setFormError(parsedAmount.error);
      return;
    }

    setIsSending(true);

    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [recipientState.resolvedAddress as Address, parsedAmount.value],
        chainId: mainnet.id,
      });

      setTxHash(hash);

      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: mainnet.id,
        confirmations: 1,
      });

      if (receipt.status !== "success") {
        throw new Error("The transaction was included but did not succeed.");
      }

      await Promise.all([ethBalance.refetch(), usdcBalance.refetch()]);
      setSuccessMessage("USDC transfer confirmed on Ethereum mainnet.");
      setAmount("");
    } catch (error) {
      setFormError(userFriendlyError(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Application header">
        <a className="brand" href="/pay" aria-label={`${APP_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">
            $
          </span>
          <span>
            <strong>{APP_NAME}</strong>
            <small>Ethereum mainnet</small>
          </span>
        </a>

        <div className="wallet-area">
          {isConnected && address ? (
            <>
              <span className="connected-account">
                <Wallet size={16} aria-hidden="true" />
                {compactAddress(address)}
              </span>
              <button className="icon-button" type="button" onClick={() => disconnect()} aria-label="Disconnect wallet">
                <LogOut size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="connector-list" aria-label="Wallet connectors">
              {connectors.map((connector) => (
                <button
                  className="secondary-button"
                  disabled={isConnecting}
                  key={connector.uid}
                  onClick={() => connect({ connector, chainId: mainnet.id })}
                  type="button"
                >
                  <Wallet size={17} aria-hidden="true" />
                  {connector.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="status-strip" aria-label="Payment context">
        <div>
          <span className="muted-label">Token</span>
          <strong>{USDC_SYMBOL}</strong>
          <a href={`${ETHERSCAN_BASE_URL}/token/${USDC_ADDRESS}`} target="_blank" rel="noreferrer">
            {compactAddress(USDC_ADDRESS)}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        <div>
          <span className="muted-label">Network</span>
          <strong>Ethereum mainnet</strong>
          <span className={isOnMainnet ? "ok-text" : "warn-text"}>
            {isConnected ? (isOnMainnet ? "Wallet ready" : "Switch required") : "Connect to check"}
          </span>
        </div>
        <div>
          <span className="muted-label">Prices</span>
          <strong>{prices.isError ? "Unavailable" : isPriceStale ? "Stale" : "Live"}</strong>
          <span>
            CoinGecko, updated {hasPriceTimestamp ? formatDateTime(priceUpdatedAt) : "unavailable"}
          </span>
        </div>
      </section>

      {!isRpcConfigured ? (
        <aside className="notice warning" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>
            Add <code>VITE_ETHEREUM_RPC_URL</code> in your environment before using mainnet reads, ENS
            resolution, or sending.
          </span>
        </aside>
      ) : null}

      <div className="workspace">
        <section className="balance-grid" aria-label="Wallet balances">
          <article className="balance-card">
            <div>
              <span className="muted-label">USDC balance</span>
              <strong>
                {isConnected ? `${formatTokenAmount(usdcBalance.data, USDC_DECIMALS, 2)} ${USDC_SYMBOL}` : "Connect"}
              </strong>
            </div>
            <span>{isConnected ? formatUsd(balanceUsd) : "USD unavailable"}</span>
          </article>

          <article className="balance-card">
            <div>
              <span className="muted-label">ETH for gas</span>
              <strong>{isConnected ? `${formatTokenAmount(ethBalance.data?.value, 18, 5)} ETH` : "Connect"}</strong>
            </div>
            <span>{isConnected ? formatUsd(ethUsd) : "USD unavailable"}</span>
          </article>
        </section>

        <section className="pay-panel" aria-labelledby="pay-title">
          <div className="panel-heading">
            <div>
              <span className="muted-label">Transfer</span>
              <h1 id="pay-title">Send USDC</h1>
            </div>
            <ShieldCheck size={26} aria-hidden="true" />
          </div>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Recipient</span>
              <input
                autoComplete="off"
                inputMode="text"
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="vitalik.eth or 0x..."
                value={recipient}
              />
            </label>
            <div className="field-support">
              {recipientState.isResolving ? (
                <span>
                  <Loader2 className="spin" size={14} aria-hidden="true" />
                  Resolving ENS on mainnet
                </span>
              ) : recipientState.resolvedAddress ? (
                <span className="ok-text">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Recipient {compactAddress(recipientState.resolvedAddress)}
                </span>
              ) : (
                <span className={recipient ? "warn-text" : ""}>{recipientState.error}</span>
              )}
            </div>

            <label className="field">
              <span>Amount</span>
              <div className="amount-input">
                <input
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  value={amount}
                />
                <strong>{USDC_SYMBOL}</strong>
              </div>
            </label>
            <div className="field-support">
              <span className={amount && !parsedAmount.ok ? "warn-text" : ""}>
                {amount && !parsedAmount.ok ? parsedAmount.error : `${formatUsd(inputUsd)} at current USDC price`}
              </span>
            </div>

            <div className="review-box" aria-label="Transfer review">
              <div>
                <span className="muted-label">You send</span>
                <strong>{parsedAmount.ok ? `${amount} ${USDC_SYMBOL}` : `0 ${USDC_SYMBOL}`}</strong>
                <span>{formatUsd(inputUsd)}</span>
              </div>
              <div>
                <span className="muted-label">Gas paid in</span>
                <strong>ETH</strong>
                <span>
                  <Fuel size={14} aria-hidden="true" />
                  {ethBalanceNumber !== undefined && ethBalanceNumber > 0
                    ? `${formatTokenAmount(ethBalance.data?.value, 18, 5)} ETH available`
                    : "Balance needed"}
                </span>
              </div>
            </div>

            {isConnected && !isOnMainnet ? (
              <button className="primary-button" onClick={handleSwitchNetwork} type="button">
                <Send size={18} aria-hidden="true" />
                Switch to Ethereum mainnet
              </button>
            ) : (
              <button className="primary-button" disabled={!canSubmit} type="submit">
                {isSending ? (
                  <Loader2 className="spin" size={18} aria-hidden="true" />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
                {isSending ? "Waiting for confirmation" : "Send USDC"}
              </button>
            )}
          </form>

          {formError ? (
            <div className="notice error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="notice success" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {txHash ? (
            <div className="transaction-row">
              <span>{compactAddress(txHash)}</span>
              <button
                className="icon-button"
                onClick={() => navigator.clipboard.writeText(txHash)}
                type="button"
                aria-label="Copy transaction hash"
              >
                <Copy size={16} aria-hidden="true" />
              </button>
              <a
                className="icon-button"
                href={`${ETHERSCAN_BASE_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open transaction on Etherscan"
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
