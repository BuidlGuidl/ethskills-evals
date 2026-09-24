import { seedState } from "../domain/seed";
import type { ToolshedState } from "../domain/types";

const key = "toolshed:v1";

export function loadState(): ToolshedState {
  const stored = window.localStorage.getItem(key);
  if (!stored) return structuredClone(seedState);

  try {
    return JSON.parse(stored) as ToolshedState;
  } catch {
    return structuredClone(seedState);
  }
}

export function saveState(state: ToolshedState): void {
  window.localStorage.setItem(key, JSON.stringify(state));
}

export function resetState(): ToolshedState {
  const fresh = structuredClone(seedState);
  saveState(fresh);
  return fresh;
}
