import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const members = [
  { id: "m1", name: "Maya Chen", loans: 18, late: 0 },
  { id: "m2", name: "Sam Rivera", loans: 12, late: 1 },
  { id: "m3", name: "Jordan Lee", loans: 7, late: 2 }
];
const tools = [
  { id: "drill-1", ownerId: "m1", name: "18V cordless drill", condition: "Good; battery lasts about 40 minutes.", photo: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", deposit: 60, dailyFee: 5 },
  { id: "ladder-1", ownerId: "m2", name: "6 ft step ladder", condition: "Paint marks, feet and locks are solid.", photo: "https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=900&q=80", deposit: 40, dailyFee: 4 },
  { id: "saw-1", ownerId: "m3", name: "Circular saw", condition: "Sharp blade; guard sticks slightly when dusty.", photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80", deposit: 80, dailyFee: 8 }
];
const requests = [
  { id: "r1", toolId: "drill-1", borrowerId: "m2", from: "2026-09-02", to: "2026-09-05", status: "pending" },
  { id: "r2", toolId: "drill-1", borrowerId: "m3", from: "2026-09-08", to: "2026-09-10", status: "pending" }
];

const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/tools" && req.method === "GET") {
    const ranked = tools.map(tool => ({ ...tool, owner: members.find(m => m.id === tool.ownerId) }))
      .sort((a, b) => (a.owner.late / Math.max(a.owner.loans, 1)) - (b.owner.late / Math.max(b.owner.loans, 1)) || b.owner.loans - a.owner.loans);
    return json(res, 200, ranked);
  }
  if (url.pathname === "/api/tools" && req.method === "POST") {
    const input = await body(req);
    if (!input.name || !input.condition || !input.photo) return json(res, 400, { error: "name, condition and photo are required" });
    const tool = { id: crypto.randomUUID(), ownerId: "m1", name: input.name, condition: input.condition, photo: input.photo, deposit: Number(input.deposit), dailyFee: Number(input.dailyFee) };
    tools.push(tool); return json(res, 201, tool);
  }
  if (url.pathname === "/api/requests" && req.method === "POST") {
    const input = await body(req);
    const tool = tools.find(t => t.id === input.toolId);
    if (!tool || !input.from || !input.to || new Date(input.to) <= new Date(input.from)) return json(res, 400, { error: "Choose a tool and valid dates" });
    const request = { id: crypto.randomUUID(), ...input, borrowerId: "m2", status: "pending", tool };
    requests.push(request); return json(res, 201, request);
  }
  if (url.pathname === "/api/requests" && req.method === "GET") {
    const queue = requests.map(request => ({ ...request, tool: tools.find(t => t.id === request.toolId), borrower: members.find(m => m.id === request.borrowerId) }))
      .sort((a, b) => (a.borrower.late / Math.max(a.borrower.loans, 1)) - (b.borrower.late / Math.max(b.borrower.loans, 1)) || b.borrower.loans - a.borrower.loans);
    return json(res, 200, queue);
  }
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const data = await readFile(join(root, path));
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(data);
  } catch { res.writeHead(404); res.end("Not found"); }
});

server.listen(process.env.PORT || 3000, () => console.log(`Toolshed running at http://localhost:${process.env.PORT || 3000}`));
