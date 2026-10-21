const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./krishna_corp.db');

db.run("ALTER TABLE partners ADD COLUMN type TEXT;", (err) => {
  if (err) {
    console.log("Column 'type' might already exist or error:", err.message);
  } else {
    console.log("Success! Added 'type' column to partners table.");
  }
  db.close();
});