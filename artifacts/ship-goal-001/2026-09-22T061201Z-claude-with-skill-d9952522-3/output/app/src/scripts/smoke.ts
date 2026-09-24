/**
 * End-to-end smoke test against a running server: `npm run smoke`.
 *
 * Drives the whole offchain half of a loan with real keys and real signatures — sign in, list a
 * tool, ask to borrow it, approve with an EIP-712 signature, sign a return receipt — and checks
 * the server accepts every step and rejects the obvious forgeries.
 *
 * It deliberately does not touch a chain. The contract half is covered by `forge test`, including
 * a fork test against real USDC on Base; this covers the part that lives in this app: session
 * handling, the member gate, the approval checks, and the typed-data payloads matching what the
 * contract expects. Between the two, every step of a loan is exercised.
 *
 *   BASE_URL=http://localhost:3000 npm run smoke
 */
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";
import {hashTypedData} from "viem";

import {db, migrate} from "@/server/db.ts";
import {inviteMember} from "@/server/members.ts";
import {RECEIPT_TYPES, TERMS_TYPES, eip712Domain, serialiseTerms} from "@/core/eip712.ts";
import {DAY_SECONDS} from "@/core/loan.ts";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
const ESCROW = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ??
  "0x1111111111111111111111111111111111111111") as `0x${string}`;

// Well-known Anvil test keys. Never use these for anything that holds value.
const OWNER = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const BORROWER = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  passed += 1;
  console.log(`  ok  ${name}`);
}

/** Minimal cookie-jar fetch, one jar per member. */
function session() {
  let cookie = "";
  return async function call(path: string, init: RequestInit = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(init.body ? {"content-type": "application/json"} : {}),
        ...(cookie ? {cookie} : {}),
      },
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      body: text ? (JSON.parse(text) as Record<string, never>) : {},
    };
  };
}

async function signIn(call: ReturnType<typeof session>, account: typeof OWNER) {
  const nonce = await call(`/api/auth/nonce?address=${account.address}`);
  const signature = await account.signMessage({
    message: nonce.body.message as unknown as string,
  });
  return call("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      address: account.address,
      nonce: nonce.body.nonce,
      signature,
    }),
  });
}

async function main() {
  console.log(`smoke test against ${BASE_URL}\n`);

  // Put both test accounts on the association's roll — the gate is the point, so we go through
  // the same function an admin's invite would.
  migrate();
  inviteMember(OWNER.address, "Smoke Owner", "1 Test Lane");
  inviteMember(BORROWER.address, "Smoke Borrower", "2 Test Lane");

  const owner = session();
  const borrower = session();
  const stranger = session();

  await check("an unknown wallet cannot sign in", async () => {
    const outsider = privateKeyToAccount(`0x${"11".repeat(32)}`);
    const result = await signIn(stranger, outsider);
    assert.equal(result.status, 403, "expected the member gate to reject an outsider");
  });

  await check("a member signs in with a wallet signature", async () => {
    const result = await signIn(owner, OWNER);
    assert.equal(result.status, 200);
    await signIn(borrower, BORROWER);
  });

  await check("a replayed nonce is refused", async () => {
    const nonce = await owner(`/api/auth/nonce?address=${OWNER.address}`);
    const signature = await OWNER.signMessage({
      message: nonce.body.message as unknown as string,
    });
    const body = JSON.stringify({address: OWNER.address, nonce: nonce.body.nonce, signature});
    assert.equal((await owner("/api/auth/verify", {method: "POST", body})).status, 200);
    assert.equal((await owner("/api/auth/verify", {method: "POST", body})).status, 400);
  });

  let listingId = "";
  await check("the owner lists a tool", async () => {
    const result = await owner("/api/listings", {
      method: "POST",
      body: JSON.stringify({
        title: "Smoke test hedge trimmer",
        conditionNotes: "Blade guard is cracked.",
        deposit: "75",
        dailyLateFee: "5",
        maxDays: 7,
      }),
    });
    assert.equal(result.status, 201);
    listingId = (result.body.listing as unknown as {id: string}).id;
  });

  await check("a zero late fee is refused, as the contract would refuse it", async () => {
    const result = await owner("/api/listings", {
      method: "POST",
      body: JSON.stringify({title: "No fee", deposit: "50", dailyLateFee: "0", maxDays: 3}),
    });
    assert.equal(result.status, 400);
  });

  await check("a late fee above the deposit is refused", async () => {
    const result = await owner("/api/listings", {
      method: "POST",
      body: JSON.stringify({title: "Silly fee", deposit: "10", dailyLateFee: "50", maxDays: 3}),
    });
    assert.equal(result.status, 400);
  });

  await check("the owner cannot ask to borrow their own tool", async () => {
    const result = await owner("/api/requests", {
      method: "POST",
      body: JSON.stringify({listingId, days: 3}),
    });
    assert.equal(result.status, 400);
  });

  let requestId = "";
  await check("the borrower asks for it", async () => {
    const result = await borrower("/api/requests", {
      method: "POST",
      body: JSON.stringify({listingId, days: 4, message: "Hedges are out of control."}),
    });
    assert.equal(result.status, 201);
    requestId = (result.body.request as unknown as {id: string}).id;
  });

  await check("asking for longer than the owner allows is refused", async () => {
    const result = await borrower("/api/requests", {
      method: "POST",
      body: JSON.stringify({listingId, days: 99}),
    });
    assert.equal(result.status, 400);
  });

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const terms = {
    owner: OWNER.address,
    borrower: BORROWER.address,
    listingId: listingId as `0x${string}`,
    deposit: 75_000_000n,
    dailyLateFee: 5_000_000n,
    dueAt: nowSeconds + 4n * DAY_SECONDS,
    offerExpiry: nowSeconds + 3n * DAY_SECONDS,
    salt: 42n,
  };
  const domain = eip712Domain(CHAIN_ID, ESCROW);
  const typedData = {domain, types: TERMS_TYPES, primaryType: "Terms" as const, message: terms};
  const loanId = hashTypedData(typedData);

  await check("the borrower cannot approve their own request", async () => {
    const signature = await BORROWER.signTypedData(typedData);
    const result = await borrower(`/api/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify({terms: serialiseTerms(terms), signature, loanId}),
    });
    assert.equal(result.status, 403);
  });

  await check("terms that do not match the listing are refused", async () => {
    const tampered = {...terms, deposit: 1_000_000n};
    const signature = await OWNER.signTypedData({...typedData, message: tampered});
    const result = await owner(`/api/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify({
        terms: serialiseTerms(tampered),
        signature,
        loanId: hashTypedData({...typedData, message: tampered}),
      }),
    });
    assert.equal(result.status, 400);
  });

  await check("a signature from the wrong key is caught before the borrower wastes gas", async () => {
    const signature = await BORROWER.signTypedData(typedData);
    const result = await owner(`/api/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify({terms: serialiseTerms(terms), signature, loanId}),
    });
    assert.equal(result.status, 400);
  });

  await check("the owner approves with a valid EIP-712 signature", async () => {
    const signature = await OWNER.signTypedData(typedData);
    const result = await owner(`/api/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify({terms: serialiseTerms(terms), signature, loanId}),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal((result.body.request as unknown as {status: string}).status, "approved");
  });

  await check("the borrower can now see the signature they need to open the loan", async () => {
    const result = await borrower("/api/requests");
    const outgoing = result.body.outgoing as unknown as {
      id: string;
      ownerSignature: string | null;
    }[];
    const mine = outgoing.find((row) => row.id === requestId);
    assert.ok(mine?.ownerSignature, "the owner's signature should be readable by the borrower");
  });

  // Receipts are keyed on a loan the indexer has seen. Stand one in, since this test does not
  // run a chain — everything after this point is the receipt path only.
  db()
    .prepare(
      `INSERT OR REPLACE INTO loans (loan_id, listing_id, owner_address, borrower_address,
         deposit, daily_late_fee, due_at, started_at, status, opened_block, opened_tx)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, '0xsmoke')`,
    )
    .run(
      loanId,
      listingId,
      OWNER.address.toLowerCase(),
      BORROWER.address.toLowerCase(),
      terms.deposit.toString(),
      terms.dailyLateFee.toString(),
      Number(terms.dueAt),
      Number(nowSeconds),
    );

  const returnedAt = Number(nowSeconds);
  const receiptData = {
    domain,
    types: RECEIPT_TYPES,
    primaryType: "Receipt" as const,
    message: {loanId, returnedAt: BigInt(returnedAt)},
  };

  await check("only the owner can sign a return receipt", async () => {
    const signature = await BORROWER.signTypedData(receiptData);
    const result = await borrower(`/api/loans/${loanId}/receipt`, {
      method: "POST",
      body: JSON.stringify({returnedAt, signature}),
    });
    assert.equal(result.status, 403);
  });

  await check("a receipt dated in the future is refused", async () => {
    const future = returnedAt + 86_400;
    const signature = await OWNER.signTypedData({
      ...receiptData,
      message: {loanId, returnedAt: BigInt(future)},
    });
    const result = await owner(`/api/loans/${loanId}/receipt`, {
      method: "POST",
      body: JSON.stringify({returnedAt: future, signature}),
    });
    assert.equal(result.status, 400);
  });

  await check("the owner signs a valid return receipt", async () => {
    const signature = await OWNER.signTypedData(receiptData);
    const result = await owner(`/api/loans/${loanId}/receipt`, {
      method: "POST",
      body: JSON.stringify({returnedAt, signature}),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const loan = result.body.loan as unknown as {receipt: {signature: string} | null};
    assert.ok(loan.receipt, "the receipt should be stored for the borrower to use");
  });

  await check("signing out ends the session", async () => {
    await owner("/api/auth/logout", {method: "POST"});
    assert.equal((await owner("/api/loans")).status, 401);
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((error) => {
  console.error("\nsmoke test failed:", error);
  process.exit(1);
});
