// Regenerates the golden calldata asserted by test/CrossCheck.t.sol.
//   JS_CALLDATA=$(node tools/gen-crosscheck.mjs) forge test --match-path test/CrossCheck.t.sol
import { encodeBatch } from "./batch.mjs";

console.log(
  encodeBatch([
    { to: "0x00000000000000000000000000000000000000aa", amount: 1n },
    { to: "0xffffffffffffffffffffffffffffffffffffffff", amount: (1n << 96n) - 1n },
    { to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", amount: 25_500_000n },
  ])
);
