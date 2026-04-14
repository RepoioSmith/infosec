'use strict';

require('dotenv').config();

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const jwt          = require('jsonwebtoken');
const fetch        = require('node-fetch');
const db           = require('./database/init');

const app  = express();
const PORT = process.env.PORT || 80;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// A05 — Security Misconfiguration:
// Static root is __dirname (app root), NOT path.join(__dirname, 'public').
// This exposes .env, backup.sql, server.js, and secret/ to any HTTP client.
app.use(express.static(__dirname));
// Serve public/ assets (CSS, JS, HTML) separately — the root static above
// intentionally does NOT serve public/ to preserve the A05 vulnerability.
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// A02 — JWT: verify() called WITHOUT algorithms option → accepts alg:none
function verifyToken(req) {
  const header = req.headers['authorization'];
  const cookie = req.cookies['ns_token'];
  const raw = (header && header.startsWith('Bearer ') ? header.slice(7) : null) || cookie;
  if (!raw) return null;
  try {
    return jwt.verify(raw, JWT_SECRET); // No { algorithms: ['HS256'] } — intentional
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Authentication required.' });
  req.user = payload;
  next();
}

function requirePrivileged(req, res, next) {
  const payload = verifyToken(req);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'cfo')) {
    return res.status(403).json({ error: 'Insufficient privileges.' });
  }
  req.user = payload;
  next();
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

// A04 — SQL Injection: username is interpolated into the query string.
// Login bypass: username = ' OR '1'='1' --
// UNION extraction: pivot via /api/statement after auth
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const hashed = md5(password);

  const query = `SELECT id, username, email, role, full_name
                 FROM users
                 WHERE username = '${username}'
                   AND password = '${hashed}'`;
  let row;
  try {
    row = db.prepare(query).get();
  } catch (err) {
    // Verbose error — leaks query structure (A05)
    return res.status(500).json({ error: 'Database query failed.', detail: err.message });
  }

  if (!row) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { id: row.id, username: row.username, role: row.role, name: row.full_name },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '8h' }
  );

  res.cookie('ns_token', token, { httpOnly: false });

  const resp = {
    token,
    user: { id: row.id, username: row.username, role: row.role, name: row.full_name },
  };

  // Flag 3 is embedded in the response when SQL injection is detected
  if (process.env.NODE_ENV === 'development') {
    resp._debug = { executed_query: query };
  }
  const injectionPattern = /['";\-\-]|(\bOR\b)|(\bUNION\b)/i;
  if (injectionPattern.test(username)) {
    resp.security_notice = 'FLAG{sql_1nj3ct10n_0p3n5_th3_v4ult_d00r}';
  }

  return res.json(resp);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('ns_token');
  res.json({ message: 'Logged out.' });
});

// ─── Profile & Accounts ───────────────────────────────────────────────────────

app.get('/api/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, full_name FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

app.get('/api/accounts', requireAuth, (req, res) => {
  const accounts = db.prepare(
    'SELECT id, account_number, account_type, balance FROM accounts WHERE user_id = ?'
  ).all(req.user.id);
  res.json({ accounts });
});

// A01 — Broken Access Control (IDOR) + A04 — SQL Injection (UNION):
// account_id is not validated against the authenticated user.
// account_id=7 → CFO savings account; transaction row 11 has Flag 5 in notes.
// UNION payload: 0 UNION SELECT id,secret_name,flag,4,5,6,7,8,9 FROM vault_secrets--
app.get('/api/statement', requireAuth, (req, res) => {
  const { account_id } = req.query;
  if (!account_id) return res.status(400).json({ error: 'account_id is required.' });

  const query = `
    SELECT t.id, t.date, t.description, t.amount, t.balance_after, t.notes,
           a.account_number, a.account_type, a.balance AS current_balance
    FROM   transactions t
    JOIN   accounts a ON a.id = t.account_id
    WHERE  t.account_id = ${account_id}
    ORDER  BY t.date DESC`;

  let rows;
  try {
    rows = db.prepare(query).all();
  } catch (err) {
    return res.status(500).json({ error: 'Query error.', detail: err.message });
  }

  res.json({ account_id, transactions: rows });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// A05 — Default credentials: admin / admin123
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.json({
      authenticated: true,
      flag: 'FLAG{d3f4ult_cr3d5_4r3_4_f1n4nc14l_cr1m3}',
      message: 'Welcome, Administrator.',
    });
  }
  res.status(401).json({ error: 'Invalid administrator credentials.' });
});

// A02 — JWT privilege escalation:
// Forge a token with role:'admin' using known JWT_SECRET or alg:none.
// /api/admin/users is only reachable with role=admin → Flag 8 returned.
app.get('/api/admin/users', requirePrivileged, (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, full_name FROM users').all();
  const payload = { users };
  if (req.user.role === 'admin') {
    payload.system_flag = 'FLAG{jwt_4lg0r1thm_c0nfus10n_pr1v_3sc}';
  }
  res.json(payload);
});

app.get('/api/admin/audit', requirePrivileged, (req, res) => {
  const entries = db.prepare(`
    SELECT u.username, a.account_number, t.date, t.description, t.amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    JOIN users u    ON u.id = a.user_id
    ORDER BY t.date DESC LIMIT 50`).all();
  res.json({ audit_log: entries });
});

// After CFO crack (Flag 7): cfo.harris logs in via /api/auth/login,
// gets a cfo-role token, which reaches requirePrivileged.
// Flag 7 is delivered on the CFO dashboard page (client-side check on role).

// ─── Transfer / SSRF ──────────────────────────────────────────────────────────

// A10 — SSRF: callback_url is fetched server-side without allowlist or scheme check.
// Flag 9: callback_url = http://localhost:8888/internal/config
// Flag 10: callback_url = file:///var/www/app/secret/master_key.txt
app.post('/api/transfer/notify', requireAuth, async (req, res) => {
  const { to_account, amount, callback_url, memo } = req.body;

  if (!to_account || !amount) {
    return res.status(400).json({ error: 'to_account and amount are required.' });
  }

  const result = {
    transfer_id: `TXN${Date.now()}`,
    status: 'processed',
    to_account,
    amount: parseFloat(amount).toFixed(2),
    memo: memo || '',
    timestamp: new Date().toISOString(),
  };

  if (callback_url) {
    try {
      const response = await fetch(callback_url, { method: 'GET', timeout: 4000 });
      const body = await response.text();
      result.notification = { status: 'delivered', response: body };
    } catch (err) {
      result.notification = { status: 'failed', error: err.message };
    }
  }

  res.json(result);
});

app.post('/api/transfer/submit', requireAuth, (req, res) => {
  const { from_account, to_account, amount, memo } = req.body;
  if (!from_account || !to_account || !amount) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  res.json({
    transfer_id: `TXN${Date.now()}`,
    status: 'pending_review',
    from: from_account,
    to: to_account,
    amount: parseFloat(amount).toFixed(2),
    memo: memo || '',
    estimated_completion: '1-2 business days',
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'), err => {
    if (err) res.status(404).json({ error: 'Not found.' });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NorthStar Portal] Running on port ${PORT} (${process.env.NODE_ENV})`);
});
