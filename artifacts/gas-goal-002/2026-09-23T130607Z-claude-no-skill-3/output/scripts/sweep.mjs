// How does per-payout gas vary with batch size, and with custody model?
//
// Every figure is receipt gasUsed from a real transaction against real USDC on
// a Base mainnet fork, so the 21,000 intrinsic cost, calldata cost and any
// EIP-7623 floor are included rather than modelled.
//
// Recipients are drawn from a single monotonic counter so that no two arms ever
// share an address. That matters: a recipient who has already been paid has a
// nonzero balance, so paying them again is a warm SSTORE (~2,900 gas) instead
// of a cold zero->nonzero one (20,000 gas). Overlapping arms silently flatter
// whichever one runs second.
import { USDC, ACCT, send, setUsdcBalance, deployBatcher, giveEth, prewarm } from './lib/fork.mjs';
import { encodePayouts } from '../src/encode.mjs';

const SIZES = (process.env.SIZES ?? '1,2,5,10,25,50,100,200,400').split(',').map(Number);
const AMT = 1000n;

await giveEth(ACCT);
const BATCH = deployBatcher();
await setUsdcBalance(BATCH, 1_000_000_000_000n);
await setUsdcBalance(ACCT, 1_000_000_000_000n);
send(USDC, 'approve(address,uint256)', BATCH, ((1n << 256n) - 1n).toString());

let counter = 0n;
const fresh = (n) => Array.from({ length: n }, () => ({
  to: '0x' + (0xc0de000000n + ++counter).toString(16).padStart(40, '0'),
  amount: AMT,
}));

/** Pay each recipient once so their balance slot is nonzero (a "warm" payout). */
const makeWarm = (ps) => { send(BATCH, 'payout(address,bytes)', USDC, encodePayouts(ps)); };

const gasOf = (res) => Number(res.gasUsed);
const batchFloat = (ps) => gasOf(send(BATCH, 'payout(address,bytes)', USDC, encodePayouts(ps)));
const batchPull = (ps) => gasOf(send(BATCH, 'payoutFrom(address,address,bytes)', USDC, ACCT, encodePayouts(ps)));

const rows = [];
for (const n of SIZES) {
  const coldFloat = fresh(n), coldPull = fresh(n), warmFloat = fresh(n), warmPull = fresh(n);
  await prewarm([...coldFloat, ...coldPull, ...warmFloat, ...warmPull].map((p) => p.to));
  makeWarm(warmFloat); makeWarm(warmPull);

  const cf = batchFloat(coldFloat), cp = batchPull(coldPull);
  const wf = batchFloat(warmFloat), wp = batchPull(warmPull);
  rows.push({
    batchSize: n,
    calldataBytes: n * 32,
    coldFloatTxGas: cf, coldFloatPerPayout: +(cf / n).toFixed(1),
    coldPullTxGas: cp, coldPullPerPayout: +(cp / n).toFixed(1),
    warmFloatTxGas: wf, warmFloatPerPayout: +(wf / n).toFixed(1),
    warmPullTxGas: wp, warmPullPerPayout: +(wp / n).toFixed(1),
  });
}

// Baseline: standalone USDC transfers, which is what the relayer sends today.
const [c1] = fresh(1); const [w1] = fresh(1);
await prewarm([c1.to, w1.to]);
const standaloneCold = gasOf(send(USDC, 'transfer(address,uint256)', c1.to, AMT.toString()));
send(USDC, 'transfer(address,uint256)', w1.to, AMT.toString());
const standaloneWarm = gasOf(send(USDC, 'transfer(address,uint256)', w1.to, AMT.toString()));

console.log(JSON.stringify({
  note: 'cold = recipient has never held USDC (zero->nonzero SSTORE); warm = already holds some',
  baseline: { standaloneTransferCold: standaloneCold, standaloneTransferWarm: standaloneWarm },
  rows: rows.map((r) => ({
    ...r,
    coldSavingPct: +(100 * (1 - r.coldPullPerPayout / standaloneCold)).toFixed(1),
    warmSavingPct: +(100 * (1 - r.warmPullPerPayout / standaloneWarm)).toFixed(1),
  })),
}, null, 2));
