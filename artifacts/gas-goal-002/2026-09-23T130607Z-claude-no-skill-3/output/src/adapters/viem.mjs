/**
 * viem wiring for BatchRelayer. Implements the small client interface the
 * relayer needs: read base fee, simulate, estimate gas, send and wait.
 */
import { encodeFunctionData, decodeErrorResult } from 'viem';

export const BATCH_TRANSFER_ABI = [
  { type: 'function', name: 'payout', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'payouts', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'payoutFrom', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'from', type: 'address' },
             { name: 'payouts', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'setRelayer', stateMutability: 'nonpayable',
    inputs: [{ name: 'relayer', type: 'address' }, { name: 'allowed', type: 'bool' }], outputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [{ name: 'index', type: 'uint256' }] },
  { type: 'error', name: 'NotRelayer', inputs: [] },
  { type: 'error', name: 'MalformedPayouts', inputs: [] },
  { type: 'error', name: 'NotOwner', inputs: [] },
];

/**
 * @param {import('viem').PublicClient} publicClient
 * @param {import('viem').WalletClient} walletClient
 */
export function viemClient(publicClient, walletClient) {
  const account = walletClient.account;
  const data = (fn, args) => encodeFunctionData({ abi: BATCH_TRANSFER_ABI, functionName: fn, args });

  return {
    async baseFeePerGas() {
      const block = await publicClient.getBlock({ blockTag: 'latest' });
      return block.baseFeePerGas ?? 0n;
    },

    /** Returns null when the call succeeds, else `{ data, message }`. */
    async simulate({ to, fn, args }) {
      try {
        await publicClient.call({ account, to, data: data(fn, args) });
        return null;
      } catch (e) {
        const raw = extractRevertData(e);
        return { data: raw, message: e.shortMessage ?? e.message };
      }
    },

    async estimateGas({ to, fn, args }) {
      return publicClient.estimateGas({ account, to, data: data(fn, args) });
    },

    /** Next nonce for the relayer, counting transactions already in the pool. */
    async pendingNonce() {
      return publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
    },

    async receiptOf(hash) {
      try { return await publicClient.getTransactionReceipt({ hash }); }
      catch { return null; }
    },

    async sendAndWait({ to, fn, args, gas, maxFeePerGas, maxPriorityFeePerGas, waitBlocks, nonce }) {
      const hash = await walletClient.sendTransaction({
        account, chain: walletClient.chain, to, data: data(fn, args),
        gas, maxFeePerGas, maxPriorityFeePerGas, nonce,
      });
      // Bounded wait: if it has not landed we want to escalate the tip, not block.
      const receipt = await publicClient.waitForTransactionReceipt({
        hash, timeout: Math.max(1, waitBlocks ?? 3) * 2_000 + 4_000,
      });
      return { ...receipt, hash };
    },
  };
}

function extractRevertData(err) {
  let e = err;
  for (let i = 0; i < 12 && e; i++) {
    if (typeof e.data === 'string' && e.data.startsWith('0x')) return e.data;
    if (e.data?.data && typeof e.data.data === 'string') return e.data.data;
    e = e.cause;
  }
  return undefined;
}

/** Decode a BatchTransfer revert into something loggable. */
export function describeRevert(data) {
  try {
    const d = decodeErrorResult({ abi: BATCH_TRANSFER_ABI, data });
    return `${d.errorName}(${(d.args ?? []).join(', ')})`;
  } catch {
    return data ?? 'unknown revert';
  }
}
