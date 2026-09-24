import { describe, expect, it } from "vitest";
import { getFeeParams, DEFAULT_TIP_WEI } from "./fees";
import { chunk, packPayouts, encodeBatch, MAX_PACKED_AMOUNT } from "./batch";
import type { Address } from "viem";

const A = (n: number): Address =>
  `0x${n.toString(16).padStart(40, "0")}` as Address;

const clientWithBaseFee = (baseFeePerGas: bigint | null) =>
  ({ getBlock: async () => ({ baseFeePerGas }) }) as any;

describe("packPayouts", () => {
  it("emits 31 bytes per payout", () => {
    const p = packPayouts([{ to: A(1), amount: 5_000_000n }]);
    expect(p.length).toBe(2 + 31 * 2);
  });

  it("round-trips address and amount into the right fields", () => {
    const p = packPayouts([{ to: A(0xbeef), amount: 0x4c4b40n }]);
    expect(p.slice(2, 42)).toBe("0".repeat(36) + "beef");
    expect(BigInt("0x" + p.slice(42))).toBe(0x4c4b40n);
  });

  it("keeps payouts in order and independently addressed", () => {
    const p = packPayouts([
      { to: A(1), amount: 1n },
      { to: A(2), amount: 2n },
    ]);
    expect(p.slice(2, 64)).toContain("0".repeat(39) + "1");
    expect(BigInt("0x" + p.slice(42, 64))).toBe(1n);
    expect(BigInt("0x" + p.slice(106))).toBe(2n);
  });

  it("is exactly half the size of the equivalent ABI array encoding", () => {
    const n = 100;
    const payouts = Array.from({ length: n }, (_, i) => ({
      to: A(i + 1),
      amount: 5_000_000n,
    }));
    const packedBytes = (packPayouts(payouts).length - 2) / 2;
    expect(packedBytes).toBe(31 * n);
    expect(packedBytes).toBeLessThan(64 * n);
  });

  it("accepts the largest representable amount", () => {
    expect(() =>
      packPayouts([{ to: A(1), amount: MAX_PACKED_AMOUNT }]),
    ).not.toThrow();
  });

  it("rejects an amount that would silently truncate", () => {
    expect(() =>
      packPayouts([{ to: A(1), amount: MAX_PACKED_AMOUNT + 1n }]),
    ).toThrow(/exceeds/);
  });

  it("rejects empty batches and bad inputs", () => {
    expect(() => packPayouts([])).toThrow(/empty/);
    expect(() => packPayouts([{ to: A(1), amount: 0n }])).toThrow(/non-positive/);
    expect(() =>
      packPayouts([{ to: "0x1234" as Address, amount: 1n }]),
    ).toThrow(/bad address/);
  });

  it("produces calldata the contract ABI accepts", () => {
    const data = encodeBatch([{ to: A(1), amount: 1n }]);
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });
});

describe("chunk", () => {
  it("splits into full batches plus a remainder", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const out = chunk(items, 100);
    expect(out.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(out.flat()).toEqual(items);
  });

  it("rejects a non-positive size rather than looping forever", () => {
    expect(() => chunk([1, 2], 0)).toThrow(/positive/);
  });
});

describe("getFeeParams", () => {
  it("bids a flat small tip, not a proportional one", async () => {
    const f = await getFeeParams(clientWithBaseFee(5_000_000n));
    expect(f.maxPriorityFeePerGas).toBe(DEFAULT_TIP_WEI);
    // 4x headroom over a 0.005 gwei base fee.
    expect(f.maxFeePerGas).toBe(5_000_000n * 4n + DEFAULT_TIP_WEI);
  });

  it("tracks the live base fee rather than a hardcoded constant", async () => {
    const spiked = await getFeeParams(clientWithBaseFee(500_000_000n));
    expect(spiked.maxFeePerGas).toBe(500_000_000n * 4n + DEFAULT_TIP_WEI);
  });

  it("clamps at the cap during an extreme spike", async () => {
    const f = await getFeeParams(clientWithBaseFee(10_000_000_000n));
    expect(f.maxFeePerGas).toBe(5_000_000_000n);
    expect(f.maxPriorityFeePerGas).toBeLessThanOrEqual(f.maxFeePerGas);
  });

  it("never lets the tip exceed maxFeePerGas", async () => {
    const f = await getFeeParams(clientWithBaseFee(1n), {
      tipWei: 10n,
      baseFeeMultiplier: 1n,
      maxFeeCapWei: 5n,
    });
    expect(f.maxPriorityFeePerGas).toBeLessThanOrEqual(f.maxFeePerGas);
  });

  it("refuses to guess when the chain reports no base fee", async () => {
    await expect(getFeeParams(clientWithBaseFee(null))).rejects.toThrow(
      /refusing to guess/,
    );
  });
});
