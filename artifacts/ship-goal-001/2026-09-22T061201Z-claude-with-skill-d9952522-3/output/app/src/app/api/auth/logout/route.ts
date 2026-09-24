import {handler, json} from "@/server/http.ts";
import {endSession} from "@/server/session.ts";

export const POST = handler(async () => {
  await endSession();
  return json({ok: true});
});
