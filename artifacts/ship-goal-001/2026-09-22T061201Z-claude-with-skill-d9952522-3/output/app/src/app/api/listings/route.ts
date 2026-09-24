import {
  HttpError,
  handler,
  json,
  optionalString,
  requireInt,
  requireMember,
  requireString,
} from "@/server/http.ts";
import {browse, createListing} from "@/server/listings.ts";
import {parseUsdc} from "@/core/loan.ts";

/** Browse. Sorted by the owner's track record — see `browse()`. */
export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  return json({
    listings: browse({
      search: params.get("q") ?? undefined,
      includeUnavailable: params.get("available") !== "1",
    }),
  });
});

/** List a tool. */
export const POST = handler(async (request: Request) => {
  const member = await requireMember();
  const body = (await request.json()) as Record<string, unknown>;

  let deposit: bigint;
  let dailyLateFee: bigint;
  try {
    deposit = parseUsdc(requireString(body.deposit, "Deposit", 32));
    dailyLateFee = parseUsdc(requireString(body.dailyLateFee, "Daily late fee", 32));
  } catch {
    throw new HttpError(400, "Deposit and late fee must be plain USDC amounts, like 40 or 12.50.");
  }

  // Mirrors the contract's own checks, so a member finds out here rather than at the point of
  // a reverted transaction weeks later.
  if (deposit <= 0n) throw new HttpError(400, "The deposit must be more than zero.");
  if (dailyLateFee <= 0n) {
    throw new HttpError(400, "The daily late fee must be more than zero — it is what guarantees the deposit can never be stuck in escrow.");
  }
  if (dailyLateFee > deposit) {
    throw new HttpError(400, "The daily late fee cannot be larger than the deposit.");
  }

  const listing = createListing({
    ownerAddress: member.address,
    title: requireString(body.title, "Title", 120),
    description: optionalString(body.description, "Description", 2_000),
    conditionNotes: optionalString(body.conditionNotes, "Condition notes", 2_000),
    photoPath: typeof body.photoPath === "string" ? body.photoPath : null,
    deposit,
    dailyLateFee,
    maxDays: requireInt(body.maxDays, "Longest loan", 1, 180),
  });

  return json({listing}, 201);
});
