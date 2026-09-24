import {handler, json} from "@/server/http.ts";
import {currentMember, trackRecord} from "@/server/members.ts";

export const GET = handler(async () => {
  const member = await currentMember();
  if (!member) return json({member: null});
  return json({member, record: trackRecord(member.address)});
});
