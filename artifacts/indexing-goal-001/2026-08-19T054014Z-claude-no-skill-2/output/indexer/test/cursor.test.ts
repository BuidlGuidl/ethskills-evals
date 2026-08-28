import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeCursor, encodeCursor } from "../src/cursor.ts";

describe("feed cursors", () => {
  it("round-trips", () => {
    const encoded = encodeCursor(31_337_000n, 4);
    assert.equal(encoded, "31337000:4");
    assert.deepEqual(decodeCursor(encoded), { blockNumber: 31_337_000n, logIndex: 4 });
  });

  it("survives block numbers beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = 2n ** 64n - 1n;
    assert.deepEqual(decodeCursor(encodeCursor(huge, 0))?.blockNumber, huge);
  });

  it("rejects garbage instead of silently paging from block 0", () => {
    for (const bad of ["", "abc", "12", "12:", ":3", "12:3:4", "-1:0", "1.5:0", "0x12:0"]) {
      assert.equal(decodeCursor(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });
});
