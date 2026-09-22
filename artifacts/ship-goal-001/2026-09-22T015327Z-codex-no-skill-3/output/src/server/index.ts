import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  approveLoan,
  createTool,
  declineLoan,
  getToolshedState,
  requestLoan,
  returnLoan
} from "./domain.js";
import { DomainError } from "./errors.js";
import { FileStore } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? (isProduction ? 5173 : 5174));
const projectRoot = isProduction ? path.resolve(__dirname, "../../..") : path.resolve(__dirname, "../..");
const storagePath = process.env.TOOLSHED_DATA_PATH ?? path.join(projectRoot, "storage", "toolshed.dev.json");

const app = express();
const store = new FileStore(storagePath);

app.use(express.json({ limit: "1mb" }));

const createToolSchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  photoUrl: z.string().url(),
  conditionNotes: z.string().min(1),
  depositUsdc: z.string().min(1),
  dailyLateFeeUsdc: z.string().min(1)
});

const requestLoanSchema = z.object({
  toolId: z.string().min(1),
  borrowerId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const ownerActionSchema = z.object({
  ownerId: z.string().min(1)
});

const returnLoanSchema = z.object({
  returnedAt: z.string().datetime()
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/state", async (_request, response, next) => {
  try {
    const database = await store.read();
    response.json(getToolshedState(database));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tools", async (request, response, next) => {
  try {
    const input = createToolSchema.parse(request.body);
    const tool = await store.update((database) => createTool(database, input));
    response.status(201).json(tool);
  } catch (error) {
    next(error);
  }
});

app.post("/api/loans", async (request, response, next) => {
  try {
    const input = requestLoanSchema.parse(request.body);
    const loan = await store.update((database) => requestLoan(database, input));
    response.status(201).json(loan);
  } catch (error) {
    next(error);
  }
});

app.post("/api/loans/:loanId/approve", async (request, response, next) => {
  try {
    const input = ownerActionSchema.parse(request.body);
    const loan = await store.update((database) => approveLoan(database, request.params.loanId, input));
    response.json(loan);
  } catch (error) {
    next(error);
  }
});

app.post("/api/loans/:loanId/decline", async (request, response, next) => {
  try {
    const input = ownerActionSchema.parse(request.body);
    const loan = await store.update((database) => declineLoan(database, request.params.loanId, input));
    response.json(loan);
  } catch (error) {
    next(error);
  }
});

app.post("/api/loans/:loanId/return", async (request, response, next) => {
  try {
    const input = returnLoanSchema.parse(request.body);
    const loan = await store.update((database) => returnLoan(database, request.params.loanId, input));
    response.json(loan);
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  const clientDir = path.resolve(projectRoot, "dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDir, "index.html"));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  if (error instanceof DomainError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Unexpected server error." });
});

app.listen(port, () => {
  console.log(`Toolshed is running on http://localhost:${port}`);
  console.log(`Data file: ${storagePath}`);
});
