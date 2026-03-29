import * as extensionConfig from '../extension.json';

const DEFAULT_BRIDGE_URL = 'ws://localhost:49620/eda';
const STORAGE_KEY = 'easyeda_bridge_url';
const SOCKET_ID = 'easyeda-ai-bridge-socket';
const MESSAGE_BUS_CHANNEL = 'easyeda-ai-bridge-status';
const RPC_SERVICE_NAME = 'ai-bridge-status';

let windowId = '';
let connected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_INTERVAL_MS = 3000;

function getBridgeUrl(): string {
  try {
    const saved = eda.sys_Storage.getExtensionUserConfig(STORAGE_KEY);
    if (typeof saved === 'string' && saved.trim().length > 0) {
      return saved.trim();
    }
  } catch {}
  return DEFAULT_BRIDGE_URL;
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

function broadcastStatus(connected: boolean): void {
  try {
    setTimeout(() => {
      eda.sys_MessageBus.publishPublic(MESSAGE_BUS_CHANNEL, {
        connected,
        windowId,
        timestamp: Date.now(),
      });
    }, 100);
  } catch (err) {
    console.log('[AI Bridge] Broadcast error:', err);
  }
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

function sendToBridge(msg: unknown): void {
  try {
    eda.sys_WebSocket.send(SOCKET_ID, JSON.stringify(msg));
  } catch (err) {
    console.error('[AI Bridge] Send error:', toSafeErrorMessage(err));
    connected = false;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  console.log(`[AI Bridge] Scheduling reconnect in ${RECONNECT_INTERVAL_MS}ms...`);
  showToast('AI Bridge: 连接断开，3秒后重新连接...', 'error');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToBridge();
  }, RECONNECT_INTERVAL_MS);
}

function disconnect(): void {
  connected = false;
  broadcastStatus(false);
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    eda.sys_WebSocket.close(SOCKET_ID, 1000, 'disconnect');
  } catch {}
}

function connectToBridge(): void {
  disconnect();
  
  const url = getBridgeUrl();
  console.log(`[AI Bridge] Connecting to ${url}...`);
  showToast('AI Bridge: 正在连接...', 'info');

  windowId = `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    eda.sys_WebSocket.register(
      SOCKET_ID,
      url,
      (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('[AI Bridge] Received:', msg.type);

          if (msg.type === 'handshake') {
            console.log('[AI Bridge] Handshake received, sending register...');
            connected = true;
            broadcastStatus(true);
            sendToBridge({
              type: 'register',
              windowId,
            });
            showToast('AI Bridge: 已连接', 'success');
            return;
          }

          if (msg.type === 'execute' && msg.code) {
            const code = msg.code;
            const id = msg.id;
            
            executeCode(code)
              .then(result => {
                sendToBridge({
                  type: 'result',
                  id,
                  result,
                  timestamp: Date.now(),
                });
              })
              .catch(error => {
                sendToBridge({
                  type: 'error',
                  id,
                  error: toSafeErrorMessage(error),
                  timestamp: Date.now(),
                });
              });
            return;
          }

          if (msg.type === 'ping') {
            sendToBridge({ type: 'pong', id: msg.id, timestamp: Date.now() });
            return;
          }

        } catch (err) {
          console.error('[AI Bridge] Message parse error:', err);
        }
      },
      () => {
        console.log('[AI Bridge] WebSocket connected');
      },
    );
  } catch (err) {
    console.error('[AI Bridge] Connection error:', toSafeErrorMessage(err));
    scheduleReconnect();
  }

  // Check connection status periodically
  setTimeout(() => {
    if (!connected) {
      console.log('[AI Bridge] Connection not established, scheduling reconnect...');
      disconnect();
      scheduleReconnect();
    }
  }, 5000);
}

export async function activate(status?: 'onStartupFinished', arg?: string): Promise<void> {
  console.log('[AI Bridge] Activating RPC service...');
  showToast('AI Bridge: 启动中...', 'info');
  
  // Register RPC service for iframe to query status
  eda.sys_MessageBus.rpcServicePublic(RPC_SERVICE_NAME, () => {
    return { connected, windowId };
  });
  
  // Initial connection after a short delay
  setTimeout(() => {
    connectToBridge();
  }, 1500);

  // Heartbeat
  setInterval(() => {
    if (!connected) return;
    try {
      sendToBridge({
        type: 'ping',
        id: `heartbeat_${Date.now()}`,
        timestamp: Date.now(),
      });
    } catch {
      connected = false;
      scheduleReconnect();
    }
  }, 5000);

  // Periodic connection check
  setInterval(() => {
    if (!connected) {
      console.log('[AI Bridge] Not connected, attempting to reconnect...');
      disconnect();
      scheduleReconnect();
    }
  }, 10000);
}

export function about(): void {
  eda.sys_Dialog.showInformationMessage(
    `EasyEDA AI Bridge v${extensionConfig.version}\nConnecting AI Agents to your EDA workspace.`,
    'About AI Bridge',
  );
}

export async function openIFrame(): Promise<void> {
  await eda.sys_IFrame.openIFrame('/dist/index.html', 600, 500, 'ai-bridge-test', {
    maximizeButton: true,
    minimizeButton: true,
    title: 'AI Bridge Test',
  });
}
