import {handler, json, optionalString, requireAddress, requireAdmin, requireString} from "@/server/http.ts";
import {allTrackRecords, inviteMember, listMembers} from "@/server/members.ts";

/** The association roll, with each member's track record. */
export const GET = handler(async () => {
  const records = allTrackRecords();
  return json({
    members: listMembers().map((member) => ({
      ...member,
      record: records.get(member.address) ?? null,
    })),
  });
});

/** Add someone to the roll. Committee members only — see TOOLSHED_ADMINS. */
export const POST = handler(async (request: Request) => {
  await requireAdmin();
  const body = (await request.json()) as Record<string, unknown>;
  const member = inviteMember(
    requireAddress(body.address, "address"),
    requireString(body.displayName, "Name", 80),
    optionalString(body.unitLabel, "Address", 120) || undefined,
  );
  return json({member}, 201);
});
