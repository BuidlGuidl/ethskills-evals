import { spawnSync } from "child_process";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { parse } from "toml";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config();

// Usage: yarn fork [--network <name>] [--block-time <seconds>]
//        yarn fork --network base
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: yarn fork [options]
Options:
  --network <network>      Network alias from foundry.toml [rpc_endpoints] to fork (default: base)
  --block-time <seconds>   Anvil block time; 0 disables interval mining (default: 1)
  --help, -h               Show this help message
Examples:
  yarn fork                       # fork Base with 1s blocks
  yarn fork --network mainnet
  `);
  process.exit(0);
}

let network = "base";
let blockTime = "1";

for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--network" || args[i] === "-n") && args[i + 1]) {
    network = args[i + 1];
    i++;
  } else if (args[i] === "--block-time" && args[i + 1]) {
    blockTime = args[i + 1];
    i++;
  } else if (!args[i].startsWith("-")) {
    // Also accept the positional form: yarn fork base
    network = args[i];
  }
}

// Fail early with a clear message instead of letting anvil fork from a bogus alias.
try {
  const foundryToml = parse(
    readFileSync(join(__dirname, "..", "foundry.toml"), "utf-8")
  );
  if (!foundryToml.rpc_endpoints[network]) {
    console.log(
      `\n❌ Error: Network '${network}' not found in foundry.toml!`,
      "\nAdd it to the [rpc_endpoints] section or pick one of: " +
        Object.keys(foundryToml.rpc_endpoints).join(", ")
    );
    process.exit(1);
  }
} catch (error) {
  console.error("\n❌ Error reading or parsing foundry.toml:", error);
  process.exit(1);
}

console.log(
  `\n🍴 Forking ${network} into a local Anvil chain (chain id 31337, ${blockTime}s blocks)\n`
);

const result = spawnSync("make", ["fork"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FORK_URL: network, BLOCK_TIME: blockTime },
});

process.exit(result.status ?? 0);
