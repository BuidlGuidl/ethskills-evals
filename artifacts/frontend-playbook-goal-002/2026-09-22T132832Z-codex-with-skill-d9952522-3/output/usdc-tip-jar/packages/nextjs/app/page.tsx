"use client";

import { SyntheticEvent, useMemo, useState } from "react";
import { Abi, Address, formatUnits, parseUnits } from "viem";
import { foundry } from "viem/chains";
import { useAccount, useConfig, useReadContract, useSwitchChain, useWatchContractEvent } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import {
  ArrowPathIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;

type TipJarContract = {
  address: Address;
  abi: Abi;
  deployedOnBlock?: number;
};

type Tip = {
  tipper: Address;
  amount: bigint;
  name: string;
  message: string;
  timestamp: bigint;
};

const contractsByChain = deployedContracts as unknown as Record<number, { USDCTipJar?: TipJarContract }>;

const formatUsdc = (value?: bigint) => `${formatUnits(value ?? 0n, 6)} USDC`;

const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const Home = () => {
  const config = useConfig();
  const { address, chain, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const tipJar = contractsByChain[foundry.id]?.USDCTipJar;

  const [amount, setAmount] = useState("5");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: balance,
    refetch: refetchBalance,
    isLoading: isBalanceLoading,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address as Address],
    chainId: foundry.id,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as Address, tipJar?.address as Address],
    chainId: foundry.id,
    query: { enabled: Boolean(address && tipJar?.address) },
  });

  const { data: totalAmount, refetch: refetchTotalAmount } = useReadContract({
    address: tipJar?.address,
    abi: tipJar?.abi,
    functionName: "totalAmount",
    chainId: foundry.id,
    query: { enabled: Boolean(tipJar?.address) },
  });

  const { data: tipCount, refetch: refetchTipCount } = useReadContract({
    address: tipJar?.address,
    abi: tipJar?.abi,
    functionName: "tipCount",
    chainId: foundry.id,
    query: { enabled: Boolean(tipJar?.address) },
  });

  const { data: tipsData, refetch: refetchTips } = useReadContract({
    address: tipJar?.address,
    abi: tipJar?.abi,
    functionName: "getTips",
    chainId: foundry.id,
    query: { enabled: Boolean(tipJar?.address) },
  });

  const tips = useMemo(() => {
    return ([...((tipsData as readonly Tip[] | undefined) ?? [])] as Tip[]).reverse();
  }, [tipsData]);

  const refetchJar = async () => {
    await Promise.all([refetchBalance(), refetchAllowance(), refetchTotalAmount(), refetchTipCount(), refetchTips()]);
  };

  useWatchContractEvent({
    address: tipJar?.address,
    abi: tipJar?.abi,
    eventName: "TipReceived",
    chainId: foundry.id,
    onLogs: () => {
      refetchJar();
    },
  });

  const submitTip = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!address || !tipJar) {
      return;
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount || "0", 6);
    } catch {
      setStatus("Enter a valid USDC amount.");
      return;
    }

    if (parsedAmount <= 0n) {
      setStatus("Enter an amount greater than zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (chain?.id !== foundry.id) {
        setStatus("Switching wallet to local Base fork...");
        await switchChainAsync({ chainId: foundry.id });
      }

      if ((allowance ?? 0n) < parsedAmount) {
        setStatus("Approving USDC spend...");
        const approveHash = await writeContract(config, {
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [tipJar.address, parsedAmount],
          chainId: foundry.id,
        });
        await waitForTransactionReceipt(config, { hash: approveHash, chainId: foundry.id });
      }

      setStatus("Sending tip...");
      const tipHash = await writeContract(config, {
        address: tipJar.address,
        abi: tipJar.abi,
        functionName: "tip",
        args: [parsedAmount, name.trim(), message.trim()],
        chainId: foundry.id,
      });
      await waitForTransactionReceipt(config, { hash: tipHash, chainId: foundry.id });

      setStatus("Tip sent. Thank you.");
      setAmount("5");
      setName("");
      setMessage("");
      await refetchJar();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isWrongNetwork = isConnected && chain?.id !== foundry.id;
  const canSubmit = Boolean(isConnected && tipJar && !isSubmitting && !isWrongNetwork);

  return (
    <main className="grow bg-base-200">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Base USDC</p>
            <h1 className="text-4xl font-bold leading-tight text-base-content sm:text-5xl">USDC Tip Jar</h1>
            <p className="mt-4 text-base leading-7 text-base-content/70">
              Send a USDC tip on a local Base fork and watch the onchain feed update from the jar contract.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded border border-base-300 bg-base-100 p-4 shadow-sm sm:min-w-72">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-base-content/60">Wallet</span>
              <RainbowKitCustomConnectButton />
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-base-content/60">Local balance</span>
              <span className="font-semibold">{isBalanceLoading ? "Loading..." : formatUsdc(balance)}</span>
            </div>
          </div>
        </div>

        {!tipJar && (
          <div className="flex items-start gap-3 rounded border border-warning/40 bg-warning/10 p-4 text-warning-content">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="m-0">
              Contract deployment is missing. Start the Base fork, run <code>yarn deploy</code>, then restart the
              frontend if it was already running.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={submitTip} className="rounded border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded bg-primary text-primary-content">
                <PaperAirplaneIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Send a tip</h2>
                <p className="text-sm text-base-content/60">Approve USDC, then send it to the jar.</p>
              </div>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1 font-medium">Amount</span>
              <div className="join w-full">
                <input
                  className="input join-item input-bordered w-full"
                  inputMode="decimal"
                  min="0"
                  onChange={event => setAmount(event.target.value)}
                  placeholder="5"
                  step="0.01"
                  type="number"
                  value={amount}
                />
                <span className="join-item flex items-center border border-base-300 bg-base-200 px-4 text-sm font-semibold">
                  USDC
                </span>
              </div>
            </label>

            <label className="form-control mt-4 w-full">
              <span className="label-text mb-1 font-medium">Name</span>
              <input
                className="input input-bordered w-full"
                maxLength={64}
                onChange={event => setName(event.target.value)}
                placeholder="Optional"
                value={name}
              />
            </label>

            <label className="form-control mt-4 w-full">
              <span className="label-text mb-1 font-medium">Message</span>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full"
                maxLength={280}
                onChange={event => setMessage(event.target.value)}
                placeholder="Say something kind"
                value={message}
              />
            </label>

            {isWrongNetwork && (
              <button
                className="btn btn-warning mt-5 w-full"
                onClick={() => switchChainAsync({ chainId: foundry.id })}
                type="button"
              >
                Switch to local fork
              </button>
            )}

            <button className="btn btn-primary mt-5 w-full" disabled={!canSubmit} type="submit">
              {isSubmitting ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
              {isSubmitting ? "Sending" : "Tip with USDC"}
            </button>

            {status && (
              <div className="mt-4 flex items-start gap-2 rounded border border-base-300 bg-base-200 p-3 text-sm">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="break-words">{status}</span>
              </div>
            )}
          </form>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm text-base-content/60">
                  <BanknotesIcon className="h-5 w-5" />
                  Total tipped
                </div>
                <p className="text-3xl font-bold">{formatUsdc(totalAmount as bigint | undefined)}</p>
              </div>
              <div className="rounded border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm text-base-content/60">
                  <CheckCircleIcon className="h-5 w-5" />
                  Feed entries
                </div>
                <p className="text-3xl font-bold">{(tipCount as bigint | undefined)?.toString() ?? "0"}</p>
              </div>
            </div>

            <section className="rounded border border-base-300 bg-base-100 shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-base-300 px-5 py-4">
                <h2 className="text-xl font-bold">Tip feed</h2>
                <button className="btn btn-ghost btn-sm" onClick={refetchJar} type="button">
                  <ArrowPathIcon className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              <div className="divide-y divide-base-300">
                {tips.length === 0 ? (
                  <div className="px-5 py-12 text-center text-base-content/60">No tips yet.</div>
                ) : (
                  tips.map((tip, index) => (
                    <article className="px-5 py-4" key={`${tip.tipper}-${tip.timestamp.toString()}-${index}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{tip.name || shortAddress(tip.tipper)}</p>
                          <p className="text-sm text-base-content/60">{shortAddress(tip.tipper)}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-success">{formatUsdc(tip.amount)}</p>
                          <p className="text-sm text-base-content/60">
                            {new Date(Number(tip.timestamp) * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {tip.message && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-base-content/80">{tip.message}</p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
