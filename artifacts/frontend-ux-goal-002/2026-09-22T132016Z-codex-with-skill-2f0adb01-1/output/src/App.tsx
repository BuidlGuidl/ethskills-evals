import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  type Address,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
} from "viem";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useEnsAddress,
  useEnsName,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { decimalPlaces, formatEth, formatUsdc, formatUsd, shortenAddress } from "./format";
import { erc20Abi, USDC_ADDRESS, USDC_DECIMALS } from "./usdc";
import { hasDedicatedRpc } from "./wagmi";
import { useEthPrice } from "./useEthPrice";

const explorerBaseUrl = "https://etherscan.io";

type TxState =
  | { status: "idle" }
  | { status: "pending"; label: string }
  | { status: "success"; hash: `0x${string}` }
  | { status: "error"; message: string };

function App() {
  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { data: ethPriceUsd } = useEthPrice();

  const isWrongNetwork = isConnected && chainId !== mainnet.id;
  const normalizedRecipientInput = recipientInput.trim();
  const isEnsRecipient =
    normalizedRecipientInput.includes(".") && !isAddress(normalizedRecipientInput);

  const { data: resolvedEnsAddress, isFetching: isResolvingEns } = useEnsAddress({
    chainId: mainnet.id,
    name: isEnsRecipient ? normalizedRecipientInput : undefined,
    query: { enabled: isEnsRecipient },
  });

  const { data: accountEnsName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { enabled: Boolean(address) },
  });

  const recipientAddress = useMemo<Address | undefined>(() => {
    if (isAddress(normalizedRecipientInput)) {
      return getAddress(normalizedRecipientInput);
    }

    return resolvedEnsAddress ?? undefined;
  }, [normalizedRecipientInput, resolvedEnsAddress]);

  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address),
      refetchInterval: 8_000,
    },
  });

  const {
    data: tokenReads,
    isLoading: isLoadingUsdc,
    refetch: refetchUsdcReads,
  } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address ?? "0x0000000000000000000000000000000000000000"],
        chainId: mainnet.id,
      },
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: mainnet.id,
      },
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "symbol",
        chainId: mainnet.id,
      },
    ],
    query: {
      enabled: Boolean(address),
      refetchInterval: 8_000,
    },
  });

  const usdcBalance = tokenReads?.[0] ?? 0n;
  const tokenDecimals = tokenReads?.[1] ?? USDC_DECIMALS;
  const tokenSymbol = tokenReads?.[2] ?? "USDC";
  const amountNumber = Number(amountInput);
  const parsedAmount = useMemo(() => {
    if (!amountInput || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      return undefined;
    }

    if (decimalPlaces(amountInput) > USDC_DECIMALS) {
      return undefined;
    }

    try {
      return parseUnits(amountInput, USDC_DECIMALS);
    } catch {
      return undefined;
    }
  }, [amountInput, amountNumber]);

  const usdcBalanceNumber = Number(formatUnits(usdcBalance, USDC_DECIMALS));
  const ethBalanceNumber = ethBalance ? Number(formatEther(ethBalance.value)) : 0;
  const hasEnoughUsdc = parsedAmount !== undefined && parsedAmount <= usdcBalance;
  const hasGas = (ethBalance?.value ?? 0n) > 0n;
  const isSending = txState.status === "pending";

  const validationMessage = useMemo(() => {
    if (!isConnected) return "Connect a wallet to send USDC.";
    if (isWrongNetwork) return "Switch to Ethereum mainnet to continue.";
    if (!normalizedRecipientInput) return "Enter a recipient address or ENS name.";
    if (isEnsRecipient && isResolvingEns) return "Resolving ENS recipient...";
    if (!recipientAddress) return "Enter a valid Ethereum address or resolvable ENS name.";
    if (address && recipientAddress.toLowerCase() === address.toLowerCase()) {
      return "Recipient is your connected wallet.";
    }
    if (!amountInput) return "Enter a USDC amount.";
    if (!parsedAmount) return "Enter a positive amount with no more than 6 decimals.";
    if (!hasEnoughUsdc) return "Insufficient USDC balance.";
    if (!hasGas) return "You need ETH in this wallet for gas.";
    return null;
  }, [
    address,
    amountInput,
    hasEnoughUsdc,
    hasGas,
    isConnected,
    isEnsRecipient,
    isResolvingEns,
    isWrongNetwork,
    normalizedRecipientInput,
    parsedAmount,
    recipientAddress,
  ]);

  const connectLabel = connectors[0]?.name ?? "Wallet";

  async function copyAddress(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedAddress(value);
    window.setTimeout(() => setCopiedAddress(null), 1_500);
  }

  async function refetchBalances() {
    await Promise.all([refetchEthBalance(), refetchUsdcReads()]);
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!publicClient || !recipientAddress || !parsedAmount || validationMessage) {
      return;
    }

    setTxState({ status: "pending", label: "Confirm in wallet" });

    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipientAddress, parsedAmount],
        chainId: mainnet.id,
      });

      setTxState({ status: "pending", label: "Sending USDC" });

      await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      await refetchBalances();
      setTxState({ status: "success", hash });
      setAmountInput("");
    } catch (error) {
      setTxState({ status: "error", message: parseTransferError(error) });
    }
  }

  async function handlePrimaryAction() {
    if (!isConnected) {
      const connector = connectors[0];
      if (connector) connect({ connector, chainId: mainnet.id });
      return;
    }

    if (isWrongNetwork) {
      setTxState({ status: "idle" });
      await switchChainAsync({ chainId: mainnet.id });
    }
  }

  return (
    <main className="app-shell">
      <section className="pay-panel" aria-labelledby="page-title">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              $
            </div>
            <div>
              <p className="eyebrow">Ethereum mainnet</p>
              <h1 id="page-title">USDC Pay</h1>
            </div>
          </div>

          <div className="wallet-control">
            {isConnected && address ? (
              <>
                <AddressPill
                  address={address}
                  label={accountEnsName ?? undefined}
                  copied={copiedAddress === address}
                  onCopy={() => copyAddress(address)}
                />
                <button className="button ghost" type="button" onClick={() => disconnect()}>
                  Disconnect
                </button>
              </>
            ) : (
              <button
                className="button primary compact"
                type="button"
                disabled={isConnecting || connectors.length === 0}
                onClick={handlePrimaryAction}
              >
                {isConnecting ? <Loader2 className="spin" size={18} /> : <Wallet size={18} />}
                {isConnecting ? "Connecting..." : `Connect ${connectLabel}`}
              </button>
            )}
          </div>
        </header>

        {!hasDedicatedRpc ? (
          <div className="notice warning" role="status">
            <AlertCircle size={18} />
            <span>Set VITE_MAINNET_RPC_URL before production. Public fallback RPCs are active.</span>
          </div>
        ) : null}

        <div className="balance-grid" aria-label="Wallet balances">
          <BalanceCard
            label="USDC balance"
            value={isLoadingUsdc ? "Loading..." : formatUsdc(usdcBalance)}
            fiat={formatUsd(usdcBalanceNumber)}
          />
          <BalanceCard
            label="ETH for gas"
            value={formatEth(ethBalance?.value)}
            fiat={formatUsd(ethBalanceNumber * (ethPriceUsd ?? Number.NaN))}
          />
        </div>

        <form className="payment-form" onSubmit={submitTransfer}>
          <label className="field">
            <span>Recipient</span>
            <div className="input-row">
              <input
                value={recipientInput}
                onChange={(event) => {
                  setRecipientInput(event.target.value.trim());
                  setTxState({ status: "idle" });
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  setRecipientInput(event.clipboardData.getData("text").trim());
                }}
                placeholder="0x... or name.eth"
                autoComplete="off"
                spellCheck={false}
              />
              {isResolvingEns ? <Loader2 className="inline-spinner spin" size={18} /> : null}
            </div>
          </label>

          {recipientAddress ? (
            <div className="resolved-address">
              <ShieldCheck size={16} />
              <span>{isEnsRecipient ? "Resolved to " : "Recipient "}</span>
              <a
                href={`${explorerBaseUrl}/address/${recipientAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortenAddress(recipientAddress)}
              </a>
              <button
                className="icon-button"
                type="button"
                aria-label="Copy recipient address"
                title="Copy recipient address"
                onClick={() => copyAddress(recipientAddress)}
              >
                <Copy size={15} />
              </button>
            </div>
          ) : null}

          <label className="field">
            <span>Amount</span>
            <div className="amount-row">
              <input
                inputMode="decimal"
                value={amountInput}
                onChange={(event) => {
                  setAmountInput(sanitizeAmount(event.target.value));
                  setTxState({ status: "idle" });
                }}
                placeholder="0.00"
                aria-describedby="amount-help"
              />
              <strong>{tokenSymbol}</strong>
            </div>
          </label>

          <div id="amount-help" className="amount-context">
            <span>{amountInput && parsedAmount ? formatUsd(amountNumber) : "~$0.00"}</span>
            <button
              className="text-button"
              type="button"
              disabled={usdcBalance === 0n}
              onClick={() => setAmountInput(trimTokenAmount(formatUnits(usdcBalance, tokenDecimals)))}
            >
              Max
            </button>
          </div>

          {validationMessage ? (
            <div className="notice" role="status">
              <AlertCircle size={18} />
              <span>{validationMessage}</span>
            </div>
          ) : null}

          {txState.status === "error" ? (
            <div className="notice error" role="alert">
              <AlertCircle size={18} />
              <span>{txState.message}</span>
            </div>
          ) : null}

          {txState.status === "success" ? (
            <div className="notice success" role="status">
              <CheckCircle2 size={18} />
              <span>USDC sent.</span>
              <a href={`${explorerBaseUrl}/tx/${txState.hash}`} target="_blank" rel="noreferrer">
                View transaction
              </a>
            </div>
          ) : null}

          {!isConnected || isWrongNetwork ? (
            <button
              className="button primary wide"
              type="button"
              disabled={isConnecting || isSwitching}
              onClick={handlePrimaryAction}
            >
              {isConnecting || isSwitching ? <Loader2 className="spin" size={18} /> : <Wallet size={18} />}
              {!isConnected
                ? isConnecting
                  ? "Connecting..."
                  : "Connect Wallet"
                : isSwitching
                  ? "Switching..."
                  : "Switch to Ethereum"}
            </button>
          ) : (
            <button
              className="button primary wide"
              type="submit"
              disabled={Boolean(validationMessage) || isSending}
            >
              {isSending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              {isSending ? txState.label : "Send USDC"}
            </button>
          )}
        </form>

        <footer className="footer-strip">
          <span>USDC contract</span>
          <a href={`${explorerBaseUrl}/token/${USDC_ADDRESS}`} target="_blank" rel="noreferrer">
            {shortenAddress(USDC_ADDRESS)}
            <ExternalLink size={14} />
          </a>
          <button
            className="icon-button"
            type="button"
            aria-label="Copy USDC contract address"
            title="Copy USDC contract address"
            onClick={() => copyAddress(USDC_ADDRESS)}
          >
            {copiedAddress === USDC_ADDRESS ? <CheckCircle2 size={15} /> : <Copy size={15} />}
          </button>
          <button className="icon-button" type="button" aria-label="Refresh balances" title="Refresh balances" onClick={refetchBalances}>
            <RefreshCw size={15} />
          </button>
        </footer>
      </section>
    </main>
  );
}

function BalanceCard({ label, value, fiat }: { label: string; value: string; fiat: string }) {
  return (
    <article className="balance-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{fiat}</small>
    </article>
  );
}

function AddressPill({
  address,
  label,
  copied,
  onCopy,
}: {
  address: Address;
  label?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="address-pill">
      <span className="address-dot" aria-hidden="true" />
      <a href={`${explorerBaseUrl}/address/${address}`} target="_blank" rel="noreferrer">
        {label ?? shortenAddress(address)}
      </a>
      <button
        className="icon-button"
        type="button"
        aria-label="Copy connected wallet address"
        title="Copy connected wallet address"
        onClick={onCopy}
      >
        {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

function sanitizeAmount(value: string) {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function trimTokenAmount(value: string) {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function parseTransferError(error: unknown) {
  if (error instanceof ContractFunctionRevertedError) {
    return error.reason ? `USDC transfer reverted: ${error.reason}` : "USDC transfer reverted.";
  }

  if (error instanceof ContractFunctionExecutionError) {
    return "USDC transfer could not be executed. Check the recipient, amount, and gas balance.";
  }

  if (error instanceof BaseError) {
    const shortMessage = error.shortMessage.toLowerCase();
    if (shortMessage.includes("user rejected") || shortMessage.includes("rejected")) {
      return "Transaction was rejected in the wallet.";
    }
    if (shortMessage.includes("insufficient funds")) {
      return "Insufficient ETH to pay gas for this transfer.";
    }
    return error.shortMessage;
  }

  return "Something went wrong while sending USDC.";
}

export default App;
