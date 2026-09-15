export type Arm = "none" | "old" | "new";

export const ARM_LABELS = { none: "No skill", old: "Old skill", new: "New skill" };
export const ARMS: Arm[] = ["none", "old", "new"];
export const ARM_COLUMNS = { none: "noSkill", old: "before", new: "after" } as const;

export const percent = (passed: number, total: number) => total === 0 ? 0 : Math.round(100 * passed / total);
export const rateBucket = (percentage: number) =>
  percentage < 50 ? "low" : percentage < 100 ? "mid" : "high";

export const readArm = (params: URLSearchParams): Arm => {
  const arm = params.get("arm");
  return arm === "none" || arm === "old" ? arm : "new";
};

export const writeArm = (params: URLSearchParams, arm: Arm) => {
  const next = new URLSearchParams(params);
  next.set("arm", arm);
  return next;
};
