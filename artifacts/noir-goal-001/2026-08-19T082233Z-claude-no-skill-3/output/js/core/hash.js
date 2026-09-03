import { solidityPackedKeccak256 } from "ethers";

/** Every hash output is < 2^248, so it is always a valid bn254 field element. */
export const FIELD_SAFE_BOUND = 1n << 248n;

/**
 * The one hash of this system, identical in three places:
 *   Noir     circuits/vote/src/hash.nr :: hash_pair
 *   Solidity src/libraries/Hash.sol          :: Hash.pair
 *   here
 *
 *   hash_pair(a, b) = keccak256(be32(a) || be32(b)) >> 8
 */
export function hashPair(a, b) {
  return BigInt(solidityPackedKeccak256(["uint256", "uint256"], [BigInt(a), BigInt(b)])) >> 8n;
}
