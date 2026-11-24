const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { MACHINES, APPROVED_ACTIONS, SUGGESTIONS, formatSimpleLog } = require('../shared/schema');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'protocolx-admin';

app.use(cors());
app.use(express.json());

// Serve static dashboard if built
const dashboardDist = path.join(__dirname, '../dashboard/dist');
app.use(express.static(dashboardDist));

/**
 * Returns overall system status and active suggestions
 */
app.get('/api/status', (req, res) => {
  const machines = db.getMachines();
  const services = db.getServices();

  // Combine services into machines
  const combined = machines.map(m => {
    const machineServices = services.filter(s => s.machine_id === m.id);
    const hasError = machineServices.some(s => s.status === 'ERROR' || s.status === 'CLOSED');
    const isOnline = (Date.now() - m.last_seen) < 30000; // seen within 30s
    return {
      ...m,
      isOnline,
      services: machineServices,
      calculatedHealth: !isOnline ? 'OFFLINE' : (hasError ? 'DEGRADED' : 'HEALTHY')
    };
  });

  // Calculate active diagnostic suggestions
  const activeSuggestions = [];
  const bA = services.find(s => s.id === 'mac3_3001');
  if (bA && (bA.status === 'ERROR' || bA.status === 'CLOSED')) {
    activeSuggestions.push({ key: 'BACKEND_A_DOWN', ...SUGGESTIONS.BACKEND_A_DOWN });
  }

  const bB = services.find(s => s.id === 'mac4_3002');
  if (bB && (bB.status === 'ERROR' || bB.status === 'CLOSED')) {
    activeSuggestions.push({ key: 'BACKEND_B_DOWN', ...SUGGESTIONS.BACKEND_B_DOWN });
  }

  const ng80 = services.find(s => s.id === 'mac2_80');
  const ng443 = services.find(s => s.id === 'mac2_443');
  if ((ng80 && ng80.status === 'CLOSED') || (ng443 && ng443.status === 'CLOSED')) {
    activeSuggestions.push({ key: 'NGINX_DOWN', ...SUGGESTIONS.NGINX_DOWN });
  }

  const dns53 = services.find(s => s.id === 'mac1_53');
  if (dns53 && (dns53.status === 'ERROR' || dns53.status === 'CLOSED')) {
    activeSuggestions.push({ key: 'DNS_FAIL', ...SUGGESTIONS.DNS_FAIL });
  }

  res.json({
    success: true,
    timestamp: Date.now(),
    machines: combined,
    suggestions: activeSuggestions,
    approvedActions: Object.values(APPROVED_ACTIONS)
  });
});

/**
 * Log retrieval
 */
app.get('/api/logs', (req, res) => {
  const logs = db.getRecentLogs(req.query.limit ? parseInt(req.query.limit) : 50);
  res.json({ success: true, logs });
});

/**
 * Audit log retrieval
 */
app.get('/api/audit', (req, res) => {
  const audits = db.getAuditLogs(req.query.limit ? parseInt(req.query.limit) : 50);
  res.json({ success: true, audits });
});

/**
 * Ingest heartbeat / report from monitoring agents
 */
app.post('/api/agent/report', (req, res) => {
  const { machine_id, ip, services, logs, metadata } = req.body;
  if (!machine_id || !MACHINES[machine_id]) {
    return res.status(400).json({ success: false, error: 'Invalid machine_id' });
  }

  // Update machine heartbeat
  db.updateMachineStatus(machine_id, ip || MACHINES[machine_id].defaultIp, 'ONLINE', metadata || {});

  // Update services
  if (Array.isArray(services)) {
    for (const s of services) {
      db.upsertService(machine_id, s.name, s.port, s.status, s.error_message || '');
    }
  }

  // Insert logs
  if (Array.isArray(logs)) {
    for (const l of logs) {
      db.insertLog({
        machine_id,
        machine_name: MACHINES[machine_id].name,
        service: l.service || 'System',
        status: l.status || 'INFO',
        what: l.what || '',
        why: l.why || '',
        action: l.action || '',
        raw_details: l.raw_details || ''
      });
      // Broadcast log event immediately
      io.emit('new-log', {
        ...l,
        machine_id,
        machine_name: MACHINES[machine_id].name,
        timestamp: Date.now()
      });
    }
  }

  // Notify dashboard of updated state
  io.emit('status-update', { machine_id, timestamp: Date.now() });

  res.json({ success: true });
});

/**
 * Execute an approved action (strictly authenticated & audited)
 */
app.post('/api/actions/execute', async (req, res) => {
  const { actionId, passcode, user, confirmed } = req.body;

  // 1. Authentication check
  if (!passcode || passcode !== ADMIN_PASSCODE) {
    db.insertAuditLog(actionId || 'UNKNOWN', 'unknown', user || 'anonymous', 'DENIED', 'Invalid passcode');
    return res.status(401).json({
      success: false,
      error: 'Authentication failed. Please provide the valid admin passcode.'
    });
  }

  // 2. Action validation against strict whitelist
  const action = APPROVED_ACTIONS[actionId];
  if (!action) {
    db.insertAuditLog(actionId, 'unknown', user || 'admin', 'REJECTED', 'Action is not in approved whitelist');
    return res.status(400).json({
      success: false,
      error: 'Action rejected: Arbitrary commands are strictly forbidden.'
    });
  }

  // 3. Confirmation check
  if (!confirmed) {
    return res.status(400).json({
      success: false,
      error: 'Confirmation required before executing remote service management actions.'
    });
  }

  // 4. Dispatch action to target agent via Socket.IO
  const targetMachine = action.targetMachine;
  const targetRoom = `agent:${targetMachine}`;

  try {
    const clients = await io.in(targetRoom).fetchSockets();
    if (clients.length === 0) {
      const errMsg = `Target machine agent (${MACHINES[targetMachine].name}) is not currently connected via Socket.IO.`;
      db.insertAuditLog(actionId, targetMachine, user || 'admin', 'FAILED', errMsg);
      return res.status(503).json({ success: false, error: errMsg });
    }

    // Send action to target agent and wait for acknowledgment
    const targetSocket = clients[0];
    targetSocket.timeout(10000).emit('run-approved-action', { actionId }, (err, response) => {
      if (err) {
        db.insertAuditLog(actionId, targetMachine, user || 'admin', 'TIMEOUT', err.message);
        return res.status(504).json({ success: false, error: 'Agent timed out responding to execution command.' });
      }

      db.insertAuditLog(actionId, targetMachine, user || 'admin', response.success ? 'SUCCESS' : 'FAILED', response.details);
      
      // Broadcast audit event
      io.emit('audit-event', {
        actionId,
        targetMachine,
        status: response.success ? 'SUCCESS' : 'FAILED',
        timestamp: Date.now()
      });

      return res.json({ success: response.success, result: response });
    });
  } catch (err) {
    db.insertAuditLog(actionId, targetMachine, user || 'admin', 'ERROR', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Agent registration
  socket.on('register-agent', (data) => {
    const { machine_id } = data;
    if (machine_id && MACHINES[machine_id]) {
      socket.join(`agent:${machine_id}`);
      console.log(`Agent registered for ${MACHINES[machine_id].name} (socket ${socket.id})`);
    }
  });

  // Client joining dashboard
  socket.on('join-dashboard', () => {
    socket.join('dashboard');
  });
});

// Fallback to React app for SPA routing
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(dashboardDist, 'index.html'), (err) => {
      if (err) {
        res.status(200).send(`
          <html>
            <head><title>ProtocolX Central Monitor API</title></head>
            <body style="font-family: sans-serif; padding: 2rem;">
              <h2>ProtocolX Central Monitoring Server</h2>
              <p>Status: <strong>Running on port ${PORT}</strong></p>
              <p>API Endpoint: <a href="/api/status">/api/status</a></p>
              <p>Logs Endpoint: <a href="/api/logs">/api/logs</a></p>
            </body>
          </html>
        `);
      }
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ProtocolX Central Monitoring Server active on http://0.0.0.0:${PORT}`);
});
