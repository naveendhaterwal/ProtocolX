const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'protocolx.sqlite');
const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    ip TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OFFLINE',
    last_seen INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    name TEXT NOT NULL,
    port INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNKNOWN',
    last_checked INTEGER DEFAULT 0,
    error_message TEXT DEFAULT '',
    FOREIGN KEY(machine_id) REFERENCES machines(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    machine_id TEXT NOT NULL,
    machine_name TEXT NOT NULL,
    service TEXT NOT NULL,
    status TEXT NOT NULL,
    what TEXT NOT NULL,
    why TEXT NOT NULL,
    action TEXT NOT NULL,
    raw_details TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    action_id TEXT NOT NULL,
    target_machine TEXT NOT NULL,
    user TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT DEFAULT ''
  );
`);

// Seed default machines if not present
const { MACHINES } = require('../shared/schema');
const insertMachine = db.prepare(`
  INSERT OR IGNORE INTO machines (id, name, role, ip, status, last_seen)
  VALUES (?, ?, ?, ?, 'OFFLINE', 0)
`);

for (const m of Object.values(MACHINES)) {
  insertMachine.run(m.id, m.name, m.role, m.defaultIp);
}

module.exports = {
  db,
  getMachines: () => db.prepare('SELECT * FROM machines').all(),
  updateMachineStatus: (id, ip, status, metadata = {}) => {
    db.prepare(`
      UPDATE machines
      SET ip = ?, status = ?, last_seen = ?, metadata = ?
      WHERE id = ?
    `).run(ip, status, Date.now(), JSON.stringify(metadata), id);
  },
  upsertService: (machineId, name, port, status, errorMessage = '') => {
    const id = `${machineId}_${port}`;
    db.prepare(`
      INSERT INTO services (id, machine_id, name, port, status, last_checked, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        last_checked = excluded.last_checked,
        error_message = excluded.error_message
    `).run(id, machineId, name, port, status, Date.now(), errorMessage);
  },
  getServices: () => db.prepare('SELECT * FROM services').all(),
  insertLog: (entry) => {
    const stmt = db.prepare(`
      INSERT INTO logs (timestamp, machine_id, machine_name, service, status, what, why, action, raw_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.timestamp || Date.now(),
      entry.machine_id,
      entry.machine_name,
      entry.service,
      entry.status,
      entry.what,
      entry.why,
      entry.action,
      entry.raw_details || ''
    );
  },
  getRecentLogs: (limit = 50) => {
    return db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  },
  insertAuditLog: (actionId, targetMachine, user, status, details = '') => {
    db.prepare(`
      INSERT INTO audit_logs (timestamp, action_id, target_machine, user, status, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Date.now(), actionId, targetMachine, user, status, details);
  },
  getAuditLogs: (limit = 50) => {
    return db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  }
};
