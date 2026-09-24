const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const TREE_DEPTH = 8;

function mod(value) {
  const out = value % FIELD_MODULUS;
  return out >= 0n ? out : out + FIELD_MODULUS;
}

function pow5(x) {
  const x2 = mod(x * x);
  const x4 = mod(x2 * x2);
  return mod(x4 * x);
}

function hash2(left, right) {
  let state = mod(BigInt(left) + 3n);
  const key = mod(BigInt(right) + 3n);

  for (let i = 0n; i < 91n; i += 1n) {
    const c = mod(i * i + 7n);
    state = pow5(state + key + c);
  }

  return mod(state + key);
}

function leafFromSecret(secret) {
  return hash2(1n, BigInt(secret));
}

function nullifierFor(secret, proposalId) {
  return hash2(hash2(2n, BigInt(proposalId)), BigInt(secret));
}

function zeroValue() {
  return leafFromSecret(0n);
}

function zeroAt(level) {
  let value = zeroValue();
  for (let i = 0; i < level; i += 1) {
    value = hash2(value, value);
  }
  return value;
}

function buildTree(leaves, depth = TREE_DEPTH) {
  const width = 1 << depth;
  if (leaves.length > width) {
    throw new Error(`too many leaves for depth ${depth}`);
  }

  const levels = [];
  levels[0] = Array.from({ length: width }, (_, i) => (i < leaves.length ? BigInt(leaves[i]) : zeroValue()));

  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (let i = 0; i < levels[level].length; i += 2) {
      next.push(hash2(levels[level][i], levels[level][i + 1]));
    }
    levels[level + 1] = next;
  }

  return { root: levels[depth][0], levels };
}

function merklePath(levels, leafIndex, depth = TREE_DEPTH) {
  const path = [];
  const pathIndices = [];
  let index = leafIndex;

  for (let level = 0; level < depth; level += 1) {
    const isRight = index % 2;
    path.push(levels[level][isRight ? index - 1 : index + 1]);
    pathIndices.push(isRight);
    index = Math.floor(index / 2);
  }

  return { path, pathIndices };
}

function toHex32(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

module.exports = {
  FIELD_MODULUS,
  TREE_DEPTH,
  hash2,
  leafFromSecret,
  nullifierFor,
  zeroValue,
  zeroAt,
  buildTree,
  merklePath,
  toHex32,
};

