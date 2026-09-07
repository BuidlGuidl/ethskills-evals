// A marker in a table and the footnote under it say the same thing, so they are the same
// string: a tooltip that has drifted from its footnote is worse than no tooltip.

export const MIXED_RUBRICS =
  "This cell pools runs graded under different expect: lines, so it is a raw count rather than a measurement " +
  "under one rubric. Open the task to see which revision each run was graded on.";

export const CELLS_DIFFER =
  "The two counts on this row share no revision of the expect: lines, so they were graded by different rules and " +
  "are not a comparison.";

export const OLD_RUBRIC =
  "Graded on an earlier revision of the expect: lines, so these dots do not line up with the list above.";

export const RETRACTED =
  "This grade measured the harness rather than the model — the deliverable never reached the judge — so it is kept " +
  "for the record and left out of every count.";
