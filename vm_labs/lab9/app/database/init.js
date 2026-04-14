'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const crypto   = require('crypto');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'northstar.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'customer',
    full_name  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    account_number TEXT    NOT NULL UNIQUE,
    account_type   TEXT    NOT NULL DEFAULT 'checking',
    balance        REAL    NOT NULL DEFAULT 0.00
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id    INTEGER NOT NULL REFERENCES accounts(id),
    date          TEXT    NOT NULL,
    description   TEXT    NOT NULL,
    amount        REAL    NOT NULL,
    balance_after REAL    NOT NULL,
    notes         TEXT    DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS vault_secrets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    secret_name TEXT NOT NULL,
    flag        TEXT NOT NULL
  );
`);

const insertUser  = db.prepare('INSERT OR IGNORE INTO users (username, email, password, role, full_name) VALUES (?, ?, ?, ?, ?)');
const insertAcct  = db.prepare('INSERT OR IGNORE INTO accounts (id, user_id, account_number, account_type, balance) VALUES (?, ?, ?, ?, ?)');
const insertTxn   = db.prepare('INSERT OR IGNORE INTO transactions (id, account_id, date, description, amount, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insertVault = db.prepare('INSERT OR IGNORE INTO vault_secrets (id, secret_name, flag) VALUES (?, ?, ?)');

const seed = db.transaction(() => {
  insertUser.run('john.doe',   'john.doe@northstarbank.com',   md5('password123'), 'customer', 'John Doe');
  insertUser.run('jane.smith', 'jane.smith@northstarbank.com', md5('qwerty'),      'customer', 'Jane Smith');
  insertUser.run('cfo.harris', 'c.harris@northstarbank.com',   md5('sunshine'),    'cfo',      'Catherine Harris');
  insertUser.run('admin',      'admin@northstarbank.com',      md5('admin123'),    'admin',    'System Administrator');

  const john  = db.prepare("SELECT id FROM users WHERE username='john.doe'").get();
  const jane  = db.prepare("SELECT id FROM users WHERE username='jane.smith'").get();
  const cfo   = db.prepare("SELECT id FROM users WHERE username='cfo.harris'").get();
  const admin = db.prepare("SELECT id FROM users WHERE username='admin'").get();

  insertAcct.run(1, john.id,  'NS-100-442-7701', 'checking',     12480.55);
  insertAcct.run(2, john.id,  'NS-100-442-7702', 'savings',      31200.00);
  insertAcct.run(3, jane.id,  'NS-100-553-8801', 'checking',      4875.20);
  insertAcct.run(4, jane.id,  'NS-100-553-8802', 'savings',      18900.00);
  insertAcct.run(5, cfo.id,   'NS-100-001-0010', 'checking',    284750.00);
  insertAcct.run(6, cfo.id,   'NS-100-001-0011', 'money_market',1500000.00);
  insertAcct.run(7, cfo.id,   'NS-100-001-0012', 'savings',      950000.00);
  insertAcct.run(8, admin.id, 'NS-100-000-0001', 'admin_reserve',    0.00);

  // John's transactions (normal)
  insertTxn.run(1, 1, '2025-01-02', 'Direct deposit — payroll',   3200.00, 12480.55, null);
  insertTxn.run(2, 1, '2025-01-05', 'Utility — ConEd',            -142.80, 12337.75, null);
  insertTxn.run(3, 1, '2025-01-08', 'Online purchase — Amazon',    -67.44, 12270.31, null);
  insertTxn.run(4, 1, '2025-01-10', 'ATM withdrawal',             -300.00, 11970.31, null);
  insertTxn.run(5, 1, '2025-01-15', 'Direct deposit — payroll',   3200.00, 15170.31, null);
  insertTxn.run(6, 1, '2025-01-18', 'Grocery — Whole Foods',        -89.12, 15081.19, null);
  insertTxn.run(7, 1, '2025-01-22', 'Subscription — Netflix',       -15.99, 15065.20, null);

  // CFO savings account (account_id=7) — IDOR target; flag in notes of txn 11
  insertTxn.run(8,  7, '2024-10-01', 'Opening deposit',            950000.00, 950000.00,  null);
  insertTxn.run(9,  7, '2024-11-15', 'Annual performance bonus',    75000.00, 1025000.00, null);
  insertTxn.run(10, 7, '2024-12-01', 'Quarterly interest credit',    1843.75, 1026843.75, null);
  insertTxn.run(11, 7, '2025-01-03', 'Internal transfer — audit ref',   0.00, 1026843.75,
    'INTERNAL: Audit case #2025-CFO-01. FLAG{1d0r_expos3d_th3_cf0_4cc0unt_d4t4}');

  // vault_secrets — UNION SQLi target
  insertVault.run(1, 'q4_master_passphrase',  'FLAG{un10n_b4s3d_3xtr4ct10n_h1ts_p4yd1rt}');
  insertVault.run(2, 'swift_integration_key', 'REDACTED-PROD-KEY-7f3a9b2c');
  insertVault.run(3, 'hsm_pin_backup',        'REDACTED-HSM-4421');
});

seed();

module.exports = db;
