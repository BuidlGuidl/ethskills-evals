import { describe, expect, it } from "vitest";
import {
  MAX_UINT96,
  InvalidTransferError,
  batchTotal,
  packBatch,
  packChunk,
  unpackBatch,
  type Transfer,
} from "../relayer/packer";

const GOLDEN_TO = "0x1111111111111111111111111111111111111111";
const GOLDEN_AMOUNT = 1234567890n;

describe("packChunk", () => {
  it("matches the Solidity golden vector", () => {
    expect(packChunk({ to: GOLDEN_TO, amount: GOLDEN_AMOUNT })).toBe(
      "11111111111111111111111111111111111111110000000000000000499602d2",
    );
  });

  it("pads amount to 12 bytes and lowercases the address", () => {
    expect(
      packChunk({
        to: "0xABCDEFabCDEFabCDEFabCDEFabCDEFabCDEFabcd".toLowerCase() as `0x${string}`,
        amount: 1n,
      }),
    ).toBe("abcdefabcdefabcdefabcdefabcdefabcdefabcd000000000000000000000001");
  });
});

describe("packBatch", () => {
  it("round-trips through unpackBatch", () => {
    const transfers: Transfer[] = [
      { to: "0x1111111111111111111111111111111111111111", amount: 1000000n },
      { to: "0x2222222222222222222222222222222222222222", amount: 424242n },
      { to: "0x3333333333333333333333333333333333333333", amount: MAX_UINT96 },
    ];
    const packed = packBatch(transfers);
    expect(packed).toHaveLength(2 + transfers.length * 64);
    expect(unpackBatch(packed)).toEqual(transfers);
  });

  it("rejects the empty batch", () => {
    expect(() => packBatch([])).toThrow("empty batch");
  });

  it("rejects zero amounts, zero addresses, and overflow", () => {
    expect(() => packBatch([{ to: GOLDEN_TO, amount: 0n }])).toThrow(InvalidTransferError);
    expect(() =>
      packBatch([{ to: "0x0000000000000000000000000000000000000000", amount: 1n }]),
    ).toThrow(InvalidTransferError);
    expect(() => packBatch([{ to: GOLDEN_TO, amount: MAX_UINT96 + 1n }])).toThrow(InvalidTransferError);
  });

  it("rejects malformed addresses at the right index", () => {
    const transfers: Transfer[] = [
      { to: GOLDEN_TO, amount: 1n },
      { to: "0x123" as `0x${string}`, amount: 1n },
    ];
    try {
      packBatch(transfers);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransferError);
      expect((err as InvalidTransferError).index).toBe(1);
    }
  });
});

describe("unpackBatch", () => {
  it("rejects non-32-byte-multiple lengths", () => {
    expect(() => unpackBatch("0x1234")).toThrow("multiple of 32");
    expect(() => unpackBatch(`0x${"ab".repeat(33)}`)).toThrow("multiple of 32");
  });
});

describe("batchTotal", () => {
  it("sums amounts", () => {
    const transfers: Transfer[] = [
      { to: GOLDEN_TO, amount: 1000000n },
      { to: "0x2222222222222222222222222222222222222222", amount: 42n },
    ];
    expect(batchTotal(transfers)).toBe(1000042n);
  });
});
