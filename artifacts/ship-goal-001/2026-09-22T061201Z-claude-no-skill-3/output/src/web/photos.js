import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { sniffImage } from './multipart.js';
import { ValidationError } from '../services/members.js';

// Photos land on disk, named by the hash of their bytes, and the database
// stores only the file name. Two members photographing the same borrowed
// drill store one file, re-uploads are idempotent, and nothing a member typed
// ever becomes a path.

export function savePhoto(file) {
  if (!file || file.data.length === 0) return '';
  if (file.data.length > config.maxPhotoBytes) {
    throw new ValidationError(`That photo is larger than ${Math.round(config.maxPhotoBytes / 1024 / 1024)} MB.`);
  }
  const signature = sniffImage(file.data);
  if (!signature) throw new ValidationError('Photos need to be a JPEG, PNG or WebP.');

  const name = `${createHash('sha256').update(file.data).digest('hex').slice(0, 32)}.${signature.extension}`;
  fs.mkdirSync(config.uploadsPath, { recursive: true });
  const target = path.join(config.uploadsPath, name);
  if (!fs.existsSync(target)) fs.writeFileSync(target, file.data);
  return name;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export function readPhoto(name) {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(String(name))) return null;
  const target = path.join(config.uploadsPath, name);
  if (!fs.existsSync(target)) return null;
  return { body: fs.readFileSync(target), type: MIME[name.split('.').pop()] };
}
