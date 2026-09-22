import {handler, json, requireMember} from "@/server/http.ts";
import {loansForMember} from "@/server/loans.ts";

/** Every loan I am party to, either side. */
export const GET = handler(async () => {
  const member = await requireMember();
  return json({loans: loansForMember(member.address), me: member.address});
});
