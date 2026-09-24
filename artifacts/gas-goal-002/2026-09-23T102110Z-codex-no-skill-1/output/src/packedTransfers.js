const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const UINT96_MAX = (1n << 96n) - 1n;

export function normalizePayment(payment) {
  if (!ADDRESS_RE.test(payment.to)) {
    throw new Error(`Invalid recipient address: ${payment.to}`);
  }

  const amount = BigInt(payment.amount);
  if (amount <= 0n) {
    throw new Error(`Invalid amount for ${payment.to}: ${payment.amount}`);
  }
  if (amount > UINT96_MAX) {
    throw new Error(`Amount exceeds uint96 for ${payment.to}: ${payment.amount}`);
  }

  return {
    to: payment.to.toLowerCase(),
    amount
  };
}

export function encodePackedTransfers(payments) {
  const encoded = payments
    .map(normalizePayment)
    .map(({ to, amount }) => {
      const addressBytes = to.slice(2);
      const amountBytes = amount.toString(16).padStart(24, '0');
      return `${addressBytes}${amountBytes}`;
    })
    .join('');

  return `0x${encoded}`;
}

export function packedTransferCount(packed) {
  if (!/^0x[0-9a-fA-F]*$/.test(packed)) {
    throw new Error('Packed transfer payload must be hex');
  }
  const byteLength = (packed.length - 2) / 2;
  if (byteLength % 32 !== 0) {
    throw new Error('Packed transfer payload length must be a multiple of 32 bytes');
  }

  return byteLength / 32;
}
