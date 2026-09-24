"use client";

import { SyntheticEvent, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import type { NextPage } from "next";
import { Address, formatUnits, parseAbi, parseAbiItem, parseUnits } from "viem";
import {
  useAccount,
  useBlockNumber,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const USDC_DECIMALS = 6;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const tipJarAbi = parseAbi([
  "function tip(string name, string message, uint256 amount)",
  "function totalTips() view returns (uint256)",
]);

const tipSentEvent = parseAbiItem(
  "event TipSent(uint256 indexed tipId, address indexed from, string name, string message, uint256 amount, uint256 timestamp)",
);

type TipEvent = {
  id: bigint;
  from: Address;
  name: string;
  message: string;
  amount: bigint;
  timestamp: bigint;
  transactionHash: string;
};

const getTipJarDeployment = (chainId: number) => {
  const deployments = deployedContracts as Record<
    number,
    {
      TipJar?: {
        address: Address;
        deployedOnBlock?: number;
      };
    }
  >;

  return deployments[chainId]?.TipJar;
};

const formatUsdc = (amount?: bigint) => `${Number(formatUnits(amount || 0n, USDC_DECIMALS)).toLocaleString()} USDC`;

const Home: NextPage = () => {
  const { targetNetwork } = useTargetNetwork();
  const expectedChainId = targetNetwork.id;
  const deployment = getTipJarDeployment(expectedChainId);
  const tipJarAddress = deployment?.address;
  const deployedOnBlock = deployment?.deployedOnBlock ? BigInt(deployment.deployedOnBlock) : 0n;

  const { address, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: expectedChainId });
  const { writeContractAsync, isPending } = useWriteContract();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("5");
  const [status, setStatus] = useState("");

  const { data: latestBlock } = useBlockNumber({ chainId: expectedChainId, watch: true });

  const parsedAmount = useMemo(() => {
    try {
      return amount && Number(amount) > 0 ? parseUnits(amount, USDC_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: balance = 0n, refetch: refetchBalance } = useReadContract({
    address: BASE_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address || "0x0000000000000000000000000000000000000000"],
    chainId: expectedChainId,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: BASE_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address || "0x0000000000000000000000000000000000000000", tipJarAddress || BASE_USDC_ADDRESS],
    chainId: expectedChainId,
    query: { enabled: Boolean(address && tipJarAddress) },
  });

  const { data: totalTips = 0n, refetch: refetchTotalTips } = useReadContract({
    address: tipJarAddress,
    abi: tipJarAbi,
    functionName: "totalTips",
    chainId: expectedChainId,
    query: { enabled: Boolean(tipJarAddress) },
  });

  const tipEventsQuery = useQuery({
    queryKey: ["tip-events", tipJarAddress, latestBlock?.toString()],
    enabled: Boolean(tipJarAddress && publicClient),
    queryFn: async () => {
      const logs = await publicClient!.getLogs({
        address: tipJarAddress,
        event: tipSentEvent,
        fromBlock: deployedOnBlock,
        toBlock: "latest",
      });

      return logs
        .map(log => ({
          id: log.args.tipId || 0n,
          from: log.args.from || "0x0000000000000000000000000000000000000000",
          name: log.args.name || "Anonymous",
          message: log.args.message || "",
          amount: log.args.amount || 0n,
          timestamp: log.args.timestamp || 0n,
          transactionHash: log.transactionHash,
        }))
        .sort((a, b) => Number(b.id - a.id)) satisfies TipEvent[];
    },
  });

  const needsApproval = parsedAmount > 0n && allowance < parsedAmount;
  const hasWrongNetwork = isConnected && connectedChainId !== expectedChainId;
  const canSubmit =
    Boolean(tipJarAddress && isConnected && !hasWrongNetwork && name.trim() && message.trim()) &&
    parsedAmount > 0n &&
    !isPending;

  const submitTip = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address || !tipJarAddress || !publicClient || !canSubmit) return;

    try {
      setStatus(needsApproval ? "Approving USDC..." : "Sending tip...");

      if (needsApproval) {
        const approveHash = await writeContractAsync({
          address: BASE_USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [tipJarAddress, parsedAmount],
          chainId: expectedChainId,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      setStatus("Sending tip...");
      const tipHash = await writeContractAsync({
        address: tipJarAddress,
        abi: tipJarAbi,
        functionName: "tip",
        args: [name.trim(), message.trim(), parsedAmount],
        chainId: expectedChainId,
      });
      await publicClient.waitForTransactionReceipt({ hash: tipHash });

      setStatus("Tip sent.");
      setMessage("");
      setAmount("5");
      await Promise.all([refetchAllowance(), refetchBalance(), refetchTotalTips(), tipEventsQuery.refetch()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed.");
    }
  };

  return (
    <div className="min-h-full bg-base-200">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 border-b border-base-300 pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">Base USDC</p>
            <h1 className="text-4xl font-bold text-base-content sm:text-5xl">USDC Tip Jar</h1>
            <p className="mt-3 max-w-2xl text-base text-base-content/70">
              Tips settle through Base USDC at {BASE_USDC_ADDRESS.slice(0, 6)}...{BASE_USDC_ADDRESS.slice(-4)} on the
              local fork.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <ConnectButton />
            {hasWrongNetwork && (
              <button className="btn btn-sm btn-primary" onClick={() => switchChainAsync({ chainId: expectedChainId })}>
                Switch to {targetNetwork.name}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="border border-base-300 bg-base-100 p-5">
            <p className="text-sm text-base-content/60">Connected balance</p>
            <p className="mt-2 text-2xl font-semibold">{formatUsdc(balance)}</p>
          </div>
          <div className="border border-base-300 bg-base-100 p-5">
            <p className="text-sm text-base-content/60">Total tipped</p>
            <p className="mt-2 text-2xl font-semibold">{formatUsdc(totalTips)}</p>
          </div>
          <div className="border border-base-300 bg-base-100 p-5">
            <p className="text-sm text-base-content/60">Tip jar contract</p>
            <p className="mt-2 break-all font-mono text-sm">{tipJarAddress || "Not deployed locally"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <form className="border border-base-300 bg-base-100 p-5" onSubmit={submitTip}>
            <div className="flex items-center justify-between gap-4 border-b border-base-300 pb-4">
              <h2 className="text-xl font-semibold">Send a Tip</h2>
              <span className="text-sm text-base-content/60">{needsApproval ? "Approval required" : "Ready"}</span>
            </div>

            <label className="form-control mt-5">
              <span className="label-text">Name</span>
              <input
                className="input input-bordered mt-2"
                maxLength={40}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>

            <label className="form-control mt-4">
              <span className="label-text">Amount</span>
              <div className="join mt-2 w-full">
                <input
                  className="input join-item input-bordered w-full"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <span className="join-item flex items-center border border-base-300 bg-base-200 px-4 text-sm font-semibold">
                  USDC
                </span>
              </div>
            </label>

            <label className="form-control mt-4">
              <span className="label-text">Message</span>
              <textarea
                className="textarea textarea-bordered mt-2 min-h-32 resize-none"
                maxLength={280}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </label>

            <button className="btn btn-primary mt-5 w-full" disabled={!canSubmit}>
              {needsApproval ? "Approve and Send" : "Send Tip"}
            </button>
            {status && <p className="mt-3 text-sm text-base-content/70">{status}</p>}
          </form>

          <section className="border border-base-300 bg-base-100 p-5">
            <div className="flex items-center justify-between gap-4 border-b border-base-300 pb-4">
              <h2 className="text-xl font-semibold">Tip Feed</h2>
              <span className="text-sm text-base-content/60">{tipEventsQuery.data?.length || 0} tips</span>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {!tipJarAddress && (
                <div className="border border-dashed border-base-300 p-5 text-sm text-base-content/60">
                  Deploy the local TipJar contract to enable the feed.
                </div>
              )}
              {tipJarAddress && tipEventsQuery.isLoading && (
                <div className="border border-base-300 p-5 text-sm text-base-content/60">Loading tips...</div>
              )}
              {tipJarAddress && !tipEventsQuery.isLoading && tipEventsQuery.data?.length === 0 && (
                <div className="border border-dashed border-base-300 p-5 text-sm text-base-content/60">
                  No tips have landed yet.
                </div>
              )}
              {tipEventsQuery.data?.map(tip => (
                <article key={`${tip.transactionHash}-${tip.id.toString()}`} className="border border-base-300 p-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-semibold">{tip.name}</p>
                      <p className="mt-1 text-sm text-base-content/60">
                        {new Date(Number(tip.timestamp) * 1000).toLocaleString()}
                      </p>
                    </div>
                    <p className="font-mono text-lg font-semibold">{formatUsdc(tip.amount)}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-base-content/80">{tip.message}</p>
                  <p className="mt-3 break-all font-mono text-xs text-base-content/50">{tip.from}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default Home;
