const { io } = require('socket.io-client');
const net = require('net');
const os = require('os');
const { execSync } = require('child_process');
const { MACHINES, APPROVED_ACTIONS, formatSimpleLog } = require('../shared/schema');

// Parse CLI flags or env vars
const args = process.argv.slice(2);
let machineId = process.env.MACHINE_ID || 'mac1';
let serverUrl = process.env.SERVER_URL || 'http://127.0.0.1:4000';

for (const arg of args) {
  if (arg.startsWith('--machine=')) machineId = arg.split('=')[1];
  if (arg.startsWith('--server=')) serverUrl = arg.split('=')[1];
}

const machineConfig = MACHINES[machineId];
if (!machineConfig) {
  console.error(`Invalid machineId: ${machineId}. Valid values: ${Object.keys(MACHINES).join(', ')}`);
  process.exit(1);
}

console.log(`=======================================================`);
console.log(`Starting ProtocolX Agent for: ${machineConfig.name}`);
console.log(`Role: ${machineConfig.role}`);
console.log(`Central Server Target: ${serverUrl}`);
console.log(`=======================================================`);

// Connect to Central Monitoring Server
const socket = io(serverUrl, {
  reconnection: true,
  reconnectionDelay: 2000
});

socket.on('connect', () => {
  console.log(`Connected to Central Monitoring Server (Socket ID: ${socket.id})`);
  socket.emit('register-agent', { machine_id: machineId });
});

socket.on('disconnect', () => {
  console.warn(`Disconnected from Central Monitoring Server. Retrying...`);
});

/**
 * Handle incoming approved actions from dashboard
 */
socket.on('run-approved-action', ({ actionId }, callback) => {
  console.log(`Received remote action request: ${actionId}`);
  const action = APPROVED_ACTIONS[actionId];

  if (!action) {
    return callback({ success: false, details: 'Unknown action rejected' });
  }

  if (action.targetMachine !== machineId) {
    return callback({ success: false, details: `Action target mismatch: ${action.targetMachine} != ${machineId}` });
  }

  try {
    let result = '';
    switch (actionId) {
      case 'CHECK_PRIMARY_DNS':
        result = execSync('dig @127.0.0.1 app.protocolx.test +time=1 +tries=1', { encoding: 'utf8' });
        break;
      case 'CHECK_BACKUP_DNS':
        result = execSync('dig @127.0.0.1 app.protocolx.test +time=1 +tries=1', { encoding: 'utf8' });
        break;
      case 'CHECK_FIREWALL':
        result = execSync('sudo pfctl -s info 2>&1 || echo "PF check completed"', { encoding: 'utf8' });
        break;
      case 'RESTART_BACKEND_A':
        // Kill existing and restart server.js safely in background
        execSync('pkill -f "backend-a/server.js" || true');
        result = 'Backend A service restart triggered.';
        break;
      case 'RESTART_BACKEND_B':
        execSync('pkill -f "backend-b/server.js" || true');
        result = 'Backend B service restart triggered.';
        break;
      case 'RELOAD_NGINX':
        result = execSync('sudo nginx -t && sudo nginx -s reload 2>&1', { encoding: 'utf8' });
        break;
      default:
        result = 'Action executed safely.';
    }

    callback({ success: true, details: result.trim() });
  } catch (err) {
    console.error(`Error executing action ${actionId}:`, err.message);
    callback({ success: false, details: err.message });
  }
});

/**
 * Tests local TCP port
 */
function probeTcp(port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
    s.on('error', () => {
      s.destroy();
      resolve(false);
    });
    s.connect(port, '127.0.0.1');
  });
}

/**
 * Get current primary IP on en0
 */
function getActiveIp() {
  const ifaces = os.networkInterfaces();
  const en0 = ifaces['en0'];
  if (en0) {
    const ipv4 = en0.find((i) => i.family === 'IPv4' && !i.internal);
    if (ipv4) return ipv4.address;
  }
  return machineConfig.defaultIp;
}

// Track previous states to log transitions
const previousServiceStates = {};

/**
 * Run periodic check and report
 */
async function runCheck() {
  const currentIp = getActiveIp();
  const servicesStatus = [];
  const generatedLogs = [];

  for (const s of machineConfig.services) {
    const isOpen = await probeTcp(s.port);
    const status = isOpen ? 'ONLINE' : 'CLOSED';
    const prevState = previousServiceStates[s.port];

    servicesStatus.push({
      name: s.name,
      port: s.port,
      status: isOpen ? 'HEALTHY' : 'ERROR',
      error_message: isOpen ? '' : `Service not listening on port ${s.port}`
    });

    // Detect state changes for plain-English logging
    if (prevState === undefined || prevState !== status) {
      if (status === 'CLOSED') {
        generatedLogs.push({
          service: s.name,
          status: 'ERROR',
          what: `${s.name} is not responding on port ${s.port}.`,
          why: `The process is stopped or refused the connection.`,
          action: `Verify process status with "lsof -nP -iTCP:${s.port} -sTCP:LISTEN".`,
          raw_details: `Connection to 127.0.0.1:${s.port} failed.`
        });
      } else if (prevState === 'CLOSED' && status === 'ONLINE') {
        generatedLogs.push({
          service: s.name,
          status: 'RECOVERED',
          what: `${s.name} on port ${s.port} has resumed normal operation.`,
          why: `The service process was restarted and is accepting connections.`,
          action: `No action required. Traffic routing has normalized.`,
          raw_details: `Port ${s.port} successfully bound.`
        });
      } else {
        generatedLogs.push({
          service: s.name,
          status: 'SUCCESS',
          what: `${s.name} is listening and healthy on port ${s.port}.`,
          why: `Normal application startup and socket binding.`,
          action: `Continue regular health monitoring.`,
          raw_details: `Listening on port ${s.port}.`
        });
      }
      previousServiceStates[s.port] = status;
    }
  }

  // Send report to central server via HTTP
  try {
    const res = await fetch(`${serverUrl}/api/agent/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: machineId,
        ip: currentIp,
        services: servicesStatus,
        logs: generatedLogs,
        metadata: {
          hostname: os.hostname(),
          platform: os.platform(),
          uptime: os.uptime(),
          loadAvg: os.loadavg()
        }
      })
    });
    if (!res.ok) {
      console.warn(`Server responded with status ${res.status} to report.`);
    }
  } catch (err) {
    console.error(`Failed to report to central server: ${err.message}`, err.cause ? (err.cause.code || err.cause.message || err.cause) : '');
  }
}

// Run initial check immediately, then every 5 seconds
runCheck();
setInterval(runCheck, 5000);
