import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  getContract,
  http,
  parseUnits,
  stringToHex,
  zeroAddress
} from "viem";
import { base } from "viem/chains";
import { erc20Abi, toolshedEscrowAbi } from "./abi";
import type { Address, ToolListing } from "../domain/types";

const contractAddress = import.meta.env.VITE_TOOLSHED_CONTRACT as Address | undefined;
const usdcAddress =
  (import.meta.env.VITE_USDC_ADDRESS as Address | undefined) ??
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export async function connectWallet(): Promise<Address> {
  const provider = window.ethereum;
  if (!provider) throw new Error("No injected wallet found.");

  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
  return account;
}

export async function requestLoanOnchain(params: {
  borrower: Address;
  listing: ToolListing;
  dueDate: string;
}): Promise<`0x${string}`> {
  const provider = window.ethereum;
  if (!provider) throw new Error("No injected wallet found.");
  if (!contractAddress || contractAddress === zeroAddress) {
    throw new Error("Set VITE_TOOLSHED_CONTRACT before submitting onchain requests.");
  }

  const walletClient = createWalletClient({
    account: params.borrower,
    chain: base,
    transport: custom(provider)
  });
  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  });

  const depositAmount = parseUnits(params.listing.depositUsdc.toString(), 6);
  const dailyLateFee = parseUnits(params.listing.dailyLateFeeUsdc.toString(), 6);

  const usdc = getContract({
    address: usdcAddress,
    abi: erc20Abi,
    client: walletClient
  });

  const approvalHash = await usdc.write.approve([contractAddress, depositAmount]);
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });

  const dueAt = BigInt(Math.floor(new Date(params.dueDate).getTime() / 1000));
  const toolId = stringToHex(params.listing.id, { size: 32 });
  const data = encodeFunctionData({
    abi: toolshedEscrowAbi,
    functionName: "requestLoan",
    args: [
      toolId,
      params.listing.listingHash,
      params.listing.owner,
      dueAt,
      depositAmount,
      dailyLateFee
    ]
  });

  return walletClient.sendTransaction({
    account: params.borrower,
    to: contractAddress,
    data
  });
}

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
    };
  }
}
