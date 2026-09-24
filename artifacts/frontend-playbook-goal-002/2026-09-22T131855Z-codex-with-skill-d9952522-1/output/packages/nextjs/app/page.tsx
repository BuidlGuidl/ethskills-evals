"use client";

import { type SyntheticEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ArrowPathIcon, BanknotesIcon, PaperAirplaneIcon, WalletIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const formatUsdc = (value?: bigint) => {
  if (value === undefined) return "0.00";

  const formatted = Number(formatUnits(value, USDC_DECIMALS));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: formatted >= 100 ? 0 : 2,
  }).format(formatted);
};

const formatDate = (timestamp?: bigint) => {
  if (!timestamp) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(Number(timestamp) * 1000);
};

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const publicClient = usePublicClient({ chainId: targetNetwork.id });
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const { writeContractAsync: writeUsdcAsync } = useWriteContract();
  const { writeContractAsync: writeTipAsync, isMining } = useScaffoldWriteContract({ contractName: "TipJar" });

  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: totalTips } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTips",
  });
  const { data: tipCount } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tipCount",
  });
  const { data: jarBalance } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "usdcBalance",
  });

  const { data: walletBalance, refetch: refetchWalletBalance } = useReadContract({
    chainId: targetNetwork.id,
    address: BASE_USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    query: { enabled: Boolean(connectedAddress) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    chainId: targetNetwork.id,
    address: BASE_USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: connectedAddress && tipJar?.address ? [connectedAddress, tipJar.address] : undefined,
    query: { enabled: Boolean(connectedAddress && tipJar?.address) },
  });

  // Local fork only: this lightweight event history hook keeps the demo self-contained.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { data: rawTips, isLoading: isFeedLoading } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "TipReceived",
    watch: true,
    blockData: true,
    blocksBatchSize: 250,
  });

  const tips = (rawTips || []).map(event => event as any);
  const needsApproval = parsedAmount > 0n && (allowance ?? 0n) < parsedAmount;
  const canTip = isConnected && Boolean(tipJar?.address) && parsedAmount > 0n && message.length <= 280;

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!connectedAddress) {
      notification.error("Connect a wallet first.");
      return;
    }
    if (!tipJar?.address) {
      notification.error("TipJar is not deployed on the local chain yet.");
      return;
    }
    if (parsedAmount <= 0n) {
      notification.error("Enter a USDC amount greater than zero.");
      return;
    }
    if (message.length > 280) {
      notification.error("Keep the note under 280 characters.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (needsApproval) {
        const approveHash = await writeUsdcAsync({
          chainId: targetNetwork.id,
          address: BASE_USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [tipJar.address, parsedAmount],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      await writeTipAsync({
        functionName: "tip",
        args: [parsedAmount, message.trim()],
      });

      setAmount("5");
      setMessage("");
      await refetchWalletBalance();
      await refetchAllowance();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-base-200">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex min-h-[360px] flex-col justify-between border border-base-300 bg-base-100 p-6 sm:p-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 border border-base-300 px-3 py-1 text-sm font-medium text-base-content/80">
                <span className="h-2 w-2 bg-success" />
                Base USDC on a local fork
              </div>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">USDC Tip Jar</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/75 sm:text-lg">
                Send USDC tips to an onchain jar, leave a short note, and watch the feed update from contract events.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border border-base-300 bg-base-200 p-4">
                <div className="flex items-center gap-2 text-sm text-base-content/60">
                  <BanknotesIcon className="h-4 w-4" />
                  Total tipped
                </div>
                <div className="mt-2 text-2xl font-bold">{formatUsdc(totalTips)} USDC</div>
              </div>
              <div className="border border-base-300 bg-base-200 p-4">
                <div className="flex items-center gap-2 text-sm text-base-content/60">
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Tips
                </div>
                <div className="mt-2 text-2xl font-bold">{tipCount?.toString() ?? "0"}</div>
              </div>
              <div className="border border-base-300 bg-base-200 p-4">
                <div className="flex items-center gap-2 text-sm text-base-content/60">
                  <WalletIcon className="h-4 w-4" />
                  Jar balance
                </div>
                <div className="mt-2 text-2xl font-bold">{formatUsdc(jarBalance)} USDC</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border border-base-300 bg-base-100 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Send a Tip</h2>
              <RainbowKitCustomConnectButton />
            </div>

            <div className="mt-6 space-y-5">
              <label className="form-control">
                <span className="label-text mb-2 font-medium">Amount</span>
                <div className="join w-full">
                  <input
                    value={amount}
                    onChange={event => setAmount(event.target.value)}
                    className="input join-item input-bordered w-full"
                    inputMode="decimal"
                    placeholder="5"
                  />
                  <span className="join-item flex items-center border border-base-300 bg-base-200 px-4 font-semibold">
                    USDC
                  </span>
                </div>
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">Note</span>
                <textarea
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  className="textarea textarea-bordered min-h-28 resize-none"
                  maxLength={280}
                  placeholder="Thanks for building on Base."
                />
                <span className="mt-2 text-right text-xs text-base-content/55">{message.length}/280</span>
              </label>

              <div className="border border-base-300 bg-base-200 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base-content/65">Wallet USDC</span>
                  <span className="font-semibold">{formatUsdc(walletBalance)} USDC</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-base-content/65">Approval</span>
                  <span className="font-semibold">{needsApproval ? "Needed" : "Ready"}</span>
                </div>
              </div>

              <button className="btn btn-primary w-full" disabled={!canTip || isSubmitting || isMining}>
                {isSubmitting || isMining ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {needsApproval ? "Approve and tip" : "Send tip"}
              </button>
            </div>
          </form>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="border border-base-300 bg-base-100">
            <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
              <h2 className="text-xl font-bold">Tip Feed</h2>
              <span className="text-sm text-base-content/55">{isFeedLoading ? "Syncing" : "Live"}</span>
            </div>
            <div className="divide-y divide-base-300">
              {tips.length === 0 ? (
                <div className="p-6 text-base-content/65">No tips yet. Send the first one from the local fork.</div>
              ) : (
                tips.map(event => (
                  <article key={`${event.transactionHash}-${event.logIndex}`} className="p-6">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <Address address={event.args.tipper} chain={targetNetwork} />
                        <p className="mt-3 break-words text-base leading-7">
                          {event.args.message || <span className="text-base-content/45">No note</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-lg font-bold">{formatUsdc(event.args.amount)} USDC</div>
                        <div className="mt-1 text-sm text-base-content/55">{formatDate(event.args.timestamp)}</div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="border border-base-300 bg-base-100 p-6">
              <h2 className="text-xl font-bold">Local Contract</h2>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="mb-1 text-base-content/55">Network</div>
                  <div className="font-semibold">
                    {targetNetwork.name} ({targetNetwork.id})
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-base-content/55">Base USDC</div>
                  <Address address={BASE_USDC_ADDRESS} chain={base} />
                </div>
                <div>
                  <div className="mb-1 text-base-content/55">TipJar</div>
                  {tipJar?.address ? (
                    <Address address={tipJar.address} chain={targetNetwork} />
                  ) : (
                    <span className="text-warning">Run `yarn deploy`</span>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-base-300 bg-base-100 p-6">
              <h2 className="text-xl font-bold">Developer Routes</h2>
              <div className="mt-4 flex flex-col gap-3">
                <Link href="/debug" className="btn btn-outline justify-start">
                  Debug Contracts
                </Link>
                <Link href="/blockexplorer" className="btn btn-outline justify-start">
                  Local Block Explorer
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
};

export default Home;
