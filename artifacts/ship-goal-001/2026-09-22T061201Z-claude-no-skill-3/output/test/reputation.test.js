import test from 'node:test';
import assert from 'node:assert/strict';
import { reliability, summarize } from '../src/domain/reputation.js';

const record = (completedLoans, lateLoans = 0, lateDays = 0) =>
  reliability({ completedLoans, lateLoans, lateDays });

test('a spotless record beats a spotty one', () => {
  assert.ok(record(10, 0).score > record(10, 3, 9).score);
});

test('volume breaks ties between equally reliable members', () => {
  assert.ok(record(20, 0).score > record(2, 0).score);
});

test('one lucky loan does not outrank a long clean history', () => {
  assert.ok(record(1, 0).score < record(30, 1, 2).score);
});

test('a new member lands between the reliable and the unreliable', () => {
  const newcomer = record(0);
  assert.ok(newcomer.isNew);
  assert.ok(newcomer.score < record(12, 0).score, 'below a proven member');
  assert.ok(newcomer.score > record(6, 4, 30).score, 'above a repeatedly late one');
});

test('being very late is worse than being a little late', () => {
  assert.ok(record(10, 2, 4).score > record(10, 2, 60).score);
});

test('on-time rate is reported raw, not smoothed', () => {
  assert.equal(record(4, 1).onTimeRate, 0.75);
  assert.equal(record(0).onTimeRate, null);
});

test('inconsistent counts cannot push a score out of range', () => {
  const nonsense = reliability({ completedLoans: 2, lateLoans: 99, lateDays: 500 });
  assert.ok(nonsense.score >= 0);
  assert.ok(nonsense.score <= record(2, 0).score);
});

test('summaries read like something a neighbour would say', () => {
  assert.equal(summarize({ completedLoans: 0 }), 'New member');
  assert.equal(summarize({ completedLoans: 1, lateLoans: 0 }), '1 loan, all on time');
  assert.equal(summarize({ completedLoans: 9, lateLoans: 2 }), '9 loans, 2 late');
});
