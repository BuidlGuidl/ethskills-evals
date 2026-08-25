import { readFile } from "node:fs/promises";
import { db } from "./db.js";

const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
await db.query(sql);
await db.end();
console.log("Database migrated");
