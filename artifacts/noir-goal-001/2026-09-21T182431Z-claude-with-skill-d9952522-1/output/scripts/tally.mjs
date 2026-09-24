// Anyone, after the deadline: read the result. No wallet needed.
//
//   node scripts/tally.mjs --proposal 0
import { ethers } from "ethers";
import { RPC_URL, VOTING_ABI, arg, loadDeployment } from "./lib.mjs";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const dep = await loadDeployment(provider);
const voting = new ethers.Contract(dep.voting, VOTING_ABI, provider);
const { yes, no, passed } = await voting.result(BigInt(arg("proposal")));
console.log(`yes ${yes} / no ${no} -> ${passed ? "PASSED" : "FAILED"}`);
