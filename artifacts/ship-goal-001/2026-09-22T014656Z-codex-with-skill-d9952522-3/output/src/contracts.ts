import { encodeAbiParameters, keccak256, parseAbiParameters, parseUnits, stringToHex } from "viem";
import type { Tool } from "./data";

export const toolshedEscrowAbi = [
  {
    type: "function",
    name: "createRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toolId", type: "bytes32" },
      { name: "toolOwner", type: "address" },
      { name: "startAt", type: "uint64" },
      { name: "dueAt", type: "uint64" },
      { name: "deposit", type: "uint256" },
      { name: "dailyLateFee", type: "uint256" },
      { name: "listingURI", type: "string" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
] as const;

export const usdcAbi = [
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
] as const;

export const escrowAddress = import.meta.env.VITE_TOOLSHED_ESCROW_ADDRESS as `0x${string}` | undefined;
export const usdcAddress = import.meta.env.VITE_USDC_ADDRESS as `0x${string}` | undefined;
export const configuredChainId = Number(import.meta.env.VITE_CHAIN_ID ?? "84532");

export function toolHash(tool: Tool) {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("string id, string name, address owner"), [
      tool.id,
      tool.name,
      tool.owner,
    ]),
  );
}

export function listingUri(tool: Tool) {
  const encoded = stringToHex(JSON.stringify(tool));
  return `data:application/json+hex,${encoded}`;
}

export function usdcAmount(amount: number) {
  return parseUnits(amount.toString(), 6);
}
