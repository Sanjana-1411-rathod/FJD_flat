const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'authentijob.sqlite');

const db = new Database(dbPath);

db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobTitle TEXT,
    company TEXT,
    description TEXT,
    sourceUrl TEXT,
    reporterEmail TEXT
)`);

console.log('Connected to the SQLite database.');

module.exports = db;