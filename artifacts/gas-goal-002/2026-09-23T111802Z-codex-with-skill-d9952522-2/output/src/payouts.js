const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_BATCH_SIZE = 250;

export function normalizePayout(payout) {
  const token = String(payout.token ?? "").toLowerCase();
  const recipient = String(payout.recipient ?? payout.to ?? "").toLowerCase();
  const amount = BigInt(payout.amount ?? 0);

  if (!ADDRESS_RE.test(token)) {
    throw new Error(`Invalid token address: ${payout.token}`);
  }
  if (!ADDRESS_RE.test(recipient)) {
    throw new Error(`Invalid recipient address: ${payout.recipient ?? payout.to}`);
  }
  if (amount < 0n) {
    throw new Error("Payout amount cannot be negative");
  }

  return {
    token,
    recipient,
    amount,
    references: payout.reference == null ? [] : [String(payout.reference)],
  };
}

export function aggregatePayouts(payouts) {
  const map = new Map();
  let inputCount = 0;
  let zeroAmountCount = 0;

  for (const payout of payouts) {
    inputCount += 1;
    const normalized = normalizePayout(payout);
    if (normalized.amount === 0n) {
      zeroAmountCount += 1;
      continue;
    }

    const key = `${normalized.token}:${normalized.recipient}`;
    const current = map.get(key);
    if (current) {
      current.amount += normalized.amount;
      current.references.push(...normalized.references);
    } else {
      map.set(key, normalized);
    }
  }

  const output = [...map.values()].sort((a, b) => {
    const tokenCompare = a.token.localeCompare(b.token);
    if (tokenCompare !== 0) return tokenCompare;
    return a.recipient.localeCompare(b.recipient);
  });

  return {
    payouts: output,
    stats: {
      inputCount,
      zeroAmountCount,
      outputCount: output.length,
      eliminatedCount: inputCount - zeroAmountCount - output.length,
    },
  };
}

export function chunkByToken(payouts, batchSize = DEFAULT_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Batch size must be a positive integer");
  }

  const chunks = [];
  let current = null;

  for (const payout of payouts) {
    if (!current || current.token !== payout.token || current.recipients.length >= batchSize) {
      current = {
        token: payout.token,
        recipients: [],
        amounts: [],
        references: [],
      };
      chunks.push(current);
    }
    current.recipients.push(payout.recipient);
    current.amounts.push(payout.amount);
    current.references.push(payout.references);
  }

  return chunks;
}

export function serializeBigInts(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function parseArgs(argv) {
  const args = { batchSize: DEFAULT_BATCH_SIZE };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--input") {
      args.input = next;
      i += 1;
    } else if (arg === "--batch-size") {
      args.batchSize = Number(next);
      i += 1;
    } else if (arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printHelp() {
  console.log(`Usage: node src/payouts.js [options] < payouts.json

Input is a JSON array of { "token": "0x...", "recipient": "0x...", "amount": "..." }.

Options:
  --batch-size <n>  Recipients per same-token batch. Default: ${DEFAULT_BATCH_SIZE}.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }

    const raw = await readStdin();
    const input = JSON.parse(raw);
    if (!Array.isArray(input)) {
      throw new Error("Input must be a JSON array");
    }

    const aggregated = aggregatePayouts(input);
    const batches = chunkByToken(aggregated.payouts, args.batchSize);
    console.log(serializeBigInts({ ...aggregated, batches }));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
