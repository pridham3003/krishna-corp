const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./krishna_corp.db');

fs.readFile('./backup.json', 'utf8', (err, data) => {
  if (err) {
    console.error("Could not find backup.json! Make sure it's in the project folder.");
    return;
  }

  const backup = JSON.parse(data);

  db.serialize(() => {
    // Restore Items
    if (backup.items) {
      db.run("DELETE FROM items");
      const stmt = db.prepare("INSERT INTO items (date, type, partyName, product, quantity, price, billNumber, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      backup.items.forEach(i => stmt.run(i.date, i.type, i.partyName, i.product, i.quantity, i.price, i.billNumber, i.paidBy, i.paymentMode));
      stmt.finalize();
    }

    // Restore Employees
    if (backup.employees) {
      db.run("DELETE FROM employees");
      const stmt = db.prepare("INSERT INTO employees (date, name, salary, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?)");
      backup.employees.forEach(e => stmt.run(e.date, e.name, e.salary, e.paidBy, e.paymentMode));
      stmt.finalize();
    }

    // Restore Assets
    if (backup.assets) {
      db.run("DELETE FROM assets");
      const stmt = db.prepare("INSERT INTO assets (date, type, name, price, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?, ?)");
      backup.assets.forEach(a => stmt.run(a.date, a.type, a.name, a.price, a.paidBy, a.paymentMode));
      stmt.finalize();
    }

    // Restore Expenses
    if (backup.expenses) {
      db.run("DELETE FROM expenses");
      const stmt = db.prepare("INSERT INTO expenses (date, category, description, amount, paidBy, paymentMode) VALUES (?, ?, ?, ?, ?, ?)");
      backup.expenses.forEach(ex => stmt.run(ex.date, ex.category, ex.description, ex.amount, ex.paidBy, ex.paymentMode));
      stmt.finalize();
    }

    // Restore Settlements
    if (backup.settlements) {
      db.run("DELETE FROM settlements");
      const stmt = db.prepare("INSERT INTO settlements (date, partyName, type, amount, paymentMode, note) VALUES (?, ?, ?, ?, ?, ?)");
      backup.settlements.forEach(st => stmt.run(st.date, st.partyName, st.type, st.amount, st.paymentMode, st.note));
      stmt.finalize();
    }

    // Restore Partners
    if (backup.partners) {
      db.run("DELETE FROM partners");
      const stmt = db.prepare("INSERT INTO partners (date, name, amount, paymentMode) VALUES (?, ?, ?, ?)");
      backup.partners.forEach(p => stmt.run(p.date, p.name, p.amount, p.paymentMode));
      stmt.finalize();
    }

    console.log("Success! All old data from backup.json has been imported into krishna_corp.db.");
  });

  db.close();
});