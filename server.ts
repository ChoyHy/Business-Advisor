import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("sme_business.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('customer', 'supplier')),
    name TEXT NOT NULL,
    tin TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('income', 'expense')),
    amount REAL,
    category TEXT,
    contact_id INTEGER,
    description TEXT,
    date TEXT,
    image_data TEXT,
    metadata TEXT,
    lhdn_status TEXT DEFAULT 'draft',
    lhdn_uuid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(contact_id) REFERENCES contacts(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/contacts", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM contacts ORDER BY name ASC").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", (req, res) => {
    const { type, name, tin, email, phone, address } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO contacts (type, name, tin, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(type, name, tin, email, phone, address);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to save contact" });
    }
  });

  app.get("/api/transactions", (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT t.*, c.name as contact_name 
        FROM transactions t 
        LEFT JOIN contacts c ON t.contact_id = c.id 
        ORDER BY date DESC
      `).all();
      res.json(rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", (req, res) => {
    const { type, amount, category, contact_id, description, date, image_data, metadata } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO transactions (type, amount, category, contact_id, description, date, image_data, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(type, amount, category, contact_id, description, date, image_data, JSON.stringify(metadata));
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save transaction" });
    }
  });

  // LHDN Sandbox Simulation
  app.post("/api/lhdn/submit", (req, res) => {
    const { transactionId } = req.body;
    // Simulate LHDN validation logic
    const random = Math.random();
    if (random > 0.1) {
      const uuid = `LHDN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      db.prepare("UPDATE transactions SET lhdn_status = 'submitted', lhdn_uuid = ? WHERE id = ?")
        .run(uuid, transactionId);
      res.json({ 
        success: true, 
        uuid,
        message: "E-Invoice successfully validated and submitted to LHDN Sandbox." 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: "LHDN Validation Error: [E01] Invalid TIN format for receiver." 
      });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
