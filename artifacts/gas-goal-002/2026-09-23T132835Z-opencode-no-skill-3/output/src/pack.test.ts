import assert from "node:assert/strict";
import { packItem, unpackItem, encodeSend, groupByToken, chunk, validatePayout, UINT96_MAX } from "./pack.ts";

const to = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const amount = 25_000_000n;

const item = packItem(to, amount);
assert.equal(item.length, 66);
assert.equal(
  item.toLowerCase(),
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000017d7840",
);
const round = unpackItem(item);
assert.equal(round.to.toLowerCase(), to.toLowerCase());
assert.equal(round.amount, amount);

assert.throws(() => validatePayout({ token: to, to: "0x123", amount: 1n }));
assert.throws(() => validatePayout({ token: to, to, amount: 0n }));
assert.throws(() => validatePayout({ token: to, to, amount: UINT96_MAX + 1n }));
assert.equal(packItem(to, UINT96_MAX).length, 66);

const data = encodeSend("send", to, [item]);
assert.equal(
  data,
  "0x40492e4c" +
    "833589fcd6edb6e08f4c7c32d4f71b54bda02913".padStart(64, "0") +
    "40".padStart(64, "0") +
    "01".padStart(64, "0") +
    item.slice(2),
);

const groups = groupByToken([
  { token: to, to, amount: 1n },
  { token: to, to, amount: 2n },
]);
assert.equal(groups.size, 1);
assert.equal(groups.get(to)!.length, 2);

assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

console.log("pack: all assertions passed");
console.log("sample item:", item);
console.log("sample send() calldata:", data);
