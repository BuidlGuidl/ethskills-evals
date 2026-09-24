"use client";

import { useAccount } from "wagmi";
import { TxButton } from "~~/components/toolshed/TxButton";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/toolshed/format";

/**
 * Only ever shows up if a payout couldn't be pushed at settlement time — USDC blocked the
 * address, or the token was paused. The money is held as a credit until it can be pulled.
 */
export const CreditBanner = () => {
  const { address } = useAccount();
  const { data: credit } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "credits",
    args: [address],
  });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });

  if (!credit) return null;

  return (
    <div className="alert alert-info flex-wrap">
      <span>
        {formatUsdc(credit)} couldn&apos;t be sent to you when a loan settled, so it&apos;s being held for you.
      </span>
      <TxButton onClick={async () => void (await writeContractAsync({ functionName: "withdrawCredit" }))}>
        Withdraw it
      </TxButton>
    </div>
  );
};
