import { compile } from "../src/compile.js";
import { reportFatal } from "../src/config.js";

const contractName = process.env.CONTRACT_NAME?.trim() || "Counter";

try {
  const artifact = compile(contractName);
  console.log(
    `✓ Compiled ${artifact.contractName} with ${artifact.compiler}\n` +
      `  → artifacts/${artifact.contractName}.json`,
  );
} catch (error) {
  reportFatal(error);
}
