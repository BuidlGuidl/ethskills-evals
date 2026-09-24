import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixture, tool } from './helpers.js';
import { config } from '../src/config.js';
import { today as todayIn } from '../src/domain/dates.js';
import { parseUsdc } from '../src/domain/money.js';
import { getTool, listTool, setToolStatus, updateTool, validateToolInput } from '../src/services/tools.js';
import { approveLoan, requestLoan } from '../src/services/loans.js';
import { savePhoto } from '../src/web/photos.js';

const valid = { name: 'Drill', deposit: '60', dailyLateFee: '3', maxDays: 7 };

test('a listing needs a name, sane money and a sane length', () => {
  assert.throws(() => validateToolInput({ ...valid, name: 'x' }), /name your neighbours/);
  assert.throws(() => validateToolInput({ ...valid, deposit: 'free' }), /deposit must be an amount/);
  assert.throws(() => validateToolInput({ ...valid, dailyLateFee: '-2' }), /late fee must be an amount/);
  assert.throws(() => validateToolInput({ ...valid, maxDays: 0 }), /between 1 and 90/);
  assert.throws(() => validateToolInput({ ...valid, maxDays: 365 }), /between 1 and 90/);
});

test('a daily late fee larger than the deposit is refused', () => {
  // Otherwise the first late day quietly eats the whole deposit and the
  // "per day" promise on the listing is a lie.
  assert.throws(() => validateToolInput({ ...valid, deposit: '5', dailyLateFee: '10' }), /cannot be larger than the deposit/);
});

test('listing stores money as exact micro-USDC', () => {
  const { handle, members } = fixture();
  const listed = listTool(handle, members[0].id, { ...valid, deposit: '12.34', dailyLateFee: '0.5' });
  assert.equal(listed.depositAmount, parseUsdc('12.34'));
  assert.equal(listed.dailyLateFee, 500_000n);
});

test('only the owner can edit a tool', () => {
  const { handle, members } = fixture();
  const drill = tool(handle, members[0].id);
  assert.throws(() => updateTool(handle, drill.id, members[1].id, valid), /not your tool/);
  const updated = updateTool(handle, drill.id, members[0].id, { ...valid, name: 'Hammer drill' });
  assert.equal(updated.name, 'Hammer drill');
  assert.equal(updated.photo, '', 'no photo given, none invented');
});

test('a tool with an open loan cannot be taken out of the shed', () => {
  const { handle, escrow, members } = fixture({ members: ['Owner', 'Borrower'] });
  const [owner, borrower] = members;
  const drill = tool(handle, owner.id);
  const today = todayIn(config.timezone);
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: today });
  approveLoan(handle, escrow, loan.id, owner.id);

  assert.throws(() => setToolStatus(handle, drill.id, owner.id, 'retired'), /Settle the open/);
  assert.equal(getTool(handle, drill.id).status, 'listed');
});

test('photos are checked by their bytes and stored by content hash', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toolshed-'));
  const previous = config.uploadsPath;
  config.uploadsPath = directory;
  t.after(() => {
    config.uploadsPath = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 3)]);
  const name = savePhoto({ filename: 'drill.png', contentType: 'image/png', data: png });
  assert.match(name, /^[a-f0-9]{32}\.png$/);
  assert.equal(savePhoto({ filename: 'other.png', contentType: 'image/png', data: png }), name, 'same bytes, same file');
  assert.equal(fs.readdirSync(directory).length, 1);

  // A shell script wearing an image content type is still a shell script.
  assert.throws(
    () => savePhoto({ filename: 'x.png', contentType: 'image/png', data: Buffer.from('#!/bin/sh\nrm -rf /\n') }),
    /JPEG, PNG or WebP/,
  );
  assert.equal(savePhoto(null), '');
});

test('oversized photos are refused', (t) => {
  const previous = config.maxPhotoBytes;
  config.maxPhotoBytes = 16;
  t.after(() => {
    config.maxPhotoBytes = previous;
  });
  assert.throws(() => savePhoto({ filename: 'big.png', contentType: 'image/png', data: Buffer.alloc(64) }), /larger than/);
});
