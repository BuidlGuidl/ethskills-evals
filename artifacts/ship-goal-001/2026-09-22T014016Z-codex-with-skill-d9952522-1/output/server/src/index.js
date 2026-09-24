require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { readStore, updateStore, id } = require("./store");
const { buildReputation, memberWithReputation } = require("./reputation");

const app = express();
const port = Number(process.env.PORT || 4317);

app.use(cors());
app.use(express.json({ limit: "12mb" }));

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === "");
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function bootstrap(data) {
  const reputation = buildReputation(data.loans);
  const members = data.members.map((member) => memberWithReputation(member, reputation));
  const memberByAddress = Object.fromEntries(
    members.map((member) => [member.address.toLowerCase(), member])
  );
  const toolById = Object.fromEntries(data.tools.map((tool) => [tool.id, tool]));

  const tools = data.tools.map((tool) => ({
    ...tool,
    owner: memberByAddress[tool.ownerAddress.toLowerCase()] || null
  }));

  const requests = data.requests
    .map((request) => ({
      ...request,
      tool: toolById[request.toolId] || null,
      borrower: memberByAddress[request.borrowerAddress.toLowerCase()] || null
    }))
    .sort((a, b) => {
      const scoreA = a.borrower?.reputation?.score || 0;
      const scoreB = b.borrower?.reputation?.score || 0;
      return scoreB - scoreA || new Date(a.createdAt) - new Date(b.createdAt);
    });

  return {
    members,
    tools,
    requests,
    loans: data.loans,
    reputation
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "toolshed-api" });
});

app.get("/api/bootstrap", (_req, res) => {
  res.json(bootstrap(readStore()));
});

app.post("/api/members", (req, res) => {
  try {
    requireFields(req.body, ["name", "address"]);
    const member = updateStore((data) => {
      const normalized = req.body.address.toLowerCase();
      if (data.members.some((existing) => existing.address.toLowerCase() === normalized)) {
        const error = new Error("Member address already exists");
        error.status = 409;
        throw error;
      }

      const next = {
        id: id("member"),
        name: req.body.name,
        address: req.body.address,
        neighborhood: req.body.neighborhood || "",
        createdAt: new Date().toISOString()
      };
      data.members.push(next);
      return next;
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/tools", (req, res) => {
  try {
    requireFields(req.body, ["ownerAddress", "name", "conditionNotes", "depositUsdc", "dailyLateFeeUsdc"]);
    const tool = updateStore((data) => {
      const ownerExists = data.members.some(
        (member) => member.address.toLowerCase() === req.body.ownerAddress.toLowerCase()
      );
      if (!ownerExists) {
        const error = new Error("Owner must be a registered member");
        error.status = 400;
        throw error;
      }

      const next = {
        id: id("tool"),
        ownerAddress: req.body.ownerAddress,
        name: req.body.name,
        category: req.body.category || "General",
        conditionNotes: req.body.conditionNotes,
        depositUsdc: req.body.depositUsdc,
        dailyLateFeeUsdc: req.body.dailyLateFeeUsdc,
        photoDataUrl: req.body.photoDataUrl || "",
        available: true,
        createdAt: new Date().toISOString()
      };
      data.tools.push(next);
      return next;
    });

    res.status(201).json(tool);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/requests", (req, res) => {
  try {
    requireFields(req.body, ["toolId", "borrowerAddress", "startDate", "dueDate"]);
    const request = updateStore((data) => {
      const tool = data.tools.find((item) => item.id === req.body.toolId);
      if (!tool) {
        const error = new Error("Tool not found");
        error.status = 404;
        throw error;
      }
      if (tool.ownerAddress.toLowerCase() === req.body.borrowerAddress.toLowerCase()) {
        const error = new Error("Owners cannot borrow their own tools");
        error.status = 400;
        throw error;
      }

      const next = {
        id: id("request"),
        toolId: req.body.toolId,
        borrowerAddress: req.body.borrowerAddress,
        startDate: req.body.startDate,
        dueDate: req.body.dueDate,
        message: req.body.message || "",
        status: "pending",
        createdAt: new Date().toISOString()
      };
      data.requests.push(next);
      return next;
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.patch("/api/requests/:id", (req, res) => {
  try {
    const request = updateStore((data) => {
      const existing = data.requests.find((item) => item.id === req.params.id);
      if (!existing) {
        const error = new Error("Request not found");
        error.status = 404;
        throw error;
      }

      if (req.body.status) {
        existing.status = req.body.status;
      }
      if (req.body.escrowLoanId) {
        existing.escrowLoanId = req.body.escrowLoanId;
      }
      if (req.body.txHash) {
        existing.txHash = req.body.txHash;
      }
      existing.updatedAt = new Date().toISOString();
      return existing;
    });

    res.json(request);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/loans", (req, res) => {
  try {
    requireFields(req.body, ["toolId", "ownerAddress", "borrowerAddress", "dueDate", "depositUsdc", "dailyLateFeeUsdc"]);
    const loan = updateStore((data) => {
      const next = {
        id: id("loan"),
        toolId: req.body.toolId,
        ownerAddress: req.body.ownerAddress,
        borrowerAddress: req.body.borrowerAddress,
        dueDate: req.body.dueDate,
        returnedAt: null,
        depositUsdc: req.body.depositUsdc,
        dailyLateFeeUsdc: req.body.dailyLateFeeUsdc,
        escrowLoanId: req.body.escrowLoanId || null,
        txHash: req.body.txHash || null,
        lateDays: 0,
        status: "active",
        createdAt: new Date().toISOString()
      };
      data.loans.push(next);

      const tool = data.tools.find((item) => item.id === req.body.toolId);
      if (tool) {
        tool.available = false;
      }

      return next;
    });

    res.status(201).json(loan);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.patch("/api/loans/:id", (req, res) => {
  try {
    const loan = updateStore((data) => {
      const existing = data.loans.find((item) => item.id === req.params.id);
      if (!existing) {
        const error = new Error("Loan not found");
        error.status = 404;
        throw error;
      }

      if (req.body.status) {
        existing.status = req.body.status;
      }
      if (req.body.returnedAt) {
        existing.returnedAt = req.body.returnedAt;
      }
      if (Number.isFinite(req.body.lateDays)) {
        existing.lateDays = req.body.lateDays;
      }
      if (req.body.settleTxHash) {
        existing.settleTxHash = req.body.settleTxHash;
      }
      existing.updatedAt = new Date().toISOString();

      if (existing.status === "returned") {
        const tool = data.tools.find((item) => item.id === existing.toolId);
        if (tool) {
          tool.available = true;
        }
      }

      return existing;
    });

    res.json(loan);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.listen(port, () => {
  console.log(`Toolshed API listening on http://localhost:${port}`);
});
