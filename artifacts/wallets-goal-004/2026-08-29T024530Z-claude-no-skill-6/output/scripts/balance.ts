/** Prints the deployer's Sepolia balance: npm run balance */
import { formatEther } from "viem";
import { deployerAccount, explorerAddress, publicClient } from "../lib/config.js";

const account = deployerAccount();
const balance = await publicClient().getBalance({ address: account.address });

console.log(`${account.address}  ${formatEther(balance)} ETH`);
console.log(explorerAddress(account.address));
