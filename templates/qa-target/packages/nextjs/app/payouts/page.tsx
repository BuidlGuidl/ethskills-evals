"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PAYOUTS = deployedContracts[8453].Payouts;
const USDC = deployedContracts[8453].USDC;

const shorten = (addr?: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

const PayoutsPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const { writeContractAsync, isPending } = useWriteContract();

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { data: payouts } = useScaffoldEventHistory({
    contractName: "Payouts",
    eventName: "Paid",
    fromBlock: 0n,
    watch: true,
  });

  const handleApprove = async () => {
    try {
      await writeContractAsync({
        address: USDC.address,
        abi: USDC.abi,
        functionName: "approve",
        args: [PAYOUTS.address, parseUnits(amount || "0", 6)],
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePay = async () => {
    try {
      await writeContractAsync({
        address: PAYOUTS.address,
        abi: PAYOUTS.abi,
        functionName: "pay",
        args: [recipient as `0x${string}`, parseUnits(amount || "0", 6), memo],
      });
      setAmount("");
      setMemo("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto pt-10 px-4 pb-16">
        <h1 className="text-3xl font-bold mb-1">USDC Payouts</h1>
        <p className="text-sm opacity-70 mb-6">Send a USDC payout to any teammate or contributor on Base.</p>

        {!isConnected ? (
          <p className="mt-4">Please connect your wallet to send a payout.</p>
        ) : (
          <>
            <p className="mb-4">
              Your balance: {usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : "0"} USDC
            </p>

            <input
              type="text"
              placeholder="0x... recipient address"
              className="input input-bordered w-full mb-3"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount (USDC)"
              className="input input-bordered w-full mb-3"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <textarea
              placeholder="What is this payout for? (optional)"
              className="textarea textarea-bordered w-full mb-4"
              value={memo}
              onChange={e => setMemo(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                className={`btn btn-primary ${isPending ? "loading" : ""}`}
                disabled={isPending}
                onClick={handleApprove}
              >
                Approve
              </button>
              <button
                className={`btn btn-secondary ${isPending ? "loading" : ""}`}
                disabled={isPending}
                onClick={handlePay}
              >
                Send Payout
              </button>
            </div>
          </>
        )}

        <h2 className="text-xl font-semibold mt-10 mb-3">Latest payouts</h2>
        <div className="flex flex-col gap-2">
          {(payouts ?? []).map((payout, i) => (
            <div key={i} className="border border-gray-700 rounded p-3">
              <span className="font-mono">{shorten(payout.args.from)}</span>
              {" paid "}
              <span className="font-mono">{shorten(payout.args.to)}</span>
              {" "}
              {payout.args.amount !== undefined ? formatUnits(payout.args.amount, 6) : "0"} USDC
              {payout.args.memo ? <span className="block opacity-70 mt-1">“{payout.args.memo}”</span> : null}
            </div>
          ))}
          {(payouts ?? []).length === 0 && <p className="opacity-60">No payouts yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default PayoutsPage;
