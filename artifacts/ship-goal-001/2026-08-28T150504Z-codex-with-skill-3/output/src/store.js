import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(file) { this.file = file; this.data = { members: [], tools: [], requests: [] }; this.queue = Promise.resolve(); }
  async load() {
    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
  }
  async save() {
    await mkdir(dirname(this.file), { recursive: true });
    this.queue = this.queue.then(() => writeFile(this.file, JSON.stringify(this.data, null, 2)));
    return this.queue;
  }
  id() { return randomUUID(); }
}

export function reliability(member, requests) {
  const completed = requests.filter(r => r.borrowerId === member.id && r.status === 'returned');
  const late = completed.filter(r => r.lateDays > 0).length;
  return { loans: completed.length, late, score: completed.length ? Math.round(100 * (completed.length - late) / completed.length) : null };
}
