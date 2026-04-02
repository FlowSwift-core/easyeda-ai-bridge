import { useState, useEffect } from 'react';
import { useBridgeStatus, useBridgeEvents, createLogEntry, type LogEntry } from '../hooks/useBridge';
import type { EdaApi, BridgeEvent, BridgeStatus } from '../types/eda';

interface AppProps {
  eda: EdaApi;
  onRequestPairing: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function App({ eda, onRequestPairing, onDisconnect }: AppProps) {
  const { status, mutate } = useBridgeStatus(eda);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPairingCode, setLastPairingCode] = useState('');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [createLogEntry(message, type), ...prev].slice(0, 50));
  };

  useBridgeEvents(eda, (event: BridgeEvent) => {
    if (event.type === 'execute') {
      const code = event.data.code || '';
      addLog(`执行: ${code.substring(0, 50)}${code.length > 50 ? '...' : ''}`, 'info');
    } else if (event.type === 'result') {
      const resultStr = JSON.stringify(event.data.result);
      addLog(`结果: ${resultStr.substring(0, 80)}${resultStr.length > 80 ? '...' : ''}`, 'success');
    } else if (event.type === 'error') {
      addLog(`错误: ${event.data.error || '未知错误'}`, 'error');
    }
  });

  useEffect(() => {
    if (status) {
      const newCode = status.pairingCode || '';
      if (newCode && newCode !== lastPairingCode) {
        setLastPairingCode(newCode);
        addLog(`配对码: ${newCode}`, 'info');
        if (status.url) {
          addLog('连接链接已生成', 'info');
        }
      } else if (!newCode && lastPairingCode) {
        setLastPairingCode('');
      }
    }
  }, [status, lastPairingCode]);

  const getStatusClass = (s: BridgeStatus) => {
    if (s.paired) return 'paired';
    if (s.connectionError) return 'error';
    return 'pending';
  };

  const getStatusText = (s: BridgeStatus) => {
    if (s.paired) return '已配对';
    if (s.connectionError) return '连接失败';
    return '等待配对';
  };

  const handleCopyCode = async () => {
    if (lastPairingCode) {
      await navigator.clipboard.writeText(lastPairingCode);
      addLog('配对码已复制', 'success');
    }
  };

  const handleCopyUrl = async () => {
    if (status?.url) {
      await navigator.clipboard.writeText(status.url);
      addLog('链接已复制', 'success');
    }
  };

  const handleOpenUrl = async () => {
    if (status?.url) {
      await eda.sys_ClientUrl.openUrl(status.url);
      addLog('已打开链接', 'success');
    }
  };

  const handleRequestPairing = async () => {
    addLog('请求配对码...', 'info');
    await onRequestPairing();
    setTimeout(() => mutate(), 500);
  };

  const handleDisconnect = async () => {
    addLog('断开连接...', 'info');
    await onDisconnect();
    setTimeout(() => mutate(), 500);
  };

  const currentStatus = status || { paired: false, connectionError: false };

  return (
    <div className="min-h-screen bg-gh-bg text-gh-text p-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gh-border">
        <h1 className="text-base font-semibold text-gh-white">EasyEDA AI Bridge</h1>
        <span className="text-xs text-gh-muted">v1.0</span>
      </div>

      <div className={`status-bar ${getStatusClass(currentStatus)}`}>
        <span className="status-dot" />
        <span className="flex-1 font-medium">{getStatusText(currentStatus)}</span>
      </div>

      <div className="card">
        <div className="card-title">会话信息</div>
        <div className="info-grid">
          <span className="info-label">Session ID:</span>
          <span className="info-value">{currentStatus.sessionId || '-'}</span>
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
            {currentStatus.url && (
              <div className="mt-3">
                <div className="text-xs text-gh-muted uppercase mb-2">Agent 连接链接</div>
                <div className="url-link" onClick={handleOpenUrl}>
                  {currentStatus.url}
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
          {logs.length === 0 ? (
            <div className="text-gh-muted text-center py-4">暂无日志</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`log-entry ${log.type}`}>
                [{log.time}] {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
