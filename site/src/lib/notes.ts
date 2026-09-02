// A marker in a table and the footnote under it say the same thing, so they are the same
// string: a tooltip that has drifted from its footnote is worse than no tooltip.

export const RUBRIC_MOVED =
  "The task's expect: lines were rewritten between these two runs, so the two cells were graded by different rules " +
  "and are not a comparison — read them per column. The unaided cell on this row is the one graded on the newer " +
  "version's expect lines, so it faces the new skill and not the old one.";

export const PARTIAL_COVERAGE =
  "The two versions were not run on all the same tasks, so the totals cover only the ones they share. Every row is " +
  "still shown above.";

export const NO_SHARED_TASKS =
  "These two versions were never run on the same task — the newer one was benchmarked on work the older one never " +
  "saw. Each total is that version's own, and the two are not a before and after.";
