import { openDb, type Db } from '../src/db/index.js';
import { createApp } from '../src/http/app.js';
import { MockPaymentProvider } from '../src/payments/index.js';
import type { PhotoStore, StoredPhoto } from '../src/lib/photos.js';
import { createMember } from '../src/domain/members.js';
import { createTool } from '../src/domain/tools.js';
import { topUp } from '../src/domain/ledger.js';
import { usdcToMicros } from '../src/lib/money.js';
import { config } from '../src/config.js';
import { newId } from '../src/lib/ids.js';

/** Photo store that keeps bytes in a Map, so tests never touch the disk. */
export class MemoryPhotoStore implements PhotoStore {
  readonly files = new Map<string, Buffer>();

  async put(buffer: Buffer): Promise<StoredPhoto> {
    const key = `${newId('photo')}.jpg`;
    this.files.set(key, buffer);
    return { key, bytes: buffer.length, contentType: 'image/jpeg' };
  }

  resolve(key: string) {
    return { kind: 'url' as const, url: `memory://${key}` };
  }

  async delete(key: string) {
    this.files.delete(key);
  }
}

export function makeDb(): Db {
  return openDb(':memory:');
}

export function makeApp(db = makeDb()) {
  const photos = new MemoryPhotoStore();
  const app = createApp({ db, payments: new MockPaymentProvider(), photos });
  return { app, db, photos };
}

let counter = 0;

export function makeMember(db: Db, overrides: Partial<{ name: string; funds: number }> = {}) {
  counter += 1;
  const member = createMember(db, {
    email: `member${counter}@example.org`,
    password: 'a-long-enough-password',
    displayName: overrides.name ?? `Member ${counter}`,
    inviteCode: config.inviteCode,
  });
  const funds = overrides.funds ?? 1000;
  if (funds > 0) topUp(db, member.id, usdcToMicros(funds), `test-topup-${member.id}`);
  return member;
}

export function makeTool(
  db: Db,
  ownerId: string,
  overrides: Partial<{ deposit: number; lateFee: number; maxDays: number; name: string }> = {},
) {
  return createTool(db, {
    ownerId,
    name: overrides.name ?? 'Cordless drill',
    category: 'power-tools',
    conditionNotes: 'Works fine.',
    depositMicros: usdcToMicros(overrides.deposit ?? 100),
    lateFeeMicros: usdcToMicros(overrides.lateFee ?? 5),
    maxLoanDays: overrides.maxDays ?? 5,
  });
}

/** A one-pixel JPEG, for upload paths that sniff magic bytes. */
export const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDIzMv/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/T+iiigD/9k=',
  'base64',
);
