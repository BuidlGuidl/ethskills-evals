import { describe, expect, it } from "vitest";

import { compileStreakContract } from "../scripts/compile.js";

describe("StreakCheckIn contract", () => {
  it("compiles and exposes the checkIn write", () => {
    const compiled = compileStreakContract();
    const functionNames = compiled.abi
      .filter((item): item is { type: "function"; name: string } => {
        return typeof item === "object" && item !== null && (item as { type?: string }).type === "function";
      })
      .map((item) => item.name);

    expect(compiled.bytecode.startsWith("0x")).toBe(true);
    expect(functionNames).toContain("checkIn");
  });
});
