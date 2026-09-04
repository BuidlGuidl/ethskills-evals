/** Compiles contracts/ into out/ without deploying: npm run compile */
import { compile } from "../lib/compile.js";

const name = process.env.CONTRACT?.trim() || "Counter";
const artifact = compile(name);
console.log(`✔ ${artifact.contractName} (${artifact.compiler})`);
console.log(`  ${(artifact.bytecode.length - 2) / 2} bytes → out/${artifact.contractName}.json`);
