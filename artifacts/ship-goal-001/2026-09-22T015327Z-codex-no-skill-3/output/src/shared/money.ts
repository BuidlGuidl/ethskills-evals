export const MICRO_USDC = 1_000_000;

export function parseUsdc(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("USDC amounts must be positive numbers with up to 6 decimals.");
  }

  const [whole, fractional = ""] = trimmed.split(".");
  return Number(whole) * MICRO_USDC + Number(fractional.padEnd(6, "0"));
}

export function formatUsdc(microUsdc: number): string {
  const sign = microUsdc < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(microUsdc));
  const whole = Math.floor(absolute / MICRO_USDC);
  const fractional = String(absolute % MICRO_USDC).padStart(6, "0").replace(/0+$/, "");
  return `${sign}${whole}${fractional ? `.${fractional}` : ""}`;
}

export function formatUsdcFixed(microUsdc: number): string {
  return Number(formatUsdc(microUsdc)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
