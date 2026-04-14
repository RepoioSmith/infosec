-- NorthStar Bank & Trust — Database Backup
-- Generated: 2025-03-15 02:00:01 UTC
-- Host: db-prod-01.northstarbank.internal
-- Database: northstar_prod
-- Server version: SQLite 3.45.1
-- WARNING: Contains sensitive credential data. INTERNAL USE ONLY.

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT NOT NULL UNIQUE,
  email     TEXT NOT NULL UNIQUE,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'customer',
  full_name TEXT NOT NULL
);

INSERT INTO users VALUES(1,'john.doe','john.doe@northstarbank.com','482c811da5d5b4bc6d497ffa98491e38','customer','John Doe');
INSERT INTO users VALUES(2,'jane.smith','jane.smith@northstarbank.com','d8578edf8458ce06fbc5bb76a58c5ca4','customer','Jane Smith');
INSERT INTO users VALUES(3,'cfo.harris','c.harris@northstarbank.com','0571749e2ac330a7455809c6b0e7af90','cfo','Catherine Harris');
INSERT INTO users VALUES(4,'admin','admin@northstarbank.com','0192023a7bbd73250516f069df18b500','admin','System Administrator');

CREATE TABLE IF NOT EXISTS accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  account_number TEXT NOT NULL UNIQUE,
  account_type   TEXT NOT NULL DEFAULT 'checking',
  balance        REAL NOT NULL DEFAULT 0.00
);

INSERT INTO accounts VALUES(1,1,'NS-100-442-7701','checking',12480.55);
INSERT INTO accounts VALUES(2,1,'NS-100-442-7702','savings',31200.00);
INSERT INTO accounts VALUES(3,2,'NS-100-553-8801','checking',4875.20);
INSERT INTO accounts VALUES(4,2,'NS-100-553-8802','savings',18900.00);
INSERT INTO accounts VALUES(5,3,'NS-100-001-0010','checking',284750.00);
INSERT INTO accounts VALUES(6,3,'NS-100-001-0011','money_market',1500000.00);
INSERT INTO accounts VALUES(7,3,'NS-100-001-0012','savings',950000.00);
INSERT INTO accounts VALUES(8,4,'NS-100-000-0001','admin_reserve',0.00);

COMMIT;
