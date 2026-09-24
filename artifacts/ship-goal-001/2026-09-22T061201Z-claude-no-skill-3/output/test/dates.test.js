import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, isDay, today } from '../src/domain/dates.js';

test('a day is a calendar day in the association timezone', () => {
  // 03:30 UTC on the 23rd is still the evening of the 22nd in New York, and a
  // tool due "the 22nd" is not late yet.
  const instant = new Date('2026-09-23T03:30:00Z');
  assert.equal(today('America/New_York', instant), '2026-09-22');
  assert.equal(today('UTC', instant), '2026-09-23');
});

test('counts whole days across a daylight-saving change', () => {
  // US clocks go forward on 2026-03-08; the loan is still 7 days long.
  assert.equal(daysBetween('2026-03-05', '2026-03-12'), 7);
  assert.equal(addDays('2026-03-05', 7), '2026-03-12');
});

test('counts across month and year ends', () => {
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2); // leap year
  assert.equal(daysBetween('2026-09-22', '2026-09-20'), -2);
});

test('rejects dates that are not real days', () => {
  assert.ok(isDay('2026-02-28'));
  assert.equal(isDay('2026-02-30'), false);
  assert.equal(isDay('2026-13-01'), false);
  assert.equal(isDay('22/09/2026'), false);
  assert.equal(isDay(''), false);
});
