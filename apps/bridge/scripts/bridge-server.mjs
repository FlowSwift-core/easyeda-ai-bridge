/**
 * EasyEDA Bridge Server - 6-Digit Pairing + SQLite Queue
 */

import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';

const PAIRING_TEMPLATE = readFileSync('./public/instruction.md', 'utf-8');

function renderPairingTemplate(code, expires) {
  const minutes = Math.floor(expires / 60);
  const expiresText = expires > 0 ? `${minutes}分钟内有效` : '无效';
  const codeDisplay = (code && code.length === 6) ? code : '------';
  
  return PAIRING_TEMPLATE
    .replace(/{code}/g, codeDisplay)
    .replace(/{expires}/g, expiresText);
}
import { initDatabase, getDb, closeDatabase } from './db.mjs';

const PORT = 49620;
const SERVICE_ID = 'easyeda-bridge';
const HOST = process.env.HOST || 'http://localhost:49620';
const INSTRUCTION_PATH = process.env.INSTRUCTION_PATH || '/instruction';

const PAIR_CODE_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const POLL_TIMEOUT_MS = 30_000;
const PAIRING_BUFFER_MS = 60 * 1000;

const VERIFY_BUFFER_MS = 60 * 1000;

function generatePairCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createSession() {
  const sessionId = `sess_${randomUUID().slice(0, 8)}`;
  const db = getDb();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO sessions (session_id, status, created_at, last_active)
    VALUES (?, 'pending', ?, ?)
  `).run(sessionId, now, now);
  
  return sessionId;
}

function getSession(sessionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
}

function isSessionValid(sessionId) {
  const session = getSession(sessionId);
  if (!session) return false;
  return Date.now() - session.created_at < SESSION_TTL_MS;
}

function updateSession(sessionId, updates) {
  const db = getDb();
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), Date.now(), sessionId];
  db.prepare(`UPDATE sessions SET ${fields}, last_active = ? WHERE session_id = ?`).run(...values);
}

function cleanupExpiredSessions() {
  const db = getDb();
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE created_at < ?').run(now - SESSION_TTL_MS);
  db.prepare('DELETE FROM commands WHERE created_at < ?').run(now - 3600 * 1000);
}

setInterval(cleanupExpiredSessions, 60_000);

function requireSession(getSessionId) {
  return async (c, next) => {
    const sessionId = getSessionId(c);
    if (!sessionId) {
      return c.json({ error: 'Missing sessionId' }, 400);
    }
    if (!isSessionValid(sessionId)) {
      return c.json({ error: 'Invalid session' }, 401);
    }
    c.set('sessionId', sessionId);
    return next();
  };
}

const sessionFromHeader = (c) => c.req.header('x-session-id');
const sessionFromParam = (c) => c.req.param('sessionId');

const app = new Hono();

app.use('/pairing.html', serveStatic({ root: './public' }));

app.get('/instruction', (c) => {
  const code = c.req.query('code') || '';
  const expires = parseInt(c.req.query('expires') || '0', 10);
  const html = renderPairingTemplate(code, expires);
  
  return c.text(html, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
  await next();
});

app.options('*', (c) => c.text('', 204));

app.get('/health', (c) => {
  const db = getDb();
  const sessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
  return c.json({
    service: SERVICE_ID,
    status: 'ok',
    sessions: sessions.count,
    timestamp: Date.now(),
  });
});

app.post('/pairing/request', (c) => {
  const code = generatePairCode();
  const sessionId = createSession();
  const now = Date.now();
  const expiresIn = Math.floor(PAIR_CODE_TTL_MS / 1000);
  
  const db = getDb();
  db.prepare(`
    UPDATE sessions SET pair_code = ?, status = 'pending'
    WHERE session_id = ?
  `).run(code, sessionId);

  console.log(`[PAIRING] Request: code=${code}, sessionId=${sessionId}`);

  return c.json({
    success: true,
    code,
    sessionId,
    expiresIn,
    url: `${HOST}/instruction?code=${code}&expires=${expiresIn}`,
  });
});

app.post('/pairing/verify', async (c) => {
  const { code } = await c.req.json().catch(() => ({}));
  const db = getDb();

  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: 'Missing "code" field' }, 400);
  }

  let session = db.prepare('SELECT * FROM sessions WHERE pair_code = ? AND status = ?').get(code, 'pending');
  
  if (!session) {
    const sessionsWithCode = db.prepare('SELECT * FROM sessions WHERE pair_code = ?').all(code);
    if (sessionsWithCode.length > 0) {
      session = sessionsWithCode.find(s => s.status === 'verified' && s.verified_at && (Date.now() - s.verified_at < VERIFY_BUFFER_MS));
      if (session) {
        updateSession(session.session_id, { last_active: Date.now() });
        console.log(`[PAIRING] Verify cached: sessionId=${session.session_id}`);
        return c.json({
          success: true,
          sessionId: session.session_id,
          cached: true,
        });
      }
    }
    console.log(`[PAIRING] Verify failed: code=${code} not found`);
    return c.json({ success: false, error: '配对码无效或已过期' }, 400);
  }

  db.prepare(`
    UPDATE sessions SET pair_code = NULL, status = 'verified', verified_at = ?
    WHERE session_id = ?
  `).run(Date.now(), session.session_id);

  console.log(`[PAIRING] Verified: sessionId=${session.session_id}`);

  return c.json({
    success: true,
    sessionId: session.session_id,
  });
});

app.post('/execute', requireSession(sessionFromHeader), async (c) => {
  const sessionId = c.get('sessionId');

  const { code } = await c.req.json().catch(() => ({}));
  
  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: 'Missing "code" field' }, 400);
  }

  updateSession(sessionId, { last_active: Date.now() });

  const requestId = randomUUID();
  const db = getDb();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO commands (request_id, session_id, code, status, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).run(requestId, sessionId, code, now, now);

  console.log(`[EXEC] requestId=${requestId}, code=${code.substring(0, 50)}`);

  const result = await waitForResult(requestId);

  console.log(`[EXEC] result: requestId=${requestId}, duration=${result.duration}ms, error=${result.error}`);

  return c.json({
    success: true,
    result: result.value,
    error: result.error,
    duration: result.duration,
  });
});

app.get('/poll/:sessionId', requireSession(sessionFromParam), (c) => {
  const sessionId = c.get('sessionId');
  const db = getDb();

  const cmd = db.prepare(`
    SELECT request_id, code FROM commands 
    WHERE session_id = ? AND status = 'pending' 
    ORDER BY created_at ASC LIMIT 1
  `).get(sessionId);

  if (cmd) {
    db.prepare(`UPDATE commands SET status = 'processing', updated_at = ? WHERE request_id = ?`).run(Date.now(), cmd.request_id);
    console.log(`[POLL] Got command: requestId=${cmd.request_id}, code=${cmd.code?.substring(0, 30)}`);
    return c.json(cmd);
  }

  const session = getSession(sessionId);
  const paired = session?.status === 'verified';
  return c.json({ noCommand: true, paired });
});

app.post('/result', requireSession(sessionFromHeader), async (c) => {
  const { requestId, result, error } = await c.req.json().catch(() => ({}));
  if (!requestId) {
    return c.json({ success: false, error: 'Missing requestId' }, 400);
  }

  const db = getDb();
  
  db.prepare(`
    UPDATE commands SET result = ?, error = ?, status = ?, updated_at = ?
    WHERE request_id = ?
  `).run(
    result ? JSON.stringify(result) : null,
    error || null,
    error ? 'error' : 'done',
    Date.now(),
    requestId
  );

  console.log(`[RESULT] requestId=${requestId}, status=${error ? 'error' : 'done'}`);

  updateSession(c.get('sessionId'), { last_active: Date.now() });

  return c.json({ success: true });
});

function waitForResult(requestId) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const db = getDb();
    
    const check = () => {
      const res = db.prepare('SELECT * FROM commands WHERE request_id = ?').get(requestId);
      if (res && (res.status === 'done' || res.status === 'error')) {
        db.prepare('DELETE FROM commands WHERE request_id = ?').run(requestId);
        resolve({
          value: res.result ? JSON.parse(res.result) : null,
          error: res.error,
          duration: Date.now() - startTime,
        });
        return true;
      }
      return false;
    };

    if (check()) return;

    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      resolve({ value: null, error: 'Timeout waiting for result', duration: Date.now() - startTime });
    }, POLL_TIMEOUT_MS);
  });
}

initDatabase();

console.log(`Starting server on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         EasyEDA Bridge Server - 6位配对码 (SQLite)           ║
╠══════════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                          ║
║  Service ID:  ${SERVICE_ID}                              ║
║  SQLite:      队列持久化 + 60秒配对缓冲                         ║
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

process.on('exit', () => closeDatabase());
process.on('SIGINT', () => { closeDatabase(); process.exit(0); });
