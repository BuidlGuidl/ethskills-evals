const url = process.argv[2] || "http://127.0.0.1:8545";
const timeoutMs = Number(process.argv[3] || 30_000);
const startedAt = Date.now();

async function wait() {
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: []
        })
      });

      if (response.ok) return;
    } catch {
      // The node is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

wait().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
