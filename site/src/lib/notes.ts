// A marker in a table and the footnote under it say the same thing, so they are the same
// string: a tooltip that has drifted from its footnote is worse than no tooltip.

export const RUBRIC_MOVED =
  "The task's expect: lines were rewritten between these two versions, so the two cells were graded by different " +
  "rules and are not a comparison — read them per column. The row is left out of the totals.";

export const UNAIDED_OFF_RUBRIC =
  "No unaided run of this task was graded on the expect: lines the skilled column was, so this cell pools every " +
  "unaided run there is. It faces neither skilled cell, and the row is left out of the totals.";

export const MIXED_RUBRICS =
  "This cell pools runs graded under different expect: lines, so it is a raw count rather than a measurement " +
  "under one rubric. Open the task to see which revision each run was graded on.";

export const CELLS_DIFFER =
  "The two counts on this row share no revision of the expect: lines, so they were graded by different rules and " +
  "are not a comparison.";

export const RETIRED_ROW =
  "This task is retired: it is not run again, so a version measured after that has no cell here. The row shows what " +
  "was scored while it was live and is left out of the totals.";

export const PARTIAL_COVERAGE =
  "The totals cover only the tasks where every cell reads against the others: both versions ran it, under the same " +
  "expect: lines. Every row is still shown above, and the ones left out are marked.";

export const NO_SHARED_TASKS =
  "These two versions were never run on the same task — the newer one was benchmarked on work the older one never " +
  "saw. Each total is that version's own, and the two are not a before and after.";

export const NO_COMPARABLE_ROWS =
  "The two versions share tasks, but every shared task had its expect: lines rewritten between them, so no row is " +
  "a comparison. Each total is that version's own.";

export const OLD_RUBRIC =
  "Graded on an earlier revision of the expect: lines, so these dots do not line up with the list above.";

export const RETRACTED =
  "This grade measured the harness rather than the model — the deliverable never reached the judge — so it is kept " +
  "for the record and left out of every count.";
