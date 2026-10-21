const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./krishna_corp.db');

db.serialize(() => {
  db.run("DELETE FROM items");
  db.run("DELETE FROM employees");
  db.run("DELETE FROM assets");
  db.run("DELETE FROM expenses");
  db.run("DELETE FROM settlements");
  db.run("DELETE FROM partners");
  console.log("Success! All data has been cleared from krishna_corp.db.");
});

db.close();