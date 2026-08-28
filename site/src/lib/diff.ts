import { diffLines } from "diff";

export type DiffRow = { left: string | null; right: string | null; state: "same" | "changed" };

const lines = (value: string) => {
  const split = value.split("\n");

  return split[split.length - 1] === "" ? split.slice(0, -1) : split;
};

// Two columns that stay level: an edited block puts its old and new lines on the same
// rows, and a pure insertion or deletion leaves the other side blank.
export const alignedDiff = (left: string, right: string): DiffRow[] => {
  const parts = diffLines(left, right);
  const rows: DiffRow[] = [];

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const next = parts[index + 1];

    if (!part.added && !part.removed) {
      for (const line of lines(part.value)) {
        rows.push({ left: line, right: line, state: "same" });
      }

      continue;
    }

    if (part.removed && next?.added) {
      const before = lines(part.value);
      const after = lines(next.value);

      for (let row = 0; row < Math.max(before.length, after.length); row++) {
        rows.push({ left: before[row] ?? null, right: after[row] ?? null, state: "changed" });
      }

      index++;
      continue;
    }

    for (const line of lines(part.value)) {
      rows.push(part.removed ? { left: line, right: null, state: "changed" } : { left: null, right: line, state: "changed" });
    }
  }

  return rows;
};
