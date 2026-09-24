import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUsdc, parseUsdc } from '../src/domain/money.js';

test('parses whole and fractional USDC to micro units', () => {
  assert.equal(parseUsdc('1'), 1_000_000n);
  assert.equal(parseUsdc('0.50'), 500_000n);
  assert.equal(parseUsdc('12.345678'), 12_345_678n);
  assert.equal(parseUsdc(' 7 '), 7_000_000n);
});

test('rejects amounts that are not money', () => {
  for (const bad of ['', 'abc', '1.2345678', '-5', '1e6', '.5', null]) {
    assert.throws(() => parseUsdc(bad), /valid USDC/, `expected ${JSON.stringify(bad)} to be rejected`);
  }
});

test('formats with at least two decimals and no float drift', () => {
  assert.equal(formatUsdc(0n), '0.00');
  assert.equal(formatUsdc(1_000_000n), '1.00');
  assert.equal(formatUsdc(1_500_000n), '1.50');
  assert.equal(formatUsdc(1n), '0.000001');
  assert.equal(formatUsdc(parseUsdc('0.1') + parseUsdc('0.2')), '0.30');
});

test('round-trips through format and parse', () => {
  for (const value of ['0.01', '3.50', '999999.999999']) {
    assert.equal(formatUsdc(parseUsdc(value)), value.replace(/^0+(?=\d)/, ''));
  }
});
