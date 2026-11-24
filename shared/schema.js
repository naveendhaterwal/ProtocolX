/**
 * ProtocolX Phase 2 - Shared Schema & Types
 * Defines machine configurations, approved remote actions, and plain-English suggestion mappings.
 */

const MACHINES = {
  mac1: {
    id: 'mac1',
    name: 'Mac 1 (Naveen)',
    role: 'Primary DNS & Integration Lead',
    defaultIp: '10.7.11.221',
    services: [
      { name: 'Primary DNS (dnsmasq)', port: 53, protocol: 'udp/tcp' }
    ]
  },
  mac2: {
    id: 'mac2',
    name: 'Mac 2 (Shagun)',
    role: 'Nginx Edge, TLS & Load Balancing',
    defaultIp: '10.7.12.189',
    services: [
      { name: 'Nginx HTTP Gateway', port: 80, protocol: 'tcp' },
      { name: 'Nginx HTTPS Termination', port: 443, protocol: 'tcp' }
    ]
  },
  mac3: {
    id: 'mac3',
    name: 'Mac 3 (Archit)',
    role: 'Backend A Application Service',
    defaultIp: '10.7.16.69',
    services: [
      { name: 'Backend A Microservice', port: 3001, protocol: 'tcp' }
    ]
  },
  mac4: {
    id: 'mac4',
    name: 'Mac 4 (Aditya)',
    role: 'Backend B & Backup DNS / Firewall',
    defaultIp: '10.7.13.247',
    services: [
      { name: 'Backend B Microservice', port: 3002, protocol: 'tcp' },
      { name: 'Backup DNS Server', port: 53, protocol: 'udp/tcp' }
    ]
  }
};

const APPROVED_ACTIONS = {
  RESTART_BACKEND_A: {
    id: 'RESTART_BACKEND_A',
    label: 'Restart Backend A',
    targetMachine: 'mac3',
    description: 'Restarts the Node.js Backend A application service on port 3001.',
    commandPreview: 'node server.js (on Mac 3)',
    riskLevel: 'LOW'
  },
  RESTART_BACKEND_B: {
    id: 'RESTART_BACKEND_B',
    label: 'Restart Backend B',
    targetMachine: 'mac4',
    description: 'Restarts the Node.js Backend B application service on port 3002.',
    commandPreview: 'node server.js (on Mac 4)',
    riskLevel: 'LOW'
  },
  RELOAD_NGINX: {
    id: 'RELOAD_NGINX',
    label: 'Reload Nginx Gateway',
    targetMachine: 'mac2',
    description: 'Safely tests configuration and reloads Nginx reverse proxy worker processes.',
    commandPreview: 'sudo nginx -s reload (on Mac 2)',
    riskLevel: 'MEDIUM'
  },
  CHECK_PRIMARY_DNS: {
    id: 'CHECK_PRIMARY_DNS',
    label: 'Verify Primary DNS Service',
    targetMachine: 'mac1',
    description: 'Tests local dnsmasq resolution for app.protocolx.test.',
    commandPreview: 'dig @127.0.0.1 app.protocolx.test (on Mac 1)',
    riskLevel: 'LOW'
  },
  CHECK_BACKUP_DNS: {
    id: 'CHECK_BACKUP_DNS',
    label: 'Verify Backup DNS Service',
    targetMachine: 'mac4',
    description: 'Tests backup DNS resolution for app.protocolx.test from Mac 4.',
    commandPreview: 'dig @127.0.0.1 app.protocolx.test (on Mac 4)',
    riskLevel: 'LOW'
  },
  CHECK_FIREWALL: {
    id: 'CHECK_FIREWALL',
    label: 'Audit macOS Firewall Rules',
    targetMachine: 'mac4',
    description: 'Queries active pfctl and Application Firewall packet filter status.',
    commandPreview: 'sudo pfctl -s info (on Mac 4)',
    riskLevel: 'LOW'
  }
};

/**
 * Maps error scenarios to clear, copyable diagnostic commands and plain-English suggestions.
 */
const SUGGESTIONS = {
  BACKEND_A_DOWN: {
    problem: 'Backend A is not responding on port 3001.',
    possibleCause: 'The Node.js server process stopped, crashed, or was terminated during failover testing.',
    diagnosticCommand: 'lsof -nP -iTCP:3001 -sTCP:LISTEN',
    whatCommandDoes: 'Checks whether any running process has opened and is listening on TCP port 3001.',
    expectedResult: 'Should display a node process with PID listening on *:3001.',
    suggestedAction: 'On Mac 3, navigate to backend/backend-a and run "node server.js", or trigger "Restart Backend A" in Execute Mode.'
  },
  BACKEND_B_DOWN: {
    problem: 'Backend B is not responding on port 3002.',
    possibleCause: 'The server was shut down manually during failure demonstration or crashed.',
    diagnosticCommand: 'lsof -nP -iTCP:3002 -sTCP:LISTEN',
    whatCommandDoes: 'Inspects active network listeners on port 3002 on Mac 4.',
    expectedResult: 'Should display the active Node.js server listening on port 3002.',
    suggestedAction: 'On Mac 4, run "node server.js" in backend/backend-b or use the approved restart action.'
  },
  NGINX_DOWN: {
    problem: 'Nginx Edge proxy is not reachable on ports 80 or 443.',
    possibleCause: 'Nginx daemon has exited, configuration syntax error, or port conflict.',
    diagnosticCommand: 'sudo nginx -t -c $(pwd)/nginx/nginx.conf',
    whatCommandDoes: 'Tests the Nginx configuration file for syntax errors and valid certificate paths without starting the server.',
    expectedResult: 'nginx: configuration file test is successful',
    suggestedAction: 'On Mac 2, verify certificate paths in nginx/nginx.conf and start Nginx with "sudo nginx -c $(pwd)/nginx/nginx.conf".'
  },
  DNS_FAIL: {
    problem: 'Private domain app.protocolx.test does not resolve to the Edge proxy.',
    possibleCause: 'dnsmasq daemon is not running on Mac 1 or listening address is bound to an outdated IP.',
    diagnosticCommand: 'dig @127.0.0.1 app.protocolx.test',
    whatCommandDoes: 'Sends a direct DNS query to the local dnsmasq instance on port 53.',
    expectedResult: 'Status: NOERROR with ANSWER section returning Nginx edge IP.',
    suggestedAction: 'Run "sudo ./scripts/start_dns.sh" on Mac 1 to deploy current configuration and restart dnsmasq.'
  },
  FIREWALL_BLOCK: {
    problem: 'Target computer ping succeeds, but connection to service port times out.',
    possibleCause: 'A local packet filter (pfctl) or macOS Application Firewall is dropping incoming SYN packets.',
    diagnosticCommand: 'sudo pfctl -s rules',
    whatCommandDoes: 'Displays all active packet filtering firewall rules applied by macOS kernel.',
    expectedResult: 'No block rules targeting incoming TCP ports 80, 443, 3001, or 3002.',
    suggestedAction: 'Roll back active pf firewall rules using "sudo pfctl -d" on the affected machine.'
  }
};

/**
 * Formats a log entry into the mandatory 4-line human-readable simple English format:
 * [TIME] [MACHINE] [SERVICE] [STATUS]
 * [WHAT HAPPENED]
 * [WHY IT MAY HAVE HAPPENED]
 * [WHAT SHOULD BE DONE]
 */
function formatSimpleLog(timestamp, machineName, serviceName, status, what, why, action) {
  const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  return `[${timeStr}] [${machineName.toUpperCase()}] [${serviceName.toUpperCase()}] [${status.toUpperCase()}]\n\n${what}\n\nPossible reason: ${why}\n\nSuggested action: ${action}`;
}

module.exports = {
  MACHINES,
  APPROVED_ACTIONS,
  SUGGESTIONS,
  formatSimpleLog
};
