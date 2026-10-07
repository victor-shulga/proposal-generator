/**
 * Proposal tracker: one Cloudflare Worker + D1.
 *
 * The proposal page (track.js) sends small beacons here: who opened it, how long
 * each slide stayed on screen, which buttons were clicked. The Worker stores them,
 * pings Telegram on the moments worth a follow-up, and, if a CRM is configured,
 * raises a buying signal on the account.
 *
 * Routes
 *   POST /e                      beacon from track.js (text/plain JSON, no preflight)
 *   POST /admin/proposals        register a proposal + recipients   (Bearer ADMIN_TOKEN)
 *   GET  /admin/proposals        list proposals                     (Bearer ADMIN_TOKEN)
 *   GET  /admin/report?p=<id>    per-recipient summary              (Bearer ADMIN_TOKEN)
 *   GET  /admin/alerts           latest alerts, all proposals       (Bearer ADMIN_TOKEN)
 *   POST /admin/archive          {id, archived: true|false}         (Bearer ADMIN_TOKEN)
 *   GET  /                       dashboard (static, public/; data needs the token)
 *   GET  /health
 *
 * Secrets (all optional except ADMIN_TOKEN)
 *   ADMIN_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TWENTY_KEY
 * Vars
 *   TWENTY_URL (e.g. https://<workspace>.twenty.com/rest), SIGNAL_CODE (default F12)
 */

const REOPEN_GAP_MS = 6 * 3600e3;   // a visit after 6h of silence counts as "came back"
const PRICING_MIN_MS = 10e3;        // pricing slide must stay on screen 10s to count as read
const MAX_BODY = 8192;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
      if (url.pathname === '/health') return json({ ok: true });
      if (url.pathname === '/e' && req.method === 'POST') return cors(await beacon(req, env, ctx));
      if (url.pathname.startsWith('/admin/')) {
        if (!authed(req, env)) return json({ error: 'unauthorized' }, 401);
        if (url.pathname === '/admin/proposals' && req.method === 'POST') return addProposal(req, env);
        if (url.pathname === '/admin/proposals' && req.method === 'GET') return listProposals(env);
        if (url.pathname === '/admin/report' && req.method === 'GET') return report(env, url.searchParams.get('p'));
        if (url.pathname === '/admin/alerts' && req.method === 'GET') return listAlerts(env);
        if (url.pathname === '/admin/archive' && req.method === 'POST') return archive(req, env);
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },
};

/* ── beacon ──────────────────────────────────────────────────────────────── */

async function beacon(req, env, ctx) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  let b;
  try { b = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }

  const p = clean(b.p, 64);
  const proposal = p && await env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(p).first();
  // Unknown proposal = someone else's page or a scraper. Drop silently.
  if (!proposal) return new Response(null, { status: 204 });

  const r = clean(b.r, 32) || '';
  const v = clean(b.v, 40) || 'anon';
  const s = clean(b.s, 40) || 'nosession';
  const now = Date.now();
  const country = req.cf && req.cf.country || '';
  const ua = (req.headers.get('user-agent') || '').slice(0, 200);
  const events = Array.isArray(b.ev) ? b.ev.slice(0, 50) : [];

  const recipient = r
    ? await env.DB.prepare('SELECT * FROM recipients WHERE proposal_id = ? AND token = ?').bind(p, r).first()
    : null;

  const stmts = [];
  const hits = [];   // things that may deserve an alert
  for (const e of events) {
    const type = clean(e.t, 16);
    if (!['open', 'slide', 'cta', 'close'].includes(type)) continue;
    const slide = Number.isInteger(e.i) ? e.i : null;
    const label = clean(e.l, 60);
    const ms = Math.max(0, Math.min(Number(e.ms) || 0, 3600e3));
    stmts.push(env.DB.prepare(
      'INSERT INTO events (proposal_id, recipient, visitor, session, type, slide, label, ms, country, ua, ts) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(p, r, v, s, type, slide, label, ms, country, ua, now));
    hits.push({ type, slide, label, ms });
  }
  if (!stmts.length) return new Response(null, { status: 204 });

  // Read history BEFORE writing, so "first open" and "came back" are decided on the past only.
  const prev = await env.DB.prepare(
    'SELECT MAX(ts) AS last_ts, COUNT(DISTINCT visitor) AS visitors FROM events WHERE proposal_id = ? AND recipient = ? AND session != ?'
  ).bind(p, r, s).first();
  const knownVisitor = await env.DB.prepare(
    'SELECT 1 FROM events WHERE proposal_id = ? AND recipient = ? AND visitor = ? LIMIT 1'
  ).bind(p, r, v).first();
  const pricingBefore = await env.DB.prepare(
    "SELECT COALESCE(SUM(ms),0) AS ms FROM events WHERE proposal_id = ? AND recipient = ? AND type = 'slide' AND label = 'pricing'"
  ).bind(p, r).first();

  await env.DB.batch(stmts);

  const who = recipient ? recipient.name : (r ? `невідомий отримувач (${r})` : 'хтось без персонального лінка');
  const title = proposal.label || proposal.id;
  const alerts = [];

  if (hits.some(h => h.type === 'open')) {
    if (!prev || !prev.last_ts) {
      alerts.push(['first_open', `👀 ${who} вперше відкрив «${title}»`]);
    } else if (now - prev.last_ts > REOPEN_GAP_MS) {
      alerts.push(['reopen', `🔁 ${who} повернувся до «${title}» (востаннє ${ago(now - prev.last_ts)} тому)`]);
    }
    if (prev && prev.visitors > 0 && !knownVisitor) {
      alerts.push(['new_device', `📨 «${title}» відкрили на новому пристрої з лінка ${who}${country ? `, ${country}` : ''}. Схоже, переслали колезі`]);
    }
  }

  const pricingNow = hits.filter(h => h.type === 'slide' && h.label === 'pricing').reduce((a, h) => a + h.ms, 0);
  if (pricingBefore.ms < PRICING_MIN_MS && pricingBefore.ms + pricingNow >= PRICING_MIN_MS) {
    alerts.push(['pricing', `💰 ${who} читає ціни в «${title}» (${Math.round((pricingBefore.ms + pricingNow) / 1000)} с)`]);
  }

  for (const h of hits.filter(h => h.type === 'cta')) {
    alerts.push([`cta:${h.label || '?'}`, `✅ ${who} натиснув «${h.label || 'кнопку'}» у «${title}»`]);
  }

  ctx.waitUntil(fire(env, proposal, r, alerts, now));
  return new Response(null, { status: 204 });
}

// One alert per kind per recipient per 6h, so a long read does not spam the chat.
async function fire(env, proposal, r, alerts, now) {
  let sent = 0;
  for (const [kind, text] of alerts) {
    const last = await env.DB.prepare(
      'SELECT ts FROM alerts WHERE proposal_id = ? AND recipient = ? AND kind = ? ORDER BY ts DESC LIMIT 1'
    ).bind(proposal.id, r, kind).first();
    if (last && now - last.ts < REOPEN_GAP_MS) continue;
    await env.DB.prepare('INSERT INTO alerts (proposal_id, recipient, kind, ts) VALUES (?,?,?,?)')
      .bind(proposal.id, r, kind, now).run();
    await telegram(env, text);
    sent++;
  }
  // A CRM signal only for intent, not for a first glance: came back, forwarded, read pricing, clicked.
  if (sent && alerts.some(([k]) => k !== 'first_open')) await crmSignal(env, proposal, alerts);
}

/* ── integrations ────────────────────────────────────────────────────────── */

async function telegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

// Twenty CRM: one open signal per account. Skipped when the proposal has no company id.
async function crmSignal(env, proposal, alerts) {
  if (!env.TWENTY_KEY || !env.TWENTY_URL || !proposal.crm_company_id) return;
  const code = env.SIGNAL_CODE || 'F12';
  const base = env.TWENTY_URL.replace(/\/$/, '');
  const tw = (path, init = {}) => fetch(base + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.TWENTY_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'curl/8.4.0',   // Cloudflare in front of Twenty blocks unknown clients
    },
  }).then(r => r.ok ? r.json() : null).catch(() => null);

  const f = encodeURIComponent(`companyId[eq]:${proposal.crm_company_id},signalCode[eq]:${code},status[eq]:NEW`);
  const open = await tw(`/signals?filter=${f}&limit=1`);
  if (open === null || open?.data?.signals?.length) return;   // API down, or already in the queue

  const what = alerts.filter(([k]) => k !== 'first_open').map(([, t]) => t.replace(/^\S+\s/, '')).join('; ');
  const now = new Date();
  await tw('/signals', {
    method: 'POST',
    body: JSON.stringify({
      name: `${proposal.label || proposal.id}: ${what}`.slice(0, 250),
      signalCode: code,
      action: 'OTHER',
      signalType: 'SITE_VISIT',
      source: 'SITE',
      status: 'NEW',
      weight: 5,
      detectedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10),
      companyId: proposal.crm_company_id,
      evidence: proposal.url ? { primaryLinkLabel: 'proposal', primaryLinkUrl: proposal.url } : undefined,
    }),
  });
}

/* ── admin ───────────────────────────────────────────────────────────────── */

async function addProposal(req, env) {
  const b = await req.json();
  const id = clean(b.id, 64);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) return json({ error: 'id: lowercase letters, digits, dashes' }, 400);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO proposals (id, label, url, crm_company_id, created_ts) VALUES (?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, url = excluded.url, crm_company_id = excluded.crm_company_id`
  ).bind(id, clean(b.label, 120), clean(b.url, 300), clean(b.crm_company_id, 64), now).run();

  const out = [];
  for (const name of (Array.isArray(b.recipients) ? b.recipients : []).slice(0, 50)) {
    const n = clean(name, 80);
    if (!n) continue;
    let row = await env.DB.prepare('SELECT token FROM recipients WHERE proposal_id = ? AND name = ?').bind(id, n).first();
    if (!row) {
      row = { token: token(8) };
      await env.DB.prepare('INSERT INTO recipients (proposal_id, token, name, created_ts) VALUES (?,?,?,?)')
        .bind(id, row.token, n, now).run();
    }
    out.push({ name: n, token: row.token });
  }
  return json({ ok: true, id, recipients: out });
}

async function listProposals(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.label, p.url, p.crm_company_id, p.created_ts, COALESCE(p.archived, 0) AS archived,
            (SELECT MAX(ts) FROM events e WHERE e.proposal_id = p.id) AS last_seen,
            (SELECT COUNT(DISTINCT session) FROM events e WHERE e.proposal_id = p.id) AS sessions,
            (SELECT COUNT(*) FROM recipients r WHERE r.proposal_id = p.id) AS recipients,
            (SELECT COUNT(DISTINCT e.recipient) FROM events e
               WHERE e.proposal_id = p.id AND e.recipient IN (SELECT token FROM recipients r WHERE r.proposal_id = p.id)) AS opened,
            (SELECT COUNT(DISTINCT a.recipient) FROM alerts a WHERE a.proposal_id = p.id AND a.kind = 'reopen') AS returned,
            (SELECT COUNT(DISTINCT a.recipient) FROM alerts a WHERE a.proposal_id = p.id AND a.kind = 'pricing') AS pricing,
            (SELECT COUNT(DISTINCT a.recipient) FROM alerts a WHERE a.proposal_id = p.id AND a.kind = 'new_device') AS forwarded,
            (SELECT COUNT(*) FROM alerts a WHERE a.proposal_id = p.id AND a.kind LIKE 'cta:%') AS clicks,
            (SELECT MAX(ts) FROM alerts a WHERE a.proposal_id = p.id AND a.kind != 'first_open') AS last_intent
       FROM proposals p ORDER BY COALESCE(last_seen, p.created_ts) DESC`
  ).all();
  return json({ proposals: results });
}

async function listAlerts(env) {
  const { results } = await env.DB.prepare(
    `SELECT a.proposal_id, a.recipient, a.kind, a.ts, p.label, r.name
       FROM alerts a
       JOIN proposals p ON p.id = a.proposal_id AND COALESCE(p.archived, 0) = 0
       LEFT JOIN recipients r ON r.proposal_id = a.proposal_id AND r.token = a.recipient
      ORDER BY a.ts DESC LIMIT 60`
  ).all();
  return json({ alerts: results });
}

// Archive instead of delete: the history stays, the proposal leaves the dashboard.
async function archive(req, env) {
  const b = await req.json();
  const id = clean(b.id, 64);
  const res = await env.DB.prepare('UPDATE proposals SET archived = ? WHERE id = ?').bind(b.archived === false ? 0 : 1, id).run();
  return json({ ok: res.meta.changes === 1, id });
}

async function report(env, p) {
  if (!p) return json({ error: 'p required' }, 400);
  const proposal = await env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(p).first();
  if (!proposal) return json({ error: 'unknown proposal' }, 404);
  const { results: recips } = await env.DB.prepare('SELECT token, name FROM recipients WHERE proposal_id = ?').bind(p).all();
  const { results: people } = await env.DB.prepare(
    `SELECT recipient, COUNT(DISTINCT session) AS sessions, COUNT(DISTINCT visitor) AS devices,
            MIN(ts) AS first_ts, MAX(ts) AS last_ts,
            SUM(CASE WHEN type = 'slide' THEN ms ELSE 0 END) AS read_ms,
            GROUP_CONCAT(DISTINCT country) AS countries
       FROM events WHERE proposal_id = ? GROUP BY recipient`
  ).bind(p).all();
  const { results: slides } = await env.DB.prepare(
    `SELECT recipient, slide, label, SUM(ms) AS ms FROM events
      WHERE proposal_id = ? AND type = 'slide' GROUP BY recipient, slide, label ORDER BY recipient, slide`
  ).bind(p).all();
  const { results: ctas } = await env.DB.prepare(
    `SELECT recipient, label, COUNT(*) AS n, MAX(ts) AS last_ts FROM events
      WHERE proposal_id = ? AND type = 'cta' GROUP BY recipient, label`
  ).bind(p).all();

  const names = Object.fromEntries(recips.map(x => [x.token, x.name]));
  const rows = people.map(x => ({
    ...x,
    recipient: names[x.recipient] || (x.recipient ? `? (${x.recipient})` : '(без персонального лінка)'),
    token: x.recipient,
    slides: slides.filter(s => s.recipient === x.recipient).map(({ slide, label, ms }) => ({ slide, label, ms })),
    ctas: ctas.filter(c => c.recipient === x.recipient).map(({ label, n, last_ts }) => ({ label, n, last_ts })),
  }));
  const silent = recips.filter(x => !people.some(y => y.recipient === x.token)).map(x => x.name);
  return json({ proposal, recipients: recips, viewers: rows, not_opened: silent });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function authed(req, env) {
  const h = req.headers.get('authorization') || '';
  return Boolean(env.ADMIN_TOKEN) && h === `Bearer ${env.ADMIN_TOKEN}`;
}

function clean(x, max) {
  if (x === undefined || x === null) return null;
  const s = String(x).trim().replace(/[\u0000-\u001f]/g, '');
  return s ? s.slice(0, max) : null;
}

function token(n) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, b => a[b % a.length]).join('');
}

function ago(ms) {
  const h = ms / 3600e3;
  return h < 48 ? `${Math.round(h)} год` : `${Math.round(h / 24)} дн`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers: h });
}
