import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parseUsdcAmount } from '../lib/money.js';

/** Accepts "25", "25.50" or 25.5 and returns integer micro-USDC. */
export const usdcAmount = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    try {
      return parseUsdcAmount(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected a USDC amount like "25.00"' });
      return z.NEVER;
    }
  });

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ApiError.badRequest(
      'invalid_request',
      result.error.issues[0]?.message ?? 'Invalid request',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
