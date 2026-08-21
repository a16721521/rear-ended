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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (url.pathname === '/api/intake') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (request.method === 'POST') {
        return handleIntake(request, env);
      }
      return new Response('Method not allowed', { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
