import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { Barretenberg, BarretenbergSync, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";

export const MERKLE_DEPTH = 8;
export const TREE_SIZE = 1 << MERKLE_DEPTH;
export const FIELD_MODULUS =
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
export const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];

export function artifact(name) {
  const outDir = path.join(rootDir, "out");
  const candidates = fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(outDir, entry.name, `${name}.json`))
    .filter((candidate) => fs.existsSync(candidate));
  if (candidates.length === 0) throw new Error(`Missing Foundry artifact for ${name}`);
  const artifactPath = candidates[0];
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

export function circuitArtifact() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "target", "private_vote.json"), "utf8"));
}

export function toField(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "boolean") return value ? 1n : 0n;
  if (typeof value === "string") {
    if (value.startsWith("0x")) return BigInt(value);
    return BigInt(value);
  }
  throw new Error(`Cannot convert ${value} to a field`);
}

export function toFieldHex(value) {
  const n = toField(value);
  if (n < 0n || n >= FIELD_MODULUS) throw new Error(`Field value out of range: ${value}`);
  return `0x${n.toString(16).padStart(64, "0")}`;
}

export function fieldBuffer(value) {
  return Uint8Array.from(Buffer.from(toFieldHex(value).slice(2), "hex"));
}

export function bytesToHex(bytes) {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function bytesToFieldHex(bytes) {
  return toFieldHex(BigInt(bytesToHex(bytes)));
}

export function randomField() {
  return BigInt(`0x${randomBytes(32).toString("hex")}`) % FIELD_MODULUS;
}

export function addressToField(address) {
  return BigInt(ethers.getAddress(address));
}

export function getWallets(rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return {
    provider,
    owner: new ethers.Wallet(process.env.OWNER_KEY || ANVIL_KEYS[0], provider),
    member: new ethers.Wallet(process.env.MEMBER_KEY || ANVIL_KEYS[1], provider),
    relayer: new ethers.Wallet(process.env.RELAYER_KEY || ANVIL_KEYS[2], provider),
  };
}

export async function deployCore(owner) {
  let nonce = await owner.getNonce("pending");
  const Membership = artifact("MembershipNFT");
  const RelationsLib = artifact("RelationsLib");
  const ZKTranscriptLib = artifact("ZKTranscriptLib");
  const Verifier = artifact("HonkVerifier");
  const Governor = artifact("PrivateGovernor");

  const membership = await new ethers.ContractFactory(Membership.abi, Membership.bytecode.object, owner).deploy({
    nonce: nonce++,
  });
  await membership.waitForDeployment();

  const relationsLib = await new ethers.ContractFactory(RelationsLib.abi, RelationsLib.bytecode.object, owner).deploy({
    nonce: nonce++,
  });
  await relationsLib.waitForDeployment();

  const zkTranscriptLib = await new ethers.ContractFactory(
    ZKTranscriptLib.abi,
    ZKTranscriptLib.bytecode.object,
    owner,
  ).deploy({ nonce: nonce++ });
  await zkTranscriptLib.waitForDeployment();

  const verifierBytecode = linkBytecode(Verifier.bytecode, {
    RelationsLib: await relationsLib.getAddress(),
    ZKTranscriptLib: await zkTranscriptLib.getAddress(),
  });
  const verifier = await new ethers.ContractFactory(Verifier.abi, verifierBytecode, owner).deploy({ nonce: nonce++ });
  await verifier.waitForDeployment();

  const governor = await new ethers.ContractFactory(Governor.abi, Governor.bytecode.object, owner).deploy(
    await membership.getAddress(),
    await verifier.getAddress(),
    { nonce: nonce++ },
  );
  await governor.waitForDeployment();

  return { membership, verifier, governor };
}

function linkBytecode(bytecode, libraries) {
  let linked = bytecode.object;
  for (const fileReferences of Object.values(bytecode.linkReferences ?? {})) {
    for (const [libraryName, references] of Object.entries(fileReferences)) {
      const address = libraries[libraryName];
      if (!address) throw new Error(`Missing address for library ${libraryName}`);
      for (const { start, length } of references) {
        linked =
          linked.slice(0, 2 + start * 2) +
          address.slice(2).toLowerCase().padStart(length * 2, "0") +
          linked.slice(2 + (start + length) * 2);
      }
    }
  }
  return linked;
}

export function contractAt(name, address, signer) {
  const { abi } = artifact(name);
  return new ethers.Contract(address, abi, signer);
}

export function makeHasher() {
  let api;

  function permute(fields) {
    const result = api.poseidon2Permutation({ inputs: fields.map(fieldBuffer) });
    return result.outputs.map(bytesToFieldHex);
  }

  return {
    async init() {
      api = await BarretenbergSync.initSingleton();
      return this;
    },
    hash1(value) {
      return permute([value, 0n, 0n, 101n])[0];
    },
    hash2(left, right) {
      return permute([left, right, 0n, 102n])[0];
    },
    hash4(a, b, c, d) {
      const first = permute([a, b, c, 104n]);
      return permute([first[0], first[1], first[2], d])[0];
    },
    destroy() {
      BarretenbergSync.destroySingleton();
    },
  };
}

export function buildMerkleTree(leaves, hasher) {
  if (leaves.length > TREE_SIZE) throw new Error(`At most ${TREE_SIZE} leaves supported`);

  const layers = [Array(TREE_SIZE).fill(toFieldHex(0n))];
  leaves.forEach((leaf, i) => {
    layers[0][i] = toFieldHex(leaf);
  });

  for (let level = 0; level < MERKLE_DEPTH; level++) {
    const current = layers[level];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hasher.hash2(current[i], current[i + 1]));
    }
    layers.push(next);
  }

  return { root: layers[MERKLE_DEPTH][0], layers };
}

export function merkleProof(layers, leafIndex) {
  const merklePath = [];
  const pathIndices = [];
  let index = leafIndex;

  for (let level = 0; level < MERKLE_DEPTH; level++) {
    const isRight = index % 2 === 1;
    merklePath.push(layers[level][isRight ? index - 1 : index + 1]);
    pathIndices.push(isRight);
    index = Math.floor(index / 2);
  }

  return { merklePath, pathIndices };
}

export async function proveVote(inputs) {
  const circuit = circuitArtifact();
  const noir = new Noir(circuit);
  const { witness } = await noir.execute(inputs);

  const api = await Barretenberg.new({ threads: 1 });
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    return await backend.generateProof(witness, { verifierTarget: "evm" });
  } finally {
    await api.destroy();
  }
}
