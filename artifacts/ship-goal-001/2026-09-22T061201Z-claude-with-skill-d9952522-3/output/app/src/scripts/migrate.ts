/** `npm run db:migrate` — applies src/server/schema.sql. Safe to run repeatedly. */
import {migrate} from "@/server/db.ts";

migrate();
console.log(`schema applied to ${process.env.DATABASE_PATH ?? "./data/toolshed.db"}`);
