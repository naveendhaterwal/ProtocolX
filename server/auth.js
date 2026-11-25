const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 minute

const sessions = new Map();
const usedNonces = new Map(); // nonce -> expiresAt
const loginAttempts = new Map(); // ip -> { count, resetAt }

/**
 * Load ADMIN_PASSWORD_HASH from server/.env if not already in process.env
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

/**
 * Hash a plaintext password with a random 16-byte salt using scrypt
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Constant-time verification against stored scrypt$<salt>$<hash>
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, derivedBuf);
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    cookies[name] = val;
  }
  return cookies;
}

/**
 * Rate limit check for login attempts per IP
 */
function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  return entry.count < MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function createSession(username) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const session = {
    id: sessionId,
    user: username,
    csrfToken,
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  sessions.set(sessionId, session);
  return session;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const sid = cookies.protocolx_sid;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sid);
    return null;
  }
  return session;
}

function destroySession(req) {
  const cookies = parseCookies(req);
  const sid = cookies.protocolx_sid;
  if (sid) sessions.delete(sid);
}

function verifyCsrf(session, req) {
  const token = req.headers['x-csrf-token'];
  if (!token || typeof token !== 'string') return false;
  const a = Buffer.from(token);
  const b = Buffer.from(session.csrfToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Replay protection: verifies timestamp is within REPLAY_WINDOW_MS and nonce has not been seen
 */
function verifyAndConsumeNonce(nonce, timestamp) {
  if (!nonce || typeof nonce !== 'string' || nonce.length < 16) {
    return { ok: false, reason: 'Missing or invalid request nonce' };
  }
  const ts = Number(timestamp);
  const now = Date.now();
  if (!Number.isFinite(ts) || Math.abs(now - ts) > REPLAY_WINDOW_MS) {
    return { ok: false, reason: 'Request timestamp expired or outside replay window' };
  }
  // Cleanup expired nonces
  for (const [k, exp] of usedNonces.entries()) {
    if (now > exp) usedNonces.delete(k);
  }
  if (usedNonces.has(nonce)) {
    return { ok: false, reason: 'Replay detected: nonce already used' };
  }
  usedNonces.set(nonce, now + REPLAY_WINDOW_MS);
  return { ok: true };
}

function getStoredPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH || '';
}

module.exports = {
  hashPassword,
  verifyPassword,
  getStoredPasswordHash,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  createSession,
  getSession,
  destroySession,
  verifyCsrf,
  verifyAndConsumeNonce,
  SESSION_TTL_MS
};
