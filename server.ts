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

function seedDatabase() {
  const contactCount = (db.prepare("SELECT COUNT(*) as count FROM contacts").get() as any).count;
  if (contactCount === 0) {
    console.log("Seeding sample data...");
    
    // Seed Contacts
    const insertContact = db.prepare(
      "INSERT INTO contacts (type, name, tin, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)"
    );
    
    const c1 = insertContact.run('customer', 'Ali Bin Ahmad', 'C1234567890', 'ali@example.com', '012-3456789', 'Kuala Lumpur').lastInsertRowid;
    const c2 = insertContact.run('customer', 'Siti Nurhaliza', 'C9876543210', 'siti@example.com', '019-8765432', 'Selangor').lastInsertRowid;
    const s1 = insertContact.run('supplier', 'Office Depot MY', 'S1122334455', 'sales@officedepot.my', '03-12345678', 'Petaling Jaya').lastInsertRowid;
    const s2 = insertContact.run('supplier', 'TNB Berhad', 'S5544332211', 'billing@tnb.com.my', '1300-88-5454', 'Kuala Lumpur').lastInsertRowid;

    // Seed Transactions
    const insertTransaction = db.prepare(
      "INSERT INTO transactions (type, amount, category, contact_id, description, date, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const threeWeeksAgo = new Date(Date.now() - 21 * 86400000).toISOString().split('T')[0];

    // Revenue
    insertTransaction.run('income', 1500.00, 'Consulting', c1, 'Web Development Services', lastWeek, JSON.stringify({ invoiceNumber: 'INV-001' }));
    insertTransaction.run('income', 2500.00, 'Sales', c2, 'Product Sales - Bundle A', yesterday, JSON.stringify({ invoiceNumber: 'INV-002' }));
    insertTransaction.run('income', 4200.00, 'Consulting', c1, 'Cloud Migration Project', twoWeeksAgo, JSON.stringify({ invoiceNumber: 'INV-003' }));
    insertTransaction.run('income', 850.00, 'Maintenance', c2, 'Monthly Server Maintenance', threeWeeksAgo, JSON.stringify({ invoiceNumber: 'INV-004' }));
    insertTransaction.run('income', 3100.00, 'Sales', c1, 'Hardware Upgrade - Office Set', today, JSON.stringify({ invoiceNumber: 'INV-005' }));

    // Expenses
    insertTransaction.run('expense', 450.00, 'Utilities', s2, 'Electricity Bill - Feb 2026', yesterday, JSON.stringify({}));
    insertTransaction.run('expense', 120.50, 'Office Supplies', s1, 'Stationery and Paper', today, JSON.stringify({}));
    insertTransaction.run('expense', 2100.00, 'Rent', null, 'Office Rent - March 2026', threeWeeksAgo, JSON.stringify({}));
    insertTransaction.run('expense', 350.00, 'Marketing', null, 'Social Media Ads - Campaign X', lastWeek, JSON.stringify({}));
    insertTransaction.run('expense', 85.00, 'Travel', null, 'Grab - Client Meeting', yesterday, JSON.stringify({}));
    insertTransaction.run('expense', 150.00, 'Utilities', null, 'Water Bill', twoWeeksAgo, JSON.stringify({}));
    
    console.log("Seeding complete.");
  }
}

seedDatabase();

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
