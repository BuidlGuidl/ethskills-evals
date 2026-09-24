const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(address, name) {
  if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
    throw new TypeError(`${name} must be a 20-byte hex address`);
  }
  return address.toLowerCase();
}

function normalizeChainId(chainId) {
  if (chainId === undefined || chainId === null) return "base";
  return String(chainId);
}

export function coalesceTransfers(transfers) {
  if (!Array.isArray(transfers)) throw new TypeError("transfers must be an array");

  const grouped = new Map();

  transfers.forEach((transfer, index) => {
    const token = normalizeAddress(transfer.token, `transfers[${index}].token`);
    const recipient = normalizeAddress(transfer.recipient, `transfers[${index}].recipient`);
    const chainId = normalizeChainId(transfer.chainId);
    const amount = BigInt(transfer.amount);

    if (amount <= 0n) throw new RangeError(`transfers[${index}].amount must be positive`);

    const key = transfer.canCoalesce === false
      ? `single:${index}`
      : `${chainId}:${token}:${recipient}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.amount += amount;
      existing.sourceTransferIds.push(transfer.id ?? index);
      existing.sourceIndexes.push(index);
      if (transfer.latestSendAt && (!existing.latestSendAt || transfer.latestSendAt < existing.latestSendAt)) {
        existing.latestSendAt = transfer.latestSendAt;
      }
      return;
    }

    grouped.set(key, {
      chainId,
      token,
      recipient,
      amount,
      latestSendAt: transfer.latestSendAt,
      sourceTransferIds: [transfer.id ?? index],
      sourceIndexes: [index],
    });
  });

  return [...grouped.values()].map((transfer) => ({
    ...transfer,
    amount: transfer.amount.toString(),
  }));
}
