// On-chain escrow driver -- NOT IMPLEMENTED, and deliberately so.
//
// The ledger driver custodies deposits: members fund a Toolshed balance from
// the association's USDC wallet and Toolshed moves numbers inside its own
// books. That is the right first version for a group of neighbours who already
// trust their treasurer, and it is the only thing v1 runs in production.
//
// If the association later wants deposits held by a contract instead of by the
// treasurer, implement this class against the same four-call port that
// LedgerEscrow implements (see escrow.js). What that takes:
//
//   1. An escrow contract on an L2 where USDC is cheap (Base, Arbitrum).
//      Roughly: `hold(loanId, borrower, amount)` pulls USDC via a borrower
//      `approve`; `settle(loanId, feeToOwner)` splits the held amount between
//      owner and borrower; only the Toolshed signer may call settle, and a
//      timeout lets the borrower claw back a deposit an absent owner never
//      settles.
//   2. A signer for that account (KMS or a hardware key -- not an env var).
//   3. Confirmation handling. A hold is not a hold until the transaction is
//      mined, so `hold()` becomes two steps: record `status='pending'` with
//      the transaction hash, and have a watcher flip it to `'held'` on
//      confirmation. The loan request flow already tolerates this: a request
//      whose hold is not yet `held` is simply not shown to the owner.
//   4. Reorg and stuck-transaction handling, and a reconciliation job that
//      compares escrow_holds against on-chain state.
//
// Until all of that exists, failing loudly at boot is better than a driver
// that silently pretends.

export class OnchainEscrow {
  constructor() {
    throw new Error(
      'TOOLSHED_ESCROW=onchain is not implemented yet. Use the ledger driver, ' +
        'or implement OnchainEscrow in src/payments/onchain.js (see the notes in that file).',
    );
  }
}
