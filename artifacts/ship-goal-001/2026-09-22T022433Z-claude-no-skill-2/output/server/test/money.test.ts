import { describe, expect, it } from 'vitest';
import { formatUsdc, parseUsdcAmount, usdcToMicros } from '../src/lib/money.js';

describe('USDC amounts', () => {
  it('parses whole and fractional amounts to micros', () => {
    expect(parseUsdcAmount('25')).toBe(25_000_000);
    expect(parseUsdcAmount('25.5')).toBe(25_500_000);
    expect(parseUsdcAmount('0.000001')).toBe(1);
    expect(parseUsdcAmount(12.25)).toBe(12_250_000);
  });

  it('rejects amounts it cannot represent exactly', () => {
    expect(() => parseUsdcAmount('25.0000001')).toThrow();
    expect(() => parseUsdcAmount('-5')).toThrow();
    expect(() => parseUsdcAmount('abc')).toThrow();
    expect(() => parseUsdcAmount('')).toThrow();
  });

  it('formats micros with at least two decimals', () => {
    expect(formatUsdc(25_000_000)).toBe('25.00');
    expect(formatUsdc(25_500_000)).toBe('25.50');
    expect(formatUsdc(1)).toBe('0.000001');
    expect(formatUsdc(0)).toBe('0.00');
    expect(formatUsdc(-2_500_000)).toBe('-2.50');
  });

  it('round-trips through micros', () => {
    for (const value of ['0.00', '1.00', '7.35', '199.99', '0.000001']) {
      expect(formatUsdc(parseUsdcAmount(value))).toBe(value === '0.000001' ? '0.000001' : value);
    }
    expect(usdcToMicros(3.3)).toBe(3_300_000);
  });
});
