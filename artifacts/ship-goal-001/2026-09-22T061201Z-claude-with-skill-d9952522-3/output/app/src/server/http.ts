import {NextResponse} from "next/server";

import {currentMember, type Member} from "./members.ts";

/**
 * JSON with bigints. USDC amounts are bigints everywhere in this codebase because they are
 * uint128 onchain; `JSON.stringify` refuses them, so they go over the wire as decimal strings
 * and the client parses them back with `BigInt(...)`.
 */
export function json(data: unknown, init?: number | ResponseInit): NextResponse {
  const body = JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  const responseInit = typeof init === "number" ? {status: init} : init;
  return new NextResponse(body, {
    ...responseInit,
    headers: {"content-type": "application/json", ...(responseInit?.headers ?? {})},
  });
}

export const fail = (status: number, message: string) => json({error: message}, status);

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a route handler so thrown HttpErrors become responses instead of 500s. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.status, error.message);
      console.error(error);
      return fail(500, "Something went wrong.");
    }
  };
}

/** The signed-in member, or a 401. */
export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) throw new HttpError(401, "Sign in first.");
  return member;
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (!member.isAdmin) throw new HttpError(403, "Committee members only.");
  return member;
}

// ---------------------------------------------------------------- input helpers

export function requireString(value: unknown, field: string, maxLength = 2_000): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} is required.`);
  }
  if (value.length > maxLength) throw new HttpError(400, `${field} is too long.`);
  return value.trim();
}

export function optionalString(value: unknown, field: string, maxLength = 2_000): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" && value.trim() === "" ? "" : requireString(value, field, maxLength);
}

export function requireInt(value: unknown, field: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}.`);
  }
  return parsed;
}

export function requireAddress(value: unknown, field: string): string {
  const raw = requireString(value, field, 42);
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) throw new HttpError(400, `${field} is not an address.`);
  return raw.toLowerCase();
}

export function requireHex32(value: unknown, field: string): string {
  const raw = requireString(value, field, 66);
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new HttpError(400, `${field} is not a bytes32.`);
  return raw.toLowerCase();
}
