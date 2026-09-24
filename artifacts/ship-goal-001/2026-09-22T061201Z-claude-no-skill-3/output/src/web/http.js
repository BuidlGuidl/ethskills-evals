import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export const SESSION_COOKIE = 'toolshed_session';

export function parseCookies(header = '') {
  const jar = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return jar;
}

export function cookieHeader(name, value, { maxAgeSeconds, expires } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (config.secureCookies) parts.push('Secure');
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}

/** Append a cookie without clobbering ones already set on this response. */
export function addCookie(response, cookie) {
  const existing = response.getHeader('set-cookie');
  const cookies = existing == null ? [] : Array.isArray(existing) ? existing : [existing];
  response.setHeader('set-cookie', [...cookies, cookie]);
}

/** Read a request body with a hard ceiling, so one bad request cannot eat the box. */
export async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('That upload is too large.');
      error.status = 413;
      error.expected = true;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function parseForm(buffer) {
  const fields = {};
  for (const [key, value] of new URLSearchParams(buffer.toString('utf8'))) {
    fields[key] = value;
  }
  return fields;
}

// --- CSRF -----------------------------------------------------------------
//
// Cookies are SameSite=Lax, which already blocks cross-site form posts in
// current browsers. The token is the second lock: it is derived from the
// session id, so it costs no storage and is worthless without the cookie.

export function csrfToken(sessionId) {
  return createHmac('sha256', config.sessionSecret).update(String(sessionId ?? 'anonymous')).digest('base64url');
}

export function checkCsrf(sessionId, submitted) {
  const expected = Buffer.from(csrfToken(sessionId));
  const given = Buffer.from(String(submitted ?? ''));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expected = true;
  }
}

export function notFound(message = 'We could not find that page.') {
  return new HttpError(404, message);
}
