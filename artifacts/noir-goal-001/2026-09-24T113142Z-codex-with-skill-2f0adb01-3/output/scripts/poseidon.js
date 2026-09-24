import { buildPoseidon } from "circomlibjs";

let poseidonPromise;

export async function getPoseidon() {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon();
  }
  return poseidonPromise;
}

export async function poseidon2(left, right) {
  const poseidon = await getPoseidon();
  return BigInt(poseidon.F.toString(poseidon([BigInt(left), BigInt(right)])));
}

export function toFieldHex(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

