import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fixture } from './helpers.js';
import { createApp } from '../src/web/server.js';
import { config } from '../src/config.js';
import { parseMultipart, sniffImage, boundaryOf } from '../src/web/multipart.js';
import { Router } from '../src/web/router.js';
import { html, escapeHtml, raw } from '../src/web/views/html.js';
import { csrfToken, checkCsrf, parseCookies } from '../src/web/http.js';

// --- units ----------------------------------------------------------------

test('templates escape anything a member typed', () => {
  const nasty = '<script>alert("x")</script>';
  assert.equal(
    String(html`<h1>${nasty}</h1>`),
    '<h1>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</h1>',
  );
  assert.equal(String(html`${raw('<b>ok</b>')}`), '<b>ok</b>', 'explicitly trusted html passes through');
  assert.equal(String(html`${html`<i>${'&'}</i>`}`), '<i>&amp;</i>', 'nested templates are not double-escaped');
  assert.equal(String(html`${[1, 2]}`), '12');
  assert.equal(String(html`${null}${undefined}${false}`), '');
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('csrf tokens are per session and constant-time compared', () => {
  const token = csrfToken('session-a');
  assert.ok(checkCsrf('session-a', token));
  assert.equal(checkCsrf('session-b', token), false);
  assert.equal(checkCsrf('session-a', ''), false);
  assert.equal(checkCsrf('session-a', `${token}x`), false);
});

test('cookies are parsed back out of a header', () => {
  const jar = parseCookies('toolshed_session=abc%3D; other=1');
  assert.equal(jar.toolshed_session, 'abc=');
  assert.equal(jar.other, '1');
});

test('the router matches paths, captures params and rejects wrong methods', () => {
  const router = new Router();
  router.get('/tools/:id', () => 'show');
  router.post('/tools/:id/request', () => 'request');
  assert.equal(router.match('GET', '/tools/12').params.id, '12');
  assert.ok(router.match('GET', '/tools/12/request').methodNotAllowed, 'a known path with the wrong verb is a 405');
  assert.ok(router.match('POST', '/tools/12').methodNotAllowed);
  assert.equal(router.match('GET', '/nope'), null);
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 7)]);

test('multipart bodies yield fields and files', () => {
  const boundary = '----toolshed';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nCordless drill\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="drill.png"\r\nContent-Type: image/png\r\n\r\n`),
    PNG,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const parsed = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
  assert.equal(parsed.fields.name, 'Cordless drill');
  assert.equal(parsed.files.photo.filename, 'drill.png');
  assert.ok(parsed.files.photo.data.equals(PNG), 'file bytes survive exactly');
});

test('an empty file part is not treated as an upload', () => {
  const boundary = 'b';
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename=""\r\nContent-Type: application/octet-stream\r\n\r\n\r\n--${boundary}--\r\n`,
  );
  assert.deepEqual(parseMultipart(body, `multipart/form-data; boundary=${boundary}`).files, {});
});

test('image sniffing trusts bytes, not the browser', () => {
  assert.equal(sniffImage(PNG).extension, 'png');
  assert.equal(sniffImage(Buffer.from('#!/bin/sh\necho hi\n#padding')), null);
  assert.equal(sniffImage(Buffer.alloc(4)), null);
  assert.equal(boundaryOf('multipart/form-data; boundary="xyz"'), 'xyz');
});

// --- end to end -----------------------------------------------------------

async function withServer(run) {
  const { handle, escrow, members } = fixture({ members: ['Ada', 'Ben'] });
  const server = http.createServer(createApp({ handle, escrow }));
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ base, handle, escrow, members, client: makeClient(base) });
  } finally {
    server.close();
    handle.close();
  }
}

/** Minimal browser: keeps cookies, does not follow redirects. */
function makeClient(base) {
  const jar = new Map();
  return {
    async request(path, { method = 'GET', form } = {}) {
      const headers = {};
      if (jar.size > 0) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
      const response = await fetch(base + path, {
        method,
        headers,
        redirect: 'manual',
        body: form ? new URLSearchParams(form).toString() : undefined,
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(';');
        const [name, value] = pair.split('=');
        if (value === '') jar.delete(name);
        else jar.set(name, value);
      }
      const body = await response.text();
      return { status: response.status, location: response.headers.get('location'), body };
    },
    async csrf(path = '/') {
      const { body } = await this.request(path);
      return /name="_csrf" value="([^"]+)"/.exec(body)?.[1];
    },
  };
}

test('signing in, listing a tool, borrowing it and settling it late', async () => {
  await withServer(async ({ client, handle, members }) => {
    const [ada, ben] = members;

    // Ben signs in.
    const loginCsrf = await client.csrf('/login');
    const signIn = await client.request('/login', {
      method: 'POST',
      form: { _csrf: loginCsrf, email: ben.email, password: 'password-1234' },
    });
    assert.equal(signIn.status, 303);

    // Ada lists a drill directly (the form path is covered by the tool tests).
    const drill = handle
      .prepare(
        `INSERT INTO tools (owner_id, name, description, condition_notes, photo, deposit_amount,
                            daily_late_fee, max_days, status, created_at)
         VALUES (?, 'Cordless drill', '', 'Chuck sticks', '', '60000000', '3000000', 7, 'listed', '2026-01-01')`,
      )
      .run(ada.id);
    const toolId = Number(drill.lastInsertRowid);

    const browse = await client.request('/browse');
    assert.match(browse.body, /Cordless drill/);

    const today = new Date().toISOString().slice(0, 10);
    const requestCsrf = await client.csrf(`/tools/${toolId}`);
    const asked = await client.request(`/tools/${toolId}/request`, {
      method: 'POST',
      form: { _csrf: requestCsrf, startDay: today, dueDay: today, note: 'Shelves' },
    });
    assert.equal(asked.status, 303);
    const loanId = Number(asked.location.split('/').pop());
    assert.equal(handle.prepare('SELECT status FROM loans WHERE id = ?').get(loanId).status, 'requested');

    // Ben cannot approve his own request.
    const selfApprove = await client.request(`/loans/${loanId}/approve`, {
      method: 'POST',
      form: { _csrf: await client.csrf('/') },
    });
    assert.equal(selfApprove.status, 303);
    assert.equal(handle.prepare('SELECT status FROM loans WHERE id = ?').get(loanId).status, 'requested');

    // Ada signs in on the same client and approves.
    await client.request('/logout', { method: 'POST', form: { _csrf: await client.csrf('/') } });
    await client.request('/login', {
      method: 'POST',
      form: { _csrf: await client.csrf('/login'), email: ada.email, password: 'password-1234' },
    });
    const dashboard = await client.request('/');
    assert.match(dashboard.body, /Asking to borrow from you/);
    assert.match(dashboard.body, /New member/, 'Ben has no track record yet');

    const approved = await client.request(`/loans/${loanId}/approve`, {
      method: 'POST',
      form: { _csrf: await client.csrf('/') },
    });
    assert.equal(approved.status, 303);
    assert.equal(handle.prepare('SELECT status FROM loans WHERE id = ?').get(loanId).status, 'active');

    // She confirms it back two days late.
    const returnedDay = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const closed = await client.request(`/loans/${loanId}/return`, {
      method: 'POST',
      form: { _csrf: await client.csrf('/'), returnedDay },
    });
    assert.equal(closed.status, 303, 'a future return date is refused');
    const loan = handle.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
    assert.equal(loan.status, 'active', 'still out -- the date was in the future');

    const settled = await client.request(`/loans/${loanId}/return`, {
      method: 'POST',
      form: { _csrf: await client.csrf('/'), returnedDay: today },
    });
    assert.equal(settled.status, 303);
    const finished = handle.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
    assert.equal(finished.status, 'closed');
    assert.equal(finished.late_days, 0);
  });
});

test('signed-out visitors are sent to sign in, not shown the shed', async () => {
  await withServer(async ({ client }) => {
    for (const path of ['/', '/browse', '/wallet', '/tools/new']) {
      const response = await client.request(path);
      assert.equal(response.status, 303, path);
      assert.match(response.location, /^\/login/, path);
    }
  });
});

test('a form post without the csrf token is rejected', async () => {
  await withServer(async ({ client, members }) => {
    await client.request('/login', {
      method: 'POST',
      form: { _csrf: await client.csrf('/login'), email: members[0].email, password: 'password-1234' },
    });
    const response = await client.request('/tools', { method: 'POST', form: { name: 'Sneaky' } });
    assert.equal(response.status, 403);
    assert.match(response.body, /expired/);
  });
});

test('signing up needs the association invite code', async () => {
  await withServer(async ({ client, handle }) => {
    const before = handle.prepare('SELECT COUNT(*) AS n FROM members').get().n;
    const rejected = await client.request('/signup', {
      method: 'POST',
      form: {
        _csrf: await client.csrf('/signup'),
        name: 'Interloper',
        email: 'nope@example.org',
        password: 'password-1234',
        inviteCode: 'wrong',
      },
    });
    assert.equal(rejected.status, 303);
    assert.equal(handle.prepare('SELECT COUNT(*) AS n FROM members').get().n, before);

    const accepted = await client.request('/signup', {
      method: 'POST',
      form: {
        _csrf: await client.csrf('/signup'),
        name: 'Newcomer',
        email: 'new@example.org',
        password: 'password-1234',
        inviteCode: config.inviteCode,
      },
    });
    assert.equal(accepted.location, '/browse');
    assert.equal(handle.prepare('SELECT COUNT(*) AS n FROM members').get().n, before + 1);
  });
});

test('one member cannot read another member"s loan', async () => {
  await withServer(async ({ client, handle, members }) => {
    const [ada, ben] = members;
    const other = handle
      .prepare(
        `INSERT INTO members (email, name, password_hash, created_at)
         VALUES ('c@example.org', 'Cara', 'scrypt$1$00$00', '2026-01-01')`,
      )
      .run();
    const drill = handle
      .prepare(
        `INSERT INTO tools (owner_id, name, deposit_amount, daily_late_fee, created_at)
         VALUES (?, 'Saw', '0', '0', '2026-01-01')`,
      )
      .run(ada.id);
    const loan = handle
      .prepare(
        `INSERT INTO loans (tool_id, borrower_id, owner_id, status, start_day, due_day,
                            deposit_amount, daily_late_fee, requested_at)
         VALUES (?, ?, ?, 'active', '2026-01-01', '2026-01-03', '0', '0', '2026-01-01')`,
      )
      .run(Number(drill.lastInsertRowid), Number(other.lastInsertRowid), ada.id);

    await client.request('/login', {
      method: 'POST',
      form: { _csrf: await client.csrf('/login'), email: ben.email, password: 'password-1234' },
    });
    const response = await client.request(`/loans/${Number(loan.lastInsertRowid)}`);
    assert.equal(response.status, 404);
  });
});
