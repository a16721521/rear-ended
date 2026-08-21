/**
 * Law Dog intake worker.
 *
 * Handles POST /api/intake — validates the submission from get-started.html,
 * sends a notification email via the Workers Email binding, and returns JSON.
 *
 * All other requests fall through to static assets.
 *
 * Setup (one-time):
 *   npx wrangler email sending enable getlawdog.com
 */

const ALLOWED_ORIGINS = [
  'https://getlawdog.com',
  'https://www.getlawdog.com',
];

const CASE_TYPE_LABELS = {
  'car-accident': 'Car accident',
  'slip-fall':    'Slip & fall',
  'motorcycle':   'Motorcycle accident',
  'truck':        'Truck / commercial vehicle',
  'other':        'Other injury',
};

const TIMELINE_LABELS = {
  'week':    'Within the last week',
  'month':   '1–4 weeks ago',
  'months':  '1–6 months ago',
  'longer':  'More than 6 months ago',
};

const DOCTOR_LABELS = {
  'yes':     'Yes — treated',
  'er':      'Went to the ER',
  'not-yet': 'Not yet, but needs to',
  'no':      'No medical care',
};

const SYMPTOMS_LABELS = {
  'yes':       'Still in pain',
  'sometimes': 'On and off',
  'recovered': 'Mostly recovered',
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function handleIntake(request, env) {
  const origin = request.headers.get('Origin') || '';

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400, origin);
  }

  const { firstName, lastName, phone, email, caseType, timeline, doctor, symptoms } = body;

  if (!firstName || !lastName || !phone) {
    return json({ ok: false, error: 'Missing required fields' }, 400, origin);
  }

  const name = `${firstName} ${lastName}`;
  const caseLabel     = CASE_TYPE_LABELS[caseType] ?? caseType ?? '—';
  const timelineLabel = TIMELINE_LABELS[timeline]  ?? timeline  ?? '—';
  const doctorLabel   = DOCTOR_LABELS[doctor]       ?? doctor    ?? '—';
  const symptomsLabel = SYMPTOMS_LABELS[symptoms]   ?? symptoms  ?? '—';

  const subject = `New Lead: ${name} — ${caseLabel}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <div style="background:#080808;padding:16px 24px;border-radius:8px;margin-bottom:24px">
    <span style="color:#fff;font-weight:700;font-size:18px">🐕 Law Dog — New Intake Lead</span>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:15px">
    <tr style="background:#f5f5f5"><td style="padding:10px 14px;font-weight:600;width:140px">Name</td><td style="padding:10px 14px">${esc(name)}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600">Phone</td><td style="padding:10px 14px"><a href="tel:${esc(phone)}">${esc(phone)}</a></td></tr>
    <tr style="background:#f5f5f5"><td style="padding:10px 14px;font-weight:600">Email</td><td style="padding:10px 14px">${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '—'}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600">Case type</td><td style="padding:10px 14px">${esc(caseLabel)}</td></tr>
    <tr style="background:#f5f5f5"><td style="padding:10px 14px;font-weight:600">Timeline</td><td style="padding:10px 14px">${esc(timelineLabel)}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600">Doctor seen</td><td style="padding:10px 14px">${esc(doctorLabel)}</td></tr>
    <tr style="background:#f5f5f5"><td style="padding:10px 14px;font-weight:600">Symptoms</td><td style="padding:10px 14px">${esc(symptomsLabel)}</td></tr>
  </table>
  <p style="margin-top:24px;font-size:13px;color:#888">Submitted via getlawdog.com/get-started</p>
</body>
</html>`;

  const text = [
    'Law Dog — New Intake Lead',
    '',
    `Name:      ${name}`,
    `Phone:     ${phone}`,
    `Email:     ${email || '—'}`,
    `Case:      ${caseLabel}`,
    `Timeline:  ${timelineLabel}`,
    `Doctor:    ${doctorLabel}`,
    `Symptoms:  ${symptomsLabel}`,
  ].join('\n');

  try {
    await env.EMAIL.send({
      to: 'a16721521@gmail.com',
      from: { email: 'intake@getlawdog.com', name: 'Law Dog Intake' },
      subject,
      html,
      text,
    });
    return json({ ok: true }, 200, origin);
  } catch (err) {
    console.error('Email send failed:', err.code, err.message);
    return json({ ok: false, error: 'Notification failed — lead not recorded' }, 500, origin);
  }
}

// ── Site-wide password gate: custom login page + auth cookie ──
// NOTE: password lives in source. Fine for a private staging gate; move it to a
// Worker secret (`wrangler secret put SITE_PASSWORD`) before this repo is public.
const SITE_PASSWORD = 'ass';
const COOKIE_NAME = 're_gate';
const AUTH_VALUE = 'reargate.9f3c1b7a2d'; // shared-secret cookie value (NOT the password)
const SET_COOKIE = `${COOKIE_NAME}=${AUTH_VALUE}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
const CLEAR_COOKIE = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return '';
}

function isAuthed(request) {
  return readCookie(request, COOKIE_NAME) === AUTH_VALUE;
}

function safeNext(value) {
  return (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) ? value : '/';
}

async function handleLogin(request) {
  const form = await request.formData().catch(() => null);
  const password = form ? (form.get('password') || '') : '';
  const next = safeNext(form ? form.get('next') : '/');
  if (password === SITE_PASSWORD) {
    return new Response(null, {
      status: 303,
      headers: { 'Location': next, 'Set-Cookie': SET_COOKIE, 'Cache-Control': 'no-store' },
    });
  }
  return loginResponse(401, next, 'Incorrect password. Try again.');
}

function logoutResponse() {
  return new Response(null, {
    status: 303,
    headers: { 'Location': '/', 'Set-Cookie': CLEAR_COOKIE, 'Cache-Control': 'no-store' },
  });
}

function loginResponse(status, next, error) {
  return new Response(loginHTML(next, error), {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

function loginHTML(next, error) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Rear Ended — Private</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;500&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;display:grid;place-items:center;padding:24px;color:#fff;
    font-family:'Space Grotesk',system-ui,-apple-system,sans-serif;background-color:#080808;
    background-image:
      radial-gradient(60% 80% at 8% 100%, rgba(152,251,152,.20) 0%, transparent 70%),
      radial-gradient(52% 72% at 30% 88%, rgba(52,211,153,.16) 0%, transparent 72%),
      radial-gradient(70% 92% at 96% 4%, rgba(6,61,48,.55) 0%, transparent 66%),
      linear-gradient(135deg,#0b0d0c 0%,#080808 60%);}
  .card{width:100%;max-width:380px;text-align:center}
  .wordmark{font-family:'Oswald',sans-serif;font-weight:300;font-size:44px;line-height:1;letter-spacing:.06em;text-transform:lowercase;margin-bottom:16px}
  .tag{font-size:13px;color:rgba(255,255,255,.5);letter-spacing:.02em;text-transform:uppercase;margin-bottom:34px}
  form{display:flex;flex-direction:column;gap:12px}
  input[type=password]{width:100%;padding:15px 16px;border-radius:12px;font:inherit;font-size:15px;color:#fff;outline:none;
    border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);transition:border-color .2s,background .2s}
  input[type=password]::placeholder{color:rgba(255,255,255,.4)}
  input[type=password]:focus{border-color:rgba(52,211,153,.75);background:rgba(255,255,255,.06)}
  button{width:100%;padding:15px 16px;border:none;border-radius:12px;cursor:pointer;font:inherit;font-weight:700;font-size:15px;color:#08110c;
    background:linear-gradient(110deg,#0E9F6E 0%,#34D399 45%,#98FB98 100%);transition:filter .2s,transform .2s}
  button:hover{filter:brightness(1.06);transform:translateY(-1px)}
  .err{min-height:18px;font-size:13px;color:#ff9a9a;margin-top:2px}
</style></head>
<body>
  <main class="card">
    <div class="wordmark">rear ended</div>
    <div class="tag">Private preview</div>
    <form method="POST" action="/__login">
      <input type="password" name="password" placeholder="Enter password" autofocus autocomplete="current-password" aria-label="Password">
      <input type="hidden" name="next" value="${esc(next)}">
      <button type="submit">Enter &rarr;</button>
      <div class="err">${error ? esc(error) : ''}</div>
    </form>
  </main>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // ── Password gate: branded login page + auth cookie (runs before assets
    //    because run_worker_first=true, so it covers every path). ──
    if (url.pathname === '/__logout') return logoutResponse();
    if (url.pathname === '/__login' && request.method === 'POST') return handleLogin(request);
    if (!isAuthed(request)) return loginResponse(200, safeNext(url.pathname + url.search), '');

    if (url.pathname === '/api/intake') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (request.method === 'POST') {
        return handleIntake(request, env);
      }
      return new Response('Method not allowed', { status: 405 });
    }

    // Serve static assets, but never let the CDN cache gated responses —
    // an edge cache hit could otherwise be served without re-checking the password.
    const assetRes = await env.ASSETS.fetch(request);
    const res = new Response(assetRes.body, assetRes);
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  },
};
