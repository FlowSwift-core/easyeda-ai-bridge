import * as extensionConfig from '../../extension/extension.json';

export async function activate(status?: 'onStartupFinished', arg?: string): Promise<void> {
  console.log('[AI Bridge] === ACTIVATE START ===');
  console.log('[AI Bridge] Activating...');
  showToast('AI Bridge: 启动中...', 'info');

  sessionId = getSessionId();

  eda.sys_MessageBus.rpcServicePublic(RPC_SERVICE_NAME, (action?: string) => {
    if (action === 'requestPairing') {
      requestPairingCode();
      return { success: true };
    }
    if (action === 'disconnect') {
      disconnectBridge();
      return { success: true };
    }
    return { paired, sessionId, pairingCode, connectionError };
  });

  setTimeout(() => {
    if (sessionId) {
      startEdaPolling();
      checkPairedStatus();
    }
  }, 2000);
}

export function about(): void {
  eda.sys_Dialog.showInformationMessage(
    `EasyEDA AI Bridge v${extensionConfig.version}\n6位配对码方案\n连接AI Agents到你的EDA工作区`,
    'About AI Bridge',
  );
}

export async function openIFrame(): Promise<void> {
  await eda.sys_IFrame.openIFrame('/dist/index.html', 600, 500, 'ai-bridge-launch', {
    maximizeButton: true,
    minimizeButton: true,
    title: 'Launch AI Bridge',
  });
}

const DEFAULT_BRIDGE_URL = 'http://localhost:49620';
const STORAGE_KEY_SESSION = 'easyeda_ai_session_id';
const MESSAGE_BUS_CHANNEL = 'easyeda-ai-bridge-status';
const MESSAGE_BUS_EVENTS = 'easyeda-ai-bridge-events';
const RPC_SERVICE_NAME = 'ai-bridge-status';

let sessionId = '';
let paired = false;
let pairingCode = '';
let pairingExpiresAt = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let hasShownPairedToast = false;
let connectionError = false;

function getStored(key: string, def = ''): string {
  try {
    const val = eda.sys_Storage.getExtensionUserConfig(key);
    return typeof val === 'string' ? val.trim() : def;
  } catch {}
  return def;
}

function setStored(key: string, val: string): void {
  try { eda.sys_Storage.setExtensionUserConfig(key, val); } catch {}
}

function getBridgeUrl(): string {
  return getStored('easyeda_bridge_url', DEFAULT_BRIDGE_URL);
}

function getSessionId(): string {
  return getStored(STORAGE_KEY_SESSION, '');
}

function saveSessionId(id: string): void {
  setStored(STORAGE_KEY_SESSION, id);
}

function clearSessionId(): void {
  setStored(STORAGE_KEY_SESSION, '');
}

function toSafeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  try {
    const toastType = type === 'success' ? 1 : type === 'error' ? 2 : 0;
    eda.sys_Message.showToastMessage(message, toastType as any, 3);
  } catch (err) {
    console.log(`[AI Bridge] ${message}`);
  }
}

function broadcast(channel: string, payload: object): void {
  try {
    setTimeout(() => {
      eda.sys_MessageBus.publishPublic(channel, { ...payload, timestamp: Date.now() });
    }, channel === MESSAGE_BUS_CHANNEL ? 100 : 0);
  } catch (err) {
    console.log('[AI Bridge] Broadcast error:', err);
  }
}

function broadcastStatus(data: { paired: boolean; sessionId?: string; pairingCode?: string; url?: string; connectionError?: boolean }): void {
  broadcast(MESSAGE_BUS_CHANNEL, data);
}

function broadcastEvent(type: string, data: unknown): void {
  broadcast(MESSAGE_BUS_EVENTS, { type, data });
}

function toSerializable(value: unknown, depth = 0, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (depth >= 4) return '[MaxDepthExceeded]';

  const tracked = seen ?? new WeakSet<object>();
  if (typeof value === 'object') {
    if (tracked.has(value as object)) return '[Circular]';
    tracked.add(value as object);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 120).map(item => toSerializable(item, depth + 1, tracked));
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = toSerializable(child, depth + 1, tracked);
    }
    return output;
  }

  return String(value);
}

async function executeCode(code: string): Promise<unknown> {
  const fn = new Function('eda', 'return ' + code);
  const result = await fn(eda);
  return toSerializable(result);
}

async function httpRequest(method: string, path: string, body?: object): Promise<unknown> {
  const url = `${getBridgeUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await eda.sys_ClientUrl.request(
    url,
    method as any,
    body ? JSON.stringify(body) : undefined,
    { headers }
  );

  if (!response.ok) {
    const msg = response.status === 401 ? 'Unauthorized' : `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  paired = false;
  connectionError = false;
}

function disconnectBridge(): void {
  stopPolling();
  connectionError = false;
  broadcastStatus({ paired: false, sessionId, connectionError: false });
}

async function requestPairingCode(): Promise<void> {
  stopPolling();
  clearSessionId();
  sessionId = '';
  pairingCode = '';
  paired = false;
  connectionError = false;
  
  try {
    const result = await httpRequest('POST', '/pairing/request') as any;
    if (result.success) {
      pairingCode = result.code;
      sessionId = result.sessionId;
      pairingExpiresAt = Date.now() + result.expiresIn * 1000;
      saveSessionId(sessionId);
      showToast(`配对码: ${pairingCode}`, 'info');
      broadcastStatus({ paired: false, sessionId, pairingCode, url: result.url, connectionError: false });
      startEdaPolling();
    }
  } catch (err) {
    console.error('[AI Bridge] Request pairing failed:', err);
    showToast('请求配对码失败', 'error');
  }
}

async function pollCommands(): Promise<void> {
  if (!sessionId) return;

  if (pairingCode && Date.now() > pairingExpiresAt) {
    showToast('配对码已过期', 'error');
    stopPolling();
    pairingCode = '';
    sessionId = '';
    clearSessionId();
    broadcastStatus({ paired: false, sessionId: '', connectionError: false });
    return;
  }

  try {
    const result = await httpRequest('GET', `/poll/${sessionId}`) as any;
    connectionError = false;

    if (result.paired && !paired) {
      paired = true;
      pairingCode = '';
      if (!hasShownPairedToast) {
        hasShownPairedToast = true;
        showToast('配对成功!', 'success');
      }
      broadcastStatus({ paired, sessionId, connectionError: false });
    }

    if (result.request_id && result.code) {
      const startTime = Date.now();
      const id = result.request_id;
      const code = result.code;

      broadcastEvent('execute', { id, code });

      try {
        const execResult = await executeCode(code);
        const duration = Date.now() - startTime;
        broadcastEvent('result', { id, result: execResult, duration });

        await httpRequest('POST', '/result', { requestId: id, result: execResult });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = toSafeErrorMessage(error);
        broadcastEvent('error', { id, error: errorMsg, duration });

        await httpRequest('POST', '/result', { requestId: id, error: errorMsg });
      }
    }
  } catch (err: any) {
    console.error('[AI Bridge] Poll error:', err);
    connectionError = true;
    if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
      console.log('[POLL] Session invalid, clearing...');
      stopPolling();
      clearSessionId();
      sessionId = '';
      showToast('会话已失效，请重新请求配对码', 'error');
    }
    broadcastStatus({ paired, sessionId, connectionError: true });
  }
}

function startEdaPolling(): void {
  if (pollTimer) return;

  pollTimer = setInterval(() => {
    pollCommands();
  }, 1000);
}

async function checkPairedStatus(): Promise<void> {
  if (!sessionId) return;
  try {
    const result = await httpRequest('GET', `/poll/${sessionId}`) as any;
    connectionError = false;
    if (result.paired) {
      paired = true;
      broadcastStatus({ paired, sessionId, connectionError: false });
    }
  } catch (e) {
    console.log('[AI Bridge] Check paired status failed:', e);
    connectionError = true;
    broadcastStatus({ paired, sessionId, connectionError: true });
  }
}
