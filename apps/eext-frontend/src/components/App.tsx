import { useCallback } from 'react';
import { useBridge } from '../hooks/useBridge';
import type { BridgeEvent } from '../types/eda';

interface AppProps {
  eda: import('../types/eda').EdaApi;
  onRequestPairing: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function App({ eda, onRequestPairing, onDisconnect }: AppProps) {
  const { state } = useBridge();
  const { status, events } = state;

  const getStatusClass = useCallback((s: typeof status) => {
    if (s.paired) return 'paired';
    if (s.connectionError) return 'error';
    return 'pending';
  }, []);

  const getStatusText = useCallback((s: typeof status) => {
    if (s.paired) return '已配对';
    if (s.connectionError) return '连接失败';
    return '等待配对';
  }, []);

  const handleCopyUrl = async () => {
    if (status.url) {
      await navigator.clipboard.writeText(status.url);
    }
  };

  const handleCopyCode = async () => {
    if (status.pairingCode) {
      await navigator.clipboard.writeText(status.pairingCode);
    }
  };

  const handleOpenUrl = async () => {
    if (status.url) {
      eda.sys_Window.open(status.url);
    }
  };

  const handleRequestPairing = async () => {
    await onRequestPairing();
  };

  const handleDisconnect = async () => {
    await onDisconnect();
  };

  return (
    <div className="min-h-screen bg-gh-bg text-gh-text p-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gh-border">
        <h1 className="text-base font-semibold text-gh-white">EasyEDA AI Bridge</h1>
        <span className="text-xs text-gh-muted">v1.0</span>
      </div>

      <div className={`status-bar ${getStatusClass(status)}`}>
        <span className="status-dot" />
        <span className="flex-1 font-medium">{getStatusText(status)}</span>
      </div>

      <div className="card">
        <div className="card-title">会话信息</div>
        <div className="info-grid">
          <span className="info-label">Session ID:</span>
          <span className="info-value">{status.sessionId || '-'}</span>
        </div>
      </div>

      {status.url && status.pairingCode && (
        <div className="card">
          <div className="card-title">配对信息</div>
          
          <div className="mb-4">
            <div className="text-xs text-gh-muted mb-1">方式一：链接配对（推荐）</div>
            <div className="text-xs text-gh-muted mb-2">直接发链接给 Agent 打开即可自动配对</div>
            <div className="url-link break-all">{status.url}</div>
          </div>

          <div className="mb-3">
            <div className="text-xs text-gh-muted mb-1">方式二：配对码</div>
            <div className="text-xs text-gh-muted mb-2">Agent 调用 /pairing/verify API 验证</div>
            <div className="pairing-code">{status.pairingCode}</div>
            <button className="btn btn-secondary mt-2" onClick={handleCopyCode}>
              复制配对码
            </button>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={handleOpenUrl}>
              打开配对页面
            </button>
            <button className="btn btn-secondary flex-1" onClick={handleCopyUrl}>
              复制链接
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button className="btn btn-primary flex-1" onClick={handleRequestPairing}>
          请求配对码
        </button>
        <button className="btn btn-danger flex-1" onClick={handleDisconnect}>
          断开连接
        </button>
      </div>

      <div className="card mt-3">
        <div className="text-xs text-gh-muted uppercase mb-2">日志</div>
        <div className="log-container">
          {events.length === 0 ? (
            <div className="text-gh-muted text-center py-4">暂无日志</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className={`log-entry ${event.type}`}>
                {event.type === 'execute' && `[执行] ${(event.data?.code || '').substring(0, 50)}...`}
                {event.type === 'result' && `[结果] ${JSON.stringify(event.data?.result || '').substring(0, 80)}...`}
                {event.type === 'error' && `[错误] ${event.data?.error || '未知错误'}`}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
