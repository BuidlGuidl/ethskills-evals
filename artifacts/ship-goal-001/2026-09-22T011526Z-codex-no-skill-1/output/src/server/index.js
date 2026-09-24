import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  asMoney,
  calculateLateDays,
  generateId,
  httpError,
  isoDate,
  loadDatabase,
  publicState,
  requireFields,
  updateDatabase
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const publicDir = path.join(rootDir, "src/public");
const port = Number(process.env.PORT ?? 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    const status = error.status ?? 500;
    sendJson(response, status, {
      error: status === 500 ? "Something went wrong." : error.message
    });

    if (status === 500) {
      console.error(error);
    }
  }
});

server.listen(port, () => {
  console.log(`Toolshed is running at http://localhost:${port}`);
});

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/state") {
    const db = await loadDatabase();
    sendJson(response, 200, publicState(db));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tools") {
    const payload = await readJson(request);
    requireFields(payload, ["ownerId", "name", "category", "conditionNotes", "photoUrl"]);

    const tool = await updateDatabase((db) => {
      const owner = db.members.find((member) => member.id === payload.ownerId);
      if (!owner) {
        throw httpError(404, "Owner not found.");
      }

      const created = {
        id: generateId("tool"),
        ownerId: payload.ownerId,
        name: String(payload.name).trim(),
        category: String(payload.category).trim(),
        conditionNotes: String(payload.conditionNotes).trim(),
        photoUrl: String(payload.photoUrl).trim(),
        depositUsdc: asMoney(payload.depositUsdc ?? 25),
        lateFeeDailyUsdc: asMoney(payload.lateFeeDailyUsdc ?? 5),
        status: "available",
        createdAt: new Date().toISOString()
      };

      db.tools.unshift(created);
      return created;
    });

    sendJson(response, 201, tool);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/requests") {
    const payload = await readJson(request);
    requireFields(payload, ["toolId", "borrowerId", "requestedStart", "requestedEnd"]);

    const requestRecord = await updateDatabase((db) => {
      const tool = db.tools.find((candidate) => candidate.id === payload.toolId);
      const borrower = db.members.find((member) => member.id === payload.borrowerId);

      if (!tool) {
        throw httpError(404, "Tool not found.");
      }
      if (!borrower) {
        throw httpError(404, "Borrower not found.");
      }
      if (tool.ownerId === borrower.id) {
        throw httpError(400, "Members cannot borrow their own tools.");
      }
      if (tool.status !== "available") {
        throw httpError(409, "This tool is not currently available.");
      }
      if (!isIsoDate(payload.requestedStart) || !isIsoDate(payload.requestedEnd)) {
        throw httpError(400, "Loan dates must use YYYY-MM-DD format.");
      }
      if (Date.parse(payload.requestedStart) > Date.parse(payload.requestedEnd)) {
        throw httpError(400, "End date must be after start date.");
      }
      if (borrower.usdcBalance < tool.depositUsdc) {
        throw httpError(400, "Borrower does not have enough USDC for the deposit.");
      }

      borrower.usdcBalance = asMoney(borrower.usdcBalance - tool.depositUsdc);

      const created = {
        id: generateId("req"),
        toolId: tool.id,
        borrowerId: borrower.id,
        requestedStart: payload.requestedStart,
        requestedEnd: payload.requestedEnd,
        message: String(payload.message ?? "").trim(),
        status: "pending",
        depositHeldUsdc: tool.depositUsdc,
        createdAt: new Date().toISOString()
      };

      db.requests.unshift(created);
      return created;
    });

    sendJson(response, 201, requestRecord);
    return;
  }

  const approveMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/approve$/);
  if (request.method === "POST" && approveMatch) {
    const payload = await readJson(request);
    const approved = await updateDatabase((db) => approveRequest(db, approveMatch[1], payload.ownerId));
    sendJson(response, 200, approved);
    return;
  }

  const rejectMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/reject$/);
  if (request.method === "POST" && rejectMatch) {
    const payload = await readJson(request);
    const rejected = await updateDatabase((db) => rejectRequest(db, rejectMatch[1], payload.ownerId));
    sendJson(response, 200, rejected);
    return;
  }

  const returnMatch = url.pathname.match(/^\/api\/loans\/([^/]+)\/return$/);
  if (request.method === "POST" && returnMatch) {
    const payload = await readJson(request);
    const settled = await updateDatabase((db) => returnLoan(db, returnMatch[1], payload.ownerId, payload.returnedAt));
    sendJson(response, 200, settled);
    return;
  }

  throw httpError(404, "API route not found.");
}

function approveRequest(db, requestId, ownerId) {
  const requestRecord = db.requests.find((request) => request.id === requestId);
  if (!requestRecord) {
    throw httpError(404, "Request not found.");
  }

  const tool = db.tools.find((candidate) => candidate.id === requestRecord.toolId);
  if (!tool) {
    throw httpError(404, "Tool not found.");
  }
  if (tool.ownerId !== ownerId) {
    throw httpError(403, "Only the tool owner can approve this request.");
  }
  if (requestRecord.status !== "pending") {
    throw httpError(409, "Only pending requests can be approved.");
  }
  if (tool.status !== "available") {
    throw httpError(409, "This tool is not currently available.");
  }

  requestRecord.status = "approved";
  tool.status = "loaned";

  const loan = {
    id: generateId("loan"),
    requestId: requestRecord.id,
    toolId: tool.id,
    ownerId: tool.ownerId,
    borrowerId: requestRecord.borrowerId,
    startDate: requestRecord.requestedStart,
    dueDate: requestRecord.requestedEnd,
    returnedAt: null,
    status: "active",
    depositUsdc: requestRecord.depositHeldUsdc,
    lateFeeDailyUsdc: tool.lateFeeDailyUsdc,
    lateDays: 0,
    lateFeeUsdc: 0,
    refundUsdc: 0,
    ownerPayoutUsdc: 0
  };

  db.loans.unshift(loan);

  db.requests
    .filter((candidate) => candidate.toolId === tool.id && candidate.id !== requestRecord.id && candidate.status === "pending")
    .forEach((candidate) => {
      candidate.status = "rejected";
      const borrower = db.members.find((member) => member.id === candidate.borrowerId);
      if (borrower) {
        borrower.usdcBalance = asMoney(borrower.usdcBalance + candidate.depositHeldUsdc);
      }
    });

  return loan;
}

function rejectRequest(db, requestId, ownerId) {
  const requestRecord = db.requests.find((request) => request.id === requestId);
  if (!requestRecord) {
    throw httpError(404, "Request not found.");
  }

  const tool = db.tools.find((candidate) => candidate.id === requestRecord.toolId);
  if (!tool) {
    throw httpError(404, "Tool not found.");
  }
  if (tool.ownerId !== ownerId) {
    throw httpError(403, "Only the tool owner can reject this request.");
  }
  if (requestRecord.status !== "pending") {
    throw httpError(409, "Only pending requests can be rejected.");
  }

  requestRecord.status = "rejected";
  const borrower = db.members.find((member) => member.id === requestRecord.borrowerId);
  if (borrower) {
    borrower.usdcBalance = asMoney(borrower.usdcBalance + requestRecord.depositHeldUsdc);
  }

  return requestRecord;
}

function returnLoan(db, loanId, ownerId, returnedAt = isoDate()) {
  const loan = db.loans.find((candidate) => candidate.id === loanId);
  if (!loan) {
    throw httpError(404, "Loan not found.");
  }
  if (loan.ownerId !== ownerId) {
    throw httpError(403, "Only the tool owner can mark this loan returned.");
  }
  if (loan.status !== "active") {
    throw httpError(409, "Only active loans can be returned.");
  }

  const borrower = db.members.find((member) => member.id === loan.borrowerId);
  const owner = db.members.find((member) => member.id === loan.ownerId);
  const tool = db.tools.find((candidate) => candidate.id === loan.toolId);

  if (!borrower || !owner || !tool) {
    throw httpError(500, "Loan references missing member or tool data.");
  }

  const settledDate = returnedAt || isoDate();
  if (!isIsoDate(settledDate)) {
    throw httpError(400, "Return date must use YYYY-MM-DD format.");
  }

  const lateDays = calculateLateDays(loan.dueDate, settledDate);
  const lateFee = asMoney(Math.min(loan.depositUsdc, lateDays * loan.lateFeeDailyUsdc));
  const refund = asMoney(loan.depositUsdc - lateFee);

  loan.returnedAt = settledDate;
  loan.status = "returned";
  loan.lateDays = lateDays;
  loan.lateFeeUsdc = lateFee;
  loan.refundUsdc = refund;
  loan.ownerPayoutUsdc = lateFee;

  borrower.usdcBalance = asMoney(borrower.usdcBalance + refund);
  owner.usdcBalance = asMoney(owner.usdcBalance + lateFee);
  tool.status = "available";

  return loan;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const requestedPath = path.normalize(path.join(publicDir, pathname));

  if (!requestedPath.startsWith(publicDir)) {
    throw httpError(403, "Forbidden.");
  }

  try {
    const contents = await readFile(requestedPath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(requestedPath)] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw httpError(404, "Page not found.");
    }
    throw error;
  }
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw httpError(413, "Request body is too large.");
    }
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw httpError(400, "Request body must be valid JSON.");
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
