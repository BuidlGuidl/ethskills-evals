// Anyone: read the tally.   PROPOSAL_ID=0 node scripts/tally.mjs
import { ethers } from "ethers";
import { RPC_URL, contracts, loadDeployment } from "./shared/common.mjs";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const { voting } = contracts(await loadDeployment(provider), provider);
const [yes, no, final_] = await voting.tally(BigInt(process.env.PROPOSAL_ID ?? 0));
console.log(`yes=${yes} no=${no} ${final_ ? "(final)" : "(voting still open — not final)"}`);
