import { VERSION } from './version';

const _BRIDGE_URL: string = '__BRIDGE_URL_PLACEHOLDER__';

export async function activate(status?: 'onStartupFinished', arg?: string): Promise<void> {
  if (isInitialized) {
    console.log('[AI Bridge] Already initialized, skipping...');
    return;
  }
  isInitialized = true;
  
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
    if (action === 'poll') {
      pollCommands();
      return { success: true };
    }
    return { paired, sessionId, pairingCode, connectionError };
  });
}

export function about(): void {
  eda.sys_Dialog.showInformationMessage(
    `EasyEDA AI Bridge v${VERSION}\n6位配对码方案\n连接AI Agents到你的EDA工作区`,
    'About AI Bridge',
  );
}

export async function openIFrame(): Promise<void> {
  await eda.sys_IFrame.openIFrame('/dist/index.html', 600, 800, 'ai-bridge-launch', {
    maximizeButton: true,
    minimizeButton: true,
    title: 'EasyEDA AI Bridge',
  });
}

const STORAGE_KEY_SESSION = 'easyeda_ai_session_id';
const MESSAGE_BUS_CHANNEL = 'easyeda-ai-bridge-status';
const MESSAGE_BUS_EVENTS = 'easyeda-ai-bridge-events';
const RPC_SERVICE_NAME = 'ai-bridge-status';

let sessionId = '';
let paired = false;
let pairingCode = '';
let pairingExpiresAt = 0;
let hasShownPairedToast = false;
let connectionError = false;
let isInitialized = false;

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
  return _BRIDGE_URL;
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
    const toastType = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
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
  if (typeof value === 'bigint') return { __type: 'bigint', value: value.toString() };
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (depth >= 10) return '[MaxDepthExceeded]';

  const tracked = seen ?? new WeakSet<object>();
  if (typeof value === 'object' && value !== null) {
    if (tracked.has(value)) return '[Circular]';
    tracked.add(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 500).map(item => toSerializable(item, depth + 1, tracked));
  }

  if (value instanceof Date) return { __type: 'Date', value: value.toISOString() };
  if (value instanceof RegExp) return { __type: 'RegExp', value: value.toString() };
  if (value instanceof Error) return { __type: 'Error', name: value.name, message: value.message, stack: value.stack };
  if (value instanceof URL) return { __type: 'URL', value: value.href };
  if (value instanceof Map) return { __type: 'Map', entries: Array.from(value.entries()).map(([k, v]) => [toSerializable(k, depth + 1, tracked), toSerializable(v, depth + 1, tracked)]) };
  if (value instanceof Set) return { __type: 'Set', values: Array.from(value).map(v => toSerializable(v, depth + 1, tracked)) };

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return { __type: value.constructor.name, value: Array.from(bytes) };
  }

  if (typeof value === 'object' && value !== null) {
    const output: Record<string, unknown> = {};
    const isPlain = value.constructor === Object;
    const keys = isPlain ? Object.keys(value) : Object.getOwnPropertyNames(value).filter(k => k !== 'constructor' && k !== '__proto__');
    for (const key of keys) {
      try {
        output[key] = toSerializable((value as Record<string, unknown>)[key], depth + 1, tracked);
      } catch {
        output[key] = '[Unserializable]';
      }
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

function disconnectBridge(): void {
  sessionId = '';
  paired = false;
  connectionError = false;
  clearSessionId();
  broadcastStatus({ paired: false, sessionId: '', connectionError: false });
}

async function requestPairingCode(): Promise<void> {
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
      clearSessionId();
      sessionId = '';
      showToast('会话已失效，请重新请求配对码', 'error');
    }
    broadcastStatus({ paired, sessionId, connectionError: true });
  }
}
