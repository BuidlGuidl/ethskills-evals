import { createServer } from "node:http";
import type { ReadModel } from "./read-model.js";

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function boundedInteger(raw: string | null, fallback: number, max: number) {
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`must be an integer from 1 to ${max}`);
  return value;
}

export function createApi(readModel: ReadModel) {
  return createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method !== "GET") return json(response, 405, { error: "method not allowed" });
      if (url.pathname === "/health") return json(response, 200, { ok: true });
      if (url.pathname === "/api/feed") {
        const limit = boundedInteger(url.searchParams.get("limit"), 50, 100);
        return json(response, 200, readModel.feed(limit, url.searchParams.get("cursor") ?? undefined));
      }
      const profileMatch = url.pathname.match(/^\/api\/members\/(0x[0-9a-fA-F]{40})$/);
      if (profileMatch) return json(response, 200, readModel.profile(profileMatch[1]!));
      if (url.pathname === "/api/leaderboard") {
        const now = new Date();
        const year = boundedInteger(url.searchParams.get("year"), now.getUTCFullYear(), 9999);
        const month = boundedInteger(url.searchParams.get("month"), now.getUTCMonth() + 1, 12);
        const limit = boundedInteger(url.searchParams.get("limit"), 100, 500);
        return json(response, 200, readModel.leaderboard(year, month, limit));
      }
      return json(response, 404, { error: "not found" });
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : "bad request" });
    }
  });
}

