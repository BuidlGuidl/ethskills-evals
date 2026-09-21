// Anyone: read the result.   node scripts/tally.mjs --proposal 0
import { arg, clients, isMain, loadAbi, loadDeployment } from "./lib/common.mjs";

export async function tally(proposalId) {
  const d = loadDeployment();
  const { publicClient } = clients();
  const [yes, no, closed] = await publicClient.readContract({
    address: d.anonVoting, abi: loadAbi("AnonVoting"), functionName: "tally", args: [BigInt(proposalId)],
  });
  console.log(`proposal #${proposalId}: yes=${yes} no=${no} ${closed ? "(final)" : "(voting still open)"}`);
  return { yes, no, closed };
}

if (isMain(import.meta.url)) await tally(arg("proposal"));
