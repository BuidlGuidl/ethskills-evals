function normalizeAddress(address, fieldName) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`${fieldName} must be a 20-byte hex address`);
  }
  return address.toLowerCase();
}

function normalizeAmount(amount) {
  const value = BigInt(amount);
  if (value <= 0n) throw new Error("amount must be positive");
  return value;
}

function coalesceTransfers(transfers) {
  const groups = new Map();

  for (const transfer of transfers) {
    const token = normalizeAddress(transfer.token, "token");
    const to = normalizeAddress(transfer.to, "to");
    const amount = normalizeAmount(transfer.amount);
    const key = `${token}:${to}`;
    const current = groups.get(key);

    if (current) {
      current.amount += amount;
      current.sourceIds.push(transfer.id ?? null);
      current.count += 1;
    } else {
      groups.set(key, {
        token,
        to,
        amount,
        sourceIds: [transfer.id ?? null],
        count: 1,
      });
    }
  }

  return [...groups.values()];
}

function chunkTransfers(transfers, maxBatchSize) {
  if (!Number.isInteger(maxBatchSize) || maxBatchSize <= 0) {
    throw new Error("maxBatchSize must be a positive integer");
  }

  const batches = [];
  for (let index = 0; index < transfers.length; index += maxBatchSize) {
    batches.push(transfers.slice(index, index + maxBatchSize));
  }
  return batches;
}

function coalescingSavings(originalCount, coalescedCount, perTransferUsd) {
  if (coalescedCount > originalCount) {
    throw new Error("coalescedCount cannot exceed originalCount");
  }

  const skippedTransfers = originalCount - coalescedCount;
  return {
    skippedTransfers,
    savingsUsd: skippedTransfers * perTransferUsd,
    reductionFraction: originalCount === 0 ? 0 : skippedTransfers / originalCount,
  };
}

module.exports = {
  chunkTransfers,
  coalesceTransfers,
  coalescingSavings,
};
