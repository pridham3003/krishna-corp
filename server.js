const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize SQLite Database
const dbFile = path.join(__dirname, 'krishna_corp.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Create Tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    type TEXT,
    partyName TEXT,
    product TEXT,
    quantity REAL,
    price REAL,
    billNumber TEXT,
    paidBy TEXT,
    paymentMode TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    name TEXT,
    salary REAL,
    paidBy TEXT,
    paymentMode TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    type TEXT,
    name TEXT,
    price REAL,
    paidBy TEXT,
    paymentMode TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    category TEXT,
    description TEXT,
    amount REAL,
    paidBy TEXT,
    paymentMode TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    type TEXT,
    partyName TEXT,
    amount REAL,
    paymentMode TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    type TEXT,
    name TEXT,
    amount REAL,
    paymentMode TEXT
  )`);
});

// Generic GET endpoint
app.get('/api/:table', (req, res) => {
  const table = req.params.table;
  const validTables = ['items', 'employees', 'assets', 'expenses', 'settlements', 'partners'];
  
  if (!validTables.includes(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Generic POST endpoint (Replace-all sync per table)
app.post('/api/:table', (req, res) => {
  const table = req.params.table;
  const validTables = ['items', 'employees', 'assets', 'expenses', 'settlements', 'partners'];
  
  if (!validTables.includes(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  const dataArray = req.body;
  if (!Array.isArray(dataArray)) {
    return res.status(400).json({ error: 'Request body must be an array of objects' });
  }

  db.serialize(() => {
    db.run(`DELETE FROM ${table}`, (err) => {
      if (err) {
        console.error(`Error clearing ${table}:`, err.message);
      }
    });

    let stmtQuery = '';
    if (table === 'items') {
      stmtQuery = `INSERT INTO items (date, type, partyName, product, quantity, price, billNumber, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      dataArray.forEach(item => {
        db.run(stmtQuery, [item.date, item.type, item.partyName, item.product, item.quantity, item.price, item.billNumber, item.paidBy, item.paymentMode]);
      });
    } else if (table === 'employees') {
      stmtQuery = `INSERT INTO employees (date, name, salary, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?)`;
      dataArray.forEach(item => {
        db.run(stmtQuery, [item.date, item.name, item.salary, item.paidBy, item.paymentMode]);
      });
    } else if (table === 'assets') {
      stmtQuery = `INSERT INTO assets (date, type, name, price, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?, ?)`;
      dataArray.forEach(item => {
        db.run(stmtQuery, [item.date, item.type, item.name, item.price, item.paidBy, item.paymentMode]);
      });
    } else if (table === 'expenses') {
      stmtQuery = `INSERT INTO expenses (date, category, description, amount, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?, ?)`;
      dataArray.forEach(item => {
        db.run(stmtQuery, [item.date, item.category, item.description, item.amount, item.paidBy, item.paymentMode]);
      });
    } else if (table === 'settlements') {
      stmtQuery = `INSERT INTO settlements (date, type, partyName, amount, paymentMode) VALUES (?, ?, ?, ?, ?)`;
      dataArray.forEach(item => {
        db.run(stmtQuery, [item.date, item.type, item.partyName, item.amount, item.paymentMode]);
      });
    } else if (table === 'partners') {
      stmtQuery = `INSERT INTO partners (date, type, name, amount, paymentMode) VALUES (?, ?, ?, ?, ?)`;
      dataArray.forEach(item => {
        db.run(stmtQuery, [item.date, item.type || 'Investment', item.name, item.amount, item.paymentMode]);
      });
    }

    res.json({ status: 'Success', count: dataArray.length });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
