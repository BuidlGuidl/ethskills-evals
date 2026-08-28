import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const app = express();
const file = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data/tools.json",
);
app.use(express.json({ limit: "100kb" }));
app.get("/api/tools", async (_req, res) =>
  res.json(JSON.parse(await readFile(file, "utf8"))),
);
app.post("/api/tools", async (req, res) => {
  const { name, owner, condition, image, deposit, fee } = req.body;
  if (
    ![name, owner, condition, deposit, fee].every(
      (v) => typeof v === "string" && v.trim(),
    )
  )
    return res.status(400).json({ error: "Missing fields" });
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner))
    return res.status(400).json({ error: "Invalid owner wallet" });
  const tools = JSON.parse(await readFile(file, "utf8"));
  const tool = {
    id: crypto.randomUUID(),
    name,
    owner,
    condition,
    image: image || "",
    deposit,
    fee,
  };
  tools.unshift(tool);
  await writeFile(file, JSON.stringify(tools, null, 2) + "\n");
  res.status(201).json(tool);
});
app.listen(process.env.PORT || 8787, () =>
  console.log("Toolshed API listening on http://localhost:8787"),
);
