// Verify balances after a send: node relayer/verify.mjs payments.demo.json
import { readFileSync } from "node:fs";
import { createPublicClient, http, parseAbi, parseUnits } from "viem";

const client = createPublicClient({ transport: http(process.env.RPC_URL ?? "http://127.0.0.1:8545") });
const abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const payments = JSON.parse(readFileSync(process.argv[2], "utf8"));

let ok = 0;
for (const p of payments) {
  const bal = await client.readContract({
    address: process.env.TOKEN_ADDRESS, abi, functionName: "balanceOf", args: [p.to],
  });
  if (bal === parseUnits(p.amount, 6)) ok++;
  else console.log("MISMATCH", p.to, bal.toString(), p.amount);
}
console.log(`verified ${ok}/${payments.length} balances`);
