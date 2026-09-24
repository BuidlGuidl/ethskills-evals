import { keccak256, stringToHex } from "viem";

export function hashListing(id: string, owner: string, name: string): `0x${string}` {
  return keccak256(stringToHex(`${id}:${owner.toLowerCase()}:${name}`));
}
