import { html, raw } from './html.js';
import { formatUsdc } from '../../domain/money.js';
import { summarize } from '../../domain/reputation.js';

export function layout({ title, member, balance, notices = [], flash, body, csrf }) {
  return raw(`<!doctype html>
${html`<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title ? `${title} · Toolshed` : 'Toolshed'}</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/">🔧 Toolshed</a>
      ${member
        ? html`<nav>
            <a href="/browse">Browse</a>
            <a href="/shed">My shed</a>
            <a href="/loans">My loans</a>
            <a href="/wallet">${formatUsdc(balance ?? 0n)} USDC</a>
            <a href="/members/${member.id}">${member.name}</a>
            <form method="post" action="/logout" class="inline">
              <input type="hidden" name="_csrf" value="${csrf}" />
              <button class="link" type="submit">Sign out</button>
            </form>
          </nav>`
        : html`<nav><a href="/login">Sign in</a> <a href="/signup">Join</a></nav>`}
    </header>
    <main>
      ${flash ? html`<p class="flash flash-${flash.kind}">${flash.message}</p>` : ''}
      ${notices.length > 0
        ? html`<section class="notices">
            <form method="post" action="/notices/read" class="inline right">
              <input type="hidden" name="_csrf" value="${csrf}" />
              <button class="link" type="submit">Mark all read</button>
            </form>
            <h2>What's new</h2>
            <ul>
              ${notices.map((notice) => html`<li>${notice.body}</li>`)}
            </ul>
          </section>`
        : ''}
      ${body}
    </main>
    <footer>
      <p>Toolshed · lend your neighbours your things · deposits held in USDC</p>
    </footer>
  </body>
</html>`}`);
}

/** The track-record badge that appears next to a member's name everywhere. */
export function recordBadge(record) {
  if (!record) return html``;
  const tone = record.isNew ? 'new' : record.lateLoans === 0 ? 'good' : record.score >= 85 ? 'ok' : 'poor';
  return html`<span class="badge badge-${tone}" title="Reliability score ${record.score}">${summarize(record)}</span>`;
}

export function money(micros) {
  return html`<span class="money">${formatUsdc(micros)} USDC</span>`;
}

export function photo(tool, className = 'thumb') {
  return tool.photo
    ? html`<img class="${className}" src="/photos/${tool.photo}" alt="${tool.name}" loading="lazy" />`
    : html`<div class="${className} nophoto" aria-hidden="true">🛠</div>`;
}
