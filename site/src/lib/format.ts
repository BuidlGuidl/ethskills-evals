export const tokens = (value: number | null) => value === null ? "—" : value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value));
export const duration = (value: number | null) => {
  if (value === null)
    return "—";
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};
export const cost = (value: number | null) => value === null ? "—" : `$${value.toFixed(2)}`;
