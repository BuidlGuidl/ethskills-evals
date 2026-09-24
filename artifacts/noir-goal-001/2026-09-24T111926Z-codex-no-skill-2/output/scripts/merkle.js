const { hash2 } = require("./fieldHash");

const DEPTH = 8;

function buildTree(leaves) {
  if (leaves.length > 2 ** DEPTH) {
    throw new Error(`too many leaves for depth ${DEPTH}`);
  }

  const levels = [];
  levels.push([...leaves.map(BigInt)]);
  while (levels[0].length < 2 ** DEPTH) {
    levels[0].push(0n);
  }

  for (let level = 0; level < DEPTH; level += 1) {
    const current = levels[level];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hash2(current[i], current[i + 1]));
    }
    levels.push(next);
  }

  return {
    root: levels[DEPTH][0],
    path(index) {
      const siblings = [];
      const indices = [];
      let cursor = index;
      for (let level = 0; level < DEPTH; level += 1) {
        const siblingIndex = cursor ^ 1;
        siblings.push(levels[level][siblingIndex]);
        indices.push(BigInt(cursor & 1));
        cursor >>= 1;
      }
      return { siblings, indices };
    },
  };
}

module.exports = {
  DEPTH,
  buildTree,
};

