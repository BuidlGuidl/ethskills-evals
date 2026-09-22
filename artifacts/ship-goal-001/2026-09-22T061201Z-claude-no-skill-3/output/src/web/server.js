import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { today as todayIn } from '../domain/dates.js';
import { sessionMember } from '../services/members.js';
import { unreadFor } from '../services/notices.js';
import { availableBalance } from '../payments/escrow.js';
import { buildRouter } from './routes.js';
import { layout } from './views/layout.js';
import { raw } from './views/html.js';
import {
  SESSION_COOKIE,
  addCookie,
  cookieHeader,
  checkCsrf,
  csrfToken,
  parseCookies,
  parseForm,
  readBody,
  HttpError,
} from './http.js';
import { parseMultipart } from './multipart.js';
import { readPhoto } from './photos.js';

const FLASH_COOKIE = 'toolshed_flash';
const MAX_FORM_BYTES = 64 * 1024;

export function createApp({ handle, escrow }) {
  const router = buildRouter();

  return async function handleRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    try {
      if (await serveStatic(url, response)) return;

      const cookies = parseCookies(request.headers.cookie);
      const member = sessionMember(handle, cookies[SESSION_COOKIE]);
      const match = router.match(request.method, url.pathname);
      if (!match) throw new HttpError(404, 'We could not find that page.');
      if (match.methodNotAllowed) throw new HttpError(405, 'That is not something you can do here.');

      const ctx = {
        request,
        response,
        url,
        handle,
        escrow,
        member,
        params: match.params,
        query: Object.fromEntries(url.searchParams),
        fields: {},
        files: {},
        csrf: csrfToken(member?.session_id),
        today: todayIn(config.timezone),
        flash: readFlash(request, response),
        redirect: (location, flash) => redirect(response, location, flash),
        render: (body, options = {}) => renderPage(ctx, body, options),
      };

      if (request.method === 'POST') {
        await readRequestBody(request, ctx);
        if (!checkCsrf(member?.session_id, ctx.fields._csrf)) {
          throw new HttpError(403, 'That form expired. Please try again.');
        }
      }

      await match.handler(ctx);
    } catch (error) {
      respondToError(error, { handle, request, response, url });
    }
  };
}

async function readRequestBody(request, ctx) {
  const contentType = request.headers['content-type'] ?? '';
  if (contentType.startsWith('multipart/form-data')) {
    const body = await readBody(request, config.maxPhotoBytes + MAX_FORM_BYTES);
    const parsed = parseMultipart(body, contentType);
    ctx.fields = parsed.fields;
    ctx.files = parsed.files;
  } else {
    ctx.fields = parseForm(await readBody(request, MAX_FORM_BYTES));
  }
}

function renderPage(ctx, body, { title, status = 200 } = {}) {
  const page = layout({
    title,
    member: ctx.member,
    balance: ctx.member ? availableBalance(ctx.handle, ctx.member.id) : 0n,
    notices: ctx.member ? unreadFor(ctx.handle, ctx.member.id) : [],
    flash: ctx.flash,
    csrf: ctx.csrf,
    body,
  });
  ctx.response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'content-security-policy': "default-src 'self'; img-src 'self' data:; form-action 'self'",
  });
  ctx.response.end(String(page));
}

function redirect(response, location, flash) {
  // writeHead's headers win over anything set with setHeader, so cookies set
  // earlier in the request (a fresh session, a cleared flash) have to be
  // carried across by hand or signing in silently loses its cookie.
  if (flash) {
    addCookie(response, cookieHeader(FLASH_COOKIE, JSON.stringify(flash), { maxAgeSeconds: 10 }));
  }
  response.writeHead(303, { location });
  response.end();
}


function readFlash(request, response) {
  const cookies = parseCookies(request.headers.cookie);
  const value = cookies[FLASH_COOKIE];
  if (!value) return null;
  addCookie(response, cookieHeader(FLASH_COOKIE, '', { maxAgeSeconds: 0 }));
  try {
    const flash = JSON.parse(value);
    return flash && typeof flash.message === 'string' ? flash : null;
  } catch {
    return null;
  }
}

const STATIC_TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

async function serveStatic(url, response) {
  if (url.pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return true;
  }
  if (url.pathname.startsWith('/assets/')) {
    const name = path.basename(url.pathname);
    const file = path.join(config.root, 'public', name);
    if (!fs.existsSync(file)) return false;
    response.writeHead(200, {
      'content-type': STATIC_TYPES[path.extname(name)] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
    });
    response.end(fs.readFileSync(file));
    return true;
  }
  if (url.pathname.startsWith('/photos/')) {
    const photo = readPhoto(path.basename(url.pathname));
    if (!photo) return false;
    response.writeHead(200, {
      'content-type': photo.type,
      'cache-control': 'public, max-age=31536000, immutable',
    });
    response.end(photo.body);
    return true;
  }
  return false;
}

function respondToError(error, { request, response, url }) {
  const status = error.status ?? (error.expected ? 400 : 500);
  if (status >= 500) console.error(`${request.method} ${url.pathname} failed`, error);
  const message = error.expected || status < 500 ? error.message : 'Something went wrong on our end.';
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(
    String(
      layout({
        title: 'Sorry',
        body: raw(`<h1>${status}</h1><p class="flash flash-error">${escape(message)}</p><p><a href="/">Back to Toolshed</a></p>`),
      }),
    ),
  );
}

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function startServer({ handle, escrow, port = config.port }) {
  const server = http.createServer(createApp({ handle, escrow }));
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Set PORT to something else.`));
      } else {
        reject(error);
      }
    });
    server.listen(port, () => resolve(server));
  });
}
