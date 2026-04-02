import { useState, useEffect, useCallback } from 'react';
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
  const [lastPairingCode, setLastPairingCode] = useState('');

  useEffect(() => {
    const newCode = status.pairingCode || '';
    if (newCode && newCode !== lastPairingCode) {
      setLastPairingCode(newCode);
    } else if (!newCode && lastPairingCode) {
      setLastPairingCode('');
    }
  }, [status.pairingCode, lastPairingCode]);

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

  const handleCopyCode = async () => {
    if (lastPairingCode) {
      await navigator.clipboard.writeText(lastPairingCode);
    }
  };

  const handleCopyUrl = async () => {
    if (status.url) {
      await navigator.clipboard.writeText(status.url);
    }
  };

  const handleOpenUrl = async () => {
    if (status.url) {
      await eda.sys_ClientUrl.openUrl(status.url);
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

      {lastPairingCode && (
        <div className="card">
          <div className="text-center py-4">
            <div className="text-xs text-gh-muted uppercase mb-2">配对码</div>
            <div className="pairing-code">{lastPairingCode}</div>
            <div className="text-xs text-gh-muted mb-3">在 Agent 端输入配对码完成配对</div>
            <button className="btn btn-secondary" onClick={handleCopyCode}>
              复制配对码
            </button>
            {status.url && (
              <div className="mt-3">
                <div className="text-xs text-gh-muted uppercase mb-2">Agent 连接链接</div>
                <div className="url-link" onClick={handleOpenUrl}>
                  {status.url}
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-secondary flex-1" onClick={handleOpenUrl}>
                    打开配对页面
                  </button>
                  <button className="btn btn-secondary flex-1" onClick={handleCopyUrl}>
                    复制链接
                  </button>
                </div>
              </div>
            )}
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
