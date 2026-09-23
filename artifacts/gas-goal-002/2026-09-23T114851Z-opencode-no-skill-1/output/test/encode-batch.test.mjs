import test from "node:test";
import assert from "node:assert/strict";
import {
  encodePackedBatch,
  decodePackedBatch,
  distributePackedCall,
  distributePackedSelector,
} from "../src/encode-batch.mjs";

test("encode/decode roundtrip", () => {
  const transfers = [
    { recipient: "0x1111111111111111111111111111111111111111", amount: 1500000n },
    { recipient: "0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd", amount: 2n ** 64n - 1n },
    { recipient: "0x2222222222222222222222222222222222222222", amount: 0n },
  ];
  const { blob, count, total } = encodePackedBatch(transfers);
  assert.equal(blob.length, 2 + 28 * 3 * 2);
  assert.equal(count, 3);
  assert.equal(total, (1500000n + 2n ** 64n - 1n).toString());
  const back = decodePackedBatch(blob);
  assert.equal(back.length, 3);
  assert.equal(back[0].recipient, "0x1111111111111111111111111111111111111111");
  assert.equal(back[0].amount, 1500000n);
  assert.equal(back[1].recipient, "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  assert.equal(back[1].amount, 2n ** 64n - 1n);
  assert.equal(back[2].amount, 0n);
});

test("uint64 amount range enforced", () => {
  assert.throws(() =>
    encodePackedBatch([{ recipient: "0x1111111111111111111111111111111111111111", amount: 2n ** 64n }])
  );
  assert.throws(() =>
    encodePackedBatch([{ recipient: "0x1111111111111111111111111111111111111111", amount: -1n }])
  );
});

test("invalid recipient rejected", () => {
  assert.throws(() => encodePackedBatch([{ recipient: "0x123", amount: 1n }]));
  assert.throws(() => encodePackedBatch([{ recipient: "not-an-address", amount: 1n }]));
  assert.throws(() => encodePackedBatch([{ amount: 1n }]));
});

test("known byte vector", () => {
  const { blob } = encodePackedBatch([
    { recipient: "0x" + "0".repeat(36) + "dEaD", amount: 1n },
  ]);
  assert.equal(blob, "0x" + "0".repeat(36) + "dead" + "0000000000000001");
});

test("distributePackedCall ABI layout", () => {
  const token = "0x833589fCE7ebf8E197d5f76c16a30B249F8eD0d9";
  const call = distributePackedCall(token, [
    { recipient: "0x1111111111111111111111111111111111111111", amount: 1n },
  ]);
  assert.ok(call.data.startsWith("0x" + distributePackedSelector()));
  const body = call.data.slice(2 + 8);
  assert.equal(body.slice(0, 64), token.slice(2).toLowerCase().padStart(64, "0"));
  assert.equal(body.slice(64, 128), BigInt(0x60).toString(16).padStart(64, "0"));
  assert.equal(body.slice(128, 192), BigInt(28).toString(16).padStart(64, "0"));
  assert.equal(body.slice(192), "11111111111111111111111111111111111111110000000000000001");
});

test("decode rejects bad length", () => {
  assert.throws(() => decodePackedBatch("0x1234"));
});
