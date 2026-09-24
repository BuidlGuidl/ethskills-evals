import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Address, Hash, formatEther, formatUnits, isAddress, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { toHumanError } from "../core/errors";
import { formatFiat, formatTokenAmount, truncateAddress } from "../core/format";
import { fetchTokenPrices } from "../core/prices";
import { erc20Abi, USDC_ADDRESS, USDC_DECIMALS, USDC_SYMBOL } from "../core/usdc";
import { isRpcConfigured } from "../core/wagmi";

type RecipientState =
  | { status: "idle"; message: string; address?: undefined }
  | { status: "valid"; message: string; address: Address }
  | { status: "invalid"; message: string; address?: undefined }
  | { status: "resolving"; message: string; address?: undefined };

type SendState = "idle" | "signing" | "confirming" | "refreshing";

const ETHERSCAN_TX_URL = "https://etherscan.io/tx/";
const PRICE_STALE_MS = 5 * 60 * 1000;

export function PayPage() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const queryClient = useQueryClient();

  const [recipientInput, setRecipientInput] = useState("");
  const [recipient, setRecipient] = useState<RecipientState>({
    status: "idle",
    message: "Enter an Ethereum address or ENS name.",
  });
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState("");
  const [txError, setTxError] = useState("");
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const [sendState, setSendState] = useState<SendState>("idle");

  const {
    data: ethBalance,
    isFetching: isEthBalanceFetching,
    refetch: refetchEthBalance,
  } = useBalance({
    address,
    chainId: mainnet.id,
    query: { enabled: Boolean(address) && isRpcConfigured },
  });

  const {
    data: usdcBalance,
    isFetching: isUsdcBalanceFetching,
    refetch: refetchUsdcBalance,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: mainnet.id,
    query: { enabled: Boolean(address) && isRpcConfigured },
  });

  const {
    data: prices,
    isFetching: isPriceFetching,
    isError: isPriceError,
    refetch: refetchPrices,
  } = useQuery({
    queryKey: ["token-prices"],
    queryFn: fetchTokenPrices,
    staleTime: PRICE_STALE_MS,
    refetchInterval: PRICE_STALE_MS,
  });

  const parsedAmount = useMemo(() => {
    const trimmed = amountInput.trim();
    if (!trimmed || !/^\d+(\.\d{0,6})?$/.test(trimmed)) {
      return undefined;
    }

    try {
      return parseUnits(trimmed, USDC_DECIMALS);
    } catch {
      return undefined;
    }
  }, [amountInput]);

  const enteredAmountFiat = useMemo(() => {
    if (!parsedAmount || !prices?.usdcUsd) return undefined;
    return Number(formatUnits(parsedAmount, USDC_DECIMALS)) * prices.usdcUsd;
  }, [parsedAmount, prices?.usdcUsd]);

  const usdcBalanceFiat = useMemo(() => {
    if (usdcBalance === undefined || !prices?.usdcUsd) return undefined;
    return Number(formatUnits(usdcBalance, USDC_DECIMALS)) * prices.usdcUsd;
  }, [prices?.usdcUsd, usdcBalance]);

  const ethBalanceFiat = useMemo(() => {
    if (!ethBalance?.value || !prices?.ethUsd) return undefined;
    return Number(formatEther(ethBalance.value)) * prices.ethUsd;
  }, [ethBalance?.value, prices?.ethUsd]);

  const isOnMainnet = chainId === mainnet.id;
  const canSpend = parsedAmount !== undefined && parsedAmount > 0n;
  const hasEnoughUsdc = parsedAmount !== undefined && usdcBalance !== undefined && usdcBalance >= parsedAmount;
  const primaryConnector = connectors[0];
  const isSending = sendState !== "idle";
  const priceLabel = getPriceLabel(prices?.updatedAt, isPriceFetching, isPriceError);

  useEffect(() => {
    setFormError("");
    setTxError("");
  }, [amountInput, recipientInput]);

  useEffect(() => {
    let isCurrent = true;
    const rawValue = recipientInput.trim();

    if (!rawValue) {
      setRecipient({
        status: "idle",
        message: "Enter an Ethereum address or ENS name.",
      });
      return;
    }

    if (!isRpcConfigured) {
      setRecipient({
        status: "invalid",
        message: "Configure VITE_MAINNET_RPC_URL before resolving recipients.",
      });
      return;
    }

    if (isAddress(rawValue)) {
      setRecipient({
        status: "valid",
        message: "Recipient address is ready.",
        address: rawValue,
      });
      return;
    }

    if (!rawValue.toLowerCase().endsWith(".eth")) {
      setRecipient({
        status: "invalid",
        message: "Enter an Ethereum address or an ENS name ending in .eth.",
      });
      return;
    }

    setRecipient({
      status: "resolving",
      message: "Resolving ENS on Ethereum mainnet.",
    });

    const timer = window.setTimeout(async () => {
      try {
        const resolvedAddress = await publicClient?.getEnsAddress({ name: rawValue });

        if (!isCurrent) return;

        if (resolvedAddress) {
          setRecipient({
            status: "valid",
            message: `Resolved to ${truncateAddress(resolvedAddress)}.`,
            address: resolvedAddress,
          });
        } else {
          setRecipient({
            status: "invalid",
            message: "That ENS name does not resolve to an address on mainnet.",
          });
        }
      } catch {
        if (!isCurrent) return;
        setRecipient({
          status: "invalid",
          message: "Could not resolve that ENS name. Check it and try again.",
        });
      }
    }, 350);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [publicClient, recipientInput]);

  async function handleConnect() {
    if (!primaryConnector) return;
    setTxError("");

    try {
      await connectAsync({ connector: primaryConnector, chainId: mainnet.id });
    } catch (error) {
      setTxError(toHumanError(error));
    }
  }

  async function handleSwitchNetwork() {
    setTxError("");

    try {
      await switchChainAsync({ chainId: mainnet.id });
    } catch (error) {
      setTxError(toHumanError(error));
    }
  }

  async function handleRefresh() {
    await Promise.all([refetchEthBalance(), refetchUsdcBalance(), refetchPrices()]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setTxError("");
    setTxHash(undefined);

    if (!isConnected) {
      setFormError("Connect a wallet before sending USDC.");
      return;
    }

    if (!isOnMainnet) {
      setFormError("Switch to Ethereum mainnet before sending real USDC.");
      return;
    }

    if (!walletClient || !publicClient) {
      setFormError("Wallet is not ready yet. Reconnect and try again.");
      return;
    }

    if (recipient.status !== "valid") {
      setFormError(recipient.message);
      return;
    }

    if (!canSpend || parsedAmount === undefined) {
      setFormError(`Enter a ${USDC_SYMBOL} amount with up to ${USDC_DECIMALS} decimals.`);
      return;
    }

    if (!hasEnoughUsdc) {
      setFormError("Your USDC balance is lower than the amount entered.");
      return;
    }

    try {
      setSendState("signing");
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient.address, parsedAmount],
        chain: mainnet,
        account: walletClient.account,
      });
      setTxHash(hash);

      setSendState("confirming");
      await publicClient.waitForTransactionReceipt({ hash });

      setSendState("refreshing");
      await Promise.all([queryClient.invalidateQueries(), refetchEthBalance(), refetchUsdcBalance()]);
      setAmountInput("");
    } catch (error) {
      setTxError(toHumanError(error));
    } finally {
      setSendState("idle");
    }
  }

  return (
    <main className="shell">
      <section className="topbar" aria-label="Application status">
        <div className="brand" aria-label="USDC Pay">
          <span className="brand-mark">$</span>
          <span>
            <strong>USDC Pay</strong>
            <small>Ethereum mainnet</small>
          </span>
        </div>

        <div className="wallet-controls">
          {isConnected && address ? (
            <>
              <span className="wallet-pill">
                <Wallet size={16} aria-hidden="true" />
                {truncateAddress(address)}
              </span>
              <button className="secondary-button compact" type="button" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="primary-button compact" type="button" onClick={handleConnect} disabled={isConnectPending}>
              {isConnectPending ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
              Connect
            </button>
          )}
        </div>
      </section>

      <section className="hero">
        <div>
          <p className="eyebrow">Mainnet USDC transfer</p>
          <h1>Send USDC with the context you need before signing.</h1>
        </div>
        <div className="chain-card" aria-live="polite">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>{isOnMainnet ? "Connected to Ethereum mainnet" : "Ethereum mainnet required"}</span>
        </div>
      </section>

      {!isRpcConfigured && (
        <div className="banner warning" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Set VITE_MAINNET_RPC_URL to a dedicated Ethereum mainnet RPC before using this app.</span>
        </div>
      )}

      <section className="dashboard">
        <div className="balance-strip" aria-label="Balances">
          <BalancePanel
            label="USDC balance"
            value={`${formatTokenAmount(usdcBalance, USDC_DECIMALS)} ${USDC_SYMBOL}`}
            fiat={formatFiat(usdcBalanceFiat)}
            loading={isUsdcBalanceFetching}
          />
          <BalancePanel
            label="ETH for gas"
            value={`${formatTokenAmount(ethBalance?.value, 18)} ETH`}
            fiat={formatFiat(ethBalanceFiat)}
            loading={isEthBalanceFetching}
          />
          <div className="price-panel">
            <span>Market prices</span>
            <strong>{priceLabel}</strong>
            <button className="icon-button" type="button" onClick={handleRefresh} aria-label="Refresh balances and prices">
              <RefreshCw size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <form className="pay-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <div>
              <h2>Payment</h2>
              <p>Transfers real USDC from your connected wallet.</p>
            </div>
          </div>

          <label className="field">
            <span>Recipient</span>
            <input
              value={recipientInput}
              onChange={(event) => setRecipientInput(event.target.value)}
              placeholder="vitalik.eth or 0x..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <StatusLine state={recipient.status} message={recipient.message} />

          {recipient.status === "valid" && (
            <div className="resolved-box">
              <span>Sending to</span>
              <code>{recipient.address}</code>
            </div>
          )}

          <label className="field">
            <span>Amount</span>
            <div className="amount-row">
              <input
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
              />
              <span>{USDC_SYMBOL}</span>
            </div>
          </label>

          <div className="amount-context">
            <span>{parsedAmount ? `About ${formatFiat(enteredAmountFiat)}` : "Enter up to 6 decimal places"}</span>
            {hasEnoughUsdc || !parsedAmount || usdcBalance === undefined ? null : (
              <span className="negative">Insufficient USDC</span>
            )}
          </div>

          {!isConnected && (
            <button className="primary-button full" type="button" onClick={handleConnect} disabled={isConnectPending}>
              {isConnectPending ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Wallet size={18} aria-hidden="true" />}
              Connect wallet
            </button>
          )}

          {isConnected && !isOnMainnet && (
            <button className="primary-button full" type="button" onClick={handleSwitchNetwork} disabled={isSwitchPending}>
              {isSwitchPending ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
              Switch to Ethereum
            </button>
          )}

          {isConnected && isOnMainnet && (
            <button
              className="primary-button full"
              type="submit"
              disabled={!isRpcConfigured || isSending || recipient.status !== "valid" || !canSpend || !hasEnoughUsdc}
            >
              {isSending ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
              {getSendButtonLabel(sendState)}
            </button>
          )}

          {(formError || txError) && (
            <div className="banner error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{formError || txError}</span>
            </div>
          )}

          {txHash && !txError && sendState === "idle" && (
            <a className="receipt-link" href={`${ETHERSCAN_TX_URL}${txHash}`} target="_blank" rel="noreferrer">
              <CheckCircle2 size={18} aria-hidden="true" />
              Transfer confirmed
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
        </form>
      </section>
    </main>
  );
}

function BalancePanel({
  label,
  value,
  fiat,
  loading,
}: {
  label: string;
  value: string;
  fiat: string;
  loading: boolean;
}) {
  return (
    <div className="balance-panel">
      <span>{label}</span>
      <strong>{loading ? "Refreshing..." : value}</strong>
      <small>{fiat}</small>
    </div>
  );
}

function StatusLine({ state, message }: { state: RecipientState["status"]; message: string }) {
  return (
    <p className={`status-line ${state}`} aria-live="polite">
      {state === "resolving" && <Loader2 className="spin" size={15} aria-hidden="true" />}
      {state === "valid" && <CheckCircle2 size={15} aria-hidden="true" />}
      {state === "invalid" && <AlertTriangle size={15} aria-hidden="true" />}
      {message}
    </p>
  );
}

function getSendButtonLabel(sendState: SendState) {
  if (sendState === "signing") return "Confirm in wallet";
  if (sendState === "confirming") return "Waiting for confirmation";
  if (sendState === "refreshing") return "Refreshing balances";
  return "Send USDC";
}

function getPriceLabel(updatedAt: Date | undefined, loading: boolean, failed: boolean) {
  if (loading && !updatedAt) return "Loading";
  if (failed || !updatedAt) return "Unavailable";

  const ageMs = Date.now() - updatedAt.getTime();
  if (ageMs > PRICE_STALE_MS) return "Stale";

  return `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
