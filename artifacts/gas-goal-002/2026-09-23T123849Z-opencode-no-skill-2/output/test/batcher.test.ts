import { describe, expect, it } from "vitest";
import { BatchQueue, DEFAULT_BATCHER_CONFIG, GasPriceGate } from "../relayer/batcher";
import { packBatch, type Transfer } from "../relayer/packer";

function transfer(seed: number): Transfer {
  const hex = seed.toString(16).padStart(40, "0");
  return { to: `0x${hex}` as `0x${string}`, amount: BigInt(seed + 1) };
}

describe("BatchQueue", () => {
  it("flushes when the size threshold is reached", () => {
    const queue = new BatchQueue(
      { ...DEFAULT_BATCHER_CONFIG, maxBatchSize: 3, flushIntervalMs: 60_000 },
      () => 1000,
    );
    queue.add(transfer(1));
    queue.add(transfer(2));
    expect(queue.shouldFlush()).toBe(false);
    queue.add(transfer(3));
    expect(queue.shouldFlush()).toBe(true);
    const batch = queue.drain();
    expect(batch!.transfers).toHaveLength(3);
    expect(batch!.packed).toBe(packBatch([transfer(1), transfer(2), transfer(3)]));
    expect(queue.size).toBe(0);
    expect(queue.shouldFlush()).toBe(false);
  });

  it("flushes when the oldest transfer ages past the interval", () => {
    let now = 10_000;
    const queue = new BatchQueue(
      { ...DEFAULT_BATCHER_CONFIG, maxBatchSize: 100, flushIntervalMs: 30_000 },
      () => now,
    );
    queue.add(transfer(1));
    now += 5_000;
    queue.add(transfer(2));
    expect(queue.ageMs).toBe(5_000);
    expect(queue.shouldFlush()).toBe(false);
    now += 26_000;
    expect(queue.ageMs).toBe(31_000);
    expect(queue.shouldFlush()).toBe(true);
  });

  it("does not flush an empty queue regardless of age", () => {
    let now = 0;
    const queue = new BatchQueue(
      { ...DEFAULT_BATCHER_CONFIG, flushIntervalMs: 100 },
      () => now,
    );
    now += 1_000;
    expect(queue.shouldFlush()).toBe(false);
    expect(queue.drain()).toBeNull();
  });

  it("tracks queuedAt and drainedAt for observability", () => {
    let now = 5_000;
    const queue = new BatchQueue(
      { ...DEFAULT_BATCHER_CONFIG, maxBatchSize: 10, flushIntervalMs: 10 },
      () => now,
    );
    queue.add(transfer(1));
    now += 10;
    const batch = queue.drain()!;
    expect(batch.queuedAt).toBe(5_000);
    expect(batch.drainedAt).toBe(5_010);
  });

  it("refuses to exceed max batch size", () => {
    const queue = new BatchQueue(
      { ...DEFAULT_BATCHER_CONFIG, maxBatchSize: 1, flushIntervalMs: 60_000 },
      () => 0,
    );
    queue.add(transfer(1));
    expect(() => queue.add(transfer(2))).toThrow("queue full; flush first");
  });
});

describe("GasPriceGate", () => {
  it("opens at or below the cap and closes above it", async () => {
    const closed = new GasPriceGate(async () => 0.3, 0.25);
    const open = new GasPriceGate(async () => 0.25, 0.25);
    expect(await closed.isOpen()).toBe(false);
    expect(await open.isOpen()).toBe(true);
  });
});
