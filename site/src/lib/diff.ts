import { createTwoFilesPatch } from "diff";

// @pierre/diffs renders a unified patch, which is also the shape git speaks, so the two
// versions of a SKILL.md become one before they reach the component. The names carry the
// version ids: the library shows them in its own header, which we leave off, but they end up
// in the patch text a reader may copy out.
export const patchBetween = (before: { sha: string; text: string }, after: { sha: string; text: string }) =>
  createTwoFilesPatch(`SKILL.md @ ${before.sha}`, `SKILL.md @ ${after.sha}`, before.text, after.text, "", "", {
    context: 3,
  });
