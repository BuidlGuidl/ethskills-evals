import { html } from './html.js';
import { money, photo, recordBadge } from './layout.js';
import { formatDay, daysBetween } from '../../domain/dates.js';
import { formatUsdc } from '../../domain/money.js';
import { projectedSettlement } from '../../domain/fees.js';

const csrfField = (csrf) => html`<input type="hidden" name="_csrf" value="${csrf}" />`;

// --- auth -----------------------------------------------------------------

export function loginPage({ csrf, email = '', next = '/' }) {
  return html`
    <h1>Sign in</h1>
    <form method="post" action="/login" class="card form">
      ${csrfField(csrf)}
      <input type="hidden" name="next" value="${next}" />
      <label>Email <input type="email" name="email" value="${email}" required autofocus /></label>
      <label>Password <input type="password" name="password" required /></label>
      <button type="submit">Sign in</button>
    </form>
    <p>New here? <a href="/signup">Join with your association invite code</a>.</p>`;
}

export function signupPage({ csrf, values = {} }) {
  return html`
    <h1>Join Toolshed</h1>
    <p class="lede">Toolshed is for members of the association. You will need the invite code from your membership packet.</p>
    <form method="post" action="/signup" class="card form">
      ${csrfField(csrf)}
      <label>Name <input name="name" value="${values.name ?? ''}" required autofocus /></label>
      <label>Unit / address <input name="unit" value="${values.unit ?? ''}" placeholder="e.g. 14B" /></label>
      <label>Email <input type="email" name="email" value="${values.email ?? ''}" required /></label>
      <label>Password <input type="password" name="password" minlength="10" required />
        <small>At least 10 characters.</small></label>
      <label>USDC wallet (optional)
        <input name="walletAddress" value="${values.walletAddress ?? ''}" placeholder="0x…" />
        <small>Where withdrawals are sent. You can add it later.</small></label>
      <label>Invite code <input name="inviteCode" value="${values.inviteCode ?? ''}" required /></label>
      <button type="submit">Create account</button>
    </form>`;
}

// --- browse ---------------------------------------------------------------

export function browsePage({ tools, query, csrf }) {
  return html`
    <h1>Browse the shed</h1>
    <p class="lede">Sorted by track record: neighbours who return things on time show up first.</p>
    <form method="get" action="/browse" class="searchbar">
      <input name="q" value="${query ?? ''}" placeholder="Search tools" aria-label="Search tools" />
      <button type="submit">Search</button>
      ${query ? html`<a class="link" href="/browse">Clear</a>` : ''}
    </form>
    ${tools.length === 0
      ? html`<p class="empty">Nothing matches yet. <a href="/tools/new">List one of yours</a>?</p>`
      : html`<ul class="grid">
          ${tools.map(
            (tool) => html`<li class="card tool">
              <a href="/tools/${tool.id}">${photo(tool)}</a>
              <div class="tool-body">
                <h3><a href="/tools/${tool.id}">${tool.name}</a></h3>
                <p class="owner">
                  <a href="/members/${tool.owner_id}">${tool.owner_name}</a>
                  ${tool.owner_unit ? html`<span class="muted">· ${tool.owner_unit}</span>` : ''}
                  ${recordBadge(tool.ownerRecord)}
                </p>
                <p class="terms">${money(tool.depositAmount)} deposit · ${formatUsdc(tool.dailyLateFee)}/day late · up to ${tool.max_days} days</p>
                ${tool.out_now > 0 ? html`<p class="muted">Out on loan right now</p>` : ''}
              </div>
            </li>`,
          )}
        </ul>`}`;
}

// --- a single tool --------------------------------------------------------

export function toolPage({ tool, ownerRecord, viewer, csrf, today, defaults, history, upcoming }) {
  const isOwner = viewer.id === tool.owner_id;
  return html`
    <article class="card detail">
      ${photo(tool, 'hero')}
      <div>
        <h1>${tool.name}</h1>
        <p class="owner">
          Lent by <a href="/members/${tool.owner_id}">${tool.owner_name}</a>
          ${tool.owner_unit ? html`<span class="muted">· ${tool.owner_unit}</span>` : ''}
          ${recordBadge(ownerRecord)}
        </p>
        ${tool.description ? html`<p>${tool.description}</p>` : ''}
        ${tool.condition_notes
          ? html`<div class="condition"><h3>Condition</h3><p>${tool.condition_notes}</p></div>`
          : ''}
        <dl class="terms-list">
          <dt>Deposit</dt><dd>${money(tool.depositAmount)}, held while you have it</dd>
          <dt>Late fee</dt><dd>${money(tool.dailyLateFee)} per day, taken from the deposit and paid to ${tool.owner_name}</dd>
          <dt>Longest loan</dt><dd>${tool.max_days} days</dd>
        </dl>
        ${upcoming.length > 0
          ? html`<p class="muted">Already promised: ${upcoming.map((loan) => html`<span>${formatDay(loan.start_day)}–${formatDay(loan.due_day)}</span> `)}</p>`
          : ''}
      </div>
    </article>

    ${isOwner
      ? html`<div class="rowactions">
          <a class="button" href="/tools/${tool.id}/edit">Edit</a>
          <form method="post" action="/tools/${tool.id}/status" class="inline">
            ${csrfField(csrf)}
            <input type="hidden" name="status" value="${tool.status === 'listed' ? 'retired' : 'listed'}" />
            <button type="submit">${tool.status === 'listed' ? 'Take out of the shed' : 'Put back in the shed'}</button>
          </form>
        </div>`
      : html`<section class="card form">
          <h2>Ask to borrow it</h2>
          <form method="post" action="/tools/${tool.id}/request">
            ${csrfField(csrf)}
            <div class="dates">
              <label>From <input type="date" name="startDay" value="${defaults.startDay}" min="${today}" required /></label>
              <label>Back by <input type="date" name="dueDay" value="${defaults.dueDay}" min="${today}" required /></label>
            </div>
            <label>Note to ${tool.owner_name} <textarea name="note" rows="2" placeholder="What you need it for, when you can pick it up"></textarea></label>
            <p class="muted">
              ${money(tool.depositAmount)} moves into escrow as soon as you ask, and comes back when
              ${tool.owner_name} confirms the ${tool.name} is home. Every day past the return date costs
              ${money(tool.dailyLateFee)} out of that deposit.
            </p>
            <button type="submit">Request</button>
          </form>
        </section>`}

    ${history.length > 0
      ? html`<section>
          <h2>History</h2>
          <ul class="loanlist">
            ${history.map(
              (loan) => html`<li>
                ${formatDay(loan.start_day)} – ${formatDay(loan.due_day)} ·
                <a href="/members/${loan.borrower_id}">${loan.borrower_name}</a> ·
                ${loan.status === 'closed'
                  ? loan.late_days > 0
                    ? html`<span class="late">${loan.late_days} day${loan.late_days === 1 ? '' : 's'} late, ${money(loan.feeCharged)} fee</span>`
                    : html`<span class="ontime">on time</span>`
                  : html`<span class="muted">${loan.status}</span>`}
              </li>`,
            )}
          </ul>
        </section>`
      : ''}`;
}

export function toolFormPage({ csrf, tool = null, values = {} }) {
  const editing = Boolean(tool);
  return html`
    <h1>${editing ? `Edit ${tool.name}` : 'List a tool'}</h1>
    <form method="post" action="${editing ? `/tools/${tool.id}` : '/tools'}" enctype="multipart/form-data" class="card form">
      ${csrfField(csrf)}
      <label>What is it? <input name="name" value="${values.name ?? ''}" required autofocus placeholder="Cordless drill, 18V" /></label>
      <label>Description <textarea name="description" rows="3" placeholder="Make, model, what comes with it">${values.description ?? ''}</textarea></label>
      <label>Condition notes
        <textarea name="conditionNotes" rows="3" placeholder="Chuck sticks a bit. Second battery holds less charge.">${values.conditionNotes ?? ''}</textarea>
        <small>Be honest here — it is what stops arguments later.</small></label>
      <label>Photo <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
        ${editing && tool.photo ? html`<small>Leaving this empty keeps the current photo.</small>` : ''}</label>
      <div class="dates">
        <label>Deposit (USDC) <input name="deposit" value="${values.deposit ?? '40'}" required inputmode="decimal" /></label>
        <label>Late fee per day (USDC) <input name="dailyLateFee" value="${values.dailyLateFee ?? '2'}" required inputmode="decimal" /></label>
        <label>Longest loan (days) <input type="number" name="maxDays" value="${values.maxDays ?? 7}" min="1" max="90" required /></label>
      </div>
      <button type="submit">${editing ? 'Save' : 'Add to the shed'}</button>
    </form>`;
}

// --- dashboard ------------------------------------------------------------

export function dashboardPage({ member, requests, lentOut, borrowed, csrf, today, balance }) {
  return html`
    <h1>Hello, ${member.name}</h1>
    <p class="lede">You have ${money(balance)} in Toolshed. <a href="/browse">Find a tool</a> or <a href="/tools/new">lend one</a>.</p>

    <section>
      <h2>Asking to borrow from you</h2>
      ${requests.length === 0
        ? html`<p class="empty">No open requests.</p>`
        : html`<p class="muted">Best track record first.</p>
            <ul class="loanlist">
              ${requests.map((loan) => requestRow(loan, csrf))}
            </ul>`}
    </section>

    <section>
      <h2>Your tools that are out</h2>
      ${lentOut.length === 0
        ? html`<p class="empty">Nothing of yours is out right now.</p>`
        : html`<ul class="loanlist">${lentOut.map((loan) => lentRow(loan, csrf, today))}</ul>`}
    </section>

    <section>
      <h2>Things you have borrowed</h2>
      ${borrowed.length === 0
        ? html`<p class="empty">Nothing borrowed right now.</p>`
        : html`<ul class="loanlist">${borrowed.map((loan) => borrowedRow(loan, today))}</ul>`}
    </section>`;
}

function requestRow(loan, csrf) {
  return html`<li class="request">
    <div>
      <a href="/members/${loan.borrower_id}">${loan.borrower_name}</a>
      ${recordBadge(loan.borrowerRecord)}
      wants <a href="/tools/${loan.tool_id}">${loan.tool_name}</a>
      ${formatDay(loan.start_day)} – ${formatDay(loan.due_day)}
      · deposit ${money(loan.depositAmount)} held
      ${loan.note ? html`<p class="note">“${loan.note}”</p>` : ''}
    </div>
    <div class="rowactions">
      <form method="post" action="/loans/${loan.id}/approve" class="inline">
        ${csrfField(csrf)}<button type="submit">Lend it</button>
      </form>
      <form method="post" action="/loans/${loan.id}/decline" class="inline">
        ${csrfField(csrf)}
        <input name="reason" placeholder="Reason (optional)" />
        <button class="secondary" type="submit">Decline</button>
      </form>
    </div>
  </li>`;
}

function lentRow(loan, csrf, today) {
  const projection = projectedSettlement(loan, today);
  return html`<li class="request">
    <div>
      <a href="/tools/${loan.tool_id}">${loan.tool_name}</a> with
      <a href="/members/${loan.borrower_id}">${loan.borrower_name}</a> ·
      due ${formatDay(loan.due_day)}
      ${projection.lateDays > 0
        ? html`<span class="late">${projection.lateDays} day${projection.lateDays === 1 ? '' : 's'} late — ${money(projection.fee)} owed to you so far${projection.forfeited ? ' (deposit used up)' : ''}</span>`
        : html`<span class="muted">${daysBetween(today, loan.due_day)} day(s) to go</span>`}
    </div>
    <form method="post" action="/loans/${loan.id}/return" class="inline">
      ${csrfField(csrf)}
      <label class="inline-label">Came back <input type="date" name="returnedDay" value="${today}" max="${today}" /></label>
      <button type="submit">It is back</button>
    </form>
  </li>`;
}

function borrowedRow(loan, today) {
  const projection = projectedSettlement(loan, today);
  return html`<li class="request">
    <div>
      <a href="/tools/${loan.tool_id}">${loan.tool_name}</a> from
      <a href="/members/${loan.owner_id}">${loan.owner_name}</a> ·
      ${loan.status === 'requested'
        ? html`<span class="muted">waiting on ${loan.owner_name}</span>`
        : html`due ${formatDay(loan.due_day)}`}
      ${projection.lateDays > 0 && loan.status === 'active'
        ? html`<span class="late">${projection.lateDays} day${projection.lateDays === 1 ? '' : 's'} late — ${money(projection.fee)} of your deposit spent</span>`
        : ''}
    </div>
    <div class="rowactions">
      <a class="link" href="/loans/${loan.id}">Details</a>
    </div>
  </li>`;
}

// --- loans ----------------------------------------------------------------

export function loansPage({ borrowed, lent, today, csrf }) {
  return html`
    <h1>My loans</h1>
    <section>
      <h2>Borrowed</h2>
      ${borrowed.length === 0 ? html`<p class="empty">Nothing yet.</p>` : html`<ul class="loanlist">${borrowed.map((loan) => historyRow(loan, 'owner'))}</ul>`}
    </section>
    <section>
      <h2>Lent out</h2>
      ${lent.length === 0 ? html`<p class="empty">Nothing yet.</p>` : html`<ul class="loanlist">${lent.map((loan) => historyRow(loan, 'borrower'))}</ul>`}
    </section>`;
}

function historyRow(loan, side) {
  const other = side === 'owner'
    ? html`<a href="/members/${loan.owner_id}">${loan.owner_name}</a>`
    : html`<a href="/members/${loan.borrower_id}">${loan.borrower_name}</a>`;
  return html`<li>
    <a href="/loans/${loan.id}">${loan.tool_name}</a> · ${other} ·
    ${formatDay(loan.start_day)} – ${formatDay(loan.due_day)} ·
    <span class="status status-${loan.status}">${loan.status}</span>
    ${loan.status === 'closed' && loan.late_days > 0
      ? html`<span class="late">${loan.late_days} day${loan.late_days === 1 ? '' : 's'} late, ${money(loan.feeCharged)} fee</span>`
      : ''}
  </li>`;
}

export function loanPage({ loan, viewer, csrf, today, projection }) {
  const isOwner = viewer.id === loan.owner_id;
  return html`
    <h1>${loan.tool_name}</h1>
    <p class="lede">
      <a href="/members/${loan.owner_id}">${loan.owner_name}</a> →
      <a href="/members/${loan.borrower_id}">${loan.borrower_name}</a> ·
      <span class="status status-${loan.status}">${loan.status}</span>
    </p>
    <dl class="terms-list">
      <dt>Dates</dt><dd>${formatDay(loan.start_day)} – ${formatDay(loan.due_day)}</dd>
      <dt>Deposit</dt><dd>${money(loan.depositAmount)}</dd>
      <dt>Late fee</dt><dd>${money(loan.dailyLateFee)} per day</dd>
      ${loan.note ? html`<dt>Note</dt><dd>${loan.note}</dd>` : ''}
      ${loan.decline_reason ? html`<dt>Reason</dt><dd>${loan.decline_reason}</dd>` : ''}
      ${loan.status === 'closed'
        ? html`<dt>Came back</dt><dd>${formatDay(loan.returned_day)} ${loan.late_days > 0 ? html`<span class="late">(${loan.late_days} day${loan.late_days === 1 ? '' : 's'} late)</span>` : html`<span class="ontime">(on time)</span>`}</dd>
            <dt>Late fee paid</dt><dd>${money(loan.feeCharged)}</dd>
            <dt>Deposit returned</dt><dd>${money(loan.refundAmount)}</dd>`
        : ''}
      ${loan.status === 'active'
        ? html`<dt>If it came back today</dt>
            <dd>${money(projection.fee)} to ${loan.owner_name}, ${money(projection.refund)} back to ${loan.borrower_name}</dd>`
        : ''}
    </dl>
    <div class="rowactions">
      ${loan.status === 'requested' && !isOwner
        ? html`<form method="post" action="/loans/${loan.id}/cancel" class="inline">${csrfField(csrf)}<button type="submit">Withdraw request</button></form>`
        : ''}
      ${loan.status === 'requested' && isOwner
        ? html`<form method="post" action="/loans/${loan.id}/approve" class="inline">${csrfField(csrf)}<button type="submit">Lend it</button></form>
            <form method="post" action="/loans/${loan.id}/decline" class="inline">${csrfField(csrf)}<input name="reason" placeholder="Reason (optional)" /><button class="secondary" type="submit">Decline</button></form>`
        : ''}
      ${loan.status === 'active' && isOwner
        ? html`<form method="post" action="/loans/${loan.id}/return" class="inline">
            ${csrfField(csrf)}
            <label class="inline-label">Came back <input type="date" name="returnedDay" value="${today}" max="${today}" /></label>
            <button type="submit">Confirm it is back</button>
          </form>`
        : ''}
    </div>`;
}

// --- member profile -------------------------------------------------------

export function memberPage({ member, record, lending, tools, recent, isSelf }) {
  return html`
    <h1>${member.name}</h1>
    <p class="lede">
      ${member.unit ? html`${member.unit} · ` : ''}Member since ${member.created_at.slice(0, 10)} ${recordBadge(record)}
    </p>
    <dl class="terms-list">
      <dt>Loans taken</dt><dd>${record.completedLoans}</dd>
      <dt>Returned late</dt><dd>${record.lateLoans}${record.lateDays > 0 ? html` (${record.lateDays} late days in total)` : ''}</dd>
      <dt>On-time rate</dt><dd>${record.onTimeRate == null ? 'No loans yet' : `${Math.round(record.onTimeRate * 100)}%`}</dd>
      <dt>Reliability score</dt><dd>${record.score}</dd>
      <dt>Lent to neighbours</dt><dd>${lending.loansGiven} time${lending.loansGiven === 1 ? '' : 's'} from ${lending.toolsListed} tool${lending.toolsListed === 1 ? '' : 's'}</dd>
    </dl>
    ${tools.length > 0
      ? html`<section>
          <h2>In their shed</h2>
          <ul class="grid">
            ${tools.map(
              (tool) => html`<li class="card tool">
                <a href="/tools/${tool.id}">${photo(tool)}</a>
                <div class="tool-body">
                  <h3><a href="/tools/${tool.id}">${tool.name}</a></h3>
                  <p class="terms">${money(tool.depositAmount)} deposit</p>
                  ${tool.status !== 'listed' ? html`<p class="muted">Not in the shed right now</p>` : ''}
                </div>
              </li>`,
            )}
          </ul>
        </section>`
      : ''}
    ${isSelf ? html`<p><a class="button" href="/tools/new">List another tool</a></p>` : ''}
    ${recent.length > 0
      ? html`<section><h2>Recent loans</h2><ul class="loanlist">${recent.map((loan) => historyRow(loan, loan.borrower_id === member.id ? 'owner' : 'borrower'))}</ul></section>`
      : ''}`;
}

// --- shed / wallet / admin ------------------------------------------------

export function shedPage({ tools, csrf }) {
  return html`
    <h1>My shed</h1>
    <p><a class="button" href="/tools/new">List a tool</a></p>
    ${tools.length === 0
      ? html`<p class="empty">Nothing listed yet.</p>`
      : html`<ul class="grid">
          ${tools.map(
            (tool) => html`<li class="card tool">
              <a href="/tools/${tool.id}">${photo(tool)}</a>
              <div class="tool-body">
                <h3><a href="/tools/${tool.id}">${tool.name}</a></h3>
                <p class="terms">${money(tool.depositAmount)} deposit · ${formatUsdc(tool.dailyLateFee)}/day late</p>
                <p class="muted">${tool.status === 'listed' ? 'In the shed' : 'Taken out of the shed'}</p>
                <a class="link" href="/tools/${tool.id}/edit">Edit</a>
              </div>
            </li>`,
          )}
        </ul>`}`;
}

export function walletPage({ balance, held, entries, member, csrf, faucet }) {
  return html`
    <h1>Your USDC</h1>
    <dl class="terms-list">
      <dt>Available</dt><dd>${money(balance)}</dd>
      <dt>Held as deposits</dt><dd>${money(held)}</dd>
      <dt>Payout wallet</dt><dd>${member.wallet_address || 'Not set'}</dd>
    </dl>
    <form method="post" action="/wallet/address" class="card form">
      ${csrfField(csrf)}
      <label>Payout wallet address <input name="walletAddress" value="${member.wallet_address}" placeholder="0x…" /></label>
      <button type="submit">Save</button>
    </form>
    ${faucet
      ? html`<form method="post" action="/wallet/faucet" class="card form">
          ${csrfField(csrf)}
          <h2>Development faucet</h2>
          <p class="muted">Only enabled when TOOLSHED_DEV_FAUCET=true. Mints test USDC so you can click through the flow.</p>
          <label>Amount <input name="amount" value="100" /></label>
          <button type="submit">Add test USDC</button>
        </form>`
      : html`<p class="muted">To add USDC, send it to the association wallet and the treasurer will credit your balance.</p>`}
    <section>
      <h2>Movements</h2>
      ${entries.length === 0
        ? html`<p class="empty">Nothing yet.</p>`
        : html`<ul class="loanlist">
            ${entries.map(
              (entry) => html`<li>
                <span class="muted">${entry.created_at.slice(0, 10)}</span>
                ${entry.incoming ? html`<span class="ontime">+${money(entry.amount)}</span>` : html`<span class="late">−${money(entry.amount)}</span>`}
                · ${entry.memo || entry.kind}
                ${entry.loan_id ? html`· <a href="/loans/${entry.loan_id}">loan #${entry.loan_id}</a>` : ''}
              </li>`,
            )}
          </ul>`}
    </section>`;
}

export function adminPage({ members, csrf, totals }) {
  return html`
    <h1>Treasury</h1>
    <p class="lede">Credit a member after their USDC lands in the association wallet, or record a payout.</p>
    <dl class="terms-list">
      <dt>Member balances</dt><dd>${money(totals.members)}</dd>
      <dt>Held in escrow</dt><dd>${money(totals.escrow)}</dd>
      <dt>Ledger sums to zero</dt><dd>${totals.balanced ? 'yes' : 'NO — investigate'}</dd>
    </dl>
    <form method="post" action="/admin/credit" class="card form">
      ${csrfField(csrf)}
      <label>Member
        <select name="memberId">
          ${members.map((m) => html`<option value="${m.id}">${m.name} (${m.email})</option>`)}
        </select>
      </label>
      <label>Amount (USDC) <input name="amount" value="" required inputmode="decimal" /></label>
      <label>Direction
        <select name="direction">
          <option value="credit">Credit — USDC received</option>
          <option value="debit">Debit — payout sent</option>
        </select>
      </label>
      <label>Memo <input name="memo" placeholder="tx hash or cheque no." /></label>
      <button type="submit">Record</button>
    </form>`;
}
