import { loadConfig } from "../config.js";
import { createPool } from "./client.js";
import { schemaSql } from "./schema.js";

const config = loadConfig();
const pool = createPool(config);

try {
  await pool.query(schemaSql);
  console.log("Database schema is ready.");
} finally {
  await pool.end();
}
