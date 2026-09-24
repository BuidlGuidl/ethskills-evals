import { config } from '../config.js';
import { Router } from './router.js';
import { HttpError, SESSION_COOKIE, addCookie, cookieHeader } from './http.js';
import { savePhoto } from './photos.js';
import { addDays, formatDay } from '../domain/dates.js';
import { formatUsdc, fromStorage, parseUsdc } from '../domain/money.js';
import { projectedSettlement } from '../domain/fees.js';
import {
  ValidationError,
  authenticate,
  borrowingRecord,
  createMember,
  endSession,
  findById,
  lendingRecord,
  startSession,
} from '../services/members.js';
import { browse, getTool, setToolStatus, listTool, toolsOwnedBy, updateTool } from '../services/tools.js';
import {
  approveLoan,
  cancelRequest,
  confirmReturn,
  declineLoan,
  getLoan,
  loansBorrowedBy,
  loansForTool,
  loansLentBy,
  pendingRequestsFor,
  requestLoan,
} from '../services/loans.js';
import { markAllRead } from '../services/notices.js';
import { availableBalance, fund, withdraw } from '../payments/escrow.js';
import { ESCROW, balanceOf, entriesFor, ledgerTotal, memberAccount } from '../payments/ledger.js';
import * as views from './views/pages.js';

const devFaucet = () => process.env.TOOLSHED_DEV_FAUCET === 'true';

function requireMember(ctx) {
  if (!ctx.member) {
    const next = encodeURIComponent(ctx.url.pathname + ctx.url.search);
    throw new Redirect(`/login?next=${next}`);
  }
  return ctx.member;
}

class Redirect extends Error {
  constructor(location, flash) {
    super('redirect');
    this.location = location;
    this.flash = flash;
  }
}

/** Wrap a handler so validation problems come back as a flash, not a 400 page. */
function form(returnTo, handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      if (error instanceof Redirect) return ctx.redirect(error.location, error.flash);
      if (error instanceof ValidationError || error.expected) {
        const back = typeof returnTo === 'function' ? returnTo(ctx) : returnTo;
        return ctx.redirect(back, { kind: 'error', message: error.message });
      }
      throw error;
    }
  };
}

function page(handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      if (error instanceof Redirect) return ctx.redirect(error.location, error.flash);
      throw error;
    }
  };
}

export function buildRouter() {
  const router = new Router();

  // --- home ---------------------------------------------------------------

  router.get('/', page((ctx) => {
    if (!ctx.member) return ctx.redirect('/login');
    const requests = pendingRequestsFor(ctx.handle, ctx.member.id);
    const lentOut = loansLentBy(ctx.handle, ctx.member.id, ['active']);
    const borrowed = loansBorrowedBy(ctx.handle, ctx.member.id, ['requested', 'active']);
    return ctx.render(
      views.dashboardPage({
        member: ctx.member,
        requests,
        lentOut,
        borrowed,
        csrf: ctx.csrf,
        today: ctx.today,
        balance: availableBalance(ctx.handle, ctx.member.id),
      }),
      { title: 'Home' },
    );
  }));

  // --- accounts -----------------------------------------------------------

  router.get('/login', (ctx) => {
    if (ctx.member) return ctx.redirect('/');
    return ctx.render(views.loginPage({ csrf: ctx.csrf, next: safeNext(ctx.query.next) }), { title: 'Sign in' });
  });

  router.post('/login', form('/login', (ctx) => {
    const member = authenticate(ctx.handle, ctx.fields.email, ctx.fields.password);
    if (!member) throw new ValidationError('That email and password do not match.');
    signIn(ctx, member.id);
    const next = safeNext(ctx.fields.next ?? ctx.query.next);
    ctx.redirect(next, { kind: 'ok', message: `Welcome back, ${member.name}.` });
  }));

  router.get('/signup', (ctx) => {
    if (ctx.member) return ctx.redirect('/');
    return ctx.render(views.signupPage({ csrf: ctx.csrf }), { title: 'Join' });
  });

  router.post('/signup', form('/signup', (ctx) => {
    if (String(ctx.fields.inviteCode ?? '').trim() !== config.inviteCode) {
      throw new ValidationError('That invite code is not right. Check your membership packet.');
    }
    const member = createMember(ctx.handle, {
      email: ctx.fields.email,
      name: ctx.fields.name,
      unit: ctx.fields.unit,
      password: ctx.fields.password,
      walletAddress: ctx.fields.walletAddress,
    });
    signIn(ctx, member.id);
    ctx.redirect('/browse', { kind: 'ok', message: 'Welcome to Toolshed. Add some USDC, then go find a drill.' });
  }));

  router.post('/logout', (ctx) => {
    const cookies = ctx.request.headers.cookie ?? '';
    const token = /toolshed_session=([^;]+)/.exec(cookies)?.[1];
    if (token) endSession(ctx.handle, decodeURIComponent(token));
    addCookie(ctx.response, cookieHeader(SESSION_COOKIE, '', { maxAgeSeconds: 0 }));
    ctx.redirect('/login', { kind: 'ok', message: 'Signed out.' });
  });

  // --- browsing -----------------------------------------------------------

  router.get('/browse', page((ctx) => {
    requireMember(ctx);
    const tools = browse(ctx.handle, { query: ctx.query.q, excludeOwnerId: ctx.member.id });
    return ctx.render(views.browsePage({ tools, query: ctx.query.q, csrf: ctx.csrf }), { title: 'Browse' });
  }));

  router.get('/shed', page((ctx) => {
    requireMember(ctx);
    return ctx.render(views.shedPage({ tools: toolsOwnedBy(ctx.handle, ctx.member.id), csrf: ctx.csrf }), {
      title: 'My shed',
    });
  }));

  // --- tools --------------------------------------------------------------

  router.get('/tools/new', page((ctx) => {
    requireMember(ctx);
    return ctx.render(views.toolFormPage({ csrf: ctx.csrf }), { title: 'List a tool' });
  }));

  router.post('/tools', form('/tools/new', (ctx) => {
    const member = requireMember(ctx);
    const tool = listTool(ctx.handle, member.id, ctx.fields, savePhoto(ctx.files.photo));
    ctx.redirect(`/tools/${tool.id}`, { kind: 'ok', message: `${tool.name} is in the shed.` });
  }));

  router.get('/tools/:id', page((ctx) => {
    requireMember(ctx);
    const tool = getTool(ctx.handle, Number(ctx.params.id));
    if (!tool) throw new HttpError(404, 'That tool is not listed.');
    const loans = loansForTool(ctx.handle, tool.id);
    return ctx.render(
      views.toolPage({
        tool,
        ownerRecord: borrowingRecord(ctx.handle, tool.owner_id),
        viewer: ctx.member,
        csrf: ctx.csrf,
        today: ctx.today,
        defaults: { startDay: ctx.today, dueDay: addDays(ctx.today, Math.min(3, tool.max_days - 1)) },
        history: loans.filter((loan) => loan.status === 'closed').slice(0, 10),
        upcoming: loans.filter((loan) => loan.status === 'active'),
      }),
      { title: tool.name },
    );
  }));

  router.get('/tools/:id/edit', page((ctx) => {
    const member = requireMember(ctx);
    const tool = getTool(ctx.handle, Number(ctx.params.id));
    if (!tool || tool.owner_id !== member.id) throw new HttpError(404, 'That is not your tool.');
    return ctx.render(
      views.toolFormPage({
        csrf: ctx.csrf,
        tool,
        values: {
          name: tool.name,
          description: tool.description,
          conditionNotes: tool.condition_notes,
          deposit: formatUsdc(tool.depositAmount),
          dailyLateFee: formatUsdc(tool.dailyLateFee),
          maxDays: tool.max_days,
        },
      }),
      { title: `Edit ${tool.name}` },
    );
  }));

  router.post('/tools/:id', form((ctx) => `/tools/${Number(ctx.params.id)}/edit`, (ctx) => {
    const member = requireMember(ctx);
    const photo = ctx.files.photo ? savePhoto(ctx.files.photo) : null;
    const tool = updateTool(ctx.handle, Number(ctx.params.id), member.id, ctx.fields, photo);
    ctx.redirect(`/tools/${tool.id}`, { kind: 'ok', message: 'Saved.' });
  }));

  router.post('/tools/:id/status', form((ctx) => `/tools/${Number(ctx.params.id)}`, (ctx) => {
    const member = requireMember(ctx);
    setToolStatus(ctx.handle, Number(ctx.params.id), member.id, ctx.fields.status);
    ctx.redirect(`/tools/${Number(ctx.params.id)}`, { kind: 'ok', message: 'Updated.' });
  }));

  // --- borrowing ----------------------------------------------------------

  router.post('/tools/:id/request', form((ctx) => `/tools/${Number(ctx.params.id)}`, (ctx) => {
    const member = requireMember(ctx);
    const loan = requestLoan(ctx.handle, ctx.escrow, {
      toolId: Number(ctx.params.id),
      borrowerId: member.id,
      startDay: ctx.fields.startDay,
      dueDay: ctx.fields.dueDay,
      note: ctx.fields.note,
    });
    ctx.redirect(`/loans/${loan.id}`, {
      kind: 'ok',
      message: `Asked ${loan.owner_name}. ${formatUsdc(loan.depositAmount)} USDC is held until the ${loan.tool_name} is back.`,
    });
  }));

  router.get('/loans', page((ctx) => {
    const member = requireMember(ctx);
    return ctx.render(
      views.loansPage({
        borrowed: loansBorrowedBy(ctx.handle, member.id),
        lent: loansLentBy(ctx.handle, member.id),
        today: ctx.today,
        csrf: ctx.csrf,
      }),
      { title: 'My loans' },
    );
  }));

  router.get('/loans/:id', page((ctx) => {
    const member = requireMember(ctx);
    const loan = getLoan(ctx.handle, Number(ctx.params.id));
    if (!loan || (loan.owner_id !== member.id && loan.borrower_id !== member.id)) {
      throw new HttpError(404, 'That loan is not yours to look at.');
    }
    return ctx.render(
      views.loanPage({
        loan,
        viewer: member,
        csrf: ctx.csrf,
        today: ctx.today,
        projection: projectedSettlement(loan, ctx.today),
      }),
      { title: loan.tool_name },
    );
  }));

  router.post('/loans/:id/approve', form('/', (ctx) => {
    const member = requireMember(ctx);
    const loan = approveLoan(ctx.handle, ctx.escrow, Number(ctx.params.id), member.id);
    ctx.redirect('/', {
      kind: 'ok',
      message: `Lent ${loan.tool_name} to ${loan.borrower_name}. Due back ${formatDay(loan.due_day)}.`,
    });
  }));

  router.post('/loans/:id/decline', form('/', (ctx) => {
    const member = requireMember(ctx);
    const loan = declineLoan(ctx.handle, ctx.escrow, Number(ctx.params.id), member.id, ctx.fields.reason);
    ctx.redirect('/', { kind: 'ok', message: `Declined. ${loan.borrower_name}'s deposit went back.` });
  }));

  router.post('/loans/:id/cancel', form('/loans', (ctx) => {
    const member = requireMember(ctx);
    const loan = cancelRequest(ctx.handle, ctx.escrow, Number(ctx.params.id), member.id);
    ctx.redirect('/loans', { kind: 'ok', message: `Withdrawn. Your ${formatUsdc(loan.depositAmount)} USDC is back.` });
  }));

  router.post('/loans/:id/return', form('/', (ctx) => {
    const member = requireMember(ctx);
    const loan = confirmReturn(ctx.handle, ctx.escrow, Number(ctx.params.id), member.id, ctx.fields.returnedDay);
    ctx.redirect(`/loans/${loan.id}`, {
      kind: 'ok',
      message:
        loan.late_days > 0
          ? `Closed. ${formatUsdc(loan.feeCharged)} USDC in late fees is yours; ${formatUsdc(loan.refundAmount)} went back to ${loan.borrower_name}.`
          : `Closed on time. ${formatUsdc(loan.refundAmount)} USDC went back to ${loan.borrower_name}.`,
    });
  }));

  // --- people -------------------------------------------------------------

  router.get('/members/:id', page((ctx) => {
    const viewer = requireMember(ctx);
    const member = findById(ctx.handle, Number(ctx.params.id));
    if (!member) throw new HttpError(404, 'No such member.');
    const isSelf = member.id === viewer.id;
    const tools = toolsOwnedBy(ctx.handle, member.id).filter((tool) => isSelf || tool.status === 'listed');
    const recent = [
      ...loansBorrowedBy(ctx.handle, member.id, ['closed', 'active']),
      ...(isSelf ? loansLentBy(ctx.handle, member.id, ['closed', 'active']) : []),
    ].slice(0, 10);
    return ctx.render(
      views.memberPage({
        member,
        record: borrowingRecord(ctx.handle, member.id),
        lending: lendingRecord(ctx.handle, member.id),
        tools,
        recent,
        isSelf,
      }),
      { title: member.name },
    );
  }));

  router.post('/notices/read', page((ctx) => {
    const member = requireMember(ctx);
    markAllRead(ctx.handle, member.id);
    ctx.redirect(localReferer(ctx));
  }));

  // --- money --------------------------------------------------------------

  router.get('/wallet', page((ctx) => {
    const member = requireMember(ctx);
    const entries = entriesFor(ctx.handle, memberAccount(member.id)).map((entry) => ({
      ...entry,
      amount: fromStorage(entry.amount),
      incoming: entry.to_account === memberAccount(member.id),
    }));
    const held = ctx.handle
      .prepare(`SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) AS total FROM escrow_holds WHERE member_id = ? AND status = 'held'`)
      .get(member.id).total;
    return ctx.render(
      views.walletPage({
        balance: availableBalance(ctx.handle, member.id),
        held: BigInt(held),
        entries,
        member,
        csrf: ctx.csrf,
        faucet: devFaucet(),
      }),
      { title: 'Your USDC' },
    );
  }));

  router.post('/wallet/address', form('/wallet', (ctx) => {
    const member = requireMember(ctx);
    const address = String(ctx.fields.walletAddress ?? '').trim();
    if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new ValidationError('That does not look like an Ethereum-style address.');
    }
    ctx.handle.prepare('UPDATE members SET wallet_address = ? WHERE id = ?').run(address, member.id);
    ctx.redirect('/wallet', { kind: 'ok', message: 'Saved.' });
  }));

  router.post('/wallet/faucet', form('/wallet', (ctx) => {
    const member = requireMember(ctx);
    if (!devFaucet()) throw new HttpError(404, 'Not available.');
    fund(ctx.handle, member.id, parseUsdc(ctx.fields.amount || '100'), 'development faucet');
    ctx.redirect('/wallet', { kind: 'ok', message: 'Test USDC added.' });
  }));

  // --- treasurer ----------------------------------------------------------

  router.get('/admin', page((ctx) => {
    requireAdmin(ctx);
    return ctx.render(views.adminPage({ ...treasuryView(ctx), csrf: ctx.csrf }), { title: 'Treasury' });
  }));

  router.post('/admin/credit', form('/admin', (ctx) => {
    requireAdmin(ctx);
    const memberId = Number(ctx.fields.memberId);
    if (!findById(ctx.handle, memberId)) throw new ValidationError('No such member.');
    let amount;
    try {
      amount = parseUsdc(ctx.fields.amount);
    } catch {
      throw new ValidationError('Enter an amount like 25 or 25.50.');
    }
    if (amount === 0n) throw new ValidationError('Enter an amount greater than zero.');
    const memo = String(ctx.fields.memo ?? '').slice(0, 200);
    if (ctx.fields.direction === 'debit') withdraw(ctx.handle, memberId, amount, memo || 'payout');
    else fund(ctx.handle, memberId, amount, memo || 'USDC received');
    ctx.redirect('/admin', { kind: 'ok', message: 'Recorded.' });
  }));

  return router;
}

// --- helpers --------------------------------------------------------------

function signIn(ctx, memberId) {
  const session = startSession(ctx.handle, memberId);
  addCookie(ctx.response, cookieHeader(SESSION_COOKIE, session.token, { expires: session.expires }));
}

/** Only bounce back to a path on this site. */
function localReferer(ctx) {
  const referer = ctx.request.headers.referer;
  if (!referer) return '/';
  try {
    const url = new URL(referer);
    return url.host === ctx.url.host ? url.pathname : '/';
  } catch {
    return '/';
  }
}

function safeNext(value) {
  const next = String(value ?? '/');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function requireAdmin(ctx) {
  const member = requireMember(ctx);
  if (!member.is_admin) throw new HttpError(403, 'The treasury page is for the association treasurer.');
  return member;
}

function treasuryView(ctx) {
  const members = ctx.handle.prepare('SELECT id, name, email FROM members ORDER BY name').all();
  const memberTotal = ctx.handle
    .prepare(`SELECT balance FROM ledger_accounts WHERE kind = 'member'`)
    .all()
    .reduce((sum, row) => sum + fromStorage(row.balance), 0n);
  return {
    members,
    totals: {
      members: memberTotal,
      escrow: balanceOf(ctx.handle, ESCROW),
      balanced: ledgerTotal(ctx.handle) === 0n,
    },
  };
}
