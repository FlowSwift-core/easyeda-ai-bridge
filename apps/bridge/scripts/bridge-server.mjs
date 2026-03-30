/**
 * EasyEDA Bridge Server - 6-Digit Pairing + HTTP Only (Hono.js)
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { randomUUID } from 'node:crypto';

const PORT = 49620;
const SERVICE_ID = 'easyeda-bridge';

const PAIR_CODE_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const POLL_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

const pairCodeMap = new Map();
const sessionMap = new Map();
const pendingCommands = new Map(); // Agent → EDA: commands waiting for EDA to poll
const pendingResults = new Map();   // EDA → Agent: results waiting for Agent to collect

function generatePairCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createSession() {
  const sessionId = `sess_${randomUUID().slice(0, 8)}`;
  sessionMap.set(sessionId, {
    createdAt: Date.now(),
    lastActive: Date.now(),
    paired: false,
  });
  return sessionId;
}

function isSessionValid(sessionId) {
  const session = sessionMap.get(sessionId);
  if (!session) return false;
  return Date.now() - session.createdAt < SESSION_TTL_MS;
}

function cleanupExpiredPairCodes() {
  const now = Date.now();
  for (const [code, data] of pairCodeMap) {
    if (now > data.expiresAt) pairCodeMap.delete(code);
  }
}

setInterval(cleanupExpiredPairCodes, 60_000);

function requireSession(getSessionId) {
  return async (c, next) => {
    const sessionId = getSessionId(c);
    console.log(`[MIDDLEWARE] sessionId=${sessionId}, valid=${isSessionValid(sessionId)}`);
    if (!sessionId) {
      return c.json({ error: 'Missing sessionId' }, 400);
    }
    const session = sessionMap.get(sessionId);
    if (!session) {
      console.log(`[MIDDLEWARE] Session not found in map, keys:`, [...sessionMap.keys()]);
    }
    if (!session || !isSessionValid(sessionId)) {
      return c.json({ error: 'Invalid session' }, 401);
    }
    c.set('session', session);
    c.set('sessionId', sessionId);
    return next();
  };
}

const sessionFromHeader = (c) => c.req.header('x-session-id');
const sessionFromParam = (c) => c.req.param('sessionId');

const app = new Hono();

app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
  await next();
});

app.options('*', (c) => c.text('', 204));

app.get('/health', (c) => {
  return c.json({
    service: SERVICE_ID,
    status: 'ok',
    sessions: sessionMap.size,
    timestamp: Date.now(),
  });
});

app.post('/pairing/request', (c) => {
  const code = generatePairCode();
  const sessionId = createSession();
  const now = Date.now();

  pairCodeMap.set(code, { sessionId, expiresAt: now + PAIR_CODE_TTL_MS });

  return c.json({
    success: true,
    code,
    sessionId,
    expiresIn: Math.floor(PAIR_CODE_TTL_MS / 1000),
  });
});

app.post('/pairing/verify', async (c) => {
  const { code } = await c.req.json().catch(() => ({}));

  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: 'Missing "code" field' }, 400);
  }

  const pairData = pairCodeMap.get(code);
  if (!pairData || Date.now() > pairData.expiresAt) {
    return c.json({ success: false, error: '配对码无效或已过期' }, 400);
  }

  pairCodeMap.delete(code);
  const session = sessionMap.get(pairData.sessionId);
  if (session) {
    session.lastActive = Date.now();
    session.paired = true;
  }

  return c.json({
    success: true,
    sessionId: pairData.sessionId,
  });
});

app.post('/execute', requireSession(sessionFromHeader), async (c) => {
  const session = c.get('session');
  const sessionId = c.get('sessionId');
  console.log(`[EXECUTE] sessionId=${sessionId}`);

  const { code } = await c.req.json().catch(() => ({}));
  console.log(`[EXECUTE] code=${code?.substring(0, 50)}`);
  
  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: 'Missing "code" field' }, 400);
  }

  session.lastActive = Date.now();

  const requestId = randomUUID();
  console.log(`[EXECUTE] requestId=${requestId}, storing command for EDA to poll...`);
  pendingCommands.set(sessionId, { requestId, code, timestamp: Date.now() });
  console.log(`[EXECUTE] pendingCommands:`, [...pendingCommands.entries()]);

  const result = await waitForResult(requestId);
  console.log(`[EXECUTE] result received:`, result);

  return c.json({
    success: true,
    result: result.value,
    error: result.error,
    duration: result.duration,
  });
});

app.get('/poll/:sessionId', requireSession(sessionFromParam), (c) => {
  const session = c.get('session');
  const sessionId = c.get('sessionId');

  const cmd = pendingCommands.get(sessionId);
  if (cmd) {
    pendingCommands.delete(sessionId);
    return c.json(cmd);
  }

  return c.json({ noCommand: true, paired: session.paired });
});

app.post('/result', requireSession(sessionFromHeader), async (c) => {
  const session = c.get('session');

  const { requestId, result, error } = await c.req.json().catch(() => ({}));
  if (!requestId) {
    return c.json({ success: false, error: 'Missing requestId' }, 400);
  }

  console.log(`[RESULT] requestId=${requestId}, result=`, result);
  session.lastActive = Date.now();
  pendingResults.set(requestId, { requestId, result, error, timestamp: Date.now() });
  console.log(`[RESULT] pendingResults:`, [...pendingResults.entries()]);

  return c.json({ success: true });
});

function waitForResult(requestId) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const check = setInterval(() => {
      const res = pendingResults.get(requestId);
      if (res) {
        console.log(`[WAIT] Found result for requestId=${requestId}`);
        clearInterval(check);
        pendingResults.delete(requestId);
        resolve({
          value: res.result,
          error: res.error,
          duration: Date.now() - startTime,
        });
        return;
      }
    }, 100);

    setTimeout(() => {
      clearInterval(check);
      console.log(`[WAIT] Timeout for requestId=${requestId}`);
      resolve({ value: null, error: 'Timeout waiting for result', duration: Date.now() - startTime });
    }, 30000);
  });
}

console.log(`Starting server on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         EasyEDA Bridge Server - 6位配对码 (HTTP Only)       ║
╠══════════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                          ║
║  Service ID:  ${SERVICE_ID}                              ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP Endpoints:                                             ║
║    POST /pairing/request - 请求配对码 (EDA调用)                ║
║    POST /pairing/verify  - 验证配对码 (Agent调用)             ║
║    POST /execute         - 执行代码 (Agent调用)               ║
║    GET  /poll/:sessionId - EDA轮询命令                        ║
║    POST /result          - EDA提交结果                        ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
