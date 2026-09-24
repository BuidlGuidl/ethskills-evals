import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const dataDir = path.join(rootDir, "data");
const dbPath = path.join(dataDir, "toolshed-db.json");
const seedPath = path.join(dataDir, "seed.json");
const dayMs = 24 * 60 * 60 * 1000;

let writeQueue = Promise.resolve();

export async function loadDatabase() {
  await mkdir(dataDir, { recursive: true });

  try {
    return JSON.parse(await readFile(dbPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const seed = JSON.parse(await readFile(seedPath, "utf8"));
    await writeDatabase(seed);
    return seed;
  }
}

export async function writeDatabase(db) {
  const payload = JSON.stringify(db, null, 2);
  writeQueue = writeQueue.then(() => writeFile(dbPath, `${payload}\n`));
  await writeQueue;
}

export async function updateDatabase(mutator) {
  const db = await loadDatabase();
  const result = await mutator(db);
  await writeDatabase(db);
  return result;
}

export function publicState(db) {
  const metricsByMember = computeMemberMetrics(db);
  const activeLoansByTool = new Map(
    db.loans.filter((loan) => loan.status === "active").map((loan) => [loan.toolId, loan])
  );

  const tools = db.tools.map((tool) => {
    const owner = db.members.find((member) => member.id === tool.ownerId);
    const activeLoan = activeLoansByTool.get(tool.id);
    const pendingRequests = db.requests.filter(
      (request) => request.toolId === tool.id && request.status === "pending"
    );

    return {
      ...tool,
      ownerName: owner?.name ?? "Unknown owner",
      ownerBlock: owner?.block ?? "",
      pendingRequestCount: pendingRequests.length,
      activeLoanId: activeLoan?.id ?? null
    };
  });

  const requests = db.requests
    .map((request) => {
      const tool = db.tools.find((candidate) => candidate.id === request.toolId);
      const borrower = db.members.find((member) => member.id === request.borrowerId);
      const borrowerMetrics = metricsByMember[request.borrowerId];

      return {
        ...request,
        toolName: tool?.name ?? "Unknown tool",
        ownerId: tool?.ownerId ?? null,
        ownerName: db.members.find((member) => member.id === tool?.ownerId)?.name ?? "Unknown owner",
        borrowerName: borrower?.name ?? "Unknown borrower",
        borrowerBlock: borrower?.block ?? "",
        borrowerMetrics
      };
    })
    .sort((a, b) => {
      if (a.status === "pending" && b.status === "pending") {
        return b.borrowerMetrics.score - a.borrowerMetrics.score || new Date(a.createdAt) - new Date(b.createdAt);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const loans = db.loans.map((loan) => {
    const tool = db.tools.find((candidate) => candidate.id === loan.toolId);
    const owner = db.members.find((member) => member.id === loan.ownerId);
    const borrower = db.members.find((member) => member.id === loan.borrowerId);

    return {
      ...loan,
      toolName: tool?.name ?? "Unknown tool",
      ownerName: owner?.name ?? "Unknown owner",
      borrowerName: borrower?.name ?? "Unknown borrower",
      currentLateDays: loan.status === "active" ? calculateLateDays(loan.dueDate, isoDate()) : loan.lateDays
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    members: db.members.map((member) => ({
      ...member,
      metrics: metricsByMember[member.id]
    })),
    tools,
    requests,
    loans
  };
}

export function computeMemberMetrics(db) {
  return Object.fromEntries(
    db.members.map((member) => {
      const returnedLoans = db.loans.filter(
        (loan) => loan.borrowerId === member.id && loan.status === "returned"
      );
      const lateReturns = returnedLoans.filter((loan) => loan.lateDays > 0).length;
      const activeLoans = db.loans.filter(
        (loan) => loan.borrowerId === member.id && loan.status === "active"
      ).length;
      const pendingRequests = db.requests.filter(
        (request) => request.borrowerId === member.id && request.status === "pending"
      ).length;
      const completedLoans = returnedLoans.length;
      const onTimeRate = completedLoans === 0 ? 1 : (completedLoans - lateReturns) / completedLoans;
      const score = Math.round(onTimeRate * 100 + completedLoans * 8 - lateReturns * 20 - activeLoans * 4);

      return [
        member.id,
        {
          completedLoans,
          lateReturns,
          activeLoans,
          pendingRequests,
          onTimeRate,
          score
        }
      ];
    })
  );
}

export function requireFields(payload, fields) {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === "");
  if (missing.length > 0) {
    throw httpError(400, `Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  }
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function calculateLateDays(dueDate, returnedAt) {
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  const returned = Date.parse(`${returnedAt}T00:00:00.000Z`);
  if (Number.isNaN(due) || Number.isNaN(returned)) {
    return 0;
  }

  return Math.max(0, Math.ceil((returned - due) / dayMs));
}

export function asMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw httpError(400, "USDC amounts must be non-negative numbers.");
  }
  return Math.round(numeric * 100) / 100;
}
