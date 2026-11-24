import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Server, Shield, Activity, RefreshCw, Terminal, 
  CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, 
  Copy, Check, Lock, Play, Cpu, Network, Clock
} from 'lucide-react';

const SOCKET_SERVER = window.location.origin;

export default function App() {
  const [statusData, setStatusData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'suggest' | 'execute' | 'logs'
  const [copiedCmd, setCopiedCmd] = useState(null);

  // Execute modal state
  const [selectedAction, setSelectedAction] = useState(null);
  const [passcode, setPasscode] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.success) setStatusData(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=40');
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/audit?limit=20');
      const data = await res.json();
      if (data.success) setAudits(data.audits);
    } catch (err) {
      console.error('Error fetching audits:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    fetchAudits();

    const socket = io(SOCKET_SERVER);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-dashboard');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('status-update', () => {
      fetchStatus();
    });

    socket.on('new-log', (newLog) => {
      setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    });

    socket.on('audit-event', () => {
      fetchAudits();
    });

    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleExecuteAction = async () => {
    if (!selectedAction || !passcode || !confirmed) return;
    setExecuting(true);
    setExecResult(null);

    try {
      const res = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: selectedAction.id,
          passcode,
          confirmed: true,
          user: 'Naveen (Mac 1)'
        })
      });
      const data = await res.json();
      setExecResult(data);
      fetchAudits();
      fetchStatus();
    } catch (err) {
      setExecResult({ success: false, error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const machines = statusData?.machines || [];
  const suggestions = statusData?.suggestions || [];
  const approvedActions = statusData?.approvedActions || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">ProtocolX Central Monitor</h1>
              <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                Phase 2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Host: <span className="font-mono text-slate-300">Mac 1 (Naveen)</span> · Active IP: <span className="font-mono text-emerald-400 font-semibold">10.7.11.221</span>
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Real-time Indicator */}
        <div className="flex items-center gap-4">
          <nav className="flex bg-slate-800/60 p-1 rounded-lg border border-slate-700/50 text-sm">
            {[
              { id: 'overview', label: 'Overview & Nodes' },
              { id: 'suggest', label: `Suggest Mode (${suggestions.length})`, badge: suggestions.length > 0 },
              { id: 'execute', label: 'Execute Mode' },
              { id: 'logs', label: 'Plain Logs' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-rose-500 animate-ping'}`} />
            <span className={connected ? 'text-emerald-400' : 'text-rose-400'}>
              {connected ? 'LIVE WEBSOCKET' : 'CONNECTING'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner if suggestions exist */}
        {suggestions.length > 0 && activeTab !== 'suggest' && (
          <div 
            onClick={() => setActiveTab('suggest')}
            className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between cursor-pointer hover:bg-amber-950/60 transition"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  {suggestions.length} Active System {suggestions.length === 1 ? 'Anomaly' : 'Anomalies'} Detected
                </p>
                <p className="text-xs text-amber-300/80">
                  Click to open Suggest Mode with diagnostic commands and plain-English troubleshooting.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-amber-400" />
          </div>
        )}

        {/* Tab 1: Overview & 4-Machine Grid */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-indigo-400" />
                Four-Machine Physical Network Topology
              </h2>
              <p className="text-sm text-slate-400">
                Continuous health inspection across private subnet <code className="text-indigo-300">10.7.0.0/19</code>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {machines.map((m) => {
                const isOnline = m.isOnline;
                const health = m.calculatedHealth;

                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-5 bg-slate-900/60 backdrop-blur flex flex-col justify-between transition relative overflow-hidden ${
                      health === 'HEALTHY'
                        ? 'border-emerald-500/30 shadow-emerald-500/5'
                        : health === 'DEGRADED'
                        ? 'border-amber-500/40 shadow-amber-500/5'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-white text-base">{m.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{m.role}</p>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            health === 'HEALTHY'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : health === 'DEGRADED'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {health}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs font-mono flex items-center justify-between">
                        <span className="text-slate-400">Assigned IP</span>
                        <span className="text-indigo-300 font-bold">{m.ip}</span>
                      </div>

                      {/* Services breakdown */}
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Monitored Ports & Services
                        </p>
                        {m.services && m.services.length > 0 ? (
                          m.services.map((srv) => (
                            <div
                              key={srv.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-slate-800/40 border border-slate-800"
                            >
                              <div className="flex items-center gap-2">
                                {srv.status === 'HEALTHY' || srv.status === 'ONLINE' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span className="text-slate-200">{srv.name}</span>
                              </div>
                              <span className="font-mono text-slate-400">:{srv.port}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500 italic">No services registered yet</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Heartbeat</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {m.last_seen ? `${Math.round((Date.now() - m.last_seen) / 1000)}s ago` : 'Never'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions & Recent Log Snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
              <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Latest Network Event Logs (Simple English)
                  </h3>
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    View All Logs →
                  </button>
                </div>

                <div className="space-y-3">
                  {logs.slice(0, 3).map((l, idx) => (
                    <div key={idx} className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-300">
                          [{new Date(l.timestamp).toLocaleTimeString()}] [{l.machine_name || l.machine_id}] [{l.service}]
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          l.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                          l.status === 'ERROR' ? 'bg-rose-500/10 text-rose-400' :
                          l.status === 'RECOVERED' ? 'bg-cyan-500/10 text-cyan-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {l.status}
                        </span>
                      </div>
                      <p className="text-slate-200 font-medium">{l.what}</p>
                      {l.why && <p className="text-slate-400"><strong className="text-slate-300">Possible reason:</strong> {l.why}</p>}
                      {l.action && <p className="text-indigo-300"><strong className="text-indigo-200">Suggested action:</strong> {l.action}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Execute Actions Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Quick Approved Operations
                </h3>
                <p className="text-xs text-slate-400">
                  Approved administrative tasks. Actions require authentication and create immutable audit logs.
                </p>

                <div className="space-y-2">
                  {approvedActions.slice(0, 4).map((act) => (
                    <button
                      key={act.id}
                      onClick={() => {
                        setSelectedAction(act);
                        setActiveTab('execute');
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-200">{act.label}</span>
                      <Play className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Suggest Mode */}
        {activeTab === 'suggest' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                Suggest Mode — Diagnostic Guidance & Command Generator
              </h2>
              <p className="text-sm text-slate-400">
                Automated failure analysis mapping live anomalies to copyable verification and remediation commands.
              </p>
            </div>

            {suggestions.length === 0 ? (
              <div className="p-8 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">All Systems Operational</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No active failures detected. DNS, Nginx edge, and backend application microservices are reporting healthy status.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="rounded-xl border border-amber-500/40 bg-slate-900/80 p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{s.problem}</h3>
                          <p className="text-xs text-amber-300/90 mt-0.5">
                            <strong>Possible Cause:</strong> {s.possibleCause}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Diagnostic Command Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span>Diagnostic Command (Click to copy)</span>
                        <span className="text-[11px] font-normal text-slate-500">Run in macOS Terminal</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-emerald-400 overflow-x-auto">
                        <code>{s.diagnosticCommand}</code>
                        <button
                          onClick={() => copyToClipboard(s.diagnosticCommand, `sugg_${idx}`)}
                          className="ml-3 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
                          title="Copy command"
                        >
                          {copiedCmd === `sugg_${idx}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Command explanation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="font-semibold text-slate-300 block mb-1">What this command does:</span>
                        <p className="text-slate-400">{s.whatCommandDoes}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="font-semibold text-slate-300 block mb-1">Expected healthy output:</span>
                        <p className="text-slate-400">{s.expectedResult}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs">
                      <strong className="text-indigo-300">Suggested Action:</strong>{' '}
                      <span className="text-slate-300">{s.suggestedAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Execute Mode */}
        {activeTab === 'execute' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Execute Mode — Authenticated Remote Service Management
              </h2>
              <p className="text-sm text-slate-400">
                Safely trigger whitelisted recovery and audit actions across all four laptops. Arbitrary shell commands are disabled by design.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Approved Actions Catalog */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Approved Actions Catalog
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {approvedActions.map((act) => {
                    const isSelected = selectedAction?.id === act.id;
                    return (
                      <div
                        key={act.id}
                        onClick={() => {
                          setSelectedAction(act);
                          setExecResult(null);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-indigo-300">
                              {act.targetMachine.toUpperCase()}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              act.riskLevel === 'LOW' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {act.riskLevel} RISK
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-sm">{act.label}</h4>
                          <p className="text-xs text-slate-400">{act.description}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                          <code>{act.commandPreview}</code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execution Authorization Console */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Authorization Console
                </h3>

                {selectedAction ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <span className="text-slate-400">Selected Action:</span>
                      <p className="font-bold text-white">{selectedAction.label}</p>
                      <p className="text-slate-400">{selectedAction.description}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-300">Admin Passcode</label>
                      <input
                        type="password"
                        placeholder="protocolx-admin"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="confirmAction"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                      />
                      <label htmlFor="confirmAction" className="text-xs text-slate-300 select-none cursor-pointer">
                        Confirm execution on {selectedAction.targetMachine.toUpperCase()}
                      </label>
                    </div>

                    <button
                      disabled={!passcode || !confirmed || executing}
                      onClick={handleExecuteAction}
                      className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                    >
                      {executing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Executing remotely...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Execute Approved Action
                        </>
                      )}
                    </button>

                    {execResult && (
                      <div className={`p-3 rounded-lg border text-xs font-mono mt-3 space-y-1 ${
                        execResult.success ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5">
                          {execResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {execResult.success ? 'Execution Succeeded' : 'Execution Failed'}
                        </div>
                        <pre className="whitespace-pre-wrap text-[11px] mt-1 text-slate-300">
                          {execResult.result?.details || execResult.error}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Select an approved action from the catalog to configure and execute.</p>
                )}
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
              <h3 className="font-semibold text-white text-sm">Security Audit Trail (Execute Mode Log)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Operator</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Target</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Result / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {audits.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-400">{new Date(a.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 px-3 text-slate-300 font-sans">{a.user}</td>
                        <td className="py-2 px-3 text-indigo-300">{a.action_id}</td>
                        <td className="py-2 px-3 text-slate-300">{a.target_machine.toUpperCase()}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 max-w-xs truncate">{a.details || '-'}</td>
                      </tr>
                    ))}
                    {audits.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-4 text-center text-slate-500">No actions executed yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Plain English Logs Stream */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Live Event Log Stream (Simple English)
                </h2>
                <p className="text-sm text-slate-400">
                  Formatted strictly according to ProtocolX 4-line logging standards.
                </p>
              </div>
              <button 
                onClick={fetchLogs}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            <div className="space-y-3 font-mono">
              {logs.map((l, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-sm">
                      [{new Date(l.timestamp).toLocaleTimeString()}] [{l.machine_name || l.machine_id}] [{l.service}] [{l.status}]
                    </span>
                    <span className={`px-2.5 py-0.5 rounded font-bold text-xs ${
                      l.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      l.status === 'ERROR' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      l.status === 'RECOVERED' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {l.status}
                    </span>
                  </div>

                  <p className="text-slate-100 font-sans text-sm leading-relaxed">{l.what}</p>
                  
                  {l.why && (
                    <p className="text-slate-400 font-sans text-xs">
                      <strong className="text-slate-300">Possible reason:</strong> {l.why}
                    </p>
                  )}

                  {l.action && (
                    <p className="text-indigo-300 font-sans text-xs">
                      <strong className="text-indigo-200">Suggested action:</strong> {l.action}
                    </p>
                  )}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-8 text-center text-slate-500">No logs collected yet.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
